// 子应用的样式作用域处理

let templateStyle: any = null; // 模版sytle

export default function scopedCSS(
  styleElement: HTMLStyleElement,
  appName: string
) {
  const prefix = `picocontainer-app[name=${appName}]`;

  if (!templateStyle) {
    templateStyle = document.createElement("style");
    document.body.appendChild(templateStyle);
    // 设置样式表无效，防止对应用造成影响
    templateStyle.sheet.disabled = true;
  }

  if (styleElement.textContent) {
    templateStyle.textContent = styleElement.textContent;
    styleElement.textContent = scopedRule(
      Array.from(templateStyle.sheet?.cssRules ?? []),
      prefix
    );
    templateStyle.textContent = "";
  } else {
    // 监听动态添加内容的style元素
    const observer = new MutationObserver(() => {
      observer.disconnect();
      styleElement.textContent = scopedRule(
        Array.from(styleElement.sheet?.cssRules ?? []),
        prefix
      );
    });

    // 监听style元素的内容是否变化
    observer.observe(styleElement, { childList: true });
  }
}

// 依次处理每个cssRule
function scopedRule(rules: CSSRule[], prefix: string) {
  let result = "";
  // 遍历rules, 处理每一条规则
  // https://www.w3.org/html/ig/zh/wiki/Cssom#CSS.E8.A7.84.E5.88.99
  // 由于 CSSRule.type 被废弃，改用 rule.constructor.name 判断规则类型。https://wiki.csswg.org/spec/cssom-constants
  for (const rule of rules) {
    if (rule.constructor.name === "CSSStyleRule") {
      result += scopedStyleRule(rule as CSSStyleRule, prefix);
    } else if (rule.constructor.name === "CSSMediaRule") {
      result += scopedPackRule(rule as CSSMediaRule, prefix, "media");
    } else if (rule.constructor.name === "CSSSupportsRule") {
      result += scopedPackRule(rule as CSSSupportsRule, prefix, "supports");
    } else {
      result += rule.cssText;
    }
  }

  return result;
}

// 处理media 和 supports
function scopedPackRule(
  rule: CSSMediaRule | CSSSupportsRule,
  prefix: string,
  packName: string
) {
  // 递归执行scopedRule，处理media 和 supports内部规则
  const result = scopedRule(Array.from(rule.cssRules), prefix);
  return `@${packName} ${rule.conditionText} {${result}}`;
}

function scopedStyleRule(rule: CSSStyleRule, prefix: string) {
  // 获取CSS规则对象的选择和内容
  const { selectorText, cssText } = rule;

  // 处理顶层选择器，如 body，html 都转换为 picocontainer-app[name=xxx]
  if (/^((html[\s>~,]+body)|(html|body|:root))$/.test(selectorText)) {
    return cssText.replace(/^((html[\s>~,]+body)|(html|body|:root))/, prefix);
  } else if (selectorText === "*") {
    // 选择器 * 替换为 picocontainer-app[name=xxx] *
    return cssText.replace("*", `${prefix} *`);
  }

  const builtInRootSelectorRE =
    /(^|\s+)((html[\s>~]+body)|(html|body|:root))(?=[\s>~]+|$)/;

  // 匹配查询选择器
  return cssText.replace(/^[\s\S]+{/, (selectors) => {
    return selectors.replace(/(^|,)([^,]+)/g, (all, $1, $2) => {
      // 如果含有顶层选择器，需要单独处理
      if (builtInRootSelectorRE.test($2)) {
        // body[name=xx]|body.xx|body#xx 等都不需要转换
        return all.replace(builtInRootSelectorRE, prefix);
      }
      // 在选择器前加上前缀
      return `${$1} ${prefix} ${$2.replace(/^\s*/, "")}`;
    });
  });
}
