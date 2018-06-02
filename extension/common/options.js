(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	// 'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/browser/storage': { local: storage, }, // do not synchronize the settings
	'node_modules/web-ext-utils/browser/version': { firefox, },
	'node_modules/web-ext-utils/options/': Options,
}) => {
const isBeta = (/^\d+\.\d+.\d+(?!$)/).test((global.browser || global.chrome).runtime.getManifest().version); // version doesn't end after the 3rd number ==> bata channel

const isId = {
	exp: !firefox ? (/^[a-p]{32}$/) : (/^{[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}}$|^[\w.-]*@[\w.-]*$/),
	message: 'Must be a valid extension ID',
};

const model = {
	config: {
		default: true,
		restrict: { type: 'boolean', },
		children: {
			extensions: {
				title: 'Allowed extensions',
				default: [ ],
				maxLength: Infinity,
				restrict: { type: 'string', match: isId, },
				input: { type: 'string', default: '', },
			},
			profile: {
				title: 'Profile location',
				default: false,
				input: { type: 'boolean', suffix: 'set manually:', },
				children: {
					value: {
						default: '',
						restrict: { type: 'string', },
						input: { type: 'string', },
					},
				},
			},
			external: {
				title: 'External extensions',
				expanded: false,
				description: `Locations of extensions that are not installed in the default location in the browser profile<br>
				E.g. for unpacked extensions during development.`,
				default: [ ],
				maxLength: Infinity,
				restrict: [
					{ type: 'string', match: isId, },
					{ type: 'string', },
				],
				input: [ { type: 'string', suffix: ':', default: '', }, { type: 'string', default: '', }, ],
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
	/*advanced: {
		title: 'Advanced',
		expanded: false,
		hidden: !isBeta,
		description: `Proceed at your own risk`,
		default: true,
		children: {
		},
	},*/
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
