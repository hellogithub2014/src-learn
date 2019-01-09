/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

const defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g // {{}}
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g // 匹配需要转义的字符

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
  expression: string,
  tokens: Array<string | { '@binding': string }>
}
/**
 * 处理文本中的插值表达式，如text=`前面的文本{{title}}后面的文本`,则res为
 * {
 *    expression: `"前面的文本"+_s(title)+"后面的文本"`，
 *    tokens：[
 *      "前面的文本"，
 *      {
 *        @binding: "title"
 *      },
 *      "后面的文本"
 *    ]
 * }
 */
export function parseText (text: string, delimiters?: [string, string]): TextParseResult | void {
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  if (!tagRE.test(text)) {
    return
  }
  const tokens = [] // 主要用于存放text被{{}}切割的分段子文本
  const rawTokens = [] // rawTokens和tokens的差别主要在处理插值表达式
  let lastIndex = (tagRE.lastIndex = 0) // lastIndex: 每次正则表达式匹配结束后，下一次匹配的起始位置
  let match, index, tokenValue
  /**
   * text=`前面的文本{{title}}后面的文本`,则match为
   * [
   *    0: "{{title}}",
        1: "title",
        groups: undefined,
        index: 5,
   * ]
   */
  while ((match = tagRE.exec(text))) {
    index = match.index
    // push text token
    if (index > lastIndex) {
      rawTokens.push((tokenValue = text.slice(lastIndex, index)))
      tokens.push(JSON.stringify(tokenValue))
    }
    // tag token
    const exp = parseFilters(match[1].trim())
    tokens.push(`_s(${exp})`)
    rawTokens.push({ '@binding': exp })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    rawTokens.push((tokenValue = text.slice(lastIndex)))
    tokens.push(JSON.stringify(tokenValue))
  }
  return {
    expression: tokens.join('+'),
    tokens: rawTokens
  }
}
