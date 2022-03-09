import { appInstanceMap } from "./app";

// 发布订阅系统
class EventCenter {
  // 缓存数据和绑定函数
  private eventList = new Map();

  // 绑定监听函数
  on(name: string, callback: Function) {
    let eventInfo: { data: Object; callbacks: Set<Function> } =
      this.eventList.get(name);
    // 如果没有缓存，则初始化
    if (!eventInfo) {
      eventInfo = {
        data: {},
        callbacks: new Set(),
      };
      // 放入缓存
      this.eventList.set(name, eventInfo);
    }

    // 记录绑定函数
    eventInfo.callbacks.add(callback);
  }

  // 解除绑定
  off(name: string, callback: Function) {
    let eventInfo = this.eventList.get(name)
    // eventInfo存在且f为函数则卸载指定函数
    if (eventInfo && typeof callback === 'function') {
      eventInfo.callbacks.delete(callback);
    }
  }
}
