import { playerConfig, actionWithDelay } from '../types';

export default class Timer {
  public timeOffset: number = 0;

  private actions: actionWithDelay[];
  private config: playerConfig;
  private raf: number;

  constructor(config: playerConfig, actions: actionWithDelay[] = []) {
    this.actions = actions; // 按照delay升序排列
    this.config = config;
  }
  /**
   * Add an action after the timer starts.
   * @param action
   */
  public addAction(action: actionWithDelay) {
    const index = this.findActionIndex(action);
    this.actions.splice(index, 0, action);
  }
  /**
   * Add all actions before the timer starts
   * @param actions
   */
  public addActions(actions: actionWithDelay[]) {
    this.actions.push(...actions);
  }

  public start() {
    this.actions.sort((a1, a2) => a1.delay - a2.delay);
    this.timeOffset = 0;
    let lastTimestamp = performance.now();
    const { actions, config } = this;
    const self = this;
    function check(time: number) {
      self.timeOffset += (time - lastTimestamp) * config.speed; // 计时器走过的时长
      lastTimestamp = time;
      // 将所有在timeOffset之前的action全部执行掉
      while (actions.length) {
        const action = actions[0];
        if (self.timeOffset >= action.delay) {
          actions.shift();
          action.doAction();
        } else {
          break;
        }
      }
      if (actions.length > 0 || self.config.liveMode) {
        self.raf = requestAnimationFrame(check);
      }
    }
    this.raf = requestAnimationFrame(check);
  }

  public clear() {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
    }
    this.actions.length = 0;
  }

  /**
   * 按照delay属性进行二分查找，如果找不到返回该插入的位置
   *
   * @author liubin.frontend
   * @private
   * @param {actionWithDelay} action
   * @returns {number}
   * @memberof Timer
   */
  private findActionIndex(action: actionWithDelay): number {
    let start = 0;
    let end = this.actions.length - 1;
    while (start <= end) {
      let mid = Math.floor((start + end) / 2);
      if (this.actions[mid].delay < action.delay) {
        start = mid + 1;
      } else if (this.actions[mid].delay > action.delay) {
        end = mid - 1;
      } else {
        return mid;
      }
    }
    return start;
  }
}
