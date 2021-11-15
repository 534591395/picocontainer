// 应用  ，SSR
import loadHtml from './source'

export interface CreateAppParam {
  name: string
  url: string
  scopecss?: boolean
  useSandbox?: boolean
  macro?: boolean
  inline?: boolean
  baseroute?: string
  container?: HTMLElement | ShadowRoot
}

export default class PicocontainerApp {
  name: string = ''
  url: string = ''
  container: HTMLElement | ShadowRoot | null = null
  loadCount = 0

  constructor({ name, url, container}: CreateAppParam) {
    this.container = container ?? null
    this.name = name
    this.url = url
    this.status = 'loading'
    loadHtml(this)
  }

  status = 'created' // 组件状态，包括 created/loading/mount/unmount

  // 存放应用的静态资源
  source: any = {
    links: new Map(), // link元素对应的静态资源
    scripts: new Map(), // script元素对应的静态资源
    html: ''
  }

  // 资源加载完时执行
  onLoad (htmlDom: any) {
    this.loadCount = this.loadCount ? this.loadCount + 1 : 1
    // 第二次执行且组件未卸载时执行渲染
    if (this.loadCount === 2 && this.status !== 'unmount') {
      // 记录DOM结构用于后续操作
      this.source.html = htmlDom
      // 执行mount方法
      this.mount()
    }
  }

  /**
   * 资源加载完成后进行渲染
   */
  mount () {
    // 克隆DOM节点
    const cloneHtml = this.source.html.cloneNode(true)
    // 创建一个fragment节点作为模版，这样不会产生冗余的元素
    const fragment = document.createDocumentFragment()
    Array.from(cloneHtml.childNodes).forEach((node: any) => {
      fragment.appendChild(node)
    })

    // 将格式化后的DOM结构插入到容器中
    this.container?.appendChild(fragment)

    // 执行js
    this.source.scripts.forEach((info: any) => {
      (0, eval)(info.code)
    })

    // 标记应用为已渲染
    this.status = 'mounted'
  }

  /**
   * 卸载应用
   * 执行关闭沙箱，清空缓存等操作
   */
  unmount () {}
}

// 资源缓存
export const appInstanceMap = new Map()
