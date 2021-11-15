/**
 * 获取静态资源
 * @param {string} url 静态资源地址
 */
function fetchSource(url) {
    return fetch(url).then((res) => {
        return res.text();
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
        else ;
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

// 应用  ，SSR
class PicocontainerApp {
    constructor({ name, url, container }) {
        this.name = '';
        this.url = '';
        this.container = null;
        this.loadCount = 0;
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
            (0, eval)(info.code);
        });
        // 标记应用为已渲染
        this.status = 'mounted';
    }
    /**
     * 卸载应用
     * 执行关闭沙箱，清空缓存等操作
     */
    unmount() { }
}
// 资源缓存
const appInstanceMap = new Map();

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
