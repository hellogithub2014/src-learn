/* @flow */

const validDivisionCharRE = /[\w).+\-_$\]]/

// parseFilters将入参看成是 expression+filters结构，
// 最终返回拼接的字符串，如"_f("upper")(title)"
export function parseFilters (exp: string): string {
  let inSingle = false
  let inDouble = false
  let inTemplateString = false
  let inRegex = false
  let curly = 0
  let square = 0
  let paren = 0
  let lastFilterIndex = 0 // 最近一次发现过滤器|的位置
  let c, prev, i, expression, filters

  for (i = 0; i < exp.length; i++) {
    prev = c // 前一个字符
    c = exp.charCodeAt(i) // 当前字符
    if (inSingle) {
      // 0x27 => '  0x5c => \
      if (c === 0x27 && prev !== 0x5c) inSingle = false
    } else if (inDouble) {
      // 0x22 => "
      if (c === 0x22 && prev !== 0x5c) inDouble = false
    } else if (inTemplateString) {
      // 0x60 => `
      if (c === 0x60 && prev !== 0x5c) inTemplateString = false
    } else if (inRegex) {
      // 0x2f => /
      if (c === 0x2f && prev !== 0x5c) inRegex = false
    } else if (
      c === 0x7c && // pipe, 0x7c => |
      exp.charCodeAt(i + 1) !== 0x7c &&
      exp.charCodeAt(i - 1) !== 0x7c &&
      !curly &&
      !square &&
      !paren
    ) {
      // 如果是遇到的第一个 |
      if (expression === undefined) {
        // first filter, end of expression
        lastFilterIndex = i + 1
        expression = exp.slice(0, i).trim() // | 前面的表达式
      } else {
        pushFilter() // 将前一个filter推入filters栈
      }
    } else {
      // 此前一直是普通文本，在这里判断是不是某些特殊字符，如 (
      switch (c) {
        case 0x22:
          inDouble = true
          break // "
        case 0x27:
          inSingle = true
          break // '
        case 0x60:
          inTemplateString = true
          break // `
        case 0x28:
          paren++
          break // (
        case 0x29:
          paren--
          break // )
        case 0x5b:
          square++
          break // [
        case 0x5d:
          square--
          break // ]
        case 0x7b:
          curly++
          break // {
        case 0x7d:
          curly--
          break // }
      }
      // 0x2f => / ,  判断是否当前位于正则表达式当中
      if (c === 0x2f) {
        let j = i - 1
        let p
        // find first non-whitespace prev char
        for (; j >= 0; j--) {
          p = exp.charAt(j)
          if (p !== ' ') break
        }
        if (!p || !validDivisionCharRE.test(p)) {
          inRegex = true
        }
      }
    }
  }

  if (expression === undefined) {
    // 如果始终没有|，那么整个入参都当做expression。
    expression = exp.slice(0, i).trim()
  } else if (lastFilterIndex !== 0) {
    // 如果之前在某个位置遇到了一个|，那么从那里到exp末尾都是这个filter
    pushFilter()
  }

  function pushFilter () {
    ;(filters || (filters = [])).push(exp.slice(lastFilterIndex, i).trim())
    lastFilterIndex = i + 1
  }
  // exp = "title|upper(123,456)|sense" => filters = ["upper(123,456)","sense"]
  // for循环后，expression = "_f("sense")(_f("upper")(title,123,456))"
  if (filters) {
    for (i = 0; i < filters.length; i++) {
      // wrapFilter('title', 'upper') =>   "_f("upper")(title)"
      // wrapFilter('title', 'upper(123,456)') => "_f("upper")(title,123,456)"
      expression = wrapFilter(expression, filters[i])
    }
  }

  return expression
}

function wrapFilter (exp: string, filter: string): string {
  // filter的形式可以是 exp| filter，或者exp| filterName(filterArg)
  const i = filter.indexOf('(')
  if (i < 0) {
    // _f: resolveFilter
    return `_f("${filter}")(${exp})`
  } else {
    const name = filter.slice(0, i)
    const args = filter.slice(i + 1)
    return `_f("${name}")(${exp}${args !== ')' ? ',' + args : args}`
  }
}
