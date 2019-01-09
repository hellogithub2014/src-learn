const { AsyncSeriesBailHook } = require( "../lib" );

// tap
let queue1 = new AsyncSeriesBailHook( [ 'name' ] );
console.time( 'cost1' );
// 回调的返回值不为空，或者回调抛出异常，就会直接执行callAsync绑定的回调函数
queue1.tap( '1', function ( name ) {
  console.log( 1 );
} );
queue1.tap( '2', function ( name ) {
  console.log( 2 );
  // return "tap2 result";
  throw 'tap2 error';
} );
queue1.tap( '3', function ( name ) {
  console.log( 3 );
} );
queue1.callAsync( 'webpack', err => {
  console.error( 'err: ',err );
  console.timeEnd( 'cost1' );
} );

/*
1
2
err:  tap2 error
cost1: 3.979ms
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
      _callback(null, _result0);
    } else {
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
          _callback(null, _result1);
        } else {
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
              _callback(null, _result2);
            } else {
              _callback();
            }
          }
        }
      }
    }
  }
}
