/* @flow */

import { emptyObject } from 'shared/util'
import { parseFilters } from './parser/filter-parser'

export function baseWarn (msg: string) {
  console.error(`[Vue compiler]: ${msg}`)
}

export function pluckModuleFunction<F: Function> (modules: ?Array<Object>, key: string): Array<F> {
  return modules ? modules.map(m => m[key]).filter(_ => _) : []
}

export function addProp (el: ASTElement, name: string, value: string) {
  ;(el.props || (el.props = [])).push({ name, value })
  el.plain = false
}

export function addAttr (el: ASTElement, name: string, value: any) {
  ;(el.attrs || (el.attrs = [])).push({ name, value })
  el.plain = false
}

// add a raw attr (use this in preTransforms)
export function addRawAttr (el: ASTElement, name: string, value: any) {
  el.attrsMap[name] = value
  el.attrsList.push({ name, value })
}

export function addDirective (el: ASTElement, name: string, rawName: string, value: string, arg: ?string, modifiers: ?ASTModifiers) {
  ;(el.directives || (el.directives = [])).push({ name, rawName, value, arg, modifiers })
  el.plain = false
}

export function addHandler (el: ASTElement, name: string, value: string, modifiers: ?ASTModifiers, important?: boolean, warn?: Function) {
  // modifiers事件修饰符对象，如{ native: true }
  modifiers = modifiers || emptyObject
  // warn prevent and passive modifier
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && warn && modifiers.prevent && modifiers.passive) {
    warn("passive and prevent can't be used together. " + "Passive handler can't prevent default event.")
  }

  // check capture modifier
  if (modifiers.capture) {
    delete modifiers.capture
    name = '!' + name // mark the event as captured
  }
  if (modifiers.once) {
    delete modifiers.once
    name = '~' + name // mark the event as once
  }
  /* istanbul ignore if */
  if (modifiers.passive) {
    delete modifiers.passive
    name = '&' + name // mark the event as passive
  }

  // normalize click.right and click.middle since they don't actually fire
  // this is technically browser-specific, but at least for now browsers are
  // the only target envs that have right/middle clicks.
  if (name === 'click') {
    if (modifiers.right) {
      name = 'contextmenu' // 将click.right修改为contextmenu事件
      delete modifiers.right
    } else if (modifiers.middle) {
      name = 'mouseup' // 将click.middle修改为mouseup事件
    }
  }

  let events // 容纳所有事件处理器的包装对象
  if (modifiers.native) {
    delete modifiers.native
    events = el.nativeEvents || (el.nativeEvents = {})
  } else {
    events = el.events || (el.events = {})
  }

  const newHandler: any = {
    value: value.trim()
  }
  // 除了上述列举的修饰符，还有其他修饰符
  if (modifiers !== emptyObject) {
    newHandler.modifiers = modifiers
  }

  const handlers = events[name]
  /* istanbul ignore if */
  if (Array.isArray(handlers)) {
    // 在el上已有多个对此事件的处理器，将所有处理器放到一个数组里
    important ? handlers.unshift(newHandler) : handlers.push(newHandler)
  } else if (handlers) {
    // 在el上已有1个对此事件的处理器
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
  } else {
    // 在el上还没有对此事件的处理器
    events[name] = newHandler
  }

  el.plain = false
}

export function getBindingAttr (el: ASTElement, name: string, getStatic?: boolean): ?string {
  const dynamicValue = getAndRemoveAttr(el, ':' + name) || getAndRemoveAttr(el, 'v-bind:' + name)
  if (dynamicValue != null) {
    return parseFilters(dynamicValue)
  } else if (getStatic !== false) {
    const staticValue = getAndRemoveAttr(el, name)
    if (staticValue != null) {
      return JSON.stringify(staticValue)
    }
  }
}

// note: this only removes the attr from the Array (attrsList) so that it
// doesn't get processed by processAttrs.
// By default it does NOT remove it from the map (attrsMap) because the map is
// needed during codegen.
export function getAndRemoveAttr (el: ASTElement, name: string, removeFromMap?: boolean): ?string {
  let val
  // attrsMap用于快速查找有没有某个属性，attrsList用于存放所有的属性
  if ((val = el.attrsMap[name]) != null) {
    const list = el.attrsList
    for (let i = 0, l = list.length; i < l; i++) {
      if (list[i].name === name) {
        list.splice(i, 1)
        break
      }
    }
  }
  if (removeFromMap) {
    delete el.attrsMap[name]
  }
  return val
}
