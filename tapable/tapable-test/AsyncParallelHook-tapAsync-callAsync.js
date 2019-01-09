const { AsyncParallelHook } = require("../lib");

let queue2 = new AsyncParallelHook(["name"]);
console.time("cost1");

/**
 * 1. 若callback被同步执行：只要前一个回调函数的callback在调用时不传error参数，在执行完后就会顺序执行后一个回调。
 *    若callback在调用时传了非空error参数，会直接执行callAsync的回调，并将非空error参数当做入参。
 * 2. 若callback被异步执行：上述情况会改变，若调用callback时传了error参数，在执行完后就会执行callAsync的回调，
 *    只不过后续的回调因为是异步的，所以依然有机会执行，只不过callAsync的回调只会执行一次
*/
queue2.tapAsync("1", function(name, callback) {
	setTimeout(() => {
		console.log(name, 1);
	}, 1000);
});
queue2.tapAsync("2", function(name, callback) {
	setTimeout(() => {
		console.log(name, 2);
    // 如果此处的callback是在异步环境中被调用如被注释的setTimeout，那么tapAsync3依然有机会被调用；
    // 如果是在同步环境中被调用，tapAsync3不会被调用
    callback( "error2" );
	}, 2000);
});
queue2.tapAsync("3", function(name, callback) {
	setTimeout(() => {
		console.log(name, 3);
		// callback("error3");
	}, 3000);
});

queue2.callAsync("webpack", err => {
	console.log("over");
	console.log("err", err);
	console.timeEnd("cost1");
});

/**
 * webpack 1
 * webpack 2
 * over
 * err error2
 * cost1: 2033.607ms
 * webpack 3
*/

function anonymous ( name, _callback ) {
  'use strict';
  var _context;
  var _x = this._x;
  do
  {
    var _counter = 3;
    var _done = () => {
      _callback();
    };
    if ( _counter <= 0 ) break;
    var _fn0 = _x[ 0 ];
    // _err0: tapAsync回调触发时传入的参数， 回调触发后才会修改counter
    // 如果第二个参数是异步被执行的，那么后面的fn1依然有机会执行
    _fn0( name, _err0 => {
      if ( _err0 )
      {
        if ( _counter > 0 )
        {
          _callback( _err0 );
          _counter = 0;
        }
      } else
      {
        if ( --_counter === 0 ) _done();
      }
    } );
    if ( _counter <= 0 ) break;
    var _fn1 = _x[ 1 ];
    _fn1( name, _err1 => {
      if ( _err1 )
      {
        if ( _counter > 0 )
        {
          _callback( _err1 );
          _counter = 0;
        }
      } else
      {
        if ( --_counter === 0 ) _done();
      }
    } );
    if ( _counter <= 0 ) break;
    var _fn2 = _x[ 2 ];
    _fn2( name, _err2 => {
      if ( _err2 )
      {
        if ( _counter > 0 )
        {
          _callback( _err2 );
          _counter = 0;
        }
      } else
      {
        if ( --_counter === 0 ) _done();
      }
    } );
  } while ( false );
}
