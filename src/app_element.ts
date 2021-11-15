
import CreateApp, { appInstanceMap } from './app'

import { ObservedAttrName } from './constants'

// 自定义元素
class MyElement extends HTMLElement {
  // 声明需要监听的属性名，只有这些属性变化时才会触发attributeChangedCallback
  static get observedAttributes() {
    return ['name', 'url']
  }

  appName = ''
  appUrl = ''

  constructor() {
    super()
  }

  connectedCallback() {
    // 元素被插入到DOM时执行，此时去加载子应用的静态资源并渲染
    console.log('picocontainer-app is connected')
    // 创建微应用实例
    const app = new CreateApp({
      name: this.appName!,
      url: this.appUrl!,
      container: this,
    })

    // 记入缓存，用于后续功能
    appInstanceMap.set(this.appName, app)
  }

  disconnectedCallback () {
    // 元素从DOM中删除时执行，此时进行一些卸载操作
    console.log('picocontainer-app has disconnected')

    // 获取应用实例
    const app = appInstanceMap.get(this.appName)
    // 如果有属性destory，则完全卸载应用包括缓存的文件
    app.unmount(this.hasAttribute('destory'))
  }

  attributeChangedCallback (attr: ObservedAttrName, _oldVal: string, newVal: string): void {
    // 元素属性发生变化时执行，可以获取name、url等属性的值
    console.log(`attribute ${attr}: ${newVal}-${_oldVal}`)

    if (this[attr === ObservedAttrName.NAME ? 'appName' : 'appUrl'] !== newVal) {
      if (attr === ObservedAttrName.URL && !this.appUrl) {
        this.appUrl = newVal
      } else if (attr === ObservedAttrName.NAME && !this.appName) {
        this.appName = newVal
      }
    }
  }

}

export function defineElement () {
  // 如果已经定义过，则忽略
  if (!window.customElements.get('picocontainer-app')) {
    /**
     * 注册元素
     * 注册后，就可以像普通元素一样使用picocontainer-app，当picocontainer-app元素被插入或删除DOM时即可触发相应的生命周期函数。
     */
    window.customElements.define(`picocontainer-app`, MyElement)
  }
}
