const {
  AsyncSeriesWaterfallHook
} = require( "../lib" );

// tap
let queue1 = new AsyncSeriesWaterfallHook( [ 'name' ] );
console.time( 'cost1' );
// 上一个监听函数的返回值, 可以作为下一个监听函数的参数。 如果监听函数报错，直接执行callAsync的回调,后续tap回调不会被执行
queue1.tap( '1', function ( name ) {
  console.log( name, 1 );
  return 'lily'
} );
queue1.tap( '2', function ( data ) {
  console.log( 2, data );
  return 'Tom';
} );
queue1.tap( '3', function ( data ) {
  console.log( 3, data );
} );
queue1.callAsync( 'webpack', err => {
  console.log( err );
  console.log( 'over' );
  console.timeEnd( 'cost1' );
} );

// 执行结果:
/*
webpack 1
2 'lily'
3 'Tom'
null
over
cost1: 5.525ms
*/

function anonymous(name, _callback) {
  'use strict';
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  var _hasError0 = false;
  try {
    var _result0 = _fn0(name);
  } catch (_err) {
    _hasError0 = true;
    _callback(_err);
  }
  if (!_hasError0) {
    if (_result0 !== undefined) {
      name = _result0;
    }
    var _fn1 = _x[1];
    var _hasError1 = false;
    try {
      var _result1 = _fn1(name);
    } catch (_err) {
      _hasError1 = true;
      _callback(_err);
    }
    if (!_hasError1) {
      if (_result1 !== undefined) {
        name = _result1;
      }
      var _fn2 = _x[2];
      var _hasError2 = false;
      try {
        var _result2 = _fn2(name);
      } catch (_err) {
        _hasError2 = true;
        _callback(_err);
      }
      if (!_hasError2) {
        if (_result2 !== undefined) {
          name = _result2;
        }
        _callback(null, name);
      }
    }
  }
}