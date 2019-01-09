const {
  AsyncSeriesWaterfallHook
} = require( "../lib" );
let queue3 = new AsyncSeriesWaterfallHook( [ 'name' ] );
console.time( 'cost3' );
// 上一个监听函数Promise的resolve结果, 可以作为下一个监听函数的data参数。
// 如果调用了reject，直接执行Hook.promise的catch回调，并传入reject参数，后续tapPromsie回调不会再执行
queue3.tapPromise( '1', function ( name ) {
  return new Promise( function ( resolve, reject ) {
    setTimeout( function () {
      console.log( '1:', name );
      resolve( 'tapPromise1' );
      // reject( 'tapPromise1 error' ) // 后续的tapPromise回调不会执行，直接执行Hook.promise的catch回调。
    }, 1000 )
  } );
} );
queue3.tapPromise( '2', function ( data ) {
  return new Promise( function ( resolve,reject ) {
    setTimeout( function () {
      console.log( '2:', data );
      // resolve( '2' );
      reject('tapPromise2 error');
    }, 2000 )
  } );
} );
queue3.tapPromise( '3', function ( data ) {
  return new Promise( function ( resolve ) {
    setTimeout( function () {
      console.log( '3:', data );
      resolve( 'over' );
    }, 3000 )
  } );
} );
queue3.promise( 'webpack' ).then( result => {
  console.log( 'result: ', result );
  console.timeEnd( 'cost3' );
}, err => {
  console.log( "err: ", err );
  console.timeEnd( 'cost3' );
} );

/*
1: webpack
2: tapPromise1
err:  tapPromise2 error
cost3: 3019.126ms
*/

function anonymous(name) {
  'use strict';
  return new Promise((_resolve, _reject) => {
    var _sync = true;
    var _context;
    var _x = this._x;
    var _fn0 = _x[0];
    var _hasResult0 = false;
    var _promise0 = _fn0(name);
    if (!_promise0 || !_promise0.then) throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise0 + ')');
    _promise0.then(
      _result0 => {
        _hasResult0 = true;
        if (_result0 !== undefined) {
          name = _result0;
        }
        var _fn1 = _x[1];
        var _hasResult1 = false;
        var _promise1 = _fn1(name);
        if (!_promise1 || !_promise1.then) throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise1 + ')');
        _promise1.then(
          _result1 => {
            _hasResult1 = true;
            if (_result1 !== undefined) {
              name = _result1;
            }
            var _fn2 = _x[2];
            var _hasResult2 = false;
            var _promise2 = _fn2(name);
            if (!_promise2 || !_promise2.then) throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise2 + ')');
            _promise2.then(
              _result2 => {
                _hasResult2 = true;
                if (_result2 !== undefined) {
                  name = _result2;
                }
                _resolve(name);
              },
              _err2 => {
                if (_hasResult2) throw _err2;
                if (_sync)
                  _resolve(
                    Promise.resolve().then(() => {
                      throw _err2;
                    }),
                  );
                else _reject(_err2);
              },
            );
          },
          _err1 => {
            if (_hasResult1) throw _err1;
            if (_sync)
              _resolve(
                Promise.resolve().then(() => {
                  throw _err1;
                }),
              );
            else _reject(_err1);
          },
        );
      },
      _err0 => {
        if (_hasResult0) throw _err0;
        if (_sync)
          _resolve(
            Promise.resolve().then(() => {
              throw _err0;
            }),
          );
        else _reject(_err0);
      },
    );
    _sync = false;
  });
}
