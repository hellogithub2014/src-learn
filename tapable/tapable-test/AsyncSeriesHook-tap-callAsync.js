const { AsyncSeriesHook } = require( "../lib" );

let queue1 = new AsyncSeriesHook( [ 'name' ] );
console.time( 'cost1' );
// 不关心每个tap回调参数的返回值，除非抛出异常会直接调用callAsync的回调,此时后续tap回调均不会执行
queue1.tap( '1', function ( name ) {
  console.log( 1 );
  return "Wrong";
} );
queue1.tap( '2', function ( name ) {
  console.log( 2 );
  throw new Error('tap2 error')
} );
queue1.tap( '3', function ( name ) {
  console.log( 3 );
} );
queue1.callAsync( 'zfpx', err => {
  console.log( err );
  console.timeEnd( 'cost1' );
} );
// 执行结果
/*
1
2
tap2 error
cost1: 3.933ms
*/


function anonymous(name, _callback) {
  'use strict';
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  var _hasError0 = false;
  try {
    _fn0(name);
  } catch (_err) {
    _hasError0 = true;
    _callback(_err);
  }
  if (!_hasError0) {
    var _fn1 = _x[1];
    var _hasError1 = false;
    try {
      _fn1(name);
    } catch (_err) {
      _hasError1 = true;
      _callback(_err);
    }
    if (!_hasError1) {
      var _fn2 = _x[2];
      var _hasError2 = false;
      try {
        _fn2(name);
      } catch (_err) {
        _hasError2 = true;
        _callback(_err);
      }
      if (!_hasError2) {
        _callback();
      }
    }
  }
}
