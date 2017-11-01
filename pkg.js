'use strict'; (async () => {


const Path = require('path');
const assets = require('./package.json').pkg.assets.map(path => Path.join(__dirname, path));

require('pkg/prelude/common.js').isDotNODE = path => {
	return Path.extname(path) === '.node' && !assets.includes(path);
};

(await require('pkg').exec(process.argv.slice(2)));

})().catch(error => {
	console.error(error);
	process.exit(-1);
});
