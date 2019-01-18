const crypto = require('crypto');
const fs = require('fs');

const hash = crypto.createHash('md4');

function log() {
  console.log(hash.digest('hex'));
}

hash.update('maintemplate');
hash.update('3');
log();
