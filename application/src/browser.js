'use strict'; module.exports = async ({ config, }) => { const browser = { }; {

/**
 * This module collects and exposes information about the connecting browser and extension.
 * It is available as `require('browser')` for the extension modules.
 */

const FS = require('fs'), Path = require('path');

browser.name = config.browser; // 'chromium', 'chrome' or 'firefox'
browser.profileDir = config.profile; // e.g. `C:\Users\<user>\AppData\Roaming\Mozilla\Firefox\Profiles\<rand>.<name>` or `C:\Users\<user>\AppData\Local\Google\Chrome\User Data\Default`

const extId = browser.extId = browser.name === 'firefox' ? process.argv[5] : (/^chrome-extension:\/\/(.*?)\/?$/).exec(process.argv[4])[1];
if (config.locations && (extId in config.locations)) {
	const path = config.locations[extId]; let stat;
	try { stat = FS.statSync(path); } catch (_) { }
	if (stat && stat.isDirectory()) { browser.extDir = path; }
	else if (stat && stat.isFile()) { browser.extFile = path; }
	else { throw new Error(`Location configured for ${extId} is not accessable`); }
} else {
	if (browser.name === 'firefox') {
		const path = Path.join(browser.profileDir, 'extensions', extId); let stat;
		try { stat = FS.statSync(path +'.xpi'); } catch (_) { }
		if (stat && stat.isFile()) { browser.extFile = path +'.xpi'; }
		else {
			try { stat = FS.statSync(path); } catch (_) { }
			if (stat && stat.isDirectory()) { browser.extDir = path; }
			else { throw new Error(`The extension ${extId} is not installed in the default location in ${browser.profileDir}`); }
		}
	} else { // chrome
		const path = Path.join(browser.profileDir, 'Extensions', extId); let versions;
		try { versions = FS.readdirSync(path); } catch (_) { }
		if (!versions || !versions.length) { throw new Error(`The extension ${extId} is not installed in the default location in ${browser.profileDir}`); }
		browser.extDir = Path.resolve(path, versions[versions.length - 1]); // this should probably use the highest semver
	}
}


/// pid of the browser main process
lazy(browser, 'pid', () => {
	const ppid = require('./get-ppid.js');
	return ppid(ppid(process.pid));
});


function lazy(obj, prop, getter) {
	Object.defineProperty(obj, prop, { configurable: true, enumerable: true, get() {
		const value = getter();
		Object.defineProperty(obj, prop, { value, });
		return value;
	}, });
}

} return browser; };
