# picocontainer
前端微容器，支持界面上多个实例。使用场景：微前端组件，微前端。


功能扩展方式：插件自定义插件开发。  

## 使用方式

```html
<div>
  <div id="one"></div>
  <div id="two"></div>
</div>
```

```js
// 具体某个页面组件
import Picocontainer from 'picocontainer'

const instanceArr = []

const render = (name, entry, container) => {
  const instance = new Picocontainer({name: name, entry: entry, container: container})
  instanceArr.push(instance)
  instance.start()
}

const destroy = () => {
  instanceArr.forEach(instance => {
    instance.destroy()
  })
}

const init = () => {
  render('one', 'http://one.com', document.getElementById('one'))
  render('two', 'http://two.com', document.getElementById('two'))
}



init()

```