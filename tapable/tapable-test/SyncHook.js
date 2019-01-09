var { SyncHook } = require("../lib");
let queue = new SyncHook(["name"]); //所有的构造函数都接收一个可选的参数，这个参数是一个字符串的数组。

// 各个钩子回调顺序执行，回调之间没有关联

queue.tap( "tap1", function( name) {
	// tap 的第一个参数是用来标识订阅的函数的
  console.log(name, 1);
	return "1";
});

queue.tap("tap2", function(name) {
	console.log(name, 2);
});

queue.intercept( {
  // tapInfo是Hook.tapXXX时构造的，包含name、type、fn3个参数
  tap: ( tapInfo ) => {
    console.log( `${tapInfo.name} taped` );
  },
  call: ( name ) => {
    console.log( `intercept called, ${name}` );
  },
  register: ( tapInfo ) => {
    console.log( `intercept register ${ tapInfo.name}` );
    return tapInfo;
  }
} )

// 发布
queue.call("webpack");

/**
 *
intercept register 1
intercept register 2
intercept call, webpack
webpack 1
webpack 2
*/

function anonymous ( name) {
  "use strict";
  var _context;
  var _x = this._x;
  var _taps = this.taps;
  var _interceptors = this.interceptors;
  _interceptors[ 0 ].call( name );
  var _tap0 = _taps[ 0 ];
  _interceptors[ 0 ].tap( _tap0 );
  var _fn0 = _x[ 0 ];
  _fn0( name );
  var _tap1 = _taps[ 1 ];
  _interceptors[ 0 ].tap( _tap1 );
  var _fn1 = _x[ 1 ];
  _fn1( name );
}