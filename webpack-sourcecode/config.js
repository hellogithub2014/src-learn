const path = require('path');

function p1() {}
p1.prototype.apply = compiler => {
  compiler.hooks.beforeRun.tap('p1', compiler => {
    console.log('beforeRun  p1');
    // throw 'p1 error';
  });
};

function p2() {}
p2.prototype.apply = compiler => {
  compiler.hooks.run.tap('p2', compiler => {
    console.log('run  p2');
  });
};

module.exports = {
  // entry: './webpack-sourcecode/index.js',
  entry: {
    main: './webpack-sourcecode/index.js',
    runtime: './webpack-sourcecode/runtime.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[chunkhash].js',
    // chunkFilename: '[name].[chunkhash].js',
  },
  plugins: [new p1(), new p2()],
  module: {
    rules: [
      {
        test: /\.ttt$/,
        use: 'my-loader',
      },
      {
        test: /\.bundle\.js$/,
        use: 'bundle-loader',
      },
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.png$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192,
            },
          },
        ],
      },
    ],
  },
  resolveLoader: {
    alias: {
      'my-loader': path.resolve(__dirname, './my-loader.js'),
    },
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      minSize: 0,
      maxSize: 0,
      minChunks: 1,
      maxAsyncRequests: 5,
      maxInitialRequests: 3,
      automaticNameDelimiter: '~',
      name: true,
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
    usedExports: true,
  },
  mode: 'development',
  // mode: 'production',
  devtool: 'cheap-source-map',
};
