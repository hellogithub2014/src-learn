import { log } from './util';
log('log in entry');
import bundle from './util.bundle.js';
import moment from 'moment';

import strange from './strange.ttt';
console.log(strange);

console.log(moment());
moment.locale('af');

require.ensure(['./runtime.js', './runtime2.js'], function() {
  console.log('ensured');
});

bundle(file => console.log(file));
