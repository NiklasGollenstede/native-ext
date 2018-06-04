(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/storage': { local: storage, }, // do not synchronize the settings
	'node_modules/web-ext-utils/browser/version': { gecko, },
	'node_modules/web-ext-utils/options/': Options,
}) => {
const isBeta = (/^\d+\.\d+.\d+(?!$)/).test((global.browser || global.chrome).runtime.getManifest().version); // version doesn't end after the 3rd number ==> bata channel

const { navigator: { userAgent, oscpu, }, } = global;
const windows = (/windows/i).test(userAgent), macos = !windows && (/mac\s*os\s*x/i).test(userAgent);
const arch = macos || (windows ? (/x64/).test(oscpu) : (/x86_64/).test(oscpu) && !(/i386/).test(oscpu)) ? 'x64' : 'x86';
const os = windows ? 'win' : macos ? 'macos' : 'linux';

const rId = {
	exp: !gecko ? (/^[a-p]{32}$/) : (/^{[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}}$|^[\w.-]*@[\w.-]*$/),
	message: 'Must be a valid extension ID',
};

const model = {
	description: {
		description: `The NativeExt extension manages access to the NativeExt application, which gives other browser extensions full access to your computer.<br>
		NativeExt will explicitly ask you for every extension before granting it access to your system.<br>
		To use NativeExt, you must <a download href="https://latest.native-ext.niklasg.de/download/${os}-${arch}/">download</a> and <b>install</b> the application, and then click the <b><code>Apply</code></b> button below.`,
	},
	config: {
		default: true,
		restrict: { type: 'boolean', },
		children: {
			extensions: {
				title: 'Allowed extensions',
				default: [ ],
				maxLength: Infinity,
				restrict: { type: 'string', match: rId, },
				input: { type: 'string', default: '', },
			},
			profile: {
				title: 'Profile location',
				default: false,
				input: { type: 'boolean', suffix: `set manually <details><summary>[INFO]:</summary>
				NativeExt is only able to automatically locate the current browser profile if it is in one of the systems default locations.<br>
				If you explicitly set a custom location, or the auto detection fails, please copy the path to the profile directory below.<br>`+ (
				gecko ? `You can find the path on the <code>about:support</code> page in the first table in the <b>Profile Folder</b> row.`
				: `You can find the path on the <code>chrome://version/</code> page next to <b>Profile Path</b>.`
				) +`</details>`, },
				children: {
					path: {
						default: '',
						restrict: { type: 'string', },
						input: { type: 'string', },
					},
				},
			},
			external: {
				title: 'External extensions',
				expanded: false,
				description: `Locations of extensions that are not installed in the default location in the browser profile must be explicitly specified.<br>
				This can be used e.g. for unpacked extensions during development.`,
				default: [ ],
				maxLength: Infinity,
				restrict: [
					{ type: 'string', match: rId,  },
					{ type: 'string', },
				],
				input: [
					{ type: 'string', suffix: ':', default: '', placeholder: 'extension ID', },
					{ type: 'string', default: '', placeholder: 'absolute path', },
				],
			},
			forceWrite: {
				description: ` `, // margin
				default: '',
				input: { type: 'random', label: 'Apply', suffix: `Write the configuration to the system.`, },
			},
			name: { default: '', restrict: { type: 'string', }, },
			version: { default: '', restrict: { type: 'string', }, },
		},
	},
	debug: {
		title: 'Debug Level',
		expanded: false,
		default: +isBeta,
		hidden: !isBeta,
		restrict: { type: 'number', from: 0, to: 2, },
		input: { type: 'integer', suffix: `set to > 0 to enable some diagnostic logging`, },
	},
};

return (await new Options({ model, storage, prefix: 'options', })).children;
}); })(this);
