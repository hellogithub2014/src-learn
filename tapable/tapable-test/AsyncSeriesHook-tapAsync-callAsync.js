const { AsyncSeriesHook } = require( "../lib" );

let queue2 = new AsyncSeriesHook( [ 'name' ] );
console.time( 'cost2' );
/**
 * 只有执行了前一个tapAsync回调里的callback后，才会执行后一个tapAsync的回调。
 * 如果执行callback时传入了非空值，会被当做时error，
 * 此时会跳过后续的tapAsync回调，直接执行callAsync的回调,并传入error
*/
queue2.tapAsync( '1', function ( name, callback ) {
  setTimeout( () => {
    console.log( name, 1 );
    callback();
  }, 1000 );
} );
queue2.tapAsync( '2', function ( name, callback ) {
  setTimeout( () => {
    console.log( name, 2 );
    callback('tapAsync2 error');
  }, 2000 );
} );
queue2.tapAsync( '3', function ( name, callback ) {
  setTimeout( () => {
    console.log( name, 3 );
    callback();
  }, 3000 );
} );

queue2.callAsync( 'webpack', ( err ) => {
  console.log( err );
  console.log( 'over' );
  console.timeEnd( 'cost2' );
} );

/*
webpack 1
webpack 2
tapAsync2 error
over
cost2: 3019.621ms
*/

function anonymous(name, _callback) {
  'use strict';
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  _fn0(name, _err0 => {
    if (_err0) {
      _callback(_err0);
    } else {
      var _fn1 = _x[1];
      _fn1(name, _err1 => {
        if (_err1) {
          _callback(_err1);
        } else {
          var _fn2 = _x[2];
          _fn2(name, _err2 => {
            if (_err2) {
              _callback(_err2);
            } else {
              _callback();
            }
          });
        }
      });
    }
  });
}