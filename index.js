/* eslint-disable strict */ (function(global) { 'use strict'; define(async ({ /* global define, */ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { runtime, rootUrl, },
	'node_modules/web-ext-utils/lib/multiport/': Port,
}) => {

let port = null; const refs = new Map, cache = { __proto__: null, };

async function require(path, { onDisconnect, } = { }) {
	if (!port) {
		port = new Port(runtime.connectNative('de.niklasg.native_ext'), Port.web_ext_Port);
		port.ended.then(() => { port = null; refs.forEach(unref); Object.keys(cache).forEach(key => delete cache[key]); });
	}

	path = global.require.toUrl(path).replace(/(?:\.js)?$/, '.js').slice(rootUrl.length - 1);

	const ref = { }, funcs = [ ]; try { refs.set(ref, null);

		let exports, resolve; const [ entries, ] = (await (cache[path] || (cache[path] = Promise.all([
			new Promise(_=>(resolve=_)), port.request('require', path, null, (...args) => resolve(args)),
		]))));

		if (entries.length === 1) {
			const value = entries[0]; exports = typeof value === 'function' ? wrapFunc(value) : value;
		} else {
			exports = { }; for (let i = 0; i < entries.length; i += 2) {
				const key = entries[i], value = entries[i +1];
				exports[key] = typeof value === 'function' ? wrapFunc(value) : value;
			}
		}
		refs.set(exports, funcs); port.ended.then(onDisconnect);
		return exports;
	} finally { refs.delete(ref); refs.size === 0 && port && port.destroy(); }

	function wrapFunc(func) {
		let closed = false; funcs.push(() => (closed = true));
		return function(...args) { if (closed) {
			throw new Error(`Can't use method of unrefed module`);
		} else {
			return func(...args);
		} };
	}
}

function unref(ref) {
	const funcs = refs.get(ref);
	if (!funcs) { return refs.delete(ref); }
	refs.delete(ref); refs.size === 0 && port && port.destroy();
	funcs.forEach(_=>_());
	return true;
}

return { require, unref, };

}); })(this);
