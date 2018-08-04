'use strict';

module.exports = {
	browser: require('browser'),
	homedir: require('os').homedir(),
	getModules() { return Object.keys(require.cache); },
};
