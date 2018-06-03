(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Runtime, },
	'common/options': options,
	Config, Prompt,
}) => {
let debug; options.debug.whenChange(([ value, ]) => { debug = value; });


async function onMessageExternal(message, sender) { switch (message.request) {
	case 'requestPermission': {
		const had = options.config.children.extensions.values.current.includes(sender.id); if (!had) {
			const state = (await Prompt.requestPermission({ id: sender.id, message: sender.message, }));
			if (state !== 'allowed') { return { failed: true, code: state, message: 'Permission to use NativeExt was not granted', }; }
		}
		if (!had || !options.config.children.name.value) {
			try { (await Config.write()); }
			catch (error) { return { failed: true, code: 'config-failed', message: error.message, }; }
		}
		return { failed: false, name: options.config.children.name.value, };
	}
	case 'removePermission': {
		const index = options.config.children.extensions.values.current.indexOf(sender.id);
		if (index < 0) { return { failed: false, removed: false, }; }
		options.config.children.extensions.values.splice(index, 1);
		try { (await Config.write()); }
		catch (error) { return { failed: true, code: 'config-failed', message: error.message, }; }
		return { failed: false, removed: true, };
	}
	case 'getName': {
		if (!options.config.children.extensions.values.current.includes(sender.id)) {
			return { failed: true, code: 'denied', message: 'This extension is not currently allowed to use NativeExt', };
		}
		const name = options.config.children.name.value;
		if (!name) { return { failed: true, code: 'not-setup', message: 'NativeExt is not installed and configured correctly', }; }
		return { failed: false, name, };
	}
	default: throw new Error(`Unknown request ${message.request}`);
} }

Runtime.onMessageExternal.addListener(async (message, sender, reply) => {
	try { reply((await onMessageExternal(message, sender))); }
	catch (error) { reply({ failed: true, code: 'unexpected', error: error.message, }); }
});

}); })(this);
