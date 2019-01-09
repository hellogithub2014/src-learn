/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

// 真正调用的是位于src/compiler/create-compiler.js中createCompilerCreator返回的createCompiler函数
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
