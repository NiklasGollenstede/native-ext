(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/native-ext/process': Process,
	'node_modules/native-ext/': Native,
	'common/options': options,
	require,
}) => {

// this is just a proof of concept how to use the global process manager
async function update() {
	Native.setApplicationName(options.config.children.name.value);

	const exports = (await Native.do(async process => {
		const exports = (await process.require(require.resolve('./update.node.js')));
		console.info((await exports.callback()));
		return exports;
	}));

	console.info(exports.version);

	try { console.info((await exports.callback())); }
	catch (_) { console.info('threw as expected'); }
}

// this is just a proof of concept how to use the `Process` class directly
async function updateOld() { let process; try {

	process = (await new Process({
		name: options.config.children.name.value,
		onStdout(enc, data) { console.info('stdout', enc, data); },
		onStderr(enc, data) { console.info('stderr', enc, data); },
	}));

	const exports = (await process.require(require.resolve('./update.node.js')));

	console.info((await exports.callback()));

	console.info(exports.version);

} finally { process && process.destroy(); } }


return { update, updateOld, };

}); })(this);
