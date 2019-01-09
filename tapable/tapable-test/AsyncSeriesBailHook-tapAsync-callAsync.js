const { AsyncSeriesBailHook } = require( "../lib" );

let queue2 = new AsyncSeriesBailHook( [ 'name' ] );
console.time( 'cost2' );
/**
 * callback: (err, result) => any
 * 注意和AsyncParallelBailHook-tapAsync-callAsync的对比：
 * 1. AsyncSeriesBailHook是异步串行，callback的err或result参数不为null，不管是同步还是异步环境中执行的，
 *    都会直接执行callAsync绑定的回调函数，会将callback的参数携带过去，后续的tapAsync不会被执行。
 * 2. AsyncParallelBailHook是异步并行，如果callbacks是在异步环境中被调用如被注释的setTimeout，那么后续的tapAsync回调依然有机会被调用
*/
queue2.tapAsync( '1', function ( name, callback ) {
  setTimeout( function () {
    console.log( name, 1 );
    callback();
  }, 1000 )
} );
queue2.tapAsync( '2', function ( name, callback ) {
  setTimeout( function () {
    console.log( name, 2 );
    // callback( 'wrong' );
    callback( undefined, 'tapAsync2 result' );
  }, 2000 )
} );
queue2.tapAsync( '3', function ( name, callback ) {
  setTimeout( function () {
    console.log( name, 3 );
    callback();
  }, 3000 )
} );
queue2.callAsync( 'webpack', (err,result) => {
  console.log( 'err: ',err,'result: ',result );
  console.log( 'over' );
  console.timeEnd( 'cost2' );
} );

/*
webpack 1
webpack 2
err:  null result:  tapAsync2 result
over
cost2: 3014.616ms
*/

function anonymous(name, _callback) {
  'use strict';
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  _fn0(name, (_err0, _result0) => {
    if (_err0) {
      _callback(_err0);
    } else {
      if (_result0 !== undefined) {
        _callback(null, _result0);
      } else {
        var _fn1 = _x[1];
        _fn1(name, (_err1, _result1) => {
          if (_err1) {
            _callback(_err1);
          } else {
            if (_result1 !== undefined) {
              _callback(null, _result1);
            } else {
              var _fn2 = _x[2];
              _fn2(name, (_err2, _result2) => {
                if (_err2) {
                  _callback(_err2);
                } else {
                  if (_result2 !== undefined) {
                    _callback(null, _result2);
                  } else {
                    _callback();
                  }
                }
              });
            }
          }
        });
      }
    }
  });
}