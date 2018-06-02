(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Runtime, Storage, manifest, },
	'node_modules/web-ext-utils/browser/version': { gecko, current: browser, },
	'node_modules/multiport/': Port,
	'common/options': options,
}) => {

async function write() { let port; try {
	port = new Port(Runtime.connectNative('de.niklasg.native_ext.'+ browser), Port.web_ext_Port);
	port.addHandlers({
		stdout: (encoding, base64) => console.info('native-ext stdout:', encoding ? { encoding, base64, } : base64),
		stderr: (encoding, base64) => console.warn('native-ext stderr:', encoding ? { encoding, base64, } : base64),
	});

	const extId = gecko ? manifest.applications.gecko.id : Runtime.id;
	const ids = [ extId, ].concat(options.config.children.extensions.values.current);

	const locations = options.config.children.external.values.current
	.reduce((o, [ k, v, ]) => ((o[k] = v), o), { });

	let dir = options.config.children.profile.children.value.value;
	if (!dir && !options.config.children.profile.value) {
		const magic = [1,2,3,4,].map(_=>Math.random().toString(32).slice(2)).join('');
		(await Storage.local.set({ __magic__: magic, })); try {
			dir = (await port.request('locateProfile', { magic, extId, }));
		} finally { (await Storage.local.remove('__magic__')); }
		dir && (options.config.children.profile.children.value.value = dir);
	}
	if (!dir) { if (!options.config.children.profile.value) {
		throw new Error(`Could not find browser profile, please set it manually`);
	} else {
		throw new Error(`Please set the browser profile manually or try auto detection`);
	} }

	const { name, version, } = (await port.request('writeProfile', { dir, ids, locations, }));

	options.config.children.name.value = name;
	options.config.children.version.value = version;

} finally { port && port.destroy(); } }

return { write, };

}); })(this);
