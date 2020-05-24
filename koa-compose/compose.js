function compose ( middlewares ) {
  // 边界条件校验
  if ( !Array.isArray( middlewares ) )
  {
    throw new Error( 'middlewares需要是数组' );
  }
  const isFunc = arg => typeof arg === 'function';
  if ( !middlewares.every( isFunc ) )
  {
    throw new Error( 'middlewares每个元素需要是函数' );
  }

  return function ( context ) {

    // 执行第i个任务
    function dispatch ( i ) {
      // 所有middleware均执行完
      if ( i >= middlewares.length )
      {
        return Promise.resolve();
      }
      const fn = middlewares[ i ];
      try
      {
        // 当fn执行时抛出了同步错误，是被try-catch捕获的，当内部返回的是被拒绝的Promise，是被catch回调捕获
        return Promise.resolve( fn( context, dispatch.bind( null, i + 1 ) ) );
      } catch ( e )
      {
        return Promise.reject( e );
      }
    }
    return dispatch( 0 );
  };
}

async function task1 ( ctx, next ) {
  console.log( 'task1, before next' );
  await next();
  ctx.a = 1;
  console.log( 'task1, after next' );
}


async function task2 ( ctx, next ) {
  console.log( 'task2, before next' );
  await next();
  ctx.b = 2;
  console.log( 'task2, after next' );
}

async function task3 ( ctx, next ) {
  console.log( 'task3' );
  ctx.c = 3;
  // next(); // 最后一个任务可以不用next
}

const composed = compose( [ task1, task2, task3 ] );
const context = {};
composed( context ).then( () => {
  console.log( JSON.stringify( context ) );
} );