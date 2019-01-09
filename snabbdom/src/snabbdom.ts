/* global module, document, Node */
import { Module } from './modules/module';
import { Hooks } from './hooks';
import vnode, { VNode, VNodeData, Key } from './vnode';
import * as is from './is';
import htmlDomApi, { DOMAPI } from './htmldomapi';

function isUndef(s: any): boolean {
  return s === undefined;
}
function isDef(s: any): boolean {
  return s !== undefined;
}

type VNodeQueue = Array<VNode>;

const emptyNode = vnode('', {}, [], undefined, undefined);

function sameVnode(vnode1: VNode, vnode2: VNode): boolean {
  return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel;
}

function isVnode(vnode: any): vnode is VNode {
  return vnode.sel !== undefined;
}

type KeyToIndexMap = { [key: string]: number };

type ArraysOf<T> = { [K in keyof T]: (T[K])[] };

type ModuleHooks = ArraysOf<Module>;

// 创建节点的key到下标之间的映射
function createKeyToOldIdx(children: Array<VNode>, beginIdx: number, endIdx: number): KeyToIndexMap {
  let i: number,
    map: KeyToIndexMap = {},
    key: Key | undefined,
    ch;
  for (i = beginIdx; i <= endIdx; ++i) {
    ch = children[i];
    if (ch != null) {
      key = ch.key;
      if (key !== undefined) map[key] = i;
    }
  }
  return map;
}

const hooks: (keyof Module)[] = ['create', 'update', 'remove', 'destroy', 'pre', 'post'];

export { h } from './h';
export { thunk } from './thunk';

export function init(modules: Array<Partial<Module>>, domApi?: DOMAPI) {
  let i: number,
    j: number,
    cbs = {} as ModuleHooks;

  const api: DOMAPI = domApi !== undefined ? domApi : htmlDomApi;

  // 查找例如每一个module中的create钩子，放到cbs['create']数组中
  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = [];
    for (j = 0; j < modules.length; ++j) {
      const hook = modules[j][hooks[i]];
      if (hook !== undefined) {
        (cbs[hooks[i]] as Array<any>).push(hook);
      }
    }
  }

  function emptyNodeAt(elm: Element) {
    const id = elm.id ? '#' + elm.id : '';
    const c = elm.className ? '.' + elm.className.split(' ').join('.') : '';
    return vnode(api.tagName(elm).toLowerCase() + id + c, {}, [], undefined, elm);
  }

  // 只有当所有的 remove hook 都调用了，remove callback 才会移除 dom
  function createRmCb(childElm: Node, listeners: number) {
    return function rmCb() {
      if (--listeners === 0) {
        const parent = api.parentNode(childElm);
        api.removeChild(parent, childElm);
      }
    };
  }

  function createElm(vnode: VNode, insertedVnodeQueue: VNodeQueue): Node {
    let i: any,
      data = vnode.data;
    // 调用vnode的init钩子
    if (data !== undefined) {
      if (isDef((i = data.hook)) && isDef((i = i.init))) {
        i(vnode);
        data = vnode.data;
      }
    }
    let children = vnode.children,
      sel = vnode.sel;
    // 注释节点
    if (sel === '!') {
      if (isUndef(vnode.text)) {
        vnode.text = '';
      }
      vnode.elm = api.createComment(vnode.text as string);
    } else if (sel !== undefined) {
      // Parse selector
      /**
       * 若sel为div#app.wrap1.wrap2,
       * 则最终hashIdx = 3
       * dotIdx = 7
       * hash = 3
       * dot = 7
       * tag = div
       */
      const hashIdx = sel.indexOf('#');
      const dotIdx = sel.indexOf('.', hashIdx);
      const hash = hashIdx > 0 ? hashIdx : sel.length;
      const dot = dotIdx > 0 ? dotIdx : sel.length;
      const tag = hashIdx !== -1 || dotIdx !== -1 ? sel.slice(0, Math.min(hash, dot)) : sel;
      // 创建一个dom元素，如div元素
      const elm = (vnode.elm = isDef(data) && isDef((i = (data as VNodeData).ns)) ? api.createElementNS(i, tag) : api.createElement(tag));
      // 设置id,如app
      if (hash < dot) elm.setAttribute('id', sel.slice(hash + 1, dot));
      // 设置class，如'wrap1 wrap2'
      if (dotIdx > 0) elm.setAttribute('class', sel.slice(dot + 1).replace(/\./g, ' '));
      // 调用每一个module上的create钩子
      for (i = 0; i < cbs.create.length; ++i) cbs.create[i](emptyNode, vnode);
      // 插入子节点
      if (is.array(children)) {
        for (i = 0; i < children.length; ++i) {
          const ch = children[i];
          if (ch != null) {
            api.appendChild(elm, createElm(ch as VNode, insertedVnodeQueue));
          }
        }
      } else if (is.primitive(vnode.text)) {
        // 插入文本子节点
        api.appendChild(elm, api.createTextNode(vnode.text));
      }
      i = (vnode.data as VNodeData).hook; // Reuse variable
      if (isDef(i)) {
        // 调用 vnode上的 create hook
        if (i.create) i.create(emptyNode, vnode);
        // insert hook 存储起来 等 dom 插入后才会调用，
        // 这里用个数组来保存能避免调用时再次对 vnode 树做遍历
        if (i.insert) insertedVnodeQueue.push(vnode);
      }
    } else {
      // vnode没有选择器，直接利用text建立一个文本节点当做节点
      vnode.elm = api.createTextNode(vnode.text as string);
    }
    return vnode.elm;
  }

  function addVnodes(parentElm: Node, before: Node | null, vnodes: Array<VNode>, startIdx: number, endIdx: number, insertedVnodeQueue: VNodeQueue) {
    for (; startIdx <= endIdx; ++startIdx) {
      const ch = vnodes[startIdx];
      if (ch != null) {
        api.insertBefore(parentElm, createElm(ch, insertedVnodeQueue), before);
      }
    }
  }

  function invokeDestroyHook(vnode: VNode) {
    let i: any,
      j: number,
      data = vnode.data;
    if (data !== undefined) {
      // 调用node的destroy钩子
      if (isDef((i = data.hook)) && isDef((i = i.destroy))) i(vnode);
      // 调用每个module的destroy钩子
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode);
      // 调用每个子节点的invokeDestroyHook
      if (vnode.children !== undefined) {
        for (j = 0; j < vnode.children.length; ++j) {
          i = vnode.children[j];
          if (i != null && typeof i !== 'string') {
            invokeDestroyHook(i);
          }
        }
      }
    }
  }

  function removeVnodes(parentElm: Node, vnodes: Array<VNode>, startIdx: number, endIdx: number): void {
    for (; startIdx <= endIdx; ++startIdx) {
      let i: any,
        listeners: number,
        rm: () => void,
        ch = vnodes[startIdx];
      if (ch != null) {
        if (isDef(ch.sel)) {
          // 调用 destory hook， module+node自身+每个子节点
          invokeDestroyHook(ch);
          // 计算需要调用 removecallback 的次数 只有全部调用了才会移除 dom
          listeners = cbs.remove.length + 1;
          rm = createRmCb(ch.elm as Node, listeners);
          // 调用每个module的remove钩子
          for (i = 0; i < cbs.remove.length; ++i) cbs.remove[i](ch, rm);
          if (isDef((i = ch.data)) && isDef((i = i.hook)) && isDef((i = i.remove))) {
            // 调用node自身的remove钩子
            i(ch, rm);
          } else {
            rm();
          }
        } else {
          // Text node
          api.removeChild(parentElm, ch.elm as Node);
        }
      }
    }
  }

  function updateChildren(parentElm: Node, oldCh: Array<VNode>, newCh: Array<VNode>, insertedVnodeQueue: VNodeQueue) {
    let oldStartIdx = 0,
      newStartIdx = 0;
    let oldEndIdx = oldCh.length - 1;
    let oldStartVnode = oldCh[0];
    let oldEndVnode = oldCh[oldEndIdx];
    let newEndIdx = newCh.length - 1;
    let newStartVnode = newCh[0];
    let newEndVnode = newCh[newEndIdx];
    let oldKeyToIdx: any;
    let idxInOld: number;
    let elmToMove: VNode;
    let before: any;

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (oldStartVnode == null) {
        // 旧数组的开头为空，向后移一位
        oldStartVnode = oldCh[++oldStartIdx]; // Vnode might have been moved left
      } else if (oldEndVnode == null) {
        // 旧数组的结尾为空，向前移一位
        oldEndVnode = oldCh[--oldEndIdx];
      } else if (newStartVnode == null) {
        // 新数组的开头为空，向后移一位
        newStartVnode = newCh[++newStartIdx];
      } else if (newEndVnode == null) {
        // 新数组的结尾为空，向前移一位
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        // 旧数组的开头和新数组的开头相同，调用patcVnode，各自均向后移一位
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
        oldStartVnode = oldCh[++oldStartIdx];
        newStartVnode = newCh[++newStartIdx];
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        // 旧数组的结尾和新数组的结尾相同，调用patcVnode，各自均向前移一位
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
        oldEndVnode = oldCh[--oldEndIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldStartVnode, newEndVnode)) {
        // 旧数组的开头和新数组的结尾相同，调用patcVnode，旧数组向后移一位，新数组向前移一位
        // 同时将旧数组的开头插入到旧数组结尾之前
        // Vnode moved right
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldStartVnode.elm as Node, api.nextSibling(oldEndVnode.elm as Node));
        oldStartVnode = oldCh[++oldStartIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldEndVnode, newStartVnode)) {
        // 旧数组的结尾和新数组的开头相同，调用patcVnode，旧数组向前移一位，新数组向后移一位
        // 同时将旧数组的结尾插入到旧数组开头之前
        // Vnode moved left
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldEndVnode.elm as Node, oldStartVnode.elm as Node);
        oldEndVnode = oldCh[--oldEndIdx];
        newStartVnode = newCh[++newStartIdx];
      } else {
        if (oldKeyToIdx === undefined) {
          oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
        }
        // 新数组开头的节点在旧数组中的下标，使用key来判断
        idxInOld = oldKeyToIdx[newStartVnode.key as string];
        if (isUndef(idxInOld)) {
          // 如果下标不存在，说明这个节点是新创建的，插入到旧数组的当前开头之前，新数组向后移一位
          // New element
          api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm as Node);
          newStartVnode = newCh[++newStartIdx];
        } else {
          // 待删除元素，这是需要移动位置的节点
          elmToMove = oldCh[idxInOld];
          if (elmToMove.sel !== newStartVnode.sel) {
            // 创建新的node节点插入到旧数组的当前开头之前
            // 虽然 key 相同了，但是 seletor 不相同，需要调用 createElm 来创建新的 dom 节点
            api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm as Node);
          } else {
            // 调用 patchVnode 对旧 vnode 做更新
            patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);
            // 旧数组中的这个位置清空，并将待删除元素插入到旧数组的当前开头之前,等下次循环到这个下标的时候直接跳过
            oldCh[idxInOld] = undefined as any;
            api.insertBefore(parentElm, elmToMove.elm as Node, oldStartVnode.elm as Node);
          }
          newStartVnode = newCh[++newStartIdx];
        }
      }
    }
    if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
      // 还有剩余的newChildren，将这些加入dom树
      if (oldStartIdx > oldEndIdx) {
        before = newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].elm;
        addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
      } else {
        // 还有剩余的oldChildren，将这些删除
        removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
      }
    }
  }

  function patchVnode(oldVnode: VNode, vnode: VNode, insertedVnodeQueue: VNodeQueue) {
    let i: any, hook: any;
    // 调用vnode本身的prepatch钩子
    if (isDef((i = vnode.data)) && isDef((hook = i.hook)) && isDef((i = hook.prepatch))) {
      i(oldVnode, vnode);
    }
    // 让vnode.elm引用到真实的dom，elm修改时vnode.elm会同步修改
    const elm = (vnode.elm = oldVnode.elm as Node);
    let oldCh = oldVnode.children;
    let ch = vnode.children;
    if (oldVnode === vnode) return;
    if (vnode.data !== undefined) {
      // 调用每个module的update钩子
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode);
      i = vnode.data.hook;
      // 调用vnode自身的update钩子
      if (isDef(i) && isDef((i = i.update))) i(oldVnode, vnode);
    }
    if (isUndef(vnode.text)) {
      if (isDef(oldCh) && isDef(ch)) {
        // 这里，新旧节点均存在 children，且不一样时，对 children 进行 diff
        // thunk 中会做相关优化和这个相关
        if (oldCh !== ch) updateChildren(elm, oldCh as Array<VNode>, ch as Array<VNode>, insertedVnodeQueue);
      } else if (isDef(ch)) {
        // 这里，旧节点不存在 children，新节点有 children，相当于是新增子节点
        // 旧节点存在text则置空
        if (isDef(oldVnode.text)) api.setTextContent(elm, '');
        // 添加新的children，追加为elm的新子节点
        addVnodes(elm, null, ch as Array<VNode>, 0, (ch as Array<VNode>).length - 1, insertedVnodeQueue);
      } else if (isDef(oldCh)) {
        // 这里，新节点不存在 children，旧节点有 children，相当于是删除子节点。
        // 从elm中删除这些子节点
        removeVnodes(elm, oldCh as Array<VNode>, 0, (oldCh as Array<VNode>).length - 1);
      } else if (isDef(oldVnode.text)) {
        // 这里，新旧节点均没有children，同时isUndef(vnode.text)表明新节点是必然没有text的，此时将旧text清空
        api.setTextContent(elm, '');
      }
    } else if (oldVnode.text !== vnode.text) {
      // 新旧vnode均有text，更新text文本
      api.setTextContent(elm, vnode.text as string);
    }
    // 调用vnode自身的postpatch钩子
    if (isDef(hook) && isDef((i = hook.postpatch))) {
      i(oldVnode, vnode);
    }
  }

  return function patch(oldVnode: VNode | Element, vnode: VNode): VNode {
    let i: number, elm: Node, parent: Node;
    const insertedVnodeQueue: VNodeQueue = [];
    // 调用每个module中的pre hook
    for (i = 0; i < cbs.pre.length; ++i) cbs.pre[i]();

    // 如果传入的是 Element 转成空的 vnode
    if (!isVnode(oldVnode)) {
      oldVnode = emptyNodeAt(oldVnode);
    }

    // sameVnode 时 (sel 和 key相同) 调用 patchVnode，即对新旧vnode做diff算法
    if (sameVnode(oldVnode, vnode)) {
      patchVnode(oldVnode, vnode, insertedVnodeQueue);
    } else {
      // 这个else分支就是用新vnode替换旧vnode的过程
      elm = oldVnode.elm as Node;
      parent = api.parentNode(elm);
      // 创建新的 dom 节点 vnode.elm
      createElm(vnode, insertedVnodeQueue);

      if (parent !== null) {
        // 插入 新dom
        api.insertBefore(parent, vnode.elm as Node, api.nextSibling(elm));
        // 移除旧dom
        removeVnodes(parent, [oldVnode], 0, 0);
      }
    }
    // 调用元素上的 insert hook，注意 insert hook 在 module 上不支持
    for (i = 0; i < insertedVnodeQueue.length; ++i) {
      (((insertedVnodeQueue[i].data as VNodeData).hook as Hooks).insert as any)(insertedVnodeQueue[i]);
    }
    // 调用每个module中的pre hook
    for (i = 0; i < cbs.post.length; ++i) cbs.post[i]();
    return vnode;
  };
}
