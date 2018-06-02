(function(global) { 'use strict'; define([ /* global define, */ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/utils/event',
	'node_modules/multiport/',
	'require',
], (
	{ setEventGetter, }, Port, require,
) => {
const Self = new WeakMap;

class Process {
	constructor(options) { return new _Process(this, options); }
	async require(id) { return Self.get(this).require(id); }
	destroy() { const self = Self.get(this); self && self.destroy(); }
}
setEventGetter(Process, 'stdout', Self);
setEventGetter(Process, 'stderr', Self);
setEventGetter(Process, 'uncaught', Self);
setEventGetter(Process, 'rejected', Self);
setEventGetter(Process, 'exit', Self, { once: true, });

const { runtime, } = (global.browser || global.chrome);
const rootUrl = runtime.getURL('');
const initPath = require.toUrl('./init.node.js').slice(rootUrl.length - 1);

class _Process {
	constructor(self, options) { return (async () => { try { {
		Self.set(this.public = self, this);
		self._ = this; // only for debugging, will be removed

		this.cache = { }; // modules exports
		[ 'onStdout', 'onStderr', 'onUncaught', 'onRejected', 'onExit', ]
		.forEach(event => options[event] && self[event](options[event]));

		// launch
		const channel = this.channel = runtime.connectNative(options.name);
		const port = this.port = new Port(channel, Port.web_ext_Port);

		// handle errors
		channel.onDisconnect.addListener(() => {
			port.error = Object.freeze(channel.error || runtime.lastError || new Error(`Native process was terminated`));
		}); port.ended.then(() => this.destroy);

		// handle messages
		port.addHandlers({
			stdout: (encoding, base64) => this.fireStdout && void this.fireStdout([ encoding, base64, ]),
			stderr: (encoding, base64) => this.fireStderr && void this.fireStderr([ encoding, base64, ]),
			uncaught: (error) => this.fireUncought ? this.fireUncought([ error, ]) : 0,
			rejected: (error) => this.fireRejected ? this.fireRejected([ error, ]) : 0,
		});

		// setup
		channel.postMessage({ main: initPath, });
		(await Promise.race([ new Promise((ready, failed) => {
			port.addHandler('ready', ready); port.addHandler('error', msg => failed(new Error(msg)));
		}), port.ended, ]));
		const error = this.error || this.port && this.port.error; if (error) { throw error; }
		port.removeHandler('ready'); port.removeHandler('error');

	} return self; } catch (error) {
		try { this.destroy(); } catch (_) { } throw error;
	} })(); }

	async require(path) { try {

		// get (cached) remote refs or values
		path = global.require.toUrl(path).replace(/(?:\.js)?$/, '.js').slice(rootUrl.length - 1);
		let exports, resolve; const [ entries, ] = (await (this.cache[path] || (this.cache[path] = Promise.all([
			new Promise(_=>(resolve=_)), this.port.request('require', path, null, (...args) => resolve(args)),
		]))));

		// create a unique exports object
		if (entries.length === 1) { // non-object
			return entries[0];
		} else { // object properties, every second entry is a value that may be a remote function
			exports = { }; for (let i = 0; i < entries.length; i += 2) {
				exports[entries[i]] = entries[i +1];
			} return exports;
		}

	} catch (error) {
		throw this.port && this.port.error || error; // if something went wrong with the port, then that is the actual problem
	} }

	destroy() {
		if (!this.public) { return; }
		Self.delete(this.public); this.public = null;
		const error = this.error = this.port && this.port.error || null;
		this.port && this.port.destroy();
		this.port = this.channel = null;
		this.fireExit && this.fireExit([ error, ]);
	}

}


return Process;

}); })(this);
