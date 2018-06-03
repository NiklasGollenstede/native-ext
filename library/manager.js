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
	 * @param  {string?}    .name   Name of the native application for `runtime.connectNative()`.
	 * @param  {function?}  .name   Lazy async fallback getter for `.name`.
	 */
	constructor(options) { return new _Manager(this, options); }

	/**
	 * Calls `action` with the process. Starts the process if necessary.
	 * The process won't be terminated before `action` returns.
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
 * called with the new or existing process immediately.
 * So effectively, calling `manager.on(callback)` ensures that the process is and stays running
 * and calls `callback` immediately and after every respawn.
 */
setEventGetter(Manager, '', Self);

/**
 * Event `onError`: Event fired with [ type, error, ] fired when a critical error occurs.
 * - `reason` === 'uncaught': There was a uncaught error/rejection, the process as killed and will be respawned.
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

		this.spawning = null;

		void self.on; // invoke getter
		this.fire.onadd = this.add.bind(this);
		this.fire.onremove = this.remove.bind(this);

	}

	async spawn() { return this.spawning || (this.spawning = (async () => {
		const name = this.name || (this.name = (await this.getName()));
		if (!this.fire) { throw new Error(`Manager was destroyed`); }
		const process = (await new Process({
			name,
			onStdout(enc, data) { console.info('stdout', enc, data); },
			onStderr(enc, data) { console.warn('stderr', enc, data); },
			onUncaught: this.onErorr.bind(this),
			onRejected: this.onErorr.bind(this),
			onExit: this.respawn.bind(this),
		}));
		if (!this.fire) { process.destroy(); throw new Error(`Manager was destroyed`); }
		this.fire([ process, ]);
		this.process = process; this.spawning = null;
	})()); }

	async respawn() {
		if (!this.fire.size) { return; } // normal exit or crashed during `.do`.
		try { (await this.spawn()); }
		catch (error) { this.fireError && this.fireError([ 'spawn', error, ]); }
	}

	onErorr(error) {
		this.process && this.process.destroy();
		this.fireError && this.fireError([ 'uncaught', error, ]);
	}

	async do(action) {
		!this.process && (await this.spawn());
		try { this.actions += 1;  return (await action(this.process)); }
		finally { this.actions -= 1; this.remove(); }
	}

	async add(listener) {
		if (this.process) {
			try { (await listener(process)); }
			catch (error) { console.error(`Process start listener threw`, error); }
		} else {
			try { (await this.spawn()); }
			catch (error) { this.fireError && this.fireError([ 'spawn', error, ]); }
		}
	}

	remove() {
		if (!this.process || this.fire.size || this.actions) { return; }
		this.process && this.process.destroy(); this.process = null; // TODO: wait a bit
	}

	destroy() {
		if (!this.public) { return; }
		Self.delete(this.public); this.public = null;
		this.fire(null, { last: true, });
		this.process && this.process.destroy();
		this.process = this.fire = this.on = null;
	}

}

return Manager;

}); })(this);
