(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Runtime, manifest, },
}) => {

const current = (/^\d+\.\d+\.\d+/).exec(manifest.version)[0].replace(/\.\d+$/, '.0');
let { os, arch, } = (await Runtime.getPlatformInfo());
os === 'mac' && (os = 'macos'); arch = arch === 'x86-32' ? 'x86' : 'x64'; //nor support for other OSs or ARM

function getUrl(version = current) {
	const name = `native-ext-v${version}-${os}-${arch}`+ (os === 'win' ? '.exe' : '');
	return `https://github.com/NiklasGollenstede/native-ext/releases/download/v${version}/`+ name;
}

return getUrl;

}); })(this);
