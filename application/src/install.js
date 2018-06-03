'use strict';

const Path = require('path'), FS = require('fs'), { promisify, } = require('util');
const { chmod, unlink, symlink, readFile, writeFile, } = Object.entries(FS)
.filter(_=> typeof _[1] === 'function' && !_[0].endsWith('Sync'))
.reduce((o, _) => ((o[_[0]] = promisify(_[1])), o), { });
const mkdirp = promisify(require('mkdirp')); // rimraf = promisify(require('rimraf'));
const prepareWrite = (path) => unlink(path).catch(_=>0).then(() => mkdirp(Path.dirname(path))).catch(_=>0);
const replaceFile = (path, data, opt) => prepareWrite(path).then(() => writeFile(path, data, opt));
const replaceLink = (target, path, opt) => prepareWrite(path).then(() => symlink(target, path, opt));

const child_process = require('child_process'), crypto = require('crypto');
const execute = (bin, ...args) => new Promise((resolve, reject) => child_process.execFile(bin, args,
	(error, stdout, stderr) => error ? reject(Object.assign(error, { stderr, stdout, })) : resolve(stdout)
));

const unpacked = !process.versions.pkg;
const packageJson = require('../package.json'), { version, } = packageJson;
const fullName = packageJson.fullName.replace(/^\W|[^\w.]|\W$/g, '_'); // must match /^\w[\w.]*\w$/
const source = unpacked ? __dirname : process.argv[0]; // location of packed executable or project root
// try { source = require.resolve(source); } catch (_) { } node && (source = Path.resolve(source, '..')); // TODO: ??

const nodeOptions = process.argv.find(_=>_.startsWith('--node-options='));
const windows = process.platform === 'win32', linux = process.platform === 'linux', macos = process.platform === 'darwin';
const scriptExt = windows ? '.bat' : '.sh';
const installDir = (windows ? process.env.APPDATA +'\\' : require('os').homedir() + (macos ? '/Library/Application Support/' : '/.')) + fullName;

const outPath = (...path) => Path.resolve(installDir, ...path);
const bin = outPath(`bin/${version}/${fullName}`) + (windows && !unpacked ? '.exe' : '');
const exec = (...args) => (windows ? '@echo off\r\n\r\n' : '#!/bin/bash\n\n')
+ args.map(s => (/^(?:%[*\d]|\$[@\d]|[\w-]+)$/).test(s) ? s : JSON.stringify(s)).join(' ');

async function install() {

	try { (await unlink(bin)); } catch (error) { if (error.code !== 'ENOENT') {
		throw error.code === 'EBUSY' ? new Error(`A file in the installation folder "${ outPath('') }" seems to be open. Please close all browsers and try again.`) : error;
	} }

	(await Promise.all([

		...(unpacked ? [
			replaceFile(outPath('bin', 'latest'+ scriptExt), exec(
				process.argv[0], process.argv[1],
				...(nodeOptions ? nodeOptions.slice(15).split(',') : [ ]),
				windows ? '%*' : '$@',
			), { mode: '754', }),
		] : [
			copyFile(bin, source).then(() => chmod(bin, '754')),
			readFile(Path.join(__dirname, '../node_modules/ref/build/Release/binding.node'))     .then(data => replaceFile(outPath(bin +'/../ref.node'), data)), // copyFile doesn't work
			readFile(Path.join(__dirname, '../node_modules/ffi/build/Release/ffi_bindings.node')).then(data => replaceFile(outPath(bin +'/../ffi.node'), data)), // copyFile doesn't work
			replaceFile(outPath('bin', 'latest'+ scriptExt), exec(bin, windows ? '%*' : '$@'), { mode: '754', }),
		]),

		!windows && writeProfile({ bin, browser: 'chromium', dir: '', ids: [ /* TBD */ 'bgfocfgnalfpdjgikdpjimjokbkmemgp', ], }),
		writeProfile({ bin, browser: 'chrome', dir: '', ids: [ /* TBD */ 'bgfocfgnalfpdjgikdpjimjokbkmemgp', ], }),
		writeProfile({ bin, browser: 'firefox', dir: '', ids: [ '@'+ packageJson.name, ], }),

		// no uninstallation yet
	]));

}

async function writeProfile({ browser, dir, ids = [ ], locations, }) {

	const profile = !dir ? browser : crypto.createHash('sha1').update(dir).digest('hex').slice(-16).padStart(16, '0');
	const name = fullName +'.'+ profile;
	const target = outPath('profiles', profile) + Path.sep;

	!Array.isArray(ids) && (ids = [ ]);
	const manifest = {
		name, description: `WebExtensions native connector (${browser}:${dir})`,
		path: target + packageJson.name + scriptExt,
		type: 'stdio', // mandatory
		allowed_extensions: browser === 'firefox' ? ids : undefined,
		allowed_origins: browser !== 'firefox' ? ids.map(id => `chrome-extension://${id}/`) : undefined,
	};
	const config = {
		browser, profile: dir, locations: typeof locations === 'object' && locations || { },
	};

	(await Promise.all([

		replaceFile(target +'manifest.json', JSON.stringify(manifest,  null, '\t'), 'utf8'),
		replaceFile(target +'config.json', JSON.stringify(config,  null, '\t'), 'utf8'),
		replaceFile(target + packageJson.name + scriptExt, exec(
			outPath('bin', 'latest'+ scriptExt),
			!dir ? 'config' : 'connect',
			target +'config.json',
			windows ? '%*' : '$@',
		), { mode: '754', }),

		windows ? execute('REG', 'ADD', (browser === 'firefox'
			? 'HKCU\\Software\\Mozilla\\NativeMessagingHosts\\' : 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\'
		) + name, '/ve', '/t', 'REG_SZ', '/d', target +'manifest.json', '/f')
		: replaceLink(target +'manifest.json', outPath((linux ? {
			chromium: '../.config/chromium/NativeMessagingHosts',
			chrome: '../.config/google-chrome/NativeMessagingHosts',
			firefox: '../.mozilla/native-messaging-hosts',
		} : {
			chromium: '../Chromium/NativeMessagingHosts',
			chrome: '../Google/Chrome/NativeMessagingHosts',
			firefox: '../Mozilla/NativeMessagingHosts',
		})[browser], name +'.json')),

	]));

	return manifest;
}

module.exports = { install, writeProfile, };

async function copyFile(target, source) { {
	if (source === target) { return; }
	(await mkdirp(Path.dirname(target)).catch(_=>0));
} (await new Promise((resolve, reject) => {
	const read = FS.createReadStream(source), write = FS.createWriteStream(target);
	read.on('error', failed); write.on('error', failed); write.on('finish', resolve);
	function failed(error) { read.destroy(); write.end(); reject(error); }
	read.pipe(write);
})); }
