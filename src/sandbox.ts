// js 沙箱环境

import { listeners } from "process"


const rawWindowAddEventListener = window.addEventListener
const rawWindowRemoveEventListener = window.removeEventListener

// 重写全局事件的监听和解绑，返回卸载所有事件，这个函数的作用目的：当卸载应用时候卸载全局事件
function effect (picocontainerWindow: any) {
  // 使用 Map 记录全局事件
  const eventListnerMap = new Map()

  // 重写 addEventListener
  picocontainerWindow.addEventListener = function(type: string, listener: any, options: any) {
    const listenerList = eventListnerMap.get(type)
    // 当前事件非第一次监听，则添加缓存
    if (listenerList) {
      listenerList.add(listener)
    } else {
      // 当前事件第一次监听，则初始化数据
      eventListnerMap.set(type, new Set([listener]))
    }
    // 执行原生监听函数
    return rawWindowAddEventListener.call(window, type, listener, options)
  }

  // 重写 removeEventListener
  picocontainerWindow.removeEventListener = function(type: string, listener: any, options: any) {
    const listenerList = eventListnerMap.get(type)
    // 从缓存中删除监听函数
    if (listenerList?.size && listenerList.has(listener)) {
      listenerList.delete(listener)
    }
    // 执行原生解绑函数
    return rawWindowRemoveEventListener.call(window, type, listener, options)
  }

  return () => {
    // 清空window绑定事件
    if (eventListnerMap.size) {
      eventListnerMap.forEach((listenerList, type) => {
        if (listenerList.size) {
          for (const listener of listenerList) {
            rawWindowRemoveEventListener.call(window, type, listener)
          }
        }
      })
      eventListnerMap.clear()
    }
  }
}

export default class SandBox {
  active = false // 沙箱是否在运行
  picocontainerWindow = {} // 要代理的对象
  injectedKeys: any = new Set() // 新添加的属性，在卸载时清空
  releaseEffect: any = null
  proxyWindow: any = null

  constructor () {
    // 卸载钩子
    this.releaseEffect = effect(this.picocontainerWindow)

    this.proxyWindow = new Proxy(this.picocontainerWindow, {
      // 取值
      get: (target: any, key: string) => {
        // 优先从代理对象上取值
        if (Reflect.has(target, key)) {
          return Reflect.get(target, key)
        }

        // 否则兜底到window对象上取
        const rawValue = Reflect.get(window, key)

        // 如果兜底的值为函数，则需要绑定window对象，如： console、alert等
        if (typeof rawValue === 'function') {
          const valueStr = rawValue.toString()
          // 排除构造函数
          if (!/^function\s+[A-Z]/.test(valueStr) && !/^class\s+/.test(valueStr)) {
            return rawValue.bind(window)
          }
        }

        return rawValue
      },
      // 设置变量
      set: (target: any, key: string, value: any) => {
        // 沙箱只有在运行时可以设置变量
        if (this.active) {
          Reflect.set(target, key, value)

          // 记录添加的变量，用于后续清空操作
          this.injectedKeys.add(key)
        }

        return true
      },
      // 删除变量
      deleteProperty: (target: any, key: string) => {
        // 当前key存在于代理对象上时才满足删除条件
        if (target.hasOwnProperty(key)) {
          return Reflect.deleteProperty(target, key)
        }

        return true
      }
    })
  }

  // 启动
  start() {
    if (!this.active) {
      this.active = true
    }
  }

  // 停止
  stop() {
    if (this.active) {
      this.active = false
    }

    // 清空变量
    this.injectedKeys.forEach((key: string) => {
      Reflect.deleteProperty(this.picocontainerWindow, key)
    })
    this.injectedKeys.clear()

    // 卸载全局事件
    this.releaseEffect()
  }

  // 绑定js作用域
  bindScope(code: string) {
    (window as any).proxyWindow = this.proxyWindow
    return `;(function(window, self) {
      with(window) {
        ;${code}\n
      }
    }).call(window.proxyWindow, window.proxyWindow, window.proxyWindow);`
  }
}
