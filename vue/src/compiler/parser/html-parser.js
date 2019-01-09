/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'

// Regular Expressions for parsing tags and attributes
// 匹配标签属性，如href="www.baidu.com" 或 href='www.baidu.com'
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
const ncname = '[a-zA-Z_][\\w\\-\\.]*' // 以a-zA-Z_开头，后面连接多个a-zA-Z-.
const qnameCapture = `((?:${ncname}\\:)?${ncname})` // ncname:ncname, 用于匹配命名空间如 svg:path
const startTagOpen = new RegExp(`^<${qnameCapture}`) // 起始标签
const startTagClose = /^\s*(\/?)>/ // 起始标签结束
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`) // 结束标签
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being pased as HTML comment when inlined in page
const comment = /^<!\--/
const conditionalComment = /^<!\[/

let IS_REGEX_CAPTURING_BROKEN = false
'x'.replace(/x(.)?/g, function (m, g) {
  IS_REGEX_CAPTURING_BROKEN = g === ''
})

// Special Elements (can contain anything)
// 根据字符串生成map，{script：true，style：true，textarea：true}
// 主要用于判断是否某个字符串为map中的一员
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML (html, options) {
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    // isPlainTextElement是否script、style、textarea
    // lastTag：最近正在处理的起始标签，在parseStartTag和parseEndTag会被设置
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')

      // 如果当前剩余的html是以<开头的，那么很有可能它是注释、条件注释、Doctype、结束标签、开始标签中的一个
      // if里面的逻辑就是挨个尝试每一种可能
      if (textEnd === 0) {
        // Comment注释
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            if (options.shouldKeepComment) {
              // 调用parse方法传递的comment选项
              options.comment(html.substring(4, commentEnd))
            }
            advance(commentEnd + 3) // index递进到指定位置，html截取
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // IE的条件注释 <![开头
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag结束标签
        // 若html为'</a>'，则endTagMatch为['</a>','a',groups:undefined,index:0]
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag其实标签
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(lastTag, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      /**
       * 如果当前剩余的html不是以<开头，那么有可能是纯文本。例如：
       * `
       * 这里是文本
            <a :href="url" target="_blank">前面的文本{{title}}后面的文本</a>
            <img :src="img">
          </div>
       * `
      */
      if (textEnd >= 0) {
        rest = html.slice(textEnd)
        // 如果剩下的以<开头的那段，不是结束标签、开始标签、注释、条件注释，那么它很有可能就是一个孤零零的<字符
        // 继续往后递进，直到再也没有<，或者其中一个while条件不满足
        while (!endTag.test(rest) && !startTagOpen.test(rest) && !comment.test(rest) && !conditionalComment.test(rest)) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break // 如果后面再也没有<，直接跳出while
          textEnd += next
          rest = html.slice(textEnd) // 递进到下一段以<开头的文本
        }
        text = html.substring(0, textEnd) // 截取位于之间的纯文本，如’这里是文本‘
        advance(textEnd)
      }

      // 如果剩下的文本没有<了，那么它们就都是纯文本了
      if (textEnd < 0) {
        text = html
        html = ''
      }

      if (options.chars && text) {
        options.chars(text) // 调用位于parse中的chars配置
      }
    } else {
      /**
       * 如果处理到了script、style、textarea。例如
       * 原始html=`<div><script>console.log( 123 )</script></div>`,
       * 在此时lastTag = `script`,html剩余`console.log( 123 )</script></div>`
       */
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      // 匹配到对应的script/style/textarea闭标签
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        /**
         * all = "console.log( 123 )</script>"
         * text='console.log( 123 )'
         * endTag="</script>"
         */
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      // 此时rest为去除script/style/textarea后剩下的
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index) // 处理script/style/textarea结束标签
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  function advance (n) {
    index += n
    html = html.substring(n)
  }

  /**
   * 解析起始标签，标签为`<div id="app">`，则返回
   * {
   *    tagName: 'div',
        attrs: [
          ['id="app"','id','=','app',undefined,undefined]
        ],
        start: 0,
        end: 14,
        unarySlash: ""
   * }
   */
  function parseStartTag () {
    // `<div id="app">`.match(startTagOpen) =>
    // ['<div','div']
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      // 如果不是以结束标签开头，并且有html属性。
      // `id="app">`.match(attribute)  =>
      // ['id="app"','id','=','app']
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        advance(attr[0].length)
        match.attrs.push(attr)
      }
      // ['>','']
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }
  // match的格式就是上面的parseStartTag返回值
  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }
    // isUnaryTag是否为单标签元素，如<img>，所有单标签元素：
    // 'area,base,br,col,embed,frame,hr,img,input,isindex,keygen'
    // 'link,meta,param,source,track,wbr'
    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') {
          delete args[3]
        }
        if (args[4] === '') {
          delete args[4]
        }
        if (args[5] === '') {
          delete args[5]
        }
      }
      // args格式： ['id="app"','id','=','app',undefined,undefined]
      const value = args[3] || args[4] || args[5] || ''
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href' ? options.shouldDecodeNewlinesForHref : options.shouldDecodeNewlines
      // attrs格式 ： {name:string, value:string}[]
      // 如 [{name:'id',value:'app'}]
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
    }

    // 如果不是单标签元素，那么先把这个其实标签记到标签堆栈当中，当遇到对应的结束标签时再出栈.
    /**
     * stack格式示范：
     * [
     *  {
     *    tag: 'div',
     *    lowerCasedTag: 'div',
     *    attrs: [ {name:'id',value:'app'} ]
     *  }
     * ]
     */
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName // 标记当前正处理到哪个标签
    }

    if (options.start) {
      // 调用parse函数中的start选项
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  /**
   * 处理结束标签
   * @param {String} tagName 标签名，如'a'
   * @param {Number} start 标签名在html字符串中的起始位置,如79
   * @param {Number} end 标签名在html字符串中的结束位置，如83
   */
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
    }

    // Find the closest opened tag of the same type
    if (tagName) {
      /**
       * 找到已处理过的离这个结束标签最近的开始标签，类似括号匹配中的).
       * 若最初的html为：
       * <div id="app">
            <a :href="url" target="_blank">前面的文本{{title}}后面的文本</a>
            <img :src="img" />
          </div>

       * 则处理到</a>这个结束标签时，stack示范:
       * [
       *  {lowerCasedTag: "div", tag: "div"},
       *  {lowerCasedTag: "a", tag: "a"}
       * ]
       */
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      // 处理位于这一对开始、结束标签之间的所有标签。 挨个调用位于parse中的end选项
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' && (i > pos || !tagName) && options.warn) {
          options.warn(`tag <${stack[i].tag}> has no matching end tag.`)
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
