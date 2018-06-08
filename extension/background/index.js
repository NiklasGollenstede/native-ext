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
		notify.info('Applying configuration', `This may take a few seconds ...`);
		(await (await require.async('./config')).write());
		notify.success('Done!', `The new configuration was written and verified.`);
	} catch (error) { notify.error(error); } });

	config.profile.children.path.onChange(() => {
		config.name.values.reset();
		config.version.values.reset();
	});
}


// check for application update whenever the extension was updated
updated.extension.updated && new Promise(wake => setTimeout(wake, 60e3)).then(() => autoUpdate(false));
options.update.onChange(() => autoUpdate(true));
async function autoUpdate(explicit) { try {
	if (!options.update.value) { return; }
	const Update = (await require.async('./update'));
	explicit && notify.info('Auto update started', 'Performing update check');
	const { expected, installed, } = (await Update.getVersions());
	if (expected === installed) { explicit && notify.success(
		'Up to Date', `The expected version of the NativeExt application is already installed.`,
	); return; }
	const url = (await Update.check(expected));
	if (!url) { notify.error(
		'Update not available', `The expected update can not be downloaded at the moment.`,
	); return; }
	if (!options.update.children.install.value) { if (!(await notify({
		title: 'Update available', message: `Click here to install version ${expected} or install it manually from ${url}`,
		icon: 'warn', timeout: null,
	}))) { return; } }
	if (explicit) { notify({
		title: 'Installing update', message: `Downloading and installing ${expected} from ${url}`,
		icon: 'default', timeout: null,
	}); } else { console.info('Installing update', `Downloading and installing ${expected} from ${url}`); }
	(await Update.install(expected));
	notify.success(`NativeExt ${expected} installed`, `Update was installed successfully, some extensions may need to be reloaded.`);
} catch(error) {notify.error(`Automatic update failed`, error); } }


// debug stuff
Object.assign(global, module.exports = {
	Browser, Storage, notify,
	options, updated,
	External,
	autoUpdate,
});

}); })(this);
