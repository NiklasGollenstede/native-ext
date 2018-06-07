(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/utils/semver': Version,
	'node_modules/native-ext/': Native,
	'common/options': options,
	require,
}) => {

const expected = new Version((/^\d+\.\d+\.\d+/).exec(manifest.version)[0]);
const isRelease = expected.string === manifest.version;

async function getVersions() {
	return { installed: (await getInstalled()), expected, };
}

async function getInstalled() {
	return Native.do(async process => {
		return new Version((await process.require(require.resolve('./update.node.js'))).version);
	}, { blocking: false, });
}

async function install(version) {
	const { os: { value: os, }, arch: { value: arch, }, } = options.internal.children;
	const name = `native-ext-v${version}-${os}-${arch}`+ (os === 'win' ? '.exe' : '');
	const url = `https://github.com/NiklasGollenstede/native-ext/releases/download/v${version}/`+ name;
	console.info('NativeExt installing update from', url);

	// use browser to fetch binary as to not bypass proxy settings etc
	let data; try { data = (await fetch(url).then(_=>_.blob()).then(blob => new Promise((onload, onerror) => {
		Object.assign(new FileReader, { onerror, onload() { onload(this.result); }, }).readAsDataURL(blob);
	}))); } catch (error) { if (isRelease) { throw error; }
		throw new Error(`The application for this development build is not available set, please install it from source (${error.message})`);
	}
	data = data.replace(/^.*,/, ''); // remove data-URL prefix

	return Native.do(async process => {
		(await (await process.require(require.resolve('./update.node.js')))).install(name, data);
	}, { blocking: false, });
}

return {
	getVersions, install, // intended API
};

}); })(this);
