const Tapable  = require('../lib/Tapable');


var tapable = new Tapable();

tapable.plugin('done',(options)=> console.log(options));