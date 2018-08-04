(function(global) { 'use strict'; define([ /* global define, */ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/utils/event',
	'node_modules/multiport/',
	'require',
], (
	{ setEventGetter, }, Port, require,
) => {

/**
 * Spawns a single native process and manages the communication with it.
 * Allows the extension to `require()` node modules and returns RPC wrappers to their `exports`.
 */
class Process {
	/**
	 * Asynchronously creates (spawns) the process via Native Messaging.
	 * @param  {string}     .name     Registered name of the Native Messaging app to spawn.
	 * @param  {object?}    .inspect  Optional boolean whether to, or object `{ port, host, break, }` how to,
	 *                                open the inspector after process initialization and before the first `require` call.
	 * @param  {function?}  .on*      Optional initial listener for each instance event.
	 */
	constructor(options) { return new _Process(this, options); }

	/**
	 * Uses `require` to load a file bundled with the extension as node module in the native process
	 * and returns an RPC wrapper to its (resolved) exports.
	 * @param  {string}  id  Absolute path to `.js` the file to load. Must have 'node' or 'native'
	 *                       as last word before the '.js' or path segment name.
	 * @return {any}         Multiport extended JSON clone on the `exports` of the module,
	 *                       but if the exports are an object, Multiports mapping is applied
	 *                       to each value on the object (not only the return value itself).
	 *                       This especially means that is possible to load (flat) objects of functions.
	 */
	async require(id) { return Self.get(this).require(id); }

	/**
	 * @return {boolean}  `true` iff `this` is a not-yet-destroyed/terminated `Process` instance.
	 */
	get alive() { return !!Self.get(this); }

	/// Destroys the `Process` handle, killing the native process if it is still alive. No-op on dead processes.
	destroy() { const self = Self.get(this); self && self.destroy(); }
} const Self = new WeakMap;

/**
 * Event fired with `(encoding, data)` when the process writes to `stdout`.
 * If `encoding` is the empty string, `data` is (and was written as) an `utf-8` string.
 * Otherwise, `data` is a `base64` representation of the logged buffer and `encoding` its encoding.
 */
setEventGetter(Process, 'stdout', Self);
/// Like `onStdout`, but for `stderr`.
setEventGetter(Process, 'stderr', Self);

/**
 * Event fired when `process.on('uncaughtException')` fires in the process.
 * If not at least one handler handles this event without throwing, the process will terminate itself.
 */
setEventGetter(Process, 'uncaught', Self);
/// As `onUncaught`, but for `'unhandledRejection'`.
setEventGetter(Process, 'rejected', Self);

/**
 * Fired directly after the `Process` was `.destroy()`ed.
 * If it was destroyed internally due to an error, that error is the only argument to the listeners.
 */
setEventGetter(Process, 'exit', Self, { async: true, once: true, });

//// start implementation

const { runtime, } = (global.browser || global.chrome);
const rootUrl = runtime.getURL('');
const initPath = require.toUrl('./init.node.js').slice(rootUrl.length - 1);

class _Process {
	constructor(self, options) { return (async () => { try { {
		Self.set(this.public = self, this);
		self._ = this; // only for debugging, will be removed

		const inspect = typeof options.inspect === 'object' || typeof options.inspect === 'boolean' ? options.inspect : undefined;

		this.cache = { }; // modules exports
		[ 'onStdout', 'onStderr', 'onUncaught', 'onRejected', 'onExit', ]
		.forEach(event => options[event] && self[event](options[event]));

		// launch
		const channel = this.channel = runtime.connectNative(options.name);
		const port = this.port = new Port(channel, Port.web_ext_Port);

		// handle errors
		channel.onDisconnect.addListener(() => {
			port.error = Object.freeze(channel.error || runtime.lastError || new Error(`Native process was terminated`));
		}); port.ended.then(() => this.destroy());

		// handle messages
		port.addHandlers({
			stdout: (encoding, base64) => this.fireStdout && void this.fireStdout([ encoding, base64, ]),
			stderr: (encoding, base64) => this.fireStderr && void this.fireStderr([ encoding, base64, ]),
			uncaught: (error) => this.fireUncought ? this.fireUncought([ error, ]) : 0,
			rejected: (error) => this.fireRejected ? this.fireRejected([ error, ]) : 0,
		});

		// setup
		channel.postMessage({ main: initPath, inspect, });
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
		let resolve; const [ exports, ] = (await (this.cache[path] || (this.cache[path] = Promise.all([
			new Promise(_=>(resolve=_)).then(entries => { // gets flattened Object.entries(exports)
				if (entries.length === 1) { // non-object
					return entries[0];
				} else { // object properties, every second entry is a value that may be a remote function
					const exports = { }; for (let i = 0; i < entries.length; i += 2) {
						exports[entries[i]] = entries[i + 1];
					} return exports;
				}
			}),
			this.port.request('require', path, null, (...args) => resolve(args)), // RPC can only return a single function, but the callback can receive multiple function arguments
		]))));
		return exports;

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
