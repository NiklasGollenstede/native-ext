'use strict'; /* globals require, module, exports, process, */

const { promisify, } = require('util'), promisifyAll = _promisifyAll; // work with promises

const fs = promisifyAll(require('fs')); // any native module, 'ffi', 'browser' or any file included in the extension

// handle special case of `fs.watch`
const cb2watcher = new WeakSet, { watch, } = require('fs');
fs.watch = (path, options, callback) => {
	const watcher = watch(path, options, callback);
	cb2watcher.set(callback, watcher);
};
fs.unwatch = callback => {
	const watcher = cb2watcher.get(callback);
	watcher && watcher.close();
	cb2watcher.delete(callback);
};

module.exports = fs;

function _promisifyAll(object) { /// returns a clone of an API with all its non 'Sync' functions promisified
	return Object.entries(object).reduce((o, [ k, v, ]) => (typeof v === 'function' && !k.endsWith('Sync') && (o[k] = promisify(v)), o), { });
}
