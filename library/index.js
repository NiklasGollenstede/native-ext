(function(global) { 'use strict'; define([ /* global define, */ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'./manager',
], (Manager) => {

/**
 * Global `Manager` instance that keeps track of the profile specific native application `name`.
 */
const exports = Object.assign(new Manager({
	/// automatically uses the saved application `name`, blocks indefinitely until `name` becomes known,
	/// i.e. may never actually run anything if NativeExt is not set up.
	getName: getApplicationName.bind(null, { blocking: true, }),
	keepAlive: 20e3, /// kill the process 20 seconds after the last callback is removed and action completed.
}), {
	/**
	 * Contacts the NativeExt extension to request permission for this extension to use the application.
	 * @param  {string}  .message  A plain text message explaining to the user why this extension needs access.
	 * @return {object}  Object { failed, code?, message?, name?, }. If `failed` is `false`, permission was granted
	 *                   (now or already), and NativeExt is ready to use; `name` is set.
	 *                   Otherwise, `failed` is `true`, `message` is set to an explanatory (English) string
	 *                   and `code` is one of the following:
	 *                    - `'dismissed'`: The user closed the prompt without making an explicit decision.
	 *                    - `'denied'`: The user explicitly decided not to grant access.
	 *                    - `'config-failed'`: The user granted access, but the application is not ready to use yet.
	 *                                         Further configuration by the user is required.
	 *                    - `'not-reachable'`: NativeExt extension could not be reached (not installed/enabled/started yet).
	 */
	requestPermission,

	/**
	 * Retires the permission to use the application.
	 * @return {object}  Object { failed, code?, message?, removed?, }. If `failed` is `false`, permission
	 *                   is no longer granted. `removed` indicates whether a change was made.
	 *                   Otherwise, `failed` is `true`, `message` is set to an explanatory (English) string
	 *                   and `code` is one of the following:
	 *                    - `'config-failed'`: The permission was removed in the extension, but the change
	 *                                         could not be written to the configuration.
	 *                    - `'not-reachable'`: NativeExt extension could not be reached (not installed/enabled/started yet).
	 */
	removePermission,

	getApplicationName,
	setApplicationName,

	extensionInstallPage: browser => ({
		edge: null, // Edge 15 supports native messaging, but does it pretty differently (https://docs.microsoft.com/en-us/microsoft-edge/extensions/guides/native-messaging). Also "Allowing other apps to download content that changes extension behavior" is not allowed, whatever that actually means.
		firefox: 'https://addons.mozilla.org/firefox/addon/native-ext/',
		fennec: null, // doesn't currently make sense
		chrome: 'https://chrome.google.com/webstore/detail/nativeext/kfabpijabfmojngneeaipepnbnlpkgcf',
		chromium: null, opera: null, vivaldi: null, // probably not
	})[browser] || 'https://github.com/NiklasGollenstede/native-ext/releases',
});
exports.onError((type, _error) => type === 'spawn' && setApplicationName(null));

const { runtime, } = (global.browser || global.chrome);


async function requestPermission({ message, }) {
	const reply = (await sendMessage({ request: 'requestPermission', message, }));
	if (reply.name) { setApplicationName(reply.name); }
	return reply;
}
async function removePermission() {
	setApplicationName(null);
	return sendMessage({ request: 'removePermission', });
}


let appName /* = undefined */; // cache and fallback for iDB
let awaitName, gotName;
async function getApplicationName(options) {
	if (!options || options.stale !== false) { try {
		if (appName !== undefined) { return appName; }
		const name = (await (await getStore()).get('name'));
		if (name) { return (appName = name); }
	} catch (error) { console.error(error); } }
	let name; if (options && options.blocking) {
		name = (await (awaitName = awaitName || new Promise(async got => {
			gotName = got; let sleep = 500;
			let name; while (!name) {
				try { ({ name, } = (await sendMessage({ request: 'awaitName', }))); }
				catch (error) { console.error(error); sleep *= 2; }
				if (name && gotName) { gotName(name); gotName = null; }
				if (!name) { (await new Promise(wake => setTimeout(wake, sleep))); }
			}
		})));
	} else if (options && options.stale) {
		return appName; // undefined
	} else {
		const reply = (await sendMessage({ request: 'getName', }));
		name = reply.name; if (!name) { return null; }
	}
	setApplicationName(name); return name;
}
function setApplicationName(name) {
	appName = name = name ? name +'' : null;
	if (name && gotName) { gotName(name); gotName = null; }
	if (!name && awaitName && !gotName) { awaitName = null; } // don't return the old name from the resolved promise
	setTimeout(() => getStore().then(_=>_.set('name', name)));
}


async function sendMessage(message) { return new Promise((resolve, reject) => {
	let error, left = extIds.length; extIds.forEach((extId, index) => runtime.sendMessage(
		extId, message, { }, reply => { if (runtime.lastError) {
			index === 0 && (error = runtime.lastError); left -= 1; !left && reject(error);
		} else { resolve(reply); } },
	));
}).catch(error => ({ failed: true, code: 'not-reachable', message: `NativeExt is not installed or not enabled (${error.message})`, })); }
const gecko = runtime.getURL('').startsWith('moz-');
const extIds = gecko ? [ '@native-ext', '@native-ext-dev', ] : [ 'kfabpijabfmojngneeaipepnbnlpkgcf', ];


let gettingDB; async function getStore() { return gettingDB || (gettingDB = (async () => {
	const idb = (await getResult(Object.assign(global.indexedDB.open('native-ext', 1), {
		onupgradeneeded({ target: { result: db, }, }) { db.createObjectStore('kv'); },
	}))); return {
		get(key)        { return getResult(idb.transaction([ 'kv', ], 'readwrite').objectStore('kv').get(key)); },
		set(key, value) { return getResult(idb.transaction([ 'kv', ], 'readwrite').objectStore('kv').put(value, key)); },
	};
})()); }
function getResult(request) { return new Promise((resolve, reject) => {
	request.onsuccess = ({ target: { result, }, }) => resolve(result);
	request.onerror = error => {
		reject(error); request.abort && request.abort();
		error.stopPropagation && error.stopPropagation();
	};
}); }

return exports;

}); })(this);
