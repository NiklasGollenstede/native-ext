(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/native-ext/process': Process,
	'common/options': options,
	require,
}) => {

// this is just a proof of concept how to use the `Process` class
async function update() { let process; try {

	process = (await new Process({
		name: options.config.children.name.value,
		onStdout(enc, data) { console.info('stdout', enc, data); },
		onStderr(enc, data) { console.info('stderr', enc, data); },
	}));

	console.info((await process.require(require.resolve('./update.node.js'))));

} finally { process && process.destroy(); } }


return { update, };

}); })(this);
