/**
 * 获取静态资源
 * @param {string} url 静态资源地址
 */
function fetchSource(url) {
    return fetch(url).then((res) => {
        return res.text();
    });
}

// 子应用的样式作用域处理
let templateStyle = null; // 模版sytle
function scopedCSS(styleElement, appName) {
    var _a, _b;
    const prefix = `picocontainer-app[name=${appName}]`;
    if (!templateStyle) {
        templateStyle = document.createElement('style');
        document.body.appendChild(templateStyle);
        // 设置样式表无效，防止对应用造成影响
        templateStyle.sheet.disabled = true;
    }
    if (styleElement.textContent) {
        templateStyle.textContent = styleElement.textContent;
        styleElement.textContent = scopedRule(Array.from((_b = (_a = templateStyle.sheet) === null || _a === void 0 ? void 0 : _a.cssRules) !== null && _b !== void 0 ? _b : []), prefix);
        templateStyle.textContent = '';
    }
    else {
        // 监听动态添加内容的style元素
        const observer = new MutationObserver(() => {
            var _a, _b;
            observer.disconnect();
            styleElement.textContent = scopedRule(Array.from((_b = (_a = styleElement.sheet) === null || _a === void 0 ? void 0 : _a.cssRules) !== null && _b !== void 0 ? _b : []), prefix);
        });
        // 监听style元素的内容是否变化
        observer.observe(styleElement, { childList: true });
    }
}
// 依次处理每个cssRule
function scopedRule(rules, prefix) {
    let result = '';
    // 遍历rules, 处理每一条规则
    // https://www.w3.org/html/ig/zh/wiki/Cssom#CSS.E8.A7.84.E5.88.99
    // 由于 CSSRule.type 被废弃，改用 rule.constructor.name 判断规则类型。https://wiki.csswg.org/spec/cssom-constants
    for (const rule of rules) {
        if (rule.constructor.name === 'CSSStyleRule') {
            result += scopedStyleRule(rule, prefix);
        }
        else if (rule.constructor.name === 'CSSMediaRule') {
            result += scopedPackRule(rule, prefix, 'media');
        }
        else if (rule.constructor.name === 'CSSSupportsRule') {
            result += scopedPackRule(rule, prefix, 'supports');
        }
        else {
            result += rule.cssText;
        }
    }
    return result;
}
// 处理media 和 supports
function scopedPackRule(rule, prefix, packName) {
    // 递归执行scopedRule，处理media 和 supports内部规则
    const result = scopedRule(Array.from(rule.cssRules), prefix);
    return `@${packName} ${rule.conditionText} {${result}}`;
}
function scopedStyleRule(rule, prefix) {
    // 获取CSS规则对象的选择和内容
    const { selectorText, cssText } = rule;
    // 处理顶层选择器，如 body，html 都转换为 picocontainer-app[name=xxx]
    if (/^((html[\s>~,]+body)|(html|body|:root))$/.test(selectorText)) {
        return cssText.replace(/^((html[\s>~,]+body)|(html|body|:root))/, prefix);
    }
    else if (selectorText === '*') {
        // 选择器 * 替换为 picocontainer-app[name=xxx] *
        return cssText.replace('*', `${prefix} *`);
    }
    const builtInRootSelectorRE = /(^|\s+)((html[\s>~]+body)|(html|body|:root))(?=[\s>~]+|$)/;
    // 匹配查询选择器
    return cssText.replace(/^[\s\S]+{/, (selectors) => {
        return selectors.replace(/(^|,)([^,]+)/g, (all, $1, $2) => {
            // 如果含有顶层选择器，需要单独处理
            if (builtInRootSelectorRE.test($2)) {
                // body[name=xx]|body.xx|body#xx 等都不需要转换
                return all.replace(builtInRootSelectorRE, prefix);
            }
            // 在选择器前加上前缀
            return `${$1} ${prefix} ${$2.replace(/^\s*/, '')}`;
        });
    });
}

function loadHtml(app) {
    fetchSource(app.url).then((html) => {
        html = html
            .replace(/<head[^>]*>[\s\S]*?<\/head>/i, (match) => {
            // 将head标签替换为picocontainer-app-head，因为web页面只允许有一个head标签
            return match
                .replace(/<head/i, '<picocontainer-app-head')
                .replace(/<\/head>/i, '</picocontainer-app-head>');
        })
            .replace(/<body[^>]*>[\s\S]*?<\/body>/i, (match) => {
            // 将body标签替换为picocontainer-app-body，防止与基座应用的body标签重复导致的问题。
            return match
                .replace(/<body/i, '<picocontainer-app-body')
                .replace(/<\/body>/i, '</picocontainer-app-body>');
        });
        // 将html字符串转化为DOM结构
        const htmlDom = document.createElement('div');
        htmlDom.innerHTML = html;
        console.log('html:', htmlDom);
        // 进一步提取和处理js、css等静态资源
        extractSourceDom(htmlDom, app);
        // picocontainer-app-head元素
        const picocontainerAppHead = htmlDom.querySelector('picocontainer-app-head');
        // 如果有远程css资源，则通过fetch请求
        if (app.source.links.size) {
            fetchLinksFromHtml(app, picocontainerAppHead, htmlDom);
        }
        else {
            app.onLoad(htmlDom);
        }
        // 如果有远程js资源，则通过fetch请求
        if (app.source.scripts.size) {
            fetchScriptsFromHtml(app, htmlDom);
        }
        else {
            app.onLoad(htmlDom);
        }
    }).catch((e) => {
        console.error('加载html出错', e);
    });
}
/**
 * 递归处理每一个子元素
 * @param parent 父元素
 * @param app 应用实例
 */
function extractSourceDom(parent, app) {
    const children = Array.from(parent.children);
    // 递归每一个子元素
    children.length && children.forEach((child) => {
        extractSourceDom(child, app);
    });
    for (const dom of children) {
        if (dom instanceof HTMLLinkElement) {
            // 提取css地址
            const href = dom.getAttribute('href');
            if (dom.getAttribute('rel') === 'stylesheet' && href) {
                // 计入source缓存中
                app.source.links.set(href, {
                    code: '',
                });
            }
            // 删除原有元素
            parent.removeChild(dom);
        }
        else if (dom instanceof HTMLScriptElement) {
            // 并提取js地址
            const src = dom.getAttribute('src');
            if (src) { // 远程script
                app.source.scripts.set(src, {
                    code: '',
                    isExternal: true,
                });
            }
            else if (dom.textContent) { // 内联script
                const nonceStr = Math.random().toString(36).substr(2, 15);
                app.source.scripts.set(nonceStr, {
                    code: dom.textContent,
                    isExternal: false,
                });
            }
            parent.removeChild(dom);
        }
        else if (dom instanceof HTMLStyleElement) {
            // 进行样式隔离
            scopedCSS(dom, app.name);
        }
    }
}
/**
 * 获取link远程资源
 * @param app 应用实例
 * @param microAppHead micro-app-head
 * @param htmlDom html DOM结构
 */
function fetchLinksFromHtml(app, microAppHead, htmlDom) {
    const linkEntries = Array.from(app.source.links.entries());
    // 通过fetch请求所有css资源
    const fetchLinkPromise = [];
    for (const [url] of linkEntries) {
        fetchLinkPromise.push(fetchSource(app.url + url));
    }
    Promise.all(fetchLinkPromise).then((res) => {
        for (let i = 0; i < res.length; i++) {
            const code = res[i];
            // 拿到css资源后放入style元素并插入到micro-app-head中
            const link2Style = document.createElement('style');
            link2Style.textContent = code;
            // 样式隔离
            scopedCSS(link2Style, app.name);
            microAppHead.appendChild(link2Style);
            // 将代码放入缓存，再次渲染时可以从缓存中获取
            linkEntries[i][1].code = code;
        }
        // 处理完成后执行onLoad方法
        app.onLoad(htmlDom);
    }).catch((e) => {
        console.error('加载css出错', e);
    });
}
/**
 * 获取js远程资源
 * @param app 应用实例
 * @param htmlDom html DOM结构
 */
function fetchScriptsFromHtml(app, htmlDom) {
    const scriptEntries = Array.from(app.source.scripts.entries());
    // 通过fetch请求所有js资源
    const fetchScriptPromise = [];
    for (const [url, info] of scriptEntries) {
        // 如果是内联script，则不需要请求资源
        fetchScriptPromise.push(info.code ? Promise.resolve(info.code) : fetchSource(app.url + url));
    }
    Promise.all(fetchScriptPromise).then((res) => {
        for (let i = 0; i < res.length; i++) {
            const code = res[i];
            // 将代码放入缓存，再次渲染时可以从缓存中获取
            scriptEntries[i][1].code = code;
        }
        // 处理完成后执行onLoad方法
        app.onLoad(htmlDom);
    }).catch((e) => {
        console.error('加载js出错', e);
    });
}

// js 沙箱环境
const rawWindowAddEventListener = window.addEventListener;
const rawWindowRemoveEventListener = window.removeEventListener;
// 重写全局事件的监听和解绑，返回卸载所有事件，这个函数的作用目的：当卸载应用时候卸载全局事件
function effect(picocontainerWindow) {
    // 使用 Map 记录全局事件
    const eventListnerMap = new Map();
    // 重写 addEventListener
    picocontainerWindow.addEventListener = function (type, listener, options) {
        const listenerList = eventListnerMap.get(type);
        // 当前事件非第一次监听，则添加缓存
        if (listenerList) {
            listenerList.add(listener);
        }
        else {
            // 当前事件第一次监听，则初始化数据
            eventListnerMap.set(type, new Set([listener]));
        }
        // 执行原生监听函数
        return rawWindowAddEventListener.call(window, type, listener, options);
    };
    // 重写 removeEventListener
    picocontainerWindow.removeEventListener = function (type, listener, options) {
        const listenerList = eventListnerMap.get(type);
        // 从缓存中删除监听函数
        if ((listenerList === null || listenerList === void 0 ? void 0 : listenerList.size) && listenerList.has(listener)) {
            listenerList.delete(listener);
        }
        // 执行原生解绑函数
        return rawWindowRemoveEventListener.call(window, type, listener, options);
    };
    return () => {
        // 清空window绑定事件
        if (eventListnerMap.size) {
            eventListnerMap.forEach((listenerList, type) => {
                if (listenerList.size) {
                    for (const listener of listenerList) {
                        rawWindowRemoveEventListener.call(window, type, listener);
                    }
                }
            });
            eventListnerMap.clear();
        }
    };
}
class SandBox {
    constructor() {
        this.active = false; // 沙箱是否在运行
        this.picocontainerWindow = {}; // 要代理的对象
        this.injectedKeys = new Set(); // 新添加的属性，在卸载时清空
        this.releaseEffect = null;
        this.proxyWindow = null;
        // 卸载钩子
        this.releaseEffect = effect(this.picocontainerWindow);
        this.proxyWindow = new Proxy(this.picocontainerWindow, {
            // 取值
            get: (target, key) => {
                // 优先从代理对象上取值
                if (Reflect.has(target, key)) {
                    return Reflect.get(target, key);
                }
                // 否则兜底到window对象上取
                const rawValue = Reflect.get(window, key);
                // 如果兜底的值为函数，则需要绑定window对象，如： console、alert等
                if (typeof rawValue === 'function') {
                    const valueStr = rawValue.toString();
                    // 排除构造函数
                    if (!/^function\s+[A-Z]/.test(valueStr) && !/^class\s+/.test(valueStr)) {
                        return rawValue.bind(window);
                    }
                }
                return rawValue;
            },
            // 设置变量
            set: (target, key, value) => {
                // 沙箱只有在运行时可以设置变量
                if (this.active) {
                    Reflect.set(target, key, value);
                    // 记录添加的变量，用于后续清空操作
                    this.injectedKeys.add(key);
                }
                return true;
            },
            // 删除变量
            deleteProperty: (target, key) => {
                // 当前key存在于代理对象上时才满足删除条件
                if (target.hasOwnProperty(key)) {
                    return Reflect.deleteProperty(target, key);
                }
                return true;
            }
        });
    }
    // 启动
    start() {
        if (!this.active) {
            this.active = true;
        }
    }
    // 停止
    stop() {
        if (this.active) {
            this.active = false;
        }
        // 清空变量
        this.injectedKeys.forEach((key) => {
            Reflect.deleteProperty(this.picocontainerWindow, key);
        });
        this.injectedKeys.clear();
        // 卸载全局事件
        this.releaseEffect();
    }
    // 绑定js作用域
    bindScope(code) {
        window.proxyWindow = this.proxyWindow;
        return `;(function(window, self) {
      with(window) {
        ;${code}\n
      }
    }).call(window.proxyWindow, window.proxyWindow, window.proxyWindow);`;
    }
}

// 应用  ，SSR
// 微应用实例
const appInstanceMap = new Map();
class PicocontainerApp {
    constructor({ name, url, container }) {
        this.name = '';
        this.url = '';
        this.container = null;
        this.loadCount = 0;
        this.sandbox = null;
        this.status = 'created'; // 组件状态，包括 created/loading/mount/unmount
        // 存放应用的静态资源
        this.source = {
            links: new Map(),
            scripts: new Map(),
            html: ''
        };
        this.container = container !== null && container !== void 0 ? container : null;
        this.name = name;
        this.url = url;
        this.status = 'loading';
        loadHtml(this);
        this.sandbox = new SandBox();
    }
    // 资源加载完时执行
    onLoad(htmlDom) {
        this.loadCount = this.loadCount ? this.loadCount + 1 : 1;
        // 第二次执行且组件未卸载时执行渲染
        if (this.loadCount === 2 && this.status !== 'unmount') {
            // 记录DOM结构用于后续操作
            this.source.html = htmlDom;
            // 执行mount方法
            this.mount();
        }
    }
    /**
     * 资源加载完成后进行渲染
     */
    mount() {
        var _a;
        // 克隆DOM节点
        const cloneHtml = this.source.html.cloneNode(true);
        // 创建一个fragment节点作为模版，这样不会产生冗余的元素
        const fragment = document.createDocumentFragment();
        Array.from(cloneHtml.childNodes).forEach((node) => {
            fragment.appendChild(node);
        });
        // 将格式化后的DOM结构插入到容器中
        (_a = this.container) === null || _a === void 0 ? void 0 : _a.appendChild(fragment);
        // 执行js
        this.source.scripts.forEach((info) => {
            (0, eval)(this.sandbox.bindScope(info.code));
        });
        // 标记应用为已渲染
        this.status = 'mounted';
    }
    /**
     * 卸载应用
     * 执行关闭沙箱，清空缓存等操作
     */
    unmount(destory) {
        var _a;
        this.status = 'unmount';
        this.container = null;
        (_a = this.sandbox) === null || _a === void 0 ? void 0 : _a.stop();
        if (destory) {
            appInstanceMap.delete(this.name);
        }
    }
}

var ObservedAttrName;
(function (ObservedAttrName) {
    ObservedAttrName["NAME"] = "name";
    ObservedAttrName["URL"] = "url";
})(ObservedAttrName || (ObservedAttrName = {}));

// 自定义元素
class MyElement extends HTMLElement {
    constructor() {
        super();
        this.appName = '';
        this.appUrl = '';
    }
    // 声明需要监听的属性名，只有这些属性变化时才会触发attributeChangedCallback
    static get observedAttributes() {
        return ['name', 'url'];
    }
    connectedCallback() {
        // 元素被插入到DOM时执行，此时去加载子应用的静态资源并渲染
        console.log('picocontainer-app is connected');
        // 创建微应用实例
        const app = new PicocontainerApp({
            name: this.appName,
            url: this.appUrl,
            container: this,
        });
        // 记入缓存，用于后续功能
        appInstanceMap.set(this.appName, app);
    }
    disconnectedCallback() {
        // 元素从DOM中删除时执行，此时进行一些卸载操作
        console.log('picocontainer-app has disconnected');
        // 获取应用实例
        const app = appInstanceMap.get(this.appName);
        // 如果有属性destory，则完全卸载应用包括缓存的文件
        app.unmount(this.hasAttribute('destory'));
    }
    attributeChangedCallback(attr, _oldVal, newVal) {
        // 元素属性发生变化时执行，可以获取name、url等属性的值
        console.log(`attribute ${attr}: ${newVal}-${_oldVal}`);
        if (this[attr === ObservedAttrName.NAME ? 'appName' : 'appUrl'] !== newVal) {
            if (attr === ObservedAttrName.URL && !this.appUrl) {
                this.appUrl = newVal;
            }
            else if (attr === ObservedAttrName.NAME && !this.appName) {
                this.appName = newVal;
            }
        }
    }
}
function defineElement() {
    // 如果已经定义过，则忽略
    if (!window.customElements.get('picocontainer-app')) {
        /**
         * 注册元素
         * 注册后，就可以像普通元素一样使用picocontainer-app，当picocontainer-app元素被插入或删除DOM时即可触发相应的生命周期函数。
         */
        window.customElements.define(`picocontainer-app`, MyElement);
    }
}

// 参考：https://zhuanlan.zhihu.com/p/395752022
const SimplePicocontainerApp = {
    start() {
        defineElement();
    }
};

export default SimplePicocontainerApp;
//# sourceMappingURL=index.esm.js.map
