import { rebuild, buildNodeWithSN } from 'rrweb-snapshot';
import * as mittProxy from 'mitt';
import * as smoothscroll from 'smoothscroll-polyfill';
import Timer from './timer';
import {
  EventType,
  IncrementalSource,
  fullSnapshotEvent,
  eventWithTime,
  MouseInteractions,
  playerConfig,
  playerMetaData,
  viewportResizeDimention,
  missingNodeMap,
  addedNodeMutation,
  missingNode,
  actionWithDelay,
  incrementalSnapshotEvent,
  incrementalData,
  ReplayerEvents,
  Handler,
  Emitter,
} from '../types';
import { mirror, polyfill } from '../utils';
import getInjectStyleRules from './styles/inject-style';
import './styles/style.css';

const SKIP_TIME_THRESHOLD = 10 * 1000;
const SKIP_TIME_INTERVAL = 5 * 1000;

// https://github.com/rollup/rollup/issues/1267#issuecomment-296395734
// tslint:disable-next-line
const mitt = (mittProxy as any).default || mittProxy;

const REPLAY_CONSOLE_PREFIX = '[replayer]';

export class Replayer {
  public wrapper: HTMLDivElement;
  public iframe: HTMLIFrameElement;

  public timer: Timer;

  private events: eventWithTime[] = [];
  private config: playerConfig;

  private mouse: HTMLDivElement;

  private emitter: Emitter = mitt();

  private baselineTime: number = 0;
  // record last played event timestamp when paused
  private lastPlayedEvent: eventWithTime;

  private nextUserInteractionEvent: eventWithTime | null; // 下一个属于用户交互产生的事件
  private noramlSpeed: number = -1;

  private missingNodeRetryMap: missingNodeMap = {};

  constructor(events: eventWithTime[], config?: Partial<playerConfig>) {
    if (events.length < 2) {
      throw new Error('Replayer need at least 2 events.');
    }
    this.events = events;
    this.handleResize = this.handleResize.bind(this);

    const defaultConfig: playerConfig = {
      speed: 1, // 倍数
      root: document.body,
      loadTimeout: 0,
      skipInactive: false,
      showWarning: true,
      showDebug: false,
      blockClass: 'rr-block',
      liveMode: false,
      insertStyleRules: [],
    };
    this.config = Object.assign({}, defaultConfig, config);

    this.timer = new Timer(this.config);
    smoothscroll.polyfill();
    polyfill();
    this.setupDom();
    this.emitter.on('resize', this.handleResize as Handler);
  }

  public on(event: string, handler: Handler) {
    this.emitter.on(event, handler);
  }

  // 覆盖当前设置
  public setConfig(config: Partial<playerConfig>) {
    Object.keys(config).forEach((key: keyof playerConfig) => {
      this.config[key] = config[key]!;
    });
    if (!this.config.skipInactive) {
      this.noramlSpeed = -1;
    }
  }

  public getMetaData(): playerMetaData {
    const firstEvent = this.events[0];
    const lastEvent = this.events[this.events.length - 1];
    return {
      totalTime: lastEvent.timestamp - firstEvent.timestamp, // 录屏总时长
    };
  }

  public getCurrentTime(): number {
    return this.timer.timeOffset + this.getTimeOffset();
  }

  public getTimeOffset(): number {
    return this.baselineTime - this.events[0].timestamp;
  }

  /**
   * This API was designed to be used as play at any time offset.
   * Since we minimized the data collected from recorder, we do not
   * have the ability of undo an event.
   * So the implementation of play at any time offset will always iterate
   * all of the events, cast event before the offset synchronously
   * and cast event after the offset asynchronously with timer.
   * @param timeOffset number 表示一个时长，目的是指定时间开始播放，比如指定第5s开始播放
   */
  public play(timeOffset = 0) {
    this.timer.clear();
    this.baselineTime = this.events[0].timestamp + timeOffset; // 重置基准时间戳为：初始事件时间戳+用户指定的时长
    const actions = new Array<actionWithDelay>();
    for (const event of this.events) {
      const isSync = event.timestamp < this.baselineTime;
      const castFn = this.getCastFn(event, isSync);
      if (isSync) {
        castFn(); // 在baselineTime之前的event先同步执行掉
      } else {
        actions.push({ doAction: castFn, delay: this.getDelay(event) });
      }
    }
    this.timer.addActions(actions);
    this.timer.start();
    this.emitter.emit(ReplayerEvents.Start);
  }

  public pause() {
    this.timer.clear(); // 会清空内部所有actions
    this.emitter.emit(ReplayerEvents.Pause);
  }

  /**
   * 从指定的时长开始恢复播放
   *
   * @author liubin.frontend
   * @param {number} [timeOffset=0] 与play方法参数作用相同
   * @memberof Replayer
   */
  public resume(timeOffset = 0) {
    this.timer.clear(); // 会清空内部所有actions
    this.baselineTime = this.events[0].timestamp + timeOffset;
    const actions = new Array<actionWithDelay>();
    for (const event of this.events) {
      // 跳过已经播放过的event
      if (
        event.timestamp <= this.lastPlayedEvent.timestamp ||
        event === this.lastPlayedEvent
      ) {
        continue;
      }
      // 这行以下的逻辑和this.play一致
      const castFn = this.getCastFn(event);
      actions.push({
        doAction: castFn,
        delay: this.getDelay(event),
      });
    }
    this.timer.addActions(actions);
    this.timer.start();
    this.emitter.emit(ReplayerEvents.Resume);
  }

  public addEvent(event: eventWithTime) {
    const castFn = this.getCastFn(event, true);
    castFn();
  }

  // 设置回放的核心DOM元素： warpper、鼠标模拟元素、iframe沙盒
  private setupDom() {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('replayer-wrapper');
    this.config.root.appendChild(this.wrapper);

    this.mouse = document.createElement('div');
    this.mouse.classList.add('replayer-mouse');
    this.wrapper.appendChild(this.mouse);

    this.iframe = document.createElement('iframe');
    // allow-same-origin: 如果没有使用该关键字，嵌入的浏览上下文将被视为来自一个独立的源，这将使 same-origin policy 同源检查失败
    // https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/iframe
    this.iframe.setAttribute('sandbox', 'allow-same-origin');
    this.iframe.setAttribute('scrolling', 'no'); // 控制是否要在框架内显示滚动条
    // pointer-events:指定在什么情况下( 如果有 ) 某个特定的图形元素可以成为鼠标事件的 target。
    // https://developer.mozilla.org/zh-CN/docs/Web/CSS/pointer-events
    this.iframe.setAttribute('style', 'pointer-events: none');
    this.wrapper.appendChild(this.iframe);
  }

  private handleResize(dimension: viewportResizeDimention) {
    this.iframe.width = `${dimension.width}px`;
    this.iframe.height = `${dimension.height}px`;
  }

  // TODO: add speed to mouse move timestamp calculation
  private getDelay(event: eventWithTime): number {
    // Mouse move events was recorded in a throttle function,
    // so we need to find the real timestamp by traverse the time offsets.
    if (
      event.type === EventType.IncrementalSnapshot &&
      event.data.source === IncrementalSource.MouseMove
    ) {
      const firstOffset = event.data.positions[0].timeOffset;
      // timeOffset is a negative offset to event.timestamp
      const firstTimestamp = event.timestamp + firstOffset;
      event.delay = firstTimestamp - this.baselineTime;
      return firstTimestamp - this.baselineTime;
    }
    // event.timestamp 此事件发生的时间戳
    // this.baselineTime： 基准事件戳
    event.delay = event.timestamp - this.baselineTime;
    return event.timestamp - this.baselineTime;
  }

  private getCastFn(event: eventWithTime, isSync = false) {
    let castFn: undefined | (() => void);
    switch (event.type) {
      case EventType.DomContentLoaded:
      case EventType.Load:
        break;
      case EventType.Meta:
        castFn = () =>
          this.emitter.emit(ReplayerEvents.Resize, {
            width: event.data.width,
            height: event.data.height,
          });
        break;
      case EventType.FullSnapshot: // 全量记录
        castFn = () => {
          this.rebuildFullSnapshot(event); // 重建完整DOM到页面
          this.iframe.contentWindow!.scrollTo(event.data.initialOffset);
        };
        break;
      case EventType.IncrementalSnapshot: // 增量记录
        castFn = () => {
          this.applyIncremental(event, isSync);
          if (event === this.nextUserInteractionEvent) {
            this.nextUserInteractionEvent = null;
            this.restoreSpeed();
          }
          if (this.config.skipInactive && !this.nextUserInteractionEvent) {
            // 查找下一个用户交互事件
            for (const _event of this.events) {
              if (_event.timestamp! <= event.timestamp!) {
                continue;
              }
              if (this.isUserInteraction(_event)) {
                if (
                  _event.delay! - event.delay! >
                  SKIP_TIME_THRESHOLD * this.config.speed // config.speed倍数
                ) {
                  this.nextUserInteractionEvent = _event;
                }
                break;
              }
            }
            // 设置倍数
            if (this.nextUserInteractionEvent) {
              this.noramlSpeed = this.config.speed;
              const skipTime =
                this.nextUserInteractionEvent.delay! - event.delay!;
              const payload = {
                speed: Math.min(Math.round(skipTime / SKIP_TIME_INTERVAL), 360),
              };
              this.setConfig(payload);
              this.emitter.emit(ReplayerEvents.SkipStart, payload);
            }
          }
        };
        break;
      default:
    }
    const wrappedCastFn = () => {
      if (castFn) {
        castFn();
      }
      this.lastPlayedEvent = event;
      if (event === this.events[this.events.length - 1]) {
        this.restoreSpeed();
        this.emitter.emit(ReplayerEvents.Finish);
      }
    };
    return wrappedCastFn;
  }

  private rebuildFullSnapshot(
    event: fullSnapshotEvent & { timestamp: number },
  ) {
    if (Object.keys(this.missingNodeRetryMap).length) {
      console.warn(
        'Found unresolved missing node map',
        this.missingNodeRetryMap,
      );
    }
    this.missingNodeRetryMap = {};
    /**
     * 构建页面完整DOM
     * rebuild will build the DOM according to the taken snapshot. There are several things will be done during rebuild:
     * 1. Add data-rrid attribute if the Node is an Element.
     * 2. Create some extra DOM node like text node to place inline CSS and some states.
     * 3. Add data-extra-child-index attribute if Node has some extra child DOM.
     */
    mirror.map = rebuild(event.data.node, this.iframe.contentDocument!)[1];
    // 插入css到iframe
    const styleEl = document.createElement('style');
    const { documentElement, head } = this.iframe.contentDocument!;
    documentElement!.insertBefore(styleEl, head);
    const injectStylesRules = getInjectStyleRules(this.config.blockClass) // 设置iframe的样式
      .concat(this.config.insertStyleRules); // 用户传入的其他内联样式
    for (let idx = 0; idx < injectStylesRules.length; idx++) {
      (styleEl.sheet! as CSSStyleSheet).insertRule(injectStylesRules[idx], idx);
    }
    this.emitter.emit(ReplayerEvents.FullsnapshotRebuilded);
    this.waitForStylesheetLoad();
  }

  /**
   * pause when loading style sheet, resume when loaded all timeout exceed
   */
  private waitForStylesheetLoad() {
    const { head } = this.iframe.contentDocument!;
    if (head) {
      const unloadSheets: Set<HTMLLinkElement> = new Set();
      let timer: number;
      head
        .querySelectorAll('link[rel="stylesheet"]')
        .forEach((css: HTMLLinkElement) => {
          if (!css.sheet) {
            if (unloadSheets.size === 0) {
              this.pause();
              this.emitter.emit(ReplayerEvents.LoadStylesheetStart);
              timer = window.setTimeout(() => {
                this.resume(this.getCurrentTime());
                // mark timer was called
                timer = -1;
              }, this.config.loadTimeout);
            }
            unloadSheets.add(css);
            css.addEventListener('load', () => {
              unloadSheets.delete(css);
              if (unloadSheets.size === 0 && timer !== -1) {
                this.resume(this.getCurrentTime());
                this.emitter.emit(ReplayerEvents.LoadStylesheetEnd);
                if (timer) {
                  window.clearTimeout(timer);
                }
              }
            });
          }
        });
    }
  }

  private applyIncremental(
    e: incrementalSnapshotEvent & { timestamp: number },
    isSync: boolean,
  ) {
    const { data: d } = e;
    switch (d.source) {
      case IncrementalSource.Mutation: {
        // 模拟节点DOM变化：节点创建/销毁、节点属性变化、文本变化
        d.removes.forEach(mutation => {
          const target = mirror.getNode(mutation.id);
          if (!target) {
            return this.warnNodeNotFound(d, mutation.id);
          }
          const parent = mirror.getNode(mutation.parentId);
          if (!parent) {
            return this.warnNodeNotFound(d, mutation.parentId);
          }
          // target may be removed with its parents before
          mirror.removeNodeFromMap(target);
          if (parent) {
            parent.removeChild(target);
          }
        });

        const missingNodeMap: missingNodeMap = { ...this.missingNodeRetryMap };
        const queue: addedNodeMutation[] = [];

        const appendNode = (mutation: addedNodeMutation) => {
          const parent = mirror.getNode(mutation.parentId);
          if (!parent) {
            return queue.push(mutation);
          }
          const target = buildNodeWithSN(
            mutation.node,
            this.iframe.contentDocument!,
            mirror.map,
            true,
          ) as Node;
          let previous: Node | null = null;
          let next: Node | null = null;
          if (mutation.previousId) {
            previous = mirror.getNode(mutation.previousId) as Node;
          }
          if (mutation.nextId) {
            next = mirror.getNode(mutation.nextId) as Node;
          }

          if (mutation.previousId === -1 || mutation.nextId === -1) {
            missingNodeMap[mutation.node.id] = {
              node: target,
              mutation,
            };
            return;
          }

          if (
            previous &&
            previous.nextSibling &&
            previous.nextSibling.parentNode
          ) {
            parent.insertBefore(target, previous.nextSibling);
          } else if (next && next.parentNode) {
            parent.insertBefore(target, next);
          } else {
            parent.appendChild(target);
          }

          if (mutation.previousId || mutation.nextId) {
            this.resolveMissingNode(missingNodeMap, parent, target, mutation);
          }
        };

        d.adds.forEach(mutation => {
          appendNode(mutation);
        });

        while (queue.length) {
          if (queue.every(m => !Boolean(mirror.getNode(m.parentId)))) {
            return queue.forEach(m => this.warnNodeNotFound(d, m.node.id));
          }
          const mutation = queue.shift()!;
          appendNode(mutation);
        }

        if (Object.keys(missingNodeMap).length) {
          Object.assign(this.missingNodeRetryMap, missingNodeMap);
        }

        d.texts.forEach(mutation => {
          const target = mirror.getNode(mutation.id);
          if (!target) {
            return this.warnNodeNotFound(d, mutation.id);
          }
          target.textContent = mutation.value;
        });
        d.attributes.forEach(mutation => {
          const target = mirror.getNode(mutation.id);
          if (!target) {
            return this.warnNodeNotFound(d, mutation.id);
          }
          for (const attributeName in mutation.attributes) {
            if (typeof attributeName === 'string') {
              const value = mutation.attributes[attributeName];
              if (value !== null) {
                ((target as Node) as Element).setAttribute(
                  attributeName,
                  value,
                );
              } else {
                ((target as Node) as Element).removeAttribute(attributeName);
              }
            }
          }
        });
        break;
      }
      case IncrementalSource.MouseMove: // 还原鼠标移动
        if (isSync) {
          const lastPosition = d.positions[d.positions.length - 1];
          this.moveAndHover(d, lastPosition.x, lastPosition.y, lastPosition.id);
        } else {
          d.positions.forEach(p => {
            const action = {
              doAction: () => {
                this.moveAndHover(d, p.x, p.y, p.id);
              },
              delay: p.timeOffset + e.timestamp - this.baselineTime,
            };
            this.timer.addAction(action);
          });
        }
        break;
      case IncrementalSource.MouseInteraction: {
        // 还原鼠标交互
        /**
         * Same as the situation of missing input target.
         */
        if (d.id === -1) {
          break;
        }
        const event = new Event(MouseInteractions[d.type].toLowerCase());
        const target = mirror.getNode(d.id);
        if (!target) {
          return this.debugNodeNotFound(d, d.id);
        }
        this.emitter.emit(ReplayerEvents.MouseInteraction, {
          type: d.type,
          target,
        });
        switch (d.type) {
          case MouseInteractions.Blur:
            if (((target as Node) as HTMLElement).blur) {
              ((target as Node) as HTMLElement).blur();
            }
            break;
          case MouseInteractions.Focus:
            if (((target as Node) as HTMLElement).focus) {
              ((target as Node) as HTMLElement).focus({
                preventScroll: true,
              });
            }
            break;
          case MouseInteractions.Click:
          case MouseInteractions.TouchStart:
          case MouseInteractions.TouchEnd:
            /**
             * 鼠标点击不会真的触发click事件，只会添加一个动画效果
             * Click has no visual impact when replaying and may
             * trigger navigation when apply to an <a> link.
             * So we will not call click(), instead we add an
             * animation to the mouse element which indicate user
             * clicked at this moment.
             */
            if (!isSync) {
              this.moveAndHover(d, d.x, d.y, d.id);
              this.mouse.classList.remove('active');
              // tslint:disable-next-line
              void this.mouse.offsetWidth; // 触发回流？？
              this.mouse.classList.add('active');
            }
            break;
          default:
            target.dispatchEvent(event);
        }
        break;
      }
      case IncrementalSource.Scroll: {
        // 模拟滚动
        /**
         * Same as the situation of missing input target.
         */
        if (d.id === -1) {
          break;
        }
        const target = mirror.getNode(d.id);
        if (!target) {
          return this.debugNodeNotFound(d, d.id);
        }
        if ((target as Node) === this.iframe.contentDocument) {
          this.iframe.contentWindow!.scrollTo({
            top: d.y,
            left: d.x,
            behavior: isSync ? 'auto' : 'smooth',
          });
        } else {
          try {
            ((target as Node) as Element).scrollTop = d.y;
            ((target as Node) as Element).scrollLeft = d.x;
          } catch (error) {
            /**
             * Seldomly we may found scroll target was removed before
             * its last scroll event.
             */
          }
        }
        break;
      }
      case IncrementalSource.ViewportResize: // 模拟视口尺寸变化
        this.emitter.emit(ReplayerEvents.Resize, {
          width: d.width,
          height: d.height,
        });
        break;
      case IncrementalSource.Input: {
        // 模拟input元素值变化
        /**
         * Input event on an unserialized node usually means the event
         * was synchrony triggered programmatically after the node was
         * created. This means there was not an user observable interaction
         * and we do not need to replay it.
         */
        if (d.id === -1) {
          break;
        }
        const target = mirror.getNode(d.id);
        if (!target) {
          return this.debugNodeNotFound(d, d.id);
        }
        try {
          ((target as Node) as HTMLInputElement).checked = d.isChecked;
          ((target as Node) as HTMLInputElement).value = d.text;
        } catch (error) {
          // for safe
        }
        break;
      }
      default:
    }
  }

  private resolveMissingNode(
    map: missingNodeMap,
    parent: Node,
    target: Node,
    targetMutation: addedNodeMutation,
  ) {
    const { previousId, nextId } = targetMutation;
    const previousInMap = previousId && map[previousId];
    const nextInMap = nextId && map[nextId];
    if (previousInMap) {
      const { node, mutation } = previousInMap as missingNode;
      parent.insertBefore(node, target);
      delete map[mutation.node.id];
      delete this.missingNodeRetryMap[mutation.node.id];
      if (mutation.previousId || mutation.nextId) {
        this.resolveMissingNode(map, parent, node as Node, mutation);
      }
    }
    if (nextInMap) {
      const { node, mutation } = nextInMap as missingNode;
      parent.insertBefore(node, target.nextSibling);
      delete map[mutation.node.id];
      delete this.missingNodeRetryMap[mutation.node.id];
      if (mutation.previousId || mutation.nextId) {
        this.resolveMissingNode(map, parent, node as Node, mutation);
      }
    }
  }

  private moveAndHover(d: incrementalData, x: number, y: number, id: number) {
    this.mouse.style.left = `${x}px`;
    this.mouse.style.top = `${y}px`;
    const target = mirror.getNode(id);
    if (!target) {
      return this.debugNodeNotFound(d, id);
    }
    this.hoverElements((target as Node) as Element);
  }

  private hoverElements(el: Element) {
    this.iframe
      .contentDocument!.querySelectorAll('.\\:hover')
      .forEach(hoveredEl => {
        hoveredEl.classList.remove(':hover');
      });
    let currentEl: Element | null = el;
    while (currentEl) {
      currentEl.classList.add(':hover');
      currentEl = currentEl.parentElement;
    }
  }

  /**
   * 是否属于用户交互产生的事件
   * MouseMove,MouseInteraction,Scroll,ViewportResize,Input
   *
   * @author liubin.frontend
   * @private
   * @param {eventWithTime} event
   * @returns {boolean}
   * @memberof Replayer
   */
  private isUserInteraction(event: eventWithTime): boolean {
    if (event.type !== EventType.IncrementalSnapshot) {
      return false;
    }
    return (
      event.data.source > IncrementalSource.Mutation &&
      event.data.source <= IncrementalSource.Input
    );
  }

  // 回复倍数
  private restoreSpeed() {
    if (this.noramlSpeed === -1) {
      return;
    }
    const payload = { speed: this.noramlSpeed };
    this.setConfig(payload);
    this.emitter.emit(ReplayerEvents.SkipEnd, payload);
    this.noramlSpeed = -1;
  }

  private warnNodeNotFound(d: incrementalData, id: number) {
    if (!this.config.showWarning) {
      return;
    }
    console.warn(REPLAY_CONSOLE_PREFIX, `Node with id '${id}' not found in`, d);
  }

  private debugNodeNotFound(d: incrementalData, id: number) {
    /**
     * There maybe some valid scenes of node not being found.
     * Because DOM events are macrotask and MutationObserver callback
     * is microtask, so events fired on a removed DOM may emit
     * snapshots in the reverse order.
     */
    if (!this.config.showDebug) {
      return;
    }
    // tslint:disable-next-line: no-console
    console.log(REPLAY_CONSOLE_PREFIX, `Node with id '${id}' not found in`, d);
  }
}
