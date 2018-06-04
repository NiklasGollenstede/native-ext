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

//// start implementation

class _Manager {
	constructor(self, options) {
		Self.set(this.public = self, this);
		self._ = this; // only for debugging, will be removed

		this.name = options.name || null;
		this.getName = options.getName || null;

		this.spawning = null; this.active = 0; this.first = new Map;

		void self.on; // invoke getter
		this.fire.onadd = this.add.bind(this);
		this.fire.onremove = this.remove.bind(this);

		this.remove = debounce(this.remove.bind(this), options.keepAlive || 15e3);
		return self;
	}

	async spawn() { return this.spawning || (this.spawning = (async () => { try {
		const name = this.name || (this.name = (await this.getName()));
		if (!this.fire || !this.fire.size) { return; } // too slow, never mind
		if (!name) { throw new Error(`Could not get name to connect to NativeExt`); }

		const process = this.process = (await new Process({
			name,
			onStdout(enc, data) { console.info('stdout', enc, data); },
			onStderr(enc, data) { console.warn('stderr', enc, data); },
			onUncaught: this.onErorr.bind(this),
			onRejected: this.onErorr.bind(this),
			onExit: this.respawn.bind(this),
		}));
		if (!this.fire) { process.destroy(); return; } { this.process = process; }
		if (!this.fire.size) { this.remove(); return; }

		this.call(() => this.fire([ process, ], { filter: it => !this.first.has(it), })); // don't catch, no one cares

		this.first.forEach(async ([ resolve, reject, ], listener) => { try {
			resolve((await this.call(listener)));
		} catch (error) { reject(error); } });
		this.first.clear(); // clear immediately

	} catch (error) {
		if (this.first) { this.first.forEach(([ , reject, ]) => reject(error)); this.first.clear(); }
		this.fireError && this.fireError([ 'spawn', error, ]);
	} finally { this.spawning = null; } })()); }

	async respawn() {
		if (!this.fire.size) { return; } // normal exit or crashed during `.do`.
		this.spawn();
	}

	onErorr(error) {
		this.process && this.process.destroy();
		this.fireError && this.fireError([ 'uncaught', error, ]);
	}

	async do(action) {
		return this.on(action, { once: true, });
	}

	async add(listener, options) {
		if (this.process) {
			options && options.once && this.on.removeListener(listener);
			return this.call(listener);
		} this.spawn();
		return new Promise((y, n) => this.first.set(listener, [ y, n, ]));
	}

	async call(listener) {
		try { this.active += 1; return (await listener(this.process)); }
		finally { this.active -= 1; this.remove(); }
	}

	remove() {
		if (!this.process || this.fire.size || this.active) { return; }
		this.process && this.process.destroy(); this.process = null;
	}

	destroy() {
		if (!this.public) { return; }
		Self.delete(this.public); this.public = null;
		this.first.forEach(([ , reject, ]) => reject(Error(`Manager was destroyed`)));
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
