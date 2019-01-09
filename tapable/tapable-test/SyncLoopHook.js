const { SyncLoopHook } = require("../lib");

let queue = new SyncLoopHook(["name"]);
// 只要某个监听的回调返回值不为空就会一直循环执行这个回调，直到返回空才会执行下一个回调
let count = 3;
queue.tap("1", function(name) {
	console.log("tap1 count: ", count--);
	if (count > 0) {
		return true;
	}
	return;
});

queue.tap("2", function(name) {
  count = 1;
	console.log("tap2 count: ", count--);
	if (count > 0) {
		return true;
	}
	return;
});

queue.call("webpack");

function anonymous(name) {
  'use strict';
  var _context;
  var _x = this._x;
  var _loop;
  do {
    _loop = false;
    var _fn0 = _x[0];
    var _result0 = _fn0(name);
    if (_result0 !== undefined) {
      _loop = true;
    } else {
      var _fn1 = _x[1];
      var _result1 = _fn1(name);
      if (_result1 !== undefined) {
        _loop = true;
      } else {
        if (!_loop) {
        }
      }
    }
  } while (_loop);
}