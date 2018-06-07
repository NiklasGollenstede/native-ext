(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Runtime, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'background/config': Config,
}) => {

Config.write()
.then(() => console.info('Setup complete'))
.catch(() => notify({
	title: `NativeExt setup`,
	message: `The NativeExt extension is installed, but the setup is not complete.\n
	Click here to open the options page with further instructions.`,
	timeout: 2**30,
}).then(_=>_ && Runtime.openOptionsPage()));

}); })(this);
