var { AsyncParallelHook } = require("../lib");

// 只要前一个回调函数不抛异常，在执行完后就会顺序执行后一个回调。若抛异常，会直接执行callAsync的回调，并将异常当做参数
let queue1 = new AsyncParallelHook(["name"]);
console.time("cost");
queue1.tap("1", function(name) {
	console.log(name, 1);
});
queue1.tap("2", function(name) {
	console.log(name, 2);
  throw 'tap2 err' // 后面的tap3不会执行了
});
queue1.tap("3", function(name) {
	console.log(name, 3);
});
queue1.callAsync("webpack", err => {
  console.error('err: ',err);
	console.timeEnd("cost");
});

/*
webpack 1
webpack 2
err:  tap2 err
cost: 4.520ms
*/
function anonymous ( name, _callback ) {
  'use strict';
  var _context;
  var _x = this._x; // 所有hook.tap的监听函数数组
  do
  {
    var _counter = 3;
    var _done = () => {
      _callback();
    };
    if ( _counter <= 0 ) break;
    var _fn0 = _x[ 0 ];
    var _hasError0 = false;
    try
    {
      _fn0( name );
    } catch ( _err )
    {
      _hasError0 = true;
      if ( _counter > 0 )
      {
        _callback( _err );
        _counter = 0;
      }
    }
    if ( !_hasError0 )
    {
      if ( --_counter === 0 ) _done();
    }
    if ( _counter <= 0 ) break;
    var _fn1 = _x[ 1 ];
    var _hasError1 = false;
    try
    {
      _fn1( name );
    } catch ( _err )
    {
      _hasError1 = true;
      if ( _counter > 0 )
      {
        _callback( _err );
        _counter = 0;
      }
    }
    if ( !_hasError1 )
    {
      if ( --_counter === 0 ) _done();
    }
    if ( _counter <= 0 ) break;
    var _fn2 = _x[ 2 ];
    var _hasError2 = false;
    try
    {
      _fn2( name );
    } catch ( _err )
    {
      _hasError2 = true;
      if ( _counter > 0 )
      {
        _callback( _err );
        _counter = 0;
      }
    }
    if ( !_hasError2 )
    {
      if ( --_counter === 0 ) _done();
    }
  } while ( false );
}
