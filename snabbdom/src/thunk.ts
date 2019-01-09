import { VNode, VNodeData } from './vnode';
import { h } from './h';

export interface ThunkData extends VNodeData {
  fn: () => VNode;
  args: Array<any>;
}

export interface Thunk extends VNode {
  data: ThunkData;
}

export interface ThunkFn {
  (sel: string, fn: Function, args: Array<any>): Thunk;
  (sel: string, key: any, fn: Function, args: Array<any>): Thunk;
}
// 将 vnode 上的数据拷贝到 thunk 上，在 patchVnode 中会进行判断，如果相同会结束 patchVnode
// 并将 thunk 的 fn 和 args 属性保存到 vnode 上，在 prepatch 时需要进行比较
function copyToThunk(vnode: VNode, thunk: VNode): void {
  thunk.elm = vnode.elm;
  (vnode.data as VNodeData).fn = (thunk.data as VNodeData).fn;
  (vnode.data as VNodeData).args = (thunk.data as VNodeData).args;
  thunk.data = vnode.data;
  thunk.children = vnode.children;
  thunk.text = vnode.text;
  thunk.elm = vnode.elm;
}

function init(thunk: VNode): void {
  const cur = thunk.data as VNodeData;
  const vnode = (cur.fn as any).apply(undefined, cur.args);
  copyToThunk(vnode, thunk);
}

// 在patchVnode的最开始会调用vnode的prepatch钩子
function prepatch(oldVnode: VNode, thunk: VNode): void {
  let i: number,
    old = oldVnode.data as VNodeData,
    cur = thunk.data as VNodeData;
  const oldArgs = old.args,
    args = cur.args;

  // 如果 fn 不同或 args 长度不同，说明发生了变化，调用 fn 生成新的 vnode 并返回
  if (old.fn !== cur.fn || (oldArgs as any).length !== (args as any).length) {
    copyToThunk((cur.fn as any).apply(undefined, args), thunk);
    return;
  }
  for (i = 0; i < (args as any).length; ++i) {
    // 如果每个参数发生变化，逻辑同上
    if ((oldArgs as any)[i] !== (args as any)[i]) {
      copyToThunk((cur.fn as any).apply(undefined, args), thunk);
      return;
    }
  }
  copyToThunk(oldVnode, thunk);
}

// 使用 h 函数返回 vnode，为其添加 init 和 prepatch 钩子
export const thunk = function thunk(sel: string, key?: any, fn?: any, args?: any): VNode {
  if (args === undefined) {
    args = fn;
    fn = key;
    key = undefined;
  }
  return h(sel, {
    key: key,
    hook: { init: init, prepatch: prepatch },
    fn: fn,
    args: args,
  });
} as ThunkFn;

export default thunk;
