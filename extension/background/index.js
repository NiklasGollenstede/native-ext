(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': Browser,
	'node_modules/web-ext-utils/utils/': { reportSuccess, reportError, },
	'common/options': options,
	Config, External, Prompt, Update, module,
}) => {


options.config.children.forceWrite.onChange(async (_, __, { values, }) => { try {
	if (!values.isSet) { return; } setTimeout(() =>values.reset(), 10);
	(await Config.write()); reportSuccess('Done!', 'The new configuration was written and verified');
} catch (error) { reportError(error); } });


// debug stuff
Object.assign(global, module.exports = {
	Browser,
	options,
	// updated,
	Config,
	External,
	Prompt,
	Update,
});

}); })(this);
