const {
  AsyncSeriesWaterfallHook
} = require( "../lib" );

let queue2 = new AsyncSeriesWaterfallHook( [ 'name' ] );
console.time( 'cost2' );
// 上一个监听函数callback的第二个调用参数, 可以作为下一个监听函数的data参数。
// 如果callback的第一个参数不为空，会被当做error参数，直接执行callAsync的回调并传入error，后续tapAsync不会执行
queue2.tapAsync( '1', function ( name, callback ) {
  setTimeout( function () {
    console.log( '1: ', name );
    callback( null, 'tapAsync1' );
  }, 1000 )
} );
queue2.tapAsync( '2', function ( data, callback ) {
  setTimeout( function () {
    console.log( '2: ', data );
    callback( 'tapAsync2 error');
  }, 2000 )
} );
queue2.tapAsync( '3', function ( data, callback ) {
  setTimeout( function () {
    console.log( '3: ', data );
    callback( null, 'tapAsync3' );
  }, 3000 )
} );
queue2.callAsync( 'webpack', (err,result) => {
  console.log( "err: ", err, 'result: ', result );
  console.log( 'over' );
  console.timeEnd( 'cost2' );
} );

/*
1:  webpack
2:  tapAsync1
err:  tapAsync2 error result:  undefined
over
cost2: 3016.889ms
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
        name = _result0;
      }
      var _fn1 = _x[1];
      _fn1(name, (_err1, _result1) => {
        if (_err1) {
          _callback(_err1);
        } else {
          if (_result1 !== undefined) {
            name = _result1;
          }
          var _fn2 = _x[2];
          _fn2(name, (_err2, _result2) => {
            if (_err2) {
              _callback(_err2);
            } else {
              if (_result2 !== undefined) {
                name = _result2;
              }
              _callback(null, name);
            }
          });
        }
      });
    }
  });
}
