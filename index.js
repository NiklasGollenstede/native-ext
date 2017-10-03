/* eslint-disable strict */ (function(global) { 'use strict'; define(async ({ /* global define, */ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { runtime, rootUrl, },
	'node_modules/web-ext-utils/lib/multiport/': Port,
	'node_modules/web-ext-utils/utils/event': { setEvent, },
	exports,
}) => {

let channel = null; const refs = new WeakMap, cache = { __proto__: null, };

const fireError  = setEvent(exports, 'onUncaughtException', { lazy: false, });
const fireReject = setEvent(exports, 'onUnhandledRejection', { lazy: false, });

function connect() {
	if (channel) { return channel.port; }

	// launch
	channel = runtime.connectNative('de.niklasg.native_ext'); const port = channel.port = new Port(channel, Port.web_ext_Port);

	// handle errors
	channel.onDisconnect.addListener(() => {
		port.error = Object.freeze(channel.error || runtime.lastError || new Error(`Native process was terminated`));
	}); port.ended.then(disconnect);

	// setup
	port.addHandlers('init.', { }); // for future requests
	port.inited = port.request('init', { versions: [ '0.2', ], }).then(version => (port.version = version));

	// handle messages
	port.addHandlers('c.', [ console.log, console.info, console.warn, console.error, ], console); // eslint-disable-line no-console
	port.addHandlers({
		stdout: (encoding, base64) => console.info('native-ext stdout:', encoding ? { encoding, base64, } : base64),
		stderr: (encoding, base64) => console.warn('native-ext stderr:', encoding ? { encoding, base64, } : base64),
	});
	port.addHandler('error', error => fireError([ error, ])); port.addHandler('reject', error => fireReject([ error, ]));

	return port;
}

function disconnect() {
	if (!channel) { return; } const { port, } = channel, { error, } = port; channel = null; port.destroy();
	refs.forEach(obj => { try { refs.delete(obj); obj.doClose(); obj.onDisconnect && obj.onDisconnect(error); } catch (error) { console.error(error); } });
	Object.keys(cache).forEach(key => delete cache[key]);
}

async function require(path, { onDisconnect, } = { }) { const ref = { }, port = connect(); {
	refs.set(ref, null); // add temporary reference
} try {

	let disconnected; channel.onDisconnect.addListener(() => {
		disconnected = Object.freeze(channel.error || runtime.lastError || new Error(`Native process was terminated`));
	});
	(await port.inited);

	// get (cached) remote refs or values
	path = global.require.toUrl(path).replace(/(?:\.js)?$/, '.js').slice(rootUrl.length - 1);
	let exports, resolve; const [ entries, ] = (await (cache[path] || (cache[path] = Promise.all([
		new Promise(_=>(resolve=_)), port.request('require', path, null, (...args) => resolve(args)),
	]))));

	// create a unique exports object
	let closed = null; function doClose() { closed = disconnected || new Error(`Can't use method of unrefed module`); }
	function wrapFunc(func) { return function(...args) { if (closed) { throw closed; } else { return func(...args); } }; }
	if (entries.length === 1) { // non-object
		const value = entries[0]; if (typeof value === 'function') { exports = wrapFunc(value); } else { return value; }
	} else { // object properties, every second entry is a value that may be a remote function
		exports = { }; for (let i = 0; i < entries.length; i += 2) {
			const key = entries[i], value = entries[i +1];
			exports[key] = typeof value === 'function' ? wrapFunc(value) : value;
		}
	}

	refs.set(exports, { doClose, onDisconnect, }); // add permanent reference
	return exports;

} catch (error) {
	throw port.error || error; // if something went wrong with the port, then that is the actual problem
} finally {
	refs.delete(ref); refs.size === 0 && port && port.destroy(); // drop temporary reference
} }

function unref(ref) {
	const it = refs.get(ref);
	if (it === undefined) { return false; }
	refs.delete(ref); refs.size === 0 && disconnect();
	it && it.doClose();
	return true;
}

Object.assign(exports, {
	require, unref, nuke: disconnect,
	get version() { return channel && channel.port.version; },
});

}); })(this);
