const path = require('path');
const webpack = require('webpack');

function p1() {}
p1.prototype.apply = compiler => {
  compiler.hooks.beforeRun.tap('p1', compiler => {
    console.log('beforeRun  p1');
  });
};

function p2() {}
p2.prototype.apply = compiler => {
  compiler.hooks.run.tap('p2', compiler => {
    console.log('run  p2');
  });
};

module.exports = {
  // entry: './index.js',
  entry: {
    main: './index.js',
    // runtime: './runtime.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[chunkhash].js',
    // chunkFilename: '[name].[chunkhash].js',
  },
  plugins: [
    new p1(),
    new p2(),
    new webpack.IgnorePlugin({
      resourceRegExp: /\.\/ignore$/,
    }),
  ],
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
  stats: {
    // fallback value for stats options when an option is not defined (has precedence over local webpack defaults)
    all: undefined,

    // Add asset Information
    assets: true,

    // Sort assets by a field
    // You can reverse the sort with `!field`.
    // Some possible values: 'id' (default), 'name', 'size', 'chunks', 'failed', 'issuer'
    // For a complete list of fields see the bottom of the page
    assetsSort: "field",

    // Add build date and time information
    builtAt: true,

    // Add information about cached (not built) modules
    cached: true,

    // Show cached assets (setting this to `false` only shows emitted files)
    cachedAssets: true,

    // Add children information
    children: true,

    // Add chunk information (setting this to `false` allows for a less verbose output)
    chunks: true,

    // Add namedChunkGroups information
    chunkGroups: true,

    // Add built modules information to chunk information
    chunkModules: true,

    // Add the origins of chunks and chunk merging info
    chunkOrigins: true,

    // Sort the chunks by a field
    // You can reverse the sort with `!field`. Default is `id`.
    // Some other possible values: 'name', 'size', 'chunks', 'failed', 'issuer'
    // For a complete list of fields see the bottom of the page
    chunksSort: "field",

    // Context directory for request shortening
    context: "../src/",

    // `webpack --colors` equivalent
    colors: false,

    // Display the distance from the entry point for each module
    depth: false,

    // Display the entry points with the corresponding bundles
    entrypoints: false,

    // Add --env information
    env: false,

    // Add errors
    errors: true,

    // Add details to errors (like resolving log)
    errorDetails: true,

    // Exclude assets from being displayed in stats
    // This can be done with a String, a RegExp, a Function getting the assets name
    // and returning a boolean or an Array of the above.
    excludeAssets: "filter" | /filter/ | ( assetName ) => true | false |
      [ "filter" ] | [ /filter/ ] | [ ( assetName ) => true | false ],

    // Exclude modules from being displayed in stats
    // This can be done with a String, a RegExp, a Function getting the modules source
    // and returning a boolean or an Array of the above.
    excludeModules: "filter" | /filter/ | ( moduleSource ) => true | false |
      [ "filter" ] | [ /filter/ ] | [ ( moduleSource ) => true | false ],

    // See excludeModules
    exclude: "filter" | /filter/ | ( moduleSource ) => true | false |
      [ "filter" ] | [ /filter/ ] | [ ( moduleSource ) => true | false ],

    // Add the hash of the compilation
    hash: true,

    // Set the maximum number of modules to be shown
    maxModules: 15,

    // Add built modules information
    modules: true,

    // Sort the modules by a field
    // You can reverse the sort with `!field`. Default is `id`.
    // Some other possible values: 'name', 'size', 'chunks', 'failed', 'issuer'
    // For a complete list of fields see the bottom of the page
    modulesSort: "field",

    // Show dependencies and origin of warnings/errors (since webpack 2.5.0)
    moduleTrace: true,

    // Show performance hint when file size exceeds `performance.maxAssetSize`
    performance: true,

    // Show the exports of the modules
    providedExports: false,

    // Add public path information
    publicPath: true,

    // Add information about the reasons why modules are included
    reasons: true,

    // Add the source code of modules
    source: false,

    // Add timing information
    timings: true,

    // Show which exports of a module are used
    usedExports: false,

    // Add webpack version information
    version: true,

    // Add warnings
    warnings: true,

    // Filter warnings to be shown (since webpack 2.4.0),
    // can be a String, Regexp, a function getting the warning and returning a boolean
    // or an Array of a combination of the above. First match wins.
    warningsFilter: "filter" | /filter/ | [ "filter", /filter/ ] | ( warning ) => true| false
  }
};
