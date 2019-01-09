/* @flow */

import he from 'he'
import { parseHTML } from './html-parser'
import { parseText } from './text-parser'
import { parseFilters } from './filter-parser'
import { genAssignmentCode } from '../directives/model'
import { extend, cached, no, camelize } from 'shared/util'
import { isIE, isEdge, isServerRendering } from 'core/util/env'

import { addProp, addAttr, baseWarn, addHandler, addDirective, getBindingAttr, getAndRemoveAttr, pluckModuleFunction } from '../helpers'

export const onRE = /^@|^v-on:/ // @或v-on开头
export const dirRE = /^v-|^@|^:/ // v- 或 @ 或 : 开头
export const forAliasRE = /([^]*?)\s+(?:in|of)\s+([^]*)/ //  item in items
export const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/ // (value, key, index) in object
const stripParensRE = /^\(|\)$/g

const argRE = /:(.*)$/ // :
export const bindRE = /^:|^v-bind:/ // : 或 v-bind: 开头
const modifierRE = /\.[^.]+/g // .xxx

const decodeHTMLCached = cached(he.decode)

// configurable state
export let warn: any
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp
let platformGetTagNamespace

type Attr = { name: string, value: string }

export function createASTElement (tag: string, attrs: Array<Attr>, parent: ASTElement | void): ASTElement {
  return {
    type: 1,
    tag,
    attrsList: attrs,
    attrsMap: makeAttrsMap(attrs),
    parent,
    children: []
  }
}

/**
 * Convert HTML string to AST.
 */
export function parse (template: string, options: CompilerOptions): ASTElement | void {
  warn = options.warn || baseWarn

  // isPreTag、mustUseProp、getTagNamespace定义位于src/platforms/web/compiler/options.js
  platformIsPreTag = options.isPreTag || no
  platformMustUseProp = options.mustUseProp || no
  platformGetTagNamespace = options.getTagNamespace || no

  // options.modules见/platforms/web/compiler/modules/index.js,
  // 包含[klass,style,model]3个成员
  // pluckModuleFunction：获取每个module中的transformNode成员
  transforms = pluckModuleFunction(options.modules, 'transformNode') // klass、style中有定义
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode') // model中有定义
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode') // 没找到

  delimiters = options.delimiters

  const stack = []
  const preserveWhitespace = options.preserveWhitespace !== false
  let root
  let currentParent
  let inVPre = false
  let inPre = false
  let warned = false

  function warnOnce (msg) {
    if (!warned) {
      warned = true
      warn(msg)
    }
  }

  function closeElement (element) {
    // check pre state
    if (element.pre) {
      inVPre = false
    }
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }
    // apply post-transforms
    for (let i = 0; i < postTransforms.length; i++) {
      postTransforms[i](element, options)
    }
  }

  parseHTML(template, {
    warn,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,
    shouldKeepComment: options.comments,

    // 参数示范
    // tag: 'div';  当前处理的起始标签
    // attrs: [ {name:'id',value:'app'} ] 起始标签上的属性
    // unary: false。 是否单标签元素
    start (tag, attrs, unary) {
      // check namespace.
      // inherit parent ns if there is one
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // handle IE svg bug
      /* istanbul ignore if */
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }
      /**
       * element格式示范：
       *
       *  {
            "type": 1,
            "tag": "div",
            "attrsList": [
              {
                "name": "id",
                "value": "app"
              }
            ],
            "attrsMap": {
              "id": "app"
            },
            "children": [],
            parent: undefined
       * }
       */
      let element: ASTElement = createASTElement(tag, attrs, currentParent)
      if (ns) {
        element.ns = ns
      }

      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
        process.env.NODE_ENV !== 'production' &&
          warn(
            'Templates should only be responsible for mapping the state to the ' +
              'UI. Avoid placing tags with side-effects in your templates, such as ' +
              `<${tag}>` +
              ', as they will not be parsed.'
          )
      }

      // apply pre-transforms。 例如v-model的预处理
      for (let i = 0; i < preTransforms.length; i++) {
        /**
         * 目前只在model这个module中有定义，
         * 见src/platforms/web/compiler/modules/model.js，是专门用来预处理<input v-model="xxx" type="xxx"> 的。
         *
         * Expand input[v-model] with dyanmic type bindings into v-if-else chains
         * Turn this:
         *   <input v-model="data[type]" :type="type">
         * into this:
         *   <input v-if="type === 'checkbox'" type="checkbox" v-model="data[type]">
         *   <input v-else-if="type === 'radio'" type="radio" v-model="data[type]">
         *   <input v-else :type="type" v-model="data[type]">
         */
        element = preTransforms[i](element, options) || element
      }

      // 处理v-pre指令, 如<span v-pre>{{ this will not be compiled }}</span>
      // 若有，则element.pre=true
      if (!inVPre) {
        processPre(element)
        if (element.pre) {
          inVPre = true
        }
      }
      if (platformIsPreTag(element.tag)) {
        inPre = true
      }
      if (inVPre) {
        processRawAttrs(element)
      } else if (!element.processed) {
        // structural directives
        processFor(element) // 处理节点上的v-for属性
        processIf(element) // 处理节点上的v-if属性
        // v-once只渲染元素和组件一次。随后的重新渲染，元素/组件及其所有的子节点将被视为静态内容并跳过。这可以用于优化更新性能。
        processOnce(element) // 处理节点上的v-once属性
        // element-scope stuff
        processElement(element, options) // 处理ref、slot、is、指令以及其他所有普通属性
      }

      function checkRootConstraints (el) {
        if (process.env.NODE_ENV !== 'production') {
          if (el.tag === 'slot' || el.tag === 'template') {
            warnOnce(`Cannot use <${el.tag}> as component root element because it may ` + 'contain multiple nodes.')
          }
          if (el.attrsMap.hasOwnProperty('v-for')) {
            warnOnce('Cannot use v-for on stateful component root element because ' + 'it renders multiple elements.')
          }
        }
      }

      // tree management
      if (!root) {
        root = element
        checkRootConstraints(root)
      } else if (!stack.length) {
        // allow root elements with v-if, v-else-if and v-else
        // 组件的根节点并不只是限制一个节点，而是可以由一组v-if, v-else-if and v-else节点
        if (root.if && (element.elseif || element.else)) {
          checkRootConstraints(element)
          addIfCondition(root, {
            exp: element.elseif,
            block: element
          })
        } else if (process.env.NODE_ENV !== 'production') {
          warnOnce(
            `Component template should contain exactly one root element. ` +
              `If you are using v-if on multiple elements, ` +
              `use v-else-if to chain them instead.`
          )
        }
      }
      if (currentParent && !element.forbidden) {
        // 在处理到v-else-if and v-else节点时，需要将其和v-if节点结合起来，
        // 通过在v-if节点上的ifConditions数组，来最终决定渲染哪个节点
        if (element.elseif || element.else) {
          processIfConditions(element, currentParent)
        } else if (element.slotScope) {
          // scoped slot，见processElement -> processSlot
          currentParent.plain = false
          const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        } else {
          currentParent.children.push(element)
          element.parent = currentParent
        }
      }
      // 如果当前处理的元素不是单标签元素，那么随后处理的element的父节点应该都是当前元素，
      // 直到处理到一个结束标签时，才会尝试再次修改currentParent
      if (!unary) {
        currentParent = element
        stack.push(element) // 保存所有处理到的标签路径，联想一下括号匹配
      } else {
        closeElement(element) // 单标签元素可以直接“关闭”当前元素，开启全新的下一轮
      }
    },

    end () {
      // remove trailing whitespace，
      /**
       * 若最初的html为：
       * <div id="app">
            <a :href="url" target="_blank">前面的文本{{title}}后面的文本</a>
            <img :src="img" />
          </div>

       * 则处理到</a>这个结束标签时，stack示范:
       * [
       *    {
       *      tag: "div", children: [{xxx},{xxx}]
       *    },
       *    {
       *      tag: "a", children:[
       *        expression: ""前面的文本"+_s(title)+"后面的文本"",
       *        type: 2,
       *      ]
       *    }
       * ]
      */
      const element = stack[stack.length - 1] // stack中最后一个元素
      const lastNode = element.children[element.children.length - 1] // 最后一个子节点
      // nodeType =3 ，文本节点
      if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
        element.children.pop()
      }
      // pop stack
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      closeElement(element) // “关闭”当前元素，开启全新的下一轮
    },

    chars (text: string) {
      if (!currentParent) {
        if (process.env.NODE_ENV !== 'production') {
          if (text === template) {
            warnOnce('Component template requires a root element, rather than just text.')
          } else if ((text = text.trim())) {
            warnOnce(`text "${text}" outside root element will be ignored.`)
          }
        }
        return
      }
      // IE textarea placeholder bug
      /* istanbul ignore if */
      if (isIE && currentParent.tag === 'textarea' && currentParent.attrsMap.placeholder === text) {
        return
      }
      const children = currentParent.children
      text =
        inPre || text.trim()
          ? isTextTag(currentParent) // script或style
            ? text
            : decodeHTMLCached(text)
          : // only preserve whitespace if its not right after a starting tag
          preserveWhitespace && children.length
            ? ' '
            : ''
      if (text) {
        let res
        /**
         * 处理文本中的插值表达式，如text=`前面的文本{{title}}后面的文本`,则res为
         * {
         *    expression: ""前面的文本"+_s(title)+"后面的文本""，
         *    tokens：{
         *      0: "前面的文本"，
         *      1：{
         *        @binding: "title"
         *      }
         *      2: "后面的文本"
         *    }
         * }
         */
        if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) {
          children.push({
            type: 2,
            expression: res.expression,
            tokens: res.tokens,
            text
          })
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          children.push({
            type: 3,
            text
          })
        }
      }
    },
    comment (text: string) {
      currentParent.children.push({
        type: 3,
        text,
        isComment: true
      })
    }
  })
  return root
}

function processPre (el) {
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true
  }
}

// 处理AST节点上的`attrsList`属性，将他们复制到`attrs`上去。
function processRawAttrs (el) {
  const l = el.attrsList.length
  if (l) {
    const attrs = (el.attrs = new Array(l))
    for (let i = 0; i < l; i++) {
      attrs[i] = {
        name: el.attrsList[i].name,
        value: JSON.stringify(el.attrsList[i].value)
      }
    }
  } else if (!el.pre) {
    // non root node in pre blocks with no attributes
    el.plain = true
  }
}

export function processElement (element: ASTElement, options: CompilerOptions) {
  processKey(element) // 处理静态或动态key属性

  // determine whether this is a plain element after
  // removing structural attributes
  // 纯元素：没有key属性以及其他任何属性
  element.plain = !element.key && !element.attrsList.length

  processRef(element) // 处理静态或动态ref属性
  processSlot(element) // 处理slot，获取slotTarget和slotScope属性
  processComponent(element) // 处理is属性，将对应值设置到component属性上
  // 处理class、style module的transformNode
  for (let i = 0; i < transforms.length; i++) {
    /**
     * transforms目前只在class和style的module中有定义，逻辑类似
     * 见src/platforms/web/compiler/modules文件夹。
     * 其中
     * 1. class的transforms作用：
     *   a. 获取静态绑定的class属性，放到el.staticClass
     *   b. 获取动态绑定的class属性，放到el.classBinding
     * 2. style的transforms作用：
     *  a. 获取静态绑定的style属性，放到el.staticStyle
     *  b. 获取动态绑定的style属性，放到el.styleBinding
     */
    element = transforms[i](element, options) || element
  }
  processAttrs(element) // 处理element上的所有属性，根据属性名分为指令和普通属性
}

function processKey (el) {
  // 获取静态或动态绑定的key属性
  const exp = getBindingAttr(el, 'key')
  if (exp) {
    if (process.env.NODE_ENV !== 'production' && el.tag === 'template') {
      warn(`<template> cannot be keyed. Place the key on real elements instead.`)
    }
    el.key = exp
  }
}

function processRef (el) {
  const ref = getBindingAttr(el, 'ref')
  if (ref) {
    el.ref = ref
    el.refInFor = checkInFor(el)
  }
}

/**
 * 处理v-for，例如处理的起始标签为<div v-for="(value,key,index) in items">，那么此时el为
 * {
 *    attrsList:[],
 *    attrsMap: {
 *      v-for: "(value,key,index) in items"
 *    },
 *    children: [],
 *    tag: "div",
      type: 1,
      parent: ...
 * }
 */
export function processFor (el: ASTElement) {
  let exp
  // 从attrsMap中获取key为‘v-for’的属性值，例如 "(value,key,index) in items"
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    const res = parseFor(exp)
    if (res) {
      extend(el, res)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid v-for expression: ${exp}`)
    }
  }
}

type ForParseResult = {
  for: string,
  alias: string,
  iterator1?: string,
  iterator2?: string
}
/**
 * 若v-for属性值为‘(value,key,index) in items’，在ast上添加的属性示范：
  {
    for: 'items',
    alias: 'value',
    iterator1: 'key'
    iterator2: 'index'
  }
 */
export function parseFor (exp: string): ?ForParseResult {
  // 若exp为(value,key,index)， inMatch为
  /**
   * [
   *    "(value,key,index) in items",
        "(value,key,index)",
        "items"
   * ]
  */
  const inMatch = exp.match(forAliasRE)
  if (!inMatch) return
  const res = {}
  res.for = inMatch[2].trim()
  // 去掉两边括号，结果为‘value,key,index’
  const alias = inMatch[1].trim().replace(stripParensRE, '')
  /**
   * iteratorMatch示范
   * [
   *    ",key,index",
        "key",
        "index"
   * ]
  */
  const iteratorMatch = alias.match(forIteratorRE)
  if (iteratorMatch) {
    res.alias = alias.replace(forIteratorRE, '') // 'value'
    res.iterator1 = iteratorMatch[1].trim() // 'key'
    if (iteratorMatch[2]) {
      res.iterator2 = iteratorMatch[2].trim() // 'index'
    }
  } else {
    res.alias = alias // ‘value,key,index’
  }
  return res
}

/**
 * 处理v-if/v-else-if/v-else，若html为
 * `
 *  <div v-if="condition">this is v-if</div>
    <div v-else-if="condition2">this is v-else-if</div>
    <div v-else>this is v-else</div>
 * `
 *
 * 则processIf会调用3次，每次的差别在于attrsMap里的属性值
 * {
 *    attrsList:[],
 *    attrsMap: {
 *       'v-if': 'condition'
 *       // 或者 'v-else-if': "condition2"
 *       // 或者 'v-else': ""
 *    },
 *    tag: 'div',
 * }
 */
function processIf (el) {
  const exp = getAndRemoveAttr(el, 'v-if')
  if (exp) {
    el.if = exp // 'condition'
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  } else {
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) {
      el.elseif = elseif // "condition2"
    }
  }
}

function processIfConditions (el, parent) {
  const prev = findPrevElement(parent.children) // 找到v-else-if或v-else前面的v-if节点
  if (prev && prev.if) {
    // 添加prev.ifConditions数组元素
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (process.env.NODE_ENV !== 'production') {
    warn(`v-${el.elseif ? 'else-if="' + el.elseif + '"' : 'else'} ` + `used on element <${el.tag}> without corresponding v-if.`)
  }
}
// 找到children中第一个element节点
function findPrevElement (children: Array<any>): ASTElement | void {
  let i = children.length
  while (i--) {
    if (children[i].type === 1) {
      return children[i]
    } else {
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
        warn(`text "${children[i].text.trim()}" between v-if and v-else(-if) ` + `will be ignored.`)
      }
      children.pop()
    }
  }
}

export function addIfCondition (el: ASTElement, condition: ASTIfCondition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}

function processOnce (el) {
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}

/**
 * 处理插槽和作用域插槽,获取slotName、slotScope、slotTarget
 *
 * 插槽有3种形式：
 * 1. 定义插槽： <slot name='xxx'> 或 <slot>
 * 2. 作用域插槽： <template slot-scope="slotScope"></template>. 在定义插槽时绑定在slot元素上的值会传递给slotScope
 * 3. 使用插槽: <p slot="xxx"></p>
 */
function processSlot (el) {
  // <slot name='xxx'>
  if (el.tag === 'slot') {
    el.slotName = getBindingAttr(el, 'name')
    if (process.env.NODE_ENV !== 'production' && el.key) {
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
          `and can possibly expand into multiple elements. ` +
          `Use the key on a wrapping element instead.`
      )
    }
  } else {
    let slotScope
    // 整个if/else-if分支用于获取作用域插槽的绑定值slotScope
    if (el.tag === 'template') {
      // <template scope="xxx">
      slotScope = getAndRemoveAttr(el, 'scope')
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && slotScope) {
        warn(
          `the "scope" attribute for scoped slots have been deprecated and ` +
            `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
            `can also be used on plain elements in addition to <template> to ` +
            `denote scoped slots.`,
          true
        )
      }
      // <template slot-scope="xxx">
      el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
    } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {
      // 普通元素上的作用域插槽，如 <p slot-scope="xxx">123</p>
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && el.attrsMap['v-for']) {
        warn(
          `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
            `(v-for takes higher priority). Use a wrapper <template> for the ` +
            `scoped slot to make it clearer.`,
          true
        )
      }
      el.slotScope = slotScope
    }
    // <p slot="xxx"></p>
    const slotTarget = getBindingAttr(el, 'slot')
    if (slotTarget) {
      el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
      // preserve slot as an attribute for native shadow DOM compat
      // only for non-scoped slots.
      if (el.tag !== 'template' && !el.slotScope) {
        addAttr(el, 'slot', slotTarget)
      }
    }
  }
}

function processComponent (el) {
  let binding
  if ((binding = getBindingAttr(el, 'is'))) {
    el.component = binding
  }
  if (getAndRemoveAttr(el, 'inline-template') != null) {
    el.inlineTemplate = true
  }
}

function processAttrs (el) {
  // attrsList结构示范：[{name:'id',value:'app'}]
  const list = el.attrsList
  let i, l, name, rawName, value, modifiers, isProp
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name
    value = list[i].value
    // v- 或 @ 或 : 开头的属性名
    if (dirRE.test(name)) {
      // mark element as dynamic
      el.hasBindings = true
      // modifiers修饰符， 即.xxx，若存在则返回一个对象， {m1: true, m2:true}
      modifiers = parseModifiers(name)
      if (modifiers) {
        name = name.replace(modifierRE, '') // 去除修饰符
      }
      if (bindRE.test(name)) {
        // v-bind，: 或 v-bind: 开头的属性绑定
        name = name.replace(bindRE, '') // 去掉: 或 v-bind:
        value = parseFilters(value) // 解析可能的过滤器，若存在则返回的value是一个字符串
        isProp = false
        if (modifiers) {
          // 见v-bind api: https://cn.vuejs.org/v2/api/#v-bind
          // .prop修饰符：被用于绑定 DOM 属性 (property)
          if (modifiers.prop) {
            isProp = true
            name = camelize(name)
            if (name === 'innerHtml') name = 'innerHTML' // innerHtml.prop
          }
          // .camel - (2.1.0+) 将 kebab-case 特性名转换为 camelCase
          if (modifiers.camel) {
            name = camelize(name)
          }
          // .sync (2.3.0+) 语法糖，会扩展成一个更新父组件绑定值的 v-on 侦听器。
          if (modifiers.sync) {
            addHandler(el, `update:${camelize(name)}`, genAssignmentCode(value, `$event`)) // 添加事件监听
          }
        }
        if (isProp || (!el.component && platformMustUseProp(el.tag, el.attrsMap.type, name))) {
          addProp(el, name, value)
        } else {
          // attrs只存在动态绑定的属性，如[{name: "href"，value: 'xxx'}]
          // attrsList存在的是大杂烩，存在所有动态/静态属性
          //      [{name: ":href"，value: 'xxx'},
          //      {name: "target", value: "_blank"},
          //      {name: "@click.native", value: "log"}]
          addAttr(el, name, value) // 将去除修饰符之后的属性添加到el.attrs数组
        }
      } else if (onRE.test(name)) {
        // v-on，事件绑定
        name = name.replace(onRE, '')
        // 添加事件监听,处理el.nativeEvents或el.events对象，他们的格式为
        /**
         * {
         *    [eventName]: handler | handler[],
         * }，
         * handler格式
         * {
         *    value: string,
         *    modifiers: { [name: string]: true }
         * }
         * 针对不同的内置修饰符，eventName的格式有所不同，如name.once会变成 `~name`
         */
        addHandler(el, name, value, modifiers, false, warn)
      } else {
        // normal directives，普通指令， v-xxx
        name = name.replace(dirRE, '')
        // parse arg，解析指令参数
        const argMatch = name.match(argRE)
        const arg = argMatch && argMatch[1]
        if (arg) {
          name = name.slice(0, -(arg.length + 1))
        }
        // 添加el.directives数组元素
        // el.directives.push({ name, rawName, value, arg, modifiers })
        addDirective(el, name, rawName, value, arg, modifiers)
        if (process.env.NODE_ENV !== 'production' && name === 'model') {
          checkForAliasModel(el, value)
        }
      }
    } else {
      // literal attribute， 非动态绑定的普通属性
      if (process.env.NODE_ENV !== 'production') {
        const res = parseText(value, delimiters)
        if (res) {
          warn(
            `${name}="${value}": ` +
              'Interpolation inside attributes has been removed. ' +
              'Use v-bind or the colon shorthand instead. For example, ' +
              'instead of <div id="{{ val }}">, use <div :id="val">.'
          )
        }
      }
      // 往el.attrs上添加元素,attrs的结构与attrsList相同
      addAttr(el, name, JSON.stringify(value))
      // #6887 firefox doesn't update muted state if set via attribute
      // even immediately after element creation
      if (!el.component && name === 'muted' && platformMustUseProp(el.tag, el.attrsMap.type, name)) {
        addProp(el, name, 'true')
      }
    }
  }
}

function checkInFor (el: ASTElement): boolean {
  let parent = el
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent
  }
  return false
}

function parseModifiers (name: string): Object | void {
  const match = name.match(modifierRE)
  if (match) {
    const ret = {}
    match.forEach(m => {
      ret[m.slice(1)] = true
    })
    return ret
  }
}

function makeAttrsMap (attrs: Array<Object>): Object {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (process.env.NODE_ENV !== 'production' && map[attrs[i].name] && !isIE && !isEdge) {
      warn('duplicate attribute: ' + attrs[i].name)
    }
    map[attrs[i].name] = attrs[i].value
  }
  return map
}

// for script (e.g. type="x/template") or style, do not decode content
function isTextTag (el): boolean {
  return el.tag === 'script' || el.tag === 'style'
}

function isForbiddenTag (el): boolean {
  return el.tag === 'style' || (el.tag === 'script' && (!el.attrsMap.type || el.attrsMap.type === 'text/javascript'))
}

const ieNSBug = /^xmlns:NS\d+/
const ieNSPrefix = /^NS\d+:/

/* istanbul ignore next */
function guardIESVGBug (attrs) {
  const res = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

function checkForAliasModel (el, value) {
  let _el = el
  while (_el) {
    if (_el.for && _el.alias === value) {
      warn(
        `<${el.tag} v-model="${value}">: ` +
          `You are binding v-model directly to a v-for iteration alias. ` +
          `This will not be able to modify the v-for source array because ` +
          `writing to the alias is like modifying a function local variable. ` +
          `Consider using an array of objects and use v-model on an object property instead.`
      )
    }
    _el = _el.parent
  }
}
