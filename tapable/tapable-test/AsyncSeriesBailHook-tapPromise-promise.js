const { AsyncSeriesBailHook } = require( "../lib" );
let queue3 = new AsyncSeriesBailHook( [ 'name' ] );
console.time( 'cost3' );
// 如果某个tapPromsie的回调Promise resolve或reject的参数不为空，
// 会直接导致Hook.promise得到resolve或reject，后续的tapPromise回调没有机会执行
// 注意和AsyncParallelBailHook-tapPromise-promise的区别,一个是异步串行，一个是异步并行
queue3.tapPromise( '1', function ( name ) {
  return new Promise( function ( resolve, reject ) {
    setTimeout( function () {
      console.log( name, 1 );
      resolve();
    }, 1000 )
  } );
} );
queue3.tapPromise( '2', function ( name ) {
  return new Promise( function ( resolve, reject ) {
    setTimeout( function () {
      console.log( name, 2 );
      reject('tapPromise2 error');
    }, 2000 )
  } );
} );
queue3.tapPromise( '3', function ( name ) {
  return new Promise( function ( resolve ) {
    setTimeout( function () {
      console.log( name, 3 );
      resolve();
    }, 3000 )
  } );
} );
queue3.promise( 'webpack' ).then( result => {
  console.log( 'result: ', result  );
  console.log( 'over' );
  console.timeEnd( 'cost3' );
}, err => {
  console.error( "err: ", err );
  console.timeEnd( 'cost3' );
} );

/*
webpack 1
webpack 2
err:  tapPromise2 error
cost3: 3017.608ms
*/
function anonymous ( name ) {
  'use strict';
  return new Promise( ( _resolve, _reject ) => {
    var _sync = true;
    var _context;
    var _x = this._x;
    var _fn0 = _x[ 0 ];
    var _hasResult0 = false;
    var _promise0 = _fn0( name );
    if ( !_promise0 || !_promise0.then ) throw new Error( 'Tap function (tapPromise) did not return promise (returned ' + _promise0 + ')' );
    _promise0.then(
      _result0 => {
        _hasResult0 = true;
        if ( _result0 !== undefined )
        {
          _resolve( _result0 );
        } else
        {
          var _fn1 = _x[ 1 ];
          var _hasResult1 = false;
          var _promise1 = _fn1( name );
          if ( !_promise1 || !_promise1.then ) throw new Error( 'Tap function (tapPromise) did not return promise (returned ' + _promise1 + ')' );
          _promise1.then(
            _result1 => {
              _hasResult1 = true;
              if ( _result1 !== undefined )
              {
                _resolve( _result1 );
              } else
              {
                var _fn2 = _x[ 2 ];
                var _hasResult2 = false;
                var _promise2 = _fn2( name );
                if ( !_promise2 || !_promise2.then ) throw new Error( 'Tap function (tapPromise) did not return promise (returned ' + _promise2 + ')' );
                _promise2.then(
                  _result2 => {
                    _hasResult2 = true;
                    if ( _result2 !== undefined )
                    {
                      _resolve( _result2 );
                    } else
                    {
                      _resolve();
                    }
                  },
                  _err2 => {
                    if ( _hasResult2 ) throw _err2;
                    if ( _sync )
                      _resolve(
                        Promise.resolve().then( () => {
                          throw _err2;
                        } ),
                      );
                    else _reject( _err2 );
                  },
                );
              }
            },
            _err1 => {
              if ( _hasResult1 ) throw _err1;
              if ( _sync )
                _resolve(
                  Promise.resolve().then( () => {
                    throw _err1;
                  } ),
                );
              else _reject( _err1 );
            },
          );
        }
      },
      _err0 => {
        if ( _hasResult0 ) throw _err0;
        if ( _sync )
          _resolve(
            Promise.resolve().then( () => {
              throw _err0;
            } ),
          );
        else _reject( _err0 );
      },
    );
    _sync = false;
  } );
}
