(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/utils/semver': Version,
	'node_modules/native-ext/': Native,
	'common/exe-url': exeUrl,
	require,
}) => {

const expected = new Version((/^\d+\.\d+\.\d+/).exec(manifest.version)[0]);

async function getVersions() {
	return { installed: (await getInstalled()), expected, };
}

async function getInstalled() {
	return Native.do(async process => {
		return new Version((await process.require(require.resolve('./update.node.js'))).version);
	}, { blocking: false, });
}

async function check(version) {
	const url = exeUrl(version); try {
		const abort = new global.AbortController();
		const { status, } = (await global.fetch(url, { signal: abort.signal, }));
		abort.abort(); // GitHub doesn't support HEAD requests ...
		return status >= 200 && status < 400 ? url : null;
	} catch (error) { return null; }
}

async function install(version) {
	const url = exeUrl(version), name = url.split('/').pop();
	console.info('NativeExt installing update from', url);

	// use browser to fetch binary as to not bypass proxy settings etc
	const data = (await global.fetch(url).then(_=>_.blob()).then(blob => new Promise((onload, onerror) => {
		Object.assign(new global.FileReader, { onerror, onload() { onload(this.result); }, }).readAsDataURL(blob);
	}))).replace(/^.*,/, ''); // remove data-URL prefix

	return Native.do(async process => {
		(await (await process.require(require.resolve('./update.node.js'))).install(name, data));
	}, { blocking: false, });
}

return {
	getVersions, check, install, // intended API
};

}); })(this);
