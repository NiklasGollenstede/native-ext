(function(global) { 'use strict'; define([ /* global define, */ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'./manager',
], (Manager) => {


const exports = Object.assign(
	new Manager({ getName: getApplicationName, }),
	{ requestPermission, removePermission, getApplicationName, setApplicationName, },
);


const { runtime, } = (global.browser || global.chrome);


async function requestPermission({ message, }) {
	const reply = (await sendMessage({ request: 'requestPermission', message, }));
	if (reply.name) { setApplicationName(reply.name); }
	return reply;
}
async function removePermission() {
	return sendMessage({ request: 'removePermission', });
}


let appName;
async function getApplicationName(force) {
	if (!force) { try {
		if (appName) { return appName; }
		const name = (await (await getStore()).get('name'));
		if (name) { return (appName = name); }
	} catch (error) { console.error(error); } }
	const reply = (await sendMessage({ request: 'getName', }));
	const name = reply.name; if (!name) { throw new Error(`Failed to get native-ext app name`); }
	setApplicationName(name); return name;
}
function setApplicationName(name) {
	appName = name;
	setTimeout(() => getStore().then(_=>_.set('name', name)));
}


async function sendMessage(message) { return new Promise((resolve, reject) => {
	let error, left = extIds.length; extIds.forEach((extId, index) => runtime.sendMessage(
		extId, message, { }, reply => { if (runtime.lastError) {
			!index && (error = runtime.lastError); left -= 1; !left && reject(error);
		} else { resolve(reply); } },
	));
}); }
const gecko = runtime.getURL('').startsWith('moz-');
const extIds = gecko ? [ '@native-ext', '@native-ext-dev', ] : [ 'bgfocfgnalfpdjgikdpjimjokbkmemgp', ]; // TODO


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
