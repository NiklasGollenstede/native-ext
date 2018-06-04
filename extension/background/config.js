(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Runtime, Storage, manifest, },
	'node_modules/web-ext-utils/browser/version': { gecko, current: browser, },
	'node_modules/multiport/': Port,
	'node_modules/native-ext/': Native,
	'common/options': options,
}) => {

const extId = gecko ? manifest.applications.gecko.id : Runtime.id;

async function write() { let port; try {
	// launch the process
	const channel = Runtime.connectNative('de.niklasg.native_ext.'+ browser);
	let error; channel.onDisconnect.addListener(() => !error && (error = channel.error || Runtime.lastError));

	// handle and log messages
	port = new Port(channel, Port.web_ext_Port); port.addHandlers({
		stdout: (encoding, base64) => console.info('native-ext stdout:', encoding ? { encoding, base64, } : base64),
		stderr: (encoding, base64) => console.warn('native-ext stderr:', encoding ? { encoding, base64, } : base64),
		error: msg => !error && (error = new Error(msg)),
	});

	// make sure the process was started correctly
	try { (await port.request('ping')); }
	catch (threw) { throw new Error(`The application is not installed correctly: ${ error && error.message || threw.message }`); }

	// (try to) get the profile dir path
	let dir = options.config.children.profile.children.path.value;
	if (!dir && !options.config.children.profile.value) {
		const magic = [1,2,3,4,].map(_=>Math.random().toString(32).slice(2)).join('');
		(await Storage.local.set({ __magic__: magic, }));
		(await new Promise(wake => setTimeout(wake, 2000))); // give the browser time to write ...
		try {
			dir = (await port.request('locateProfile', { magic, extId, }));
		} finally { (await Storage.local.remove('__magic__')); }
		dir && (options.config.children.profile.children.path.value = dir);
	}
	if (!dir) { if (!options.config.children.profile.value) {
		throw new Error(`Could not find browser profile, please set it manually`);
	} else {
		throw new Error(`Please set the browser profile manually or try auto detection`);
	} }

	// read th configuration values
	const ids = [ extId, ].concat(options.config.children.extensions.values.current);
	const locations = options.config.children.external.values.current
	.reduce((o, [ k, v, ]) => ((o[k] = v), o), { });

	// reset any previous information about the configuration
	options.config.children.name.values.reset();
	options.config.children.version.values.reset();

	// write configuration
	const { name, version, } = (await port.request('writeProfile', { dir, ids, locations, }));

	try { // test that the configuration works
		Native.setApplicationName(name);
		(await Native.do(async process => {
			(await process.require('node_modules/native-ext/test.node.js'));
		}));
	} catch (error) {
		Native.setApplicationName(null);
		throw new Error(`The configuration could not be verified, please make sure that the profile path is set correctly \n(${error.message})`);
	}

	// save information about configuration
	options.config.children.name.value = name;
	options.config.children.version.value = version;

} finally { port && port.destroy(); } }

return { write, };

}); })(this);
