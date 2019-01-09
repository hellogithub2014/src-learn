const { AsyncParallelBailHook } = require("../lib");

let queue1 = new AsyncParallelBailHook(["name"]);
console.time("cost");
/**
 * 只要前一个回调的返回值不为空或者抛异常，就会直接执行callAsync的回调，后续的tap回调不会被执行
*/
queue1.tap("1", function(name) {
	console.log(name, 1);
	// return 1;
});
queue1.tap("2", function(name) {
	console.log(name, 2);
	return "tap2 result";
});
queue1.tap("3", function(name) {
	console.log(name, 3);
});
queue1.callAsync("webpack", (err,result) => {
  console.log('err: ',err, 'result: ',result);
	console.timeEnd("cost");
});


function anonymous ( name, _callback ) {
  "use strict";
  var _context;
  var _x = this._x;
  var _results = new Array( 3 );
  var _checkDone = () => {
    for ( var i = 0; i < _results.length; i++ )
    {
      var item = _results[ i ];
      if ( item === undefined ) return false;
      if ( item.result !== undefined )
      {
        _callback( null, item.result );
        return true;
      }
      if ( item.error )
      {
        _callback( item.error );
        return true;
      }
    }
    return false;
  }
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
      var _result0 = _fn0( name );
    } catch ( _err )
    {
      _hasError0 = true;
      if ( _counter > 0 )
      {
        if ( 0 < _results.length && ( ( _results.length = 1 ), ( _results[ 0 ] = { error: _err } ), _checkDone() ) )
        {
          _counter = 0;
        } else
        {
          if ( --_counter === 0 ) _done();
        }
      }
    }
    if ( !_hasError0 )
    {
      if ( _counter > 0 )
      {
        if ( 0 < _results.length && ( _result0 !== undefined && ( _results.length = 1 ), ( _results[ 0 ] = { result: _result0 } ), _checkDone() ) )
        {
          _counter = 0;
        } else
        {
          if ( --_counter === 0 ) _done();
        }
      }
    }
    if ( _counter <= 0 ) break;
    if ( 1 >= _results.length )
    {
      if ( --_counter === 0 ) _done();
    } else
    {
      var _fn1 = _x[ 1 ];
      var _hasError1 = false;
      try
      {
        var _result1 = _fn1( name );
      } catch ( _err )
      {
        _hasError1 = true;
        if ( _counter > 0 )
        {
          if ( 1 < _results.length && ( ( _results.length = 2 ), ( _results[ 1 ] = { error: _err } ), _checkDone() ) )
          {
            _counter = 0;
          } else
          {
            if ( --_counter === 0 ) _done();
          }
        }
      }
      if ( !_hasError1 )
      {
        if ( _counter > 0 )
        {
          if ( 1 < _results.length && ( _result1 !== undefined && ( _results.length = 2 ), ( _results[ 1 ] = { result: _result1 } ), _checkDone() ) )
          {
            _counter = 0;
          } else
          {
            if ( --_counter === 0 ) _done();
          }
        }
      }
    }
    if ( _counter <= 0 ) break;
    if ( 2 >= _results.length )
    {
      if ( --_counter === 0 ) _done();
    } else
    {
      var _fn2 = _x[ 2 ];
      var _hasError2 = false;
      try
      {
        var _result2 = _fn2( name );
      } catch ( _err )
      {
        _hasError2 = true;
        if ( _counter > 0 )
        {
          if ( 2 < _results.length && ( ( _results.length = 3 ), ( _results[ 2 ] = { error: _err } ), _checkDone() ) )
          {
            _counter = 0;
          } else
          {
            if ( --_counter === 0 ) _done();
          }
        }
      }
      if ( !_hasError2 )
      {
        if ( _counter > 0 )
        {
          if ( 2 < _results.length && ( _result2 !== undefined && ( _results.length = 3 ), ( _results[ 2 ] = { result: _result2 } ), _checkDone() ) )
          {
            _counter = 0;
          } else
          {
            if ( --_counter === 0 ) _done();
          }
        }
      }
    }
  } while ( false );

}
