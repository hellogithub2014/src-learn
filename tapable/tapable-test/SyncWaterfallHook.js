const { SyncWaterfallHook } = require("../lib");

let queue = new SyncWaterfallHook(["name"]);

// 上一个回调函数的返回值如果不为空，就会传给下一个回调函数当做参数
queue.tap("1", function(name) {
	console.log(name, 1);
	// return 1;
});
queue.tap("2", function(data) {
	console.log(data, 2);
	return 2;
});
queue.tap("3", function(data) {
	console.log(data, 3);
});

queue.call("webpack");

function anonymous(name) {
  'use strict';
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  var _result0 = _fn0(name);
  if (_result0 !== undefined) {
    name = _result0;
  }
  var _fn1 = _x[1];
  var _result1 = _fn1(name);
  if (_result1 !== undefined) {
    name = _result1;
  }
  var _fn2 = _x[2];
  var _result2 = _fn2(name);
  if (_result2 !== undefined) {
    name = _result2;
  }
  return name;
}