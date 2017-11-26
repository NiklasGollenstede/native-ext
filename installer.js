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
const nodeOptions = process.argv.find(_=>_.startsWith('--node-options='));
const node = process.versions.pkg ? '' : 'node'+ (nodeOptions ? ' '+ nodeOptions.slice(15).replace(/,/g, ' ') : '');
const os = process.platform;
const windows = os === 'win32';
const scriptExt = windows ? '.bat' : '.sh';
const installDir = (windows ? process.env.APPDATA +'\\' : require('os').homedir() + (os === 'darwin' ? '/Library/Application Support/' : '/.')) + name;
const outPath = path => Path.resolve(installDir, path);
const manifest = browser => ({
	name, description: 'WebExtensions native connector',
	path: (windows ? '' : installDir +'/') + browser + scriptExt,
	type: 'stdio', // mandatory
});

async function install({ source, }) {
	try { source = require.resolve(source); } catch (_) { } node && (source = Path.resolve(source, '..'));
	const binTarget = outPath('bin') + (windows && !node ? '.exe' : '');
	const exec = (...args) => (windows ? '@echo off\r\n\r\n' : '#!/bin/bash\n\n')
	+ (node ? node +` "${binTarget}"` : `"${binTarget}"`) // use absolute paths. The install dir can't be moved anyway
	+' '+ args.map(s => (/^(?:%[*\d]|\$[@\d]|\w+)$/).test(s) ? s : JSON.stringify(s)).join(' ');


	try {
		(await unlink(binTarget));
	} catch (error) { if (error.code !== 'ENOENT') {
		throw error.code === 'EBUSY' ? new Error(`A file in the installation folder "${ outPath('') }" seems to be open. Please close all browsers and try again.`) : error;
	} }

	try { (await mkdir(installDir)); } catch (_) { }
	try { (await mkdir(installDir +'/res')); } catch (_) { }

	(await Promise.all([
		node ? symlink(source, binTarget, 'junction') : copyFile(binTarget, source).then(() => chmod(binTarget, '754')),
		!windows &&
		replaceFile(outPath('chromium.json'), JSON.stringify(manifest('chromium'), null, '\t'), 'utf8'),
		replaceFile(outPath('chrome.json'),   JSON.stringify(manifest('chrome'),   null, '\t'), 'utf8'),
		replaceFile(outPath('firefox.json'),  JSON.stringify(manifest('firefox'),  null, '\t'), 'utf8'),
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
		readFile(Path.join(__dirname, 'node_modules/ref/build/Release/binding.node')).then(data => replaceFile(outPath('res/ref.node'), data)),
		readFile(Path.join(__dirname, 'node_modules/ffi/build/Release/ffi_bindings.node')).then(data => replaceFile(outPath('res/ffi.node'), data)),
	]));

	os === 'linux' && (await Promise.all([
		/*chromium*/mkdir(outPath(`../.config/`)).catch(_=>0)
		.then(() => mkdir(outPath(`../.config/chromium`)).catch(_=>0))
		.then(() => mkdir(outPath(`../.config/chromium/NativeMessagingHosts`)).catch(_=>0))
		.then(() =>unlink(outPath(`../.config/chromium/NativeMessagingHosts/${ name }.json`)).catch(_=>0))
		.then(() => symlink(outPath(`chromium.json`), outPath(`../.config/chromium/NativeMessagingHosts/${ name }.json`))),
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
		.then(() => symlink(outPath('chromium.json'), outPath(`../Chromium/NativeMessagingHosts/${ name }.json`))),
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

	const vendors = { }, allowed = { };

	(await Promise.all((await readdir(outPath('vendors'))).map(async name => { try {
		if (name.startsWith('.')) { return; }
		vendors[name] = JSON.parse((await readFile(outPath('vendors/'+ name), 'utf-8'))) || { };
	} catch (error) {
		console.error(`failed to parse vendors/${name} as JSON`);
	} })));

	for (const { browser, source, target, match, } of [
		{ browser: 'chrome', source: 'chrome-ext-urls', target: 'allowed_origins', match: (/^chrome-extension:\/\/[a-p]{32}\/$/), },
		{ browser: 'firefox', source: 'firefox-ext-ids', target: 'allowed_extensions', match: (/^[\w.-]*@[\w.-]+$|^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/), },
	]) {
		// let json; try { json = JSON.parse((await readFile(outPath(browser +'.json')))); } catch (error) { json = manifest(browser); }
		// const before = new Set(Array.isArray(json[target]) ? json[target] : [ ])
		const ids = allowed[browser] = new Set;

		Object.entries(vendors).forEach(([ name, { [source]: add, }, ]) => {
			if (!Array.isArray(add)) { add && console.error(`${name} -> ${source} was ignored because it is not a JSON Array`); return; }
			add.forEach(id => {
				if (!match.test(id)) { console.error(`${name} -> ${source}: ignored "${id}", as it is not a valid string`); return; }
				ids.add(id);
			});
		});

		const write = browser => replaceFile(outPath(browser +'.json'),  JSON.stringify(
			Object.assign(manifest(browser), { [target]: Array.from(ids), }),
		null, '\t'), 'utf8');
		write(browser); !windows && browser === 'chrome' && write('chromium');
	}
	console.info(`Now allowing ${allowed.chrome.size} Chrome extensions and ${allowed.firefox.size} Firefox add-ons`);
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

function copyFile(target, source) { return new Promise((resolve, reject) => {
	const read = FS.createReadStream(source), write = FS.createWriteStream(target);
	read.on('error', failed); write.on('error', failed); write.on('finish', resolve);
	function failed(error) { read.destroy(); write.end(); reject(error); }
	read.pipe(write);
}); }
