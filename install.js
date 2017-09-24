'use strict';

const promisify = require('util').promisify || (func => (...args) => new Promise((g, b) => func(...args, (e, v) => e ? b(e) : g(v))));

const Path = require('path');
const FS = require('fs');
const chmod = promisify(FS.chmod);
const unlink = promisify(FS.unlink);
const symlink = promisify(FS.symlink);
const readFile = promisify(FS.readFile);
const writeFile = promisify(FS.writeFile);
const mkdir = promisify(FS.mkdir);
const readdir = promisify(FS.readdir);
const rimraf = promisify(require('rimraf'));
const replaceFile = (path, data, opt) => unlink(path).catch(_=>0).then(() => writeFile(path, data, opt));

const child_process = require('child_process');
const execute = (bin, ...args) => new Promise((resolve, reject) => child_process.execFile(bin, args, (error, stdout, stderr) =>
	error ? reject(Object.assign(error, { stderr, stdout, })) : resolve(stdout)
));

const name = 'de.niklasg.native_ext'; // must match \w[\w.]*\w (so no '-')
const node = process.argv[1].startsWith(require('path').resolve('/snapshot/')) ? '' : 'node'; // 'node-dwe --pipe=ioe --';
const os = process.platform;
const windows = os === 'win32';
const scriptExt = windows ? '.bat' : '.sh';
const installDir = (windows ? process.env.APPDATA +'\\' : require('os').homedir() + (os === 'darwin' ? '/Library/Application Support/' : '/.')) + name;
const outPath = path => Path.resolve(installDir, path);

async function install({ source, }) {
	try { source = require.resolve(source); } catch (_) { } node && (source = Path.resolve(source, '..'));
	const binTarget = outPath('bin') + (windows && !node ? '.exe' : '');
	const exec = (...args) => (windows ? '@echo off\r\n\r\n' : '#!/bin/bash\n\n')
	+ (node ? node +` "${binTarget}"` : `"${binTarget}"`) // use absolute paths. The install dir can't be moved anyway
	+' '+ args.map(s => (/^(?:%[*\d]|\$[@\d]|\w+)$/).test(s) ? s : JSON.stringify(s)).join(' ');

	const manifest = browser => ({
		name, description: 'WebExtensions native connector',
		path: (windows ? '' : installDir +'/') + browser + scriptExt,
		type: 'stdio', // mandatory
	});

	try {
		(await unlink(binTarget));
	} catch (error) { if (error.code !== 'ENOENT') {
		throw error.code === 'EBUSY' ? new Error(`A file in the installation folder "${ outPath('') }" seems to be open. Please close all browsers and try again.`) : error;
	} }

	try { (await mkdir(installDir)); } catch (_) { }

	(await Promise.all([
		node ? symlink(source, binTarget, 'junction') : copyFile(source, binTarget).then(() => chmod(binTarget, '754')),
		replaceFile(outPath('chrome.json'),  JSON.stringify(manifest('chrome'), null, '\t'), 'utf8'),
		replaceFile(outPath('firefox.json'), JSON.stringify(manifest('firefox'), null, '\t'), 'utf8'),
		mkdir(outPath('vendors')).catch(_=>0),
		...(windows ? [
			execute('REG', 'ADD', 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\'+ name, '/ve', '/t', 'REG_SZ', '/d', outPath('chrome.json'),  '/f'),
			execute('REG', 'ADD', 'HKCU\\Software\\Mozilla\\NativeMessagingHosts\\'+        name, '/ve', '/t', 'REG_SZ', '/d', outPath('firefox.json'), '/f'),
			replaceFile(outPath('chrome.bat'),    exec('connect', 'chrome',   '%*'), { }),
			replaceFile(outPath('firefox.bat'),   exec('connect', 'firefox',  '%*'), { }),
			replaceFile(outPath('uninstall.bat'), exec('uninstall',           '%*'), { }),
			replaceFile(outPath('refresh.bat'),   exec('refresh',             '%*'), { }),
		] : [
			replaceFile(outPath('chromium.sh'),   exec('connect', 'chromium', '$@'), { mode: '754', }),
			replaceFile(outPath('chrome.sh'),     exec('connect', 'chrome',   '$@'), { mode: '754', }),
			replaceFile(outPath('firefox.sh'),    exec('connect', 'firefox',  '$@'), { mode: '754', }),
			replaceFile(outPath('uninstall.sh'),  exec('uninstall',           '$@'), { mode: '754', }),
			replaceFile(outPath('refresh.sh'),    exec('refresh',             '$@'), { mode: '754', }),
		]),
	]));

	os === 'linux' && (await Promise.all([
		/*chromium*/mkdir(outPath(`../.config/`)).catch(_=>0)
		.then(() => mkdir(outPath(`../.config/chromium`)).catch(_=>0))
		.then(() => mkdir(outPath(`../.config/chromium/NativeMessagingHosts`)).catch(_=>0))
		.then(() =>unlink(outPath(`../.config/chromium/NativeMessagingHosts/${ name }.json`)).catch(_=>0))
		.then(() => symlink(outPath(`chrome.json`), outPath(`../.config/chromium/NativeMessagingHosts/${ name }.json`))),
		/*chrome*/  mkdir(outPath(`../.config/`)).catch(_=>0)
		.then(() => mkdir(outPath(`../.config/google-chrome`)).catch(_=>0))
		.then(() => mkdir(outPath(`../.config/google-chrome/NativeMessagingHosts`)).catch(_=>0))
		.then(() =>unlink(outPath(`../.config/google-chrome/NativeMessagingHosts/${ name }.json`)).catch(_=>0))
		.then(() => symlink(outPath(`chrome.json`), outPath(`../.config/google-chrome/NativeMessagingHosts/${ name }.json`))),
		/*firefox*/ mkdir(outPath(`../.mozilla/`)).catch(_=>0)
		.then(() => mkdir(outPath(`../.mozilla/native-messaging-hosts`)).catch(_=>0))
		.then(() =>unlink(outPath(`../.mozilla/native-messaging-hosts/${ name }.json`)).catch(_=>0))
		.then(() => symlink(outPath('firefox.json'), outPath(`../.mozilla/native-messaging-hosts/${ name }.json`))),
	]));

	os === 'darwin' && (await Promise.all([
		/*chromium*/mkdir(outPath(`../Chromium`)).catch(_=>0)
		.then(() => mkdir(outPath(`../Chromium/NativeMessagingHosts`)).catch(_=>0))
		.then(() =>unlink(outPath(`../Chromium/NativeMessagingHosts/${ name }.json`)).catch(_=>0))
		.then(() => symlink(outPath('chrome.json'), outPath(`../Chromium/NativeMessagingHosts/${ name }.json`))),
		/*chrome*/  mkdir(outPath(`../Google`)).catch(_=>0)
		.then(() => mkdir(outPath(`../Google/Chrome`)).catch(_=>0))
		.then(() => mkdir(outPath(`../Google/Chrome/NativeMessagingHosts`)).catch(_=>0))
		.then(() =>unlink(outPath(`../Google/Chrome/NativeMessagingHosts/${ name }.json`)).catch(_=>0))
		.then(() => symlink(outPath('chrome.json'), outPath(`../Google/Chrome/NativeMessagingHosts/${ name }.json`))),
		/*firefox*/ mkdir(outPath(`../Mozilla/`)).catch(_=>0)
		.then(() => mkdir(outPath(`../Mozilla/NativeMessagingHosts`)).catch(_=>0))
		.then(() =>unlink(outPath(`../Mozilla/NativeMessagingHosts/${ name }.json`)).catch(_=>0))
		.then(() => symlink(outPath('firefox.json'), outPath(`../Mozilla/NativeMessagingHosts/${ name }.json`))),
	]));

	(await refresh(arguments[0]));
}

async function refresh() {
	const urls = [ ], ids = [ ];
	(await (await readdir(outPath('vendors'))).filter(_=>!_.startsWith('.')).map(name =>
		readFile(outPath('vendors/'+ name))
		.then(config => {
			config = JSON.parse(config);
			config['chrome-ext-urls'] && urls.push(...config['chrome-ext-urls']);
			config['firefox-ext-ids'] && ids.push(...config['firefox-ext-ids']);
		}).catch(error => console.error(error))
	));

	(await Promise.all([
		replaceFile(outPath('chrome.json'),  JSON.stringify(
			Object.assign(JSON.parse((await readFile(outPath('chrome.json')))), { allowed_origins: urls, }),
		null, '\t'), 'utf8'),
		replaceFile(outPath('firefox.json'),  JSON.stringify(
			Object.assign(JSON.parse((await readFile(outPath('firefox.json')))), { allowed_extensions: ids, }),
		null, '\t'), 'utf8'),
	]));
}

async function uninstall() {
	try {
		(await rimraf(installDir));
	} catch (error) {
		throw error.code === 'EBUSY' ? new Error(`A file in the installation folder "${ outPath('') }" seems to be open. Please close all browsers and try again.`) : error;
	}
	(await Promise.all([
		...(windows ? [
			execute('REG', 'ADD', 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\'+ name, '/f').catch(_=>0),
			execute('REG', 'ADD', 'HKCU\\Software\\Mozilla\\NativeMessagingHosts\\'+        name, '/f').catch(_=>0),
		] : [ ]),
		...(os === 'linux' ? [
			unlink(outPath(`../.config/chromium/NativeMessagingHosts/${ name }.json`)).catch(_=>0),
			unlink(outPath(`../.config/google-chrome/NativeMessagingHosts/${ name }.json`)).catch(_=>0),
			unlink(outPath(`../.mozilla/native-messaging-hosts/${ name }.json`)).catch(_=>0),
		] : [ ]),
		...(os === 'darwin' ? [
			unlink(outPath(`../Chromium/NativeMessagingHosts/${ name }.json`)).catch(_=>0),
			unlink(outPath(`../Google/Chrome/NativeMessagingHosts/${ name }.json`)).catch(_=>0),
			unlink(outPath(`../Mozilla/NativeMessagingHosts/${ name }.json`)).catch(_=>0),
		] : [ ]),
	]));
}

module.exports = { install, refresh, uninstall, };

function copyFile(source, target) { return new Promise((resolve, reject) => {
	const read = FS.createReadStream(source), write = FS.createWriteStream(target);
	read.on('error', failed); write.on('error', failed); write.on('finish', resolve);
	function failed(error) { read.destroy(); write.end(); reject(error); }
	read.pipe(write);
}); }
