/* eslint-disable strict */ (function(global) { 'use strict'; define(async ({ /* global define, */ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { runtime, manifest, rootUrl, isGecko: gecko, },
	Tar,
}) => {

const chromeUrl = !gecko ? rootUrl : /*manifest.applications && manifest.applications.chrome && manifest.applications.chrome.id && `chrome-extension://${manifest.applications.chrome.id}/` ||*/ undefined;
const firefoxId = gecko ? runtime.id : manifest.applications && manifest.applications.gecko && manifest.applications.gecko.id || undefined;
const json = JSON.stringify({ 'firefox-ext-ids': firefoxId && [ firefoxId, ], 'chrome-ext-urls': chromeUrl && [ chromeUrl, ], });
const windows = (/windows/i).test(global.navigator.userAgent), macos = !windows && (/mac\s*os\s*x/i).test(global.navigator.userAgent);
const unixPath = macos ? '~/Library/Application\\ Support/de.niklasg.native_ext' : '~/.de.niklasg.native_ext';
const script = (windows
	? `echo ${json} > %APPDATA%\\de.niklasg.native_ext\\vendors\\re-style.json\r\n%APPDATA%\\de.niklasg.native_ext\\refresh.bat`
	: `#!/bin/bash\necho ${JSON.stringify(json)} > ${ unixPath }/vendors/re-style.json\n${ unixPath }/refresh.sh`
);
const url = global.URL.createObjectURL(windows
	? new global.Blob([ script, ], { type: 'application/x-bat', })
	: new Tar([ {
		mode: 0o777, // must set exec flag
		name: `add ${manifest.name}.${macos? 'command' : 'sh'}`,
		data: script,
	}, ]).toBlob()
);
const name = `add ${manifest.name}.${windows ? 'bat' : 'tar'}`;

return {
	script: { name, text: script, url, },
};

}); })(this);
