/* @flow */

let decoder

export default {
  // 去除html中所有的标签
  decode (html: string): string {
    decoder = decoder || document.createElement('div')
    decoder.innerHTML = html
    return decoder.textContent
  }
}
