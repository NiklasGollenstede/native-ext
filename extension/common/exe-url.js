(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Runtime, },
}) => {

const current = '0.3.2';
const info = (await Runtime.getPlatformInfo());
const os = info.os === 'mac' ? 'macos' : info.os, ext = os === 'win' ? 'exe' : 'bin';
const arch = (info.nacl_arch || info.arch) === 'x86-32' ? 'x86' : 'x64';
// no support for other OSs or ARM

function getUrl(version = current) {
	const name = `native-ext-v${version}-${os}-${arch}.${ext}`;
	return `https://github.com/NiklasGollenstede/native-ext/releases/download/v${version}/`+ name;
}

return getUrl;

}); })(this);
