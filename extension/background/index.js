(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': Browser,
	// 'node_modules/web-ext-utils/update/': updated,
	'node_modules/web-ext-utils/utils/': { reportError, },
	'common/options': options,
	Config, module,
}) => {


options.config.children.forceWrite.onChange(async (_, __, { values, }) => { try {
	if (!values.isSet) { return; } setTimeout(() =>values.reset(), 10);
	(await Config.write());
} catch (error) { reportError(error); } });


/*
	port.addHandlers({
		stdout: (encoding, base64) => console.info('native-ext stdout:', encoding ? { encoding, base64, } : base64),
		stderr: (encoding, base64) => console.warn('native-ext stderr:', encoding ? { encoding, base64, } : base64),
	});
	port.addHandler('error', error => console.error('native-ext uncaught', error)); port.addHandler('reject', error => console.error('native-ext rejection', error));
 */


// debug stuff
Object.assign(global, module.exports = {
	Browser,
	options,
	// updated,
	Config,
});

}); })(this);
