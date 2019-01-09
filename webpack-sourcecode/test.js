const webpack = require('webpack');
const config = require('./config.js');

webpack(config, (err, stat) => {
  console.error('err', err);
  console.log('stat', stat);
});
