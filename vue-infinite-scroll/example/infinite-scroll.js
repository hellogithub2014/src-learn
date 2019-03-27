const ctx = '@@InfiniteScroll';

var throttle = function(fn, delay) {
  var now, lastExec, timer, context, args; //eslint-disable-line

  var execute = function() {
    fn.apply(context, args);
    lastExec = now;
  };

  return function() {
    context = this;
    args = arguments;

    now = Date.now();

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    if (lastExec) {
      var diff = delay - (now - lastExec);
      if (diff < 0) {
        execute();
      } else {
        timer = setTimeout(() => {
          execute();
        }, diff);
      }
    } else {
      execute();
    }
  };
};

// 元素距离文档坐标顶部的距离
var getScrollTop = function(element) {
  if (element === window) {
    return Math.max(window.pageYOffset || 0, document.documentElement.scrollTop);
  }

  return element.scrollTop;
};

var getComputedStyle = document.defaultView.getComputedStyle;

// 从自身开始，寻找设置了滚动的父元素。 overflow-y 为scroll或auto
var getScrollEventTarget = function(element) {
  var currentNode = element;
  // bugfix, see http://w3help.org/zh-cn/causes/SD9013 and http://stackoverflow.com/questions/17016740/onscroll-function-is-not-working-for-chrome
  // nodeType 1表示元素节点
  while (currentNode && currentNode.tagName !== 'HTML' && currentNode.tagName !== 'BODY' && currentNode.nodeType === 1) {
    var overflowY = getComputedStyle(currentNode).overflowY;
    if (overflowY === 'scroll' || overflowY === 'auto') {
      return currentNode;
    }
    currentNode = currentNode.parentNode;
  }
  return window;
};

// 元素不带边框的高度
var getVisibleHeight = function(element) {
  if (element === window) {
    return document.documentElement.clientHeight;
  }

  return element.clientHeight;
};

var getElementTop = function(element) {
  if (element === window) {
    return getScrollTop(window);
  }
  // getBoundingClientRect返回视口坐标
  // getScrollTop( window ) 表示整个站点的滚动条高度
  return element.getBoundingClientRect().top + getScrollTop(window);
};

// 判断元素是否已经在页面上
var isAttached = function(element) {
  var currentNode = element.parentNode;
  while (currentNode) {
    if (currentNode.tagName === 'HTML') {
      return true;
    }
    // 11 表示DomFragment
    if (currentNode.nodeType === 11) {
      return false;
    }
    currentNode = currentNode.parentNode;
  }
  return false;
};

var doBind = function() {
  if (this.binded) return; // eslint-disable-line
  this.binded = true;

  var directive = this;
  var element = directive.el;

  // throttleDelayExpr: 截流间隔。 设置在元素的属性上
  var throttleDelayExpr = element.getAttribute('infinite-scroll-throttle-delay');
  var throttleDelay = 200;
  if (throttleDelayExpr) {
    // 优先尝试组件上的throttleDelayExpr属性值， 如 <div infinite-scroll-throttle-delay="myDelay"></div>
    throttleDelay = Number(directive.vm[throttleDelayExpr] || throttleDelayExpr);
    if (isNaN(throttleDelay) || throttleDelay < 0) {
      throttleDelay = 200;
    }
  }
  directive.throttleDelay = throttleDelay;

  // 监听滚动父元素的scroll时间，监听函数设置了函数截流
  directive.scrollEventTarget = getScrollEventTarget(element); // 设置了滚动的父元素
  directive.scrollListener = throttle(doCheck.bind(directive), directive.throttleDelay);
  directive.scrollEventTarget.addEventListener('scroll', directive.scrollListener);

  this.vm.$on('hook:beforeDestroy', function() {
    directive.scrollEventTarget.removeEventListener('scroll', directive.scrollListener);
  });

  // infinite-scroll-disabled: 是否禁用无限滚动
  // 可以为表达式
  var disabledExpr = element.getAttribute('infinite-scroll-disabled');
  var disabled = false;

  if (disabledExpr) {
    this.vm.$watch(disabledExpr, function(value) {
      directive.disabled = value;
      // 当disable为false时，重启check
      if (!value && directive.immediateCheck) {
        doCheck.call(directive);
      }
    });
    disabled = Boolean(directive.vm[disabledExpr]);
  }
  directive.disabled = disabled;

  // 宿主元素到滚动父元素底部的距离阈值，小于这个值时，触发listen-for-event监听函数
  var distanceExpr = element.getAttribute('infinite-scroll-distance');
  var distance = 0;
  if (distanceExpr) {
    distance = Number(directive.vm[distanceExpr] || distanceExpr);
    if (isNaN(distance)) {
      distance = 0;
    }
  }
  directive.distance = distance;

  // 是否在bind后立即检查一遍，也会在disable失效时立即触发检查
  var immediateCheckExpr = element.getAttribute('infinite-scroll-immediate-check');
  var immediateCheck = true;
  if (immediateCheckExpr) {
    immediateCheck = Boolean(directive.vm[immediateCheckExpr]);
  }
  directive.immediateCheck = immediateCheck;

  if (immediateCheck) {
    doCheck.call(directive);
  }

  // 当组件上设置的此事件触发时，执行一次检查
  var eventName = element.getAttribute('infinite-scroll-listen-for-event');
  if (eventName) {
    directive.vm.$on(eventName, function() {
      doCheck.call(directive);
    });
  }
};

var doCheck = function(force) {
  var scrollEventTarget = this.scrollEventTarget; // 滚动父元素
  var element = this.el;
  var distance = this.distance; // 距离阈值

  if (force !== true && this.disabled) return; //eslint-disable-line
  var viewportScrollTop = getScrollTop(scrollEventTarget); // 元素顶部与文档坐标顶部的距离
  // viewportBottom： 元素底部与文档坐标顶部的距离； visibleHeight：元素不带边框的高度
  var viewportBottom = viewportScrollTop + getVisibleHeight(scrollEventTarget);

  var shouldTrigger = false;

  // 滚动元素就是自身
  if (scrollEventTarget === element) {
    // scrollHeight - 在没有滚动条的情况下，元素内容的总高度，是元素的内容区加上内边距再加上任何溢出内容的尺寸。
    // shouldTrigger为true表示已经滚动到元素的足够底部了。
    // 参考https://hellogithub2014.github.io/2017/10/19/dom-element-size-summary/
    shouldTrigger = scrollEventTarget.scrollHeight - viewportBottom <= distance;
  } else {
    //  getElementTop(element) - getElementTop(scrollEventTarget) 当前元素顶部与滚动父元素顶部的距离
    // offsetHeight元素带边框的高度
    // elementBottom: 元素底部与文档坐标顶部的距离
    var elementBottom = getElementTop(element) - getElementTop(scrollEventTarget) + element.offsetHeight + viewportScrollTop;

    shouldTrigger = viewportBottom + distance >= elementBottom;
  }

  if (shouldTrigger && this.expression) {
    this.expression(); // 触发绑定的无限滚动函数，通常是获取下一页数据。 之后scrollEventTarget.scrollHeight会变大
  }
};

window.InfiniteScroll = {
  bind(el, binding, vnode) {
    el[ctx] = {
      el,
      vm: vnode.context,
      expression: binding.value,
    };
    const args = arguments;
    el[ctx].vm.$on('hook:mounted', function() {
      el[ctx].vm.$nextTick(function() {
        // 判断元素是否已经在页面上
        if (isAttached(el)) {
          doBind.call(el[ctx], args);
        }

        el[ctx].bindTryCount = 0;

        // 间隔50ms轮训10次，判断元素是否已经在页面上
        var tryBind = function() {
          if (el[ctx].bindTryCount > 10) return; //eslint-disable-line
          el[ctx].bindTryCount++;
          if (isAttached(el)) {
            doBind.call(el[ctx], args);
          } else {
            setTimeout(tryBind, 50);
          }
        };

        tryBind();
      });
    });
  },

  unbind(el) {
    if (el && el[ctx] && el[ctx].scrollEventTarget) el[ctx].scrollEventTarget.removeEventListener('scroll', el[ctx].scrollListener);
  },
};
