(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Runtime, },
	'common/options': options,
	require, // loads ./config and ./prompt lazily
}) => {
let debug; options.debug.whenChange(([ value, ]) => { debug = value; });

const vExtensions = options.config.children.extensions.values;
const vName = options.config.children.name.values;
const wants = { __proto__: null, };

async function onMessageExternal(message, sender) { switch (message.request) {
	case 'requestPermission': {
		const had = vExtensions.current.includes(sender); if (!had) {
			const state = (await (await require.async('./prompt')).requestPermission({ id: sender, message: message.message, }));
			if (state !== 'allowed') { return { failed: true, code: state, message: 'Permission to use NativeExt was not granted', }; }
			vExtensions.splice(Infinity, 0, sender);
		}
		// Always write, to make sure the extension state is matched by the on-disc configuration.
		try { (await (await require.async('./config')).write()); }
		catch (error) { return { failed: true, code: 'config-failed', message: error.message, }; }
		wants[sender] && wants[sender].forEach(_=>_());
		return { failed: false, name: vName.get(), };
	}
	case 'removePermission': {
		const index = vExtensions.current.indexOf(sender);
		if (index < 0) { return { failed: false, removed: false, }; }
		vExtensions.splice(index, 1);
		try { (await (await require.async('./config')).write()); }
		catch (error) { return { failed: true, code: 'config-failed', message: error.message, }; }
		return { failed: false, removed: true, };
	}
	case 'getName': {
		if (!vExtensions.current.includes(sender)) {
			return { failed: true, code: 'denied', message: 'This extension is not currently allowed to use NativeExt', };
		}
		const name = vName.get();
		if (!name) { return { failed: true, code: 'not-setup', message: 'NativeExt is not installed and configured correctly', }; }
		return { failed: false, name, };
	}
	case 'awaitName': {
		if (!vExtensions.current.includes(sender)) {
			(await new Promise(got => (wants[sender] || (wants[sender] = [ ])).push(got)));
		}
		const name = vName.get() || (await new Promise(got => vName.parent.onChange(function done() {
			if (vName.isSet) { vName.parent.onChange.removeListener(done); got(vName.get()); }
		})));
		return { failed: false, name, };
	}
	default: throw new Error(`Unknown request ${message.request}`);
} }

Runtime.onMessageExternal.addListener((message, sender, reply) => { {
	debug && console.info('onMessageExternal', sender.id, message);
	onMessageExternal(message, sender.id).then(reply)
	.catch(error => reply({ failed: true, code: 'unexpected', error: error.message, }));
} return true; });

}); })(this);
