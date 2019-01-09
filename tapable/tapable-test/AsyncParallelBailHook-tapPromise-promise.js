const { AsyncParallelBailHook } = require( "../lib" );

let queue3 = new AsyncParallelBailHook( [ 'name' ] );
console.time( 'cost3' );
// 如果某个tapPromsie的回调Promise resolve或reject的参数不为空，
// 会直接导致Hook.promise得到resolve或reject，而不会等后面的tapPromise回调得到resolve或reject
// 只不过因为promise是异步的，所以后续的promise依然有机会执行，只不过Hook.promise的then / catch只会执行一次
queue3.tapPromise( '1', function ( name ) {
  return new Promise( function ( resolve, reject ) {
    setTimeout( () => {
      console.log( name, 1 );
      resolve( );
    }, 1000 );
  } );
} );

queue3.tapPromise( '2', function ( name ) {
  return new Promise( function ( resolve, reject ) {
    setTimeout( () => {
      console.log( name, 2 );
      reject( 'tapPromise2 wrong' ); // resolve或reject的参数非undefined时，会直接resolve或reject最后的queue3.promise
    }, 2000 );
  } );
} );

queue3.tapPromise( '3', function ( name ) {
  return new Promise( function ( resolve, reject ) {
    setTimeout( () => {
      console.log( name, 3 );
      resolve();
    }, 3000 );
  } );
} );

queue3.promise( 'webpack' )
// 此处的result和err都是某个tapPromise回调resolve或reject的参数
  .then( (result) => {
    console.log( 'over', 'result: ',result );
    console.timeEnd( 'cost3' );
  }, (err) => {
    console.error( 'error: ',err );
    console.timeEnd( 'cost3' );
  } );

/**
 * webpack 1
 * webpack 2
 * error:  tapPromise2 wrong
 * cost3: 2014.422ms
 * webpack 3 // 注意tapPromise3的回调promise依然有机会执行，只不过是在Hook.promise之后
*/

function anonymous(name) {
  'use strict';
  return new Promise((_resolve, _reject) => {
    var _sync = true;
    var _context;
    var _x = this._x;
    var _results = new Array(3);
    var _checkDone = () => {
      for (var i = 0; i < _results.length; i++) {
        var item = _results[i];
        if (item === undefined) return false;
        if (item.result !== undefined) {
          _resolve(item.result);
          return true;
        }
        if (item.error) {
          if (_sync)
            _resolve(
              Promise.resolve().then(() => {
                throw item.error;
              }),
            );
          else _reject(item.error);
          return true;
        }
      }
      return false;
    };
    do {
      var _counter = 3;
      var _done = () => {
        _resolve();
      };
      if (_counter <= 0) break;
      var _fn0 = _x[0];
      var _hasResult0 = false;
      var _promise0 = _fn0(name);
      if (!_promise0 || !_promise0.then) throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise0 + ')');
      _promise0.then(
        _result0 => {
          _hasResult0 = true;
          if (_counter > 0) {
            if (0 < _results.length && (_result0 !== undefined && (_results.length = 1), (_results[0] = { result: _result0 }), _checkDone())) {
              _counter = 0;
            } else {
              if (--_counter === 0) _done();
            }
          }
        },
        _err0 => {
          if (_hasResult0) throw _err0;
          if (_counter > 0) {
            if (0 < _results.length && ((_results.length = 1), (_results[0] = { error: _err0 }), _checkDone())) {
              _counter = 0;
            } else {
              if (--_counter === 0) _done();
            }
          }
        },
      );
      if (_counter <= 0) break;
      if (1 >= _results.length) {
        if (--_counter === 0) _done();
      } else {
        var _fn1 = _x[1];
        var _hasResult1 = false;
        var _promise1 = _fn1(name);
        if (!_promise1 || !_promise1.then) throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise1 + ')');
        _promise1.then(
          _result1 => {
            _hasResult1 = true;
            if (_counter > 0) {
              if (1 < _results.length && (_result1 !== undefined && (_results.length = 2), (_results[1] = { result: _result1 }), _checkDone())) {
                _counter = 0;
              } else {
                if (--_counter === 0) _done();
              }
            }
          },
          _err1 => {
            if (_hasResult1) throw _err1;
            if (_counter > 0) {
              if (1 < _results.length && ((_results.length = 2), (_results[1] = { error: _err1 }), _checkDone())) {
                _counter = 0;
              } else {
                if (--_counter === 0) _done();
              }
            }
          },
        );
      }
      if (_counter <= 0) break;
      if (2 >= _results.length) {
        if (--_counter === 0) _done();
      } else {
        var _fn2 = _x[2];
        var _hasResult2 = false;
        var _promise2 = _fn2(name);
        if (!_promise2 || !_promise2.then) throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise2 + ')');
        _promise2.then(
          _result2 => {
            _hasResult2 = true;
            if (_counter > 0) {
              if (2 < _results.length && (_result2 !== undefined && (_results.length = 3), (_results[2] = { result: _result2 }), _checkDone())) {
                _counter = 0;
              } else {
                if (--_counter === 0) _done();
              }
            }
          },
          _err2 => {
            if (_hasResult2) throw _err2;
            if (_counter > 0) {
              if (2 < _results.length && ((_results.length = 3), (_results[2] = { error: _err2 }), _checkDone())) {
                _counter = 0;
              } else {
                if (--_counter === 0) _done();
              }
            }
          },
        );
      }
    } while (false);
    _sync = false;
  });
}
