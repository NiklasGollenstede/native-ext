(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': Browser,
	'node_modules/web-ext-utils/browser/storage': Storage,
	'node_modules/web-ext-utils/update/': updated,
	'node_modules/web-ext-utils/utils/notify': notify,
	'common/options': options,
	External, module,
	require, // loads ./config and ./update lazily
}) => {


// modules that must be loaded
void External; // listens for external messages


// wire up the configuration
const config = options.config.children; {
	config.forceWrite.onChange(async (_, __, { values, }) => { try {
		if (!values.isSet) { return; } setTimeout(() => values.reset(), 10);
		notify.info(`Applying configuration`, `This may take a few seconds ...`);
		(await (await require.async('./config')).write());
		notify.success('Done!', 'The new configuration was written and verified');
	} catch (error) { notify.error(error); } });

	config.profile.children.path.onChange(() => {
		config.name.values.reset();
		config.version.values.reset();
	});
}


// check for application update whenever the extension was updated
updated.extension.updated && require.async('./update').then(async Update => {
	const { expected, installed, } = (await Update.getVersions());
	if (expected <= installed) { return; }
	(await Update.install(expected));
}).catch(error => notify.error(`Automatic update failed`, error));


// debug stuff
Object.assign(global, module.exports = {
	Browser, Storage, notify,
	options, updated,
	External,
});

}); })(this);
