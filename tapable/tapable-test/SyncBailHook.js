const { SyncBailHook } = require("../lib");

let queue = new SyncBailHook(["name"]);

// 上一个回调函数的返回值如果不为空，后面的回调就再也不会执行，相当于被截断
queue.tap("1", function(name) {
	console.log(name, 1);
});
queue.tap("2", function(name) {
	console.log(name, 2);
	return "wrong";
});
queue.tap("3", function(name) {
	console.log(name, 3);
});

queue.call("webpack");

function anonymous(name) {
  'use strict';
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  var _result0 = _fn0(name);
  if (_result0 !== undefined) {
    return _result0;
  } else {
    var _fn1 = _x[1];
    var _result1 = _fn1(name);
    if (_result1 !== undefined) {
      return _result1;
    } else {
      var _fn2 = _x[2];
      var _result2 = _fn2(name);
      if (_result2 !== undefined) {
        return _result2;
      } else {
      }
    }
  }
}