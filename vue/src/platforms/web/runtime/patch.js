/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
/**
 * platformModules： 平台相关的一些属性的处理，包括attrs、class、domProps、on、style和show。
 * 代码位于src/platforms/web/runtime/modules/index.js，每个子module都会包含create和update两个钩子。
 *
 * baseModules：是web和weex都有的处理，包括directives和ref属性的处理。
 * 代码位于src/core/vdom/modules/index.js，每个子module同样会包含create和update两个钩子。
 */
const modules = platformModules.concat(baseModules)

export const patch: Function = createPatchFunction({ nodeOps, modules })
