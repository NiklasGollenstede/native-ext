(function(global) { 'use strict'; define([ /* global define, */ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/utils/event',
	'./process',
], (
	{ setEventGetter, }, Process,
) => {

/**
 * Manages a `Process`. Spawns the process when necessary,
 * respawns it when it crashes and terminates it when no longer needed.
 * Stdio of the process is logged to the console, uncaught errors/rejections respawn the process.
 * @see  `Process`
 */
class Manager {

	/**
	 * @param  {string?}    .name       Name of the native application for `runtime.connectNative()`.
	 * @param  {function?}  .name       Lazy async fallback getter for `.name`.
	 * @param  {natural?}   .keepAlive  Time in ms to keep the process alive after the last listener was removed.
	 * @param  {any?}       .inspect    Initial value for `this.inspect`.
	 */
	constructor(options) { return new _Manager(this, options); }

	/**
	 * Alias for `this.on(action, { once: true, })`.
	 * So it calls `action` with the process, but does not
	 * keep the process alive after the completion of `action`.
	 * @param  {function}  action  Async function called with (process).
	 * @return {any}               Return value of `action`.
	 */
	async do(action) { return Self.get(this).do(action); }

	/// Removes all listeners and immediately terminates the process.
	destroy() { const self = Self.get(this); self && self.destroy(); }
} const Self = new WeakMap;

/**
 * Event `on`: Event fired with [ process, ] whenever the process was (re-)started.
 * Adding listeners will not only keep the process alive and prompt respawns if it dies,
 * it also spawns a new process if none was started, and new listeners are always
 * called with the new or existing process immediately (or as soon as it is started).
 * So effectively, calling `manager.on(callback)` ensures that the process is and stays running
 * and calls `callback` immediately and after every respawn.
 */
setEventGetter(Manager, '', Self);

/**
 * Event `onError`: Event fired with [ type, error, ] fired when a critical error occurs.
 * - `reason` === 'uncaught': There was a uncaught error/rejection, the process was killed and will be respawned.
 * - `reason` === 'spawn': The process failed to (re-)start. The process won't be respawned automatically again.
 */
setEventGetter(Manager, 'error', Self);

/**
 * @property {object|boolean?}  inspect  Current value is forwarded to the process(es) at the time of their creation.
 */

//// start implementation

class _Manager {
	constructor(self, options) {
		Self.set(this.public = self, this);
		self._ = this; // only for debugging, will be removed

		self.inspect = options.inspect;
		this.name = options.name || null;
		this.getName = options.getName || null;
		this.throttle = options.throttle || 20e3;

		this.spawning = null; this.active = this.crashed = 0; this.first = new Map;

		void self.on; // invoke getter
		this.fire.onadd = this.add.bind(this);
		this.fire.onremove = this.remove.bind(this);

		this.remove = debounce(this.remove.bind(this), options.keepAlive || 15e3);
		return self;
	}

	async spawn() { return this.spawning || (this.spawning = (async () => { try {

		// TODO: handle this.first..blocking // EDIT: probably not ...
		//	const noBlock = new Set; this.first.forEach(({ blocking, }, listener) => !blocking && noBlock.add(listener));
		//	if (noBlock.size) { try { (await this.getName({ blocking: false, })); } catch (error) {
		//		Object.freeze(error); noBlock.forEach(listener => {
		//			const options = this.first.get(listener); if (!options) { return; } // too slow, never mind
		//			options.reject(error); options.once && this.off(listener);
		//		});
		//	} }

		const name = this.name || (this.name = (await this.getName(/*{ blocking: true, }*/)));
		if (!this.fire || !this.fire.size) { return; } // too slow, never mind
		if (!name) { throw new Error(`Could not get name to connect to NativeExt`); }

		// avoid respawn loops, or at least slow them down
		const wait = this.throttle - (Date.now() - this.crashed);
		wait > 0 && (await new Promise(wake => setTimeout(wake, wait)));
		if (!this.fire || !this.fire.size) { return; } // too slow, never mind

		const process = this.process = (await new Process({
			name, inspect: this.public.inspect,
			onStdout(enc, data) { console.info('stdout', enc, data); },
			onStderr(enc, data) { console.warn('stderr', enc, data); },
			onUncaught: this.onErorr.bind(this),
			onRejected: this.onErorr.bind(this),
			onExit: this.respawn.bind(this),
		})); this.crashed = 0;
		if (!this.fire) { process.destroy(); return; } { this.process = process; }
		if (!this.fire.size) { this.remove(null); return; }

		const first = new Map(this.first); this.first.clear(); // `.fire()` works on a slice as well, and may very well cause changes to `this.first`
		this.call(() => this.fire([ process, ], { filter: it => !first.has(it), }))
		.catch(error => console.error('Error in process spawn handler:', error));

		first.forEach(async ({ resolve, reject, }, listener) => { try {
			resolve((await this.call(listener)));
		} catch (error) { reject(error); } });

	} catch (error) {
		if (this.first) { this.first.forEach(({ reject, }) => reject(error)); this.first.clear(); }
		this.fireError && this.fireError([ 'spawn', error, ]);
	} finally { this.spawning = null; } })()); }

	async respawn(error) {
		error && console.error('Native process crashed', error);
		error && (this.crashed = Date.now());
		this.process && this.process.destroy(); this.process = null;
		if (!this.fire.size) { return; } // normal exit or crashed during `.do`.
		this.spawn();
	}

	onErorr(error) {
		this.process && this.process.destroy(); this.process = null;
		this.fireError && this.fireError([ 'uncaught', error, ]);
	}

	async do(action, options) {
		!options && (options = { }); options.once = true;
		return this.on(action, options);
	}

	async add(listener, options) {
		if (this.process) {
			options && options.once && this.on.removeListener(listener);
			return this.call(listener);
		} this.spawn();
		return new Promise((resolve, reject) => this.first.set(listener, {
			resolve, reject, // blocking: !options || options.blocking,
		}));
	}

	async call(listener) {
		try { this.active += 1; return (await listener(this.process)); }
		finally { this.active -= 1; this.remove(); }
	}

	remove(listener) {
		this.first.delete(listener);
		if (!this.process || this.fire.size || this.active) { return; }
		this.process && this.process.destroy(); this.process = null;
	}

	destroy() {
		if (!this.public) { return; }
		Self.delete(this.public); this.public = null;
		this.first.forEach(({ reject, }) => reject(Error(`Manager was destroyed`)));
		this.fire(null, { last: true, });
		this.process && this.process.destroy();
		this.process = this.fire = this.on = this.first = null;
	}

}

// let unloading = false; global.addEventListener('unload', () => (unloading = true)); // TODO: don't respawn if `unloading`?

return Manager;

function debounce(callback, time) {
	let timer = null; return function() {
		clearTimeout(timer); timer = setTimeout(() => callback.apply(this, arguments), time); // eslint-disable-line no-invalid-this
	};
}

}); })(this);
