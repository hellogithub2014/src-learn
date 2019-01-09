const { AsyncParallelBailHook } = require( "../lib" );

// 如果某个cb在调用时传入了非undefined的值或error，会提早调用callAsync的回调，而不会等到后续的cb执行
let queue2 = new AsyncParallelBailHook( [ 'name' ] );
console.time( 'cost1' );


/**
 * 类似AsyncParallelHook-tapAsync-callAsync
 *
 * 1. 若callback被同步执行：只要前一个回调函数的callback在调用时不传error/result参数，在执行完后就会顺序执行后一个回调。
 *    若callback在调用时传了非空error/result参数，会直接执行callAsync的回调，并将非空error/result参数当做入参。
 * 2. 若callback被异步执行：上述情况会改变，若调用callback时传了error/result参数，在执行完后就会执行callAsync的回调，
 *    只不过后续的回调因为是异步的，所以依然有机会执行，只不过callAsync的回调只会执行一次
*/

queue2.tapAsync( '1', function ( name, callback ) {
  setTimeout( () => {
    console.log( name, 1 );
    callback();
  }, 1000 );
} );
queue2.tapAsync( '2', function ( name, callback ) {
  // setTimeout( () => {
    console.log( name, 2 );
    // 如果此处的callback是在异步环境中被调用如被注释的setTimeout，那么tapAsync3依然有机会被调用；
    // 如果是在同步环境中被调用，tapAsync3不会被调用
    callback( undefined, 123 );
  // })
} );
queue2.tapAsync( '3', function ( name, callback ) {
  setTimeout( () => {
    console.log( name, 3 );
    callback();
  }, 3000 );
} );

queue2.callAsync( 'webpack', (err,result) => {
  // 此处的err,result是某个cb调用时传入的
  console.log( 'over','error: ',err,'result: ',result );
  console.timeEnd( 'cost1' );
} );

/**
 * webpack 2
 * webpack 1
 * over error:  null result:  123
 * cost1: 1012.450ms
*/

function anonymous(name, _callback) {
  'use strict';
  var _context;
  var _x = this._x;
  var _results = new Array(3); // 每个tap的回调函数cb可能的调用参数
  // 检查_results结果集中是否存在不是undefined的
  var _checkDone = () => {
    for (var i = 0; i < _results.length; i++) {
      var item = _results[i];
      if (item === undefined) return false;
      if (item.result !== undefined) {
        _callback(null, item.result);
        return true;
      }
      if (item.error) {
        _callback(item.error);
        return true;
      }
    }
    return false;
  };
  do {
    var _counter = 3;
    var _done = () => {
      _callback();
    };
    if (_counter <= 0) break;
    var _fn0 = _x[0];
    // 调用tapAsync的回调函数，(_err0, _result0) => xxx是传给cb的实参
    _fn0(name, (_err0, _result0) => {
      // 如果cb在执行时传入了err参数
      if (_err0) {
        if (_counter > 0) {
          if (0 < _results.length && ((_results.length = 1), (_results[0] = { error: _err0 }), _checkDone())) {
            _counter = 0;
          } else {
            if (--_counter === 0) _done();
          }
        }
      } else {
        // 如果未传入err参数
        if (_counter > 0) {
          if (0 < _results.length && (_result0 !== undefined && (_results.length = 1), (_results[0] = { result: _result0 }), _checkDone())) {
            _counter = 0;
          } else {
            if (--_counter === 0) _done();
          }
        }
      }
    });
    if (_counter <= 0) break;
    if (1 >= _results.length) {
      if (--_counter === 0) _done();
    } else {
      var _fn1 = _x[1];
      _fn1(name, (_err1, _result1) => {
        if (_err1) {
          if (_counter > 0) {
            if (1 < _results.length && ((_results.length = 2), (_results[1] = { error: _err1 }), _checkDone())) {
              _counter = 0;
            } else {
              if (--_counter === 0) _done();
            }
          }
        } else {
          if (_counter > 0) {
            if (1 < _results.length && (_result1 !== undefined && (_results.length = 2), (_results[1] = { result: _result1 }), _checkDone())) {
              _counter = 0;
            } else {
              if (--_counter === 0) _done();
            }
          }
        }
      });
    }
    if (_counter <= 0) break;
    if (2 >= _results.length) {
      if (--_counter === 0) _done();
    } else {
      var _fn2 = _x[2];
      _fn2(name, (_err2, _result2) => {
        if (_err2) {
          if (_counter > 0) {
            if (2 < _results.length && ((_results.length = 3), (_results[2] = { error: _err2 }), _checkDone())) {
              _counter = 0;
            } else {
              if (--_counter === 0) _done();
            }
          }
        } else {
          if (_counter > 0) {
            if (2 < _results.length && (_result2 !== undefined && (_results.length = 3), (_results[2] = { result: _result2 }), _checkDone())) {
              _counter = 0;
            } else {
              if (--_counter === 0) _done();
            }
          }
        }
      });
    }
  } while (false);
}
