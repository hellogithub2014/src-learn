/* @flow */

import { warn } from 'core/util/index'
import { cached, isUndef, isPlainObject } from 'shared/util'

const normalizeEvent = cached(
  (
    name: string
  ): {
    name: string,
    once: boolean,
    capture: boolean,
    passive: boolean,
    handler?: Function,
    params?: Array<any>
  } => {
    const passive = name.charAt(0) === '&'
    name = passive ? name.slice(1) : name
    const once = name.charAt(0) === '~' // Prefixed last, checked first
    name = once ? name.slice(1) : name
    const capture = name.charAt(0) === '!'
    name = capture ? name.slice(1) : name
    return {
      name,
      once,
      capture,
      passive
    }
  }
)

export function createFnInvoker (fns: Function | Array<Function>): Function {
  function invoker () {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        cloned[i].apply(null, arguments)
      }
    } else {
      // return handler return value for single handlers
      return fns.apply(null, arguments)
    }
  }
  invoker.fns = fns
  return invoker
}

export function updateListeners (on: Object, oldOn: Object, add: Function, remove: Function, vm: Component) {
  let name, def, cur, old, event
  for (name in on) {
    def = cur = on[name]
    old = oldOn[name]
    event = normalizeEvent(name) // 处理事件名的前缀 ! ~ &,转为 once passive capture标志
    /* istanbul ignore if */
    if (__WEEX__ && isPlainObject(def)) {
      cur = def.handler
      event.params = def.params
    }
    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(`Invalid handler for event "${event.name}": got ` + String(cur), vm)
    } else if (isUndef(old)) {
      // 新增的事件处理
      if (isUndef(cur.fns)) {
        cur = on[name] = createFnInvoker(cur)
      }
      // 在vnode.elm上使用addEventListener添加事件
      add(event.name, cur, event.once, event.capture, event.passive, event.params)
    } else if (cur !== old) {
      // 更新的事件处理函数
      old.fns = cur
      on[name] = old
    }
  }
  // 遗弃的事件处理函数
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      // 在vnode.elm上使用removeEventListener添加事件
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
