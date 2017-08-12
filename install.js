'use strict';

const FS = require('fs-extra');
const Path = require('path');
const child_process = require('child_process');
const execute = (bin, ...args) => new Promise((resolve, reject) => child_process.execFile(bin, args, (error, stdout, stderr) =>
	error ? reject(Object.assign(error, { stderr, stdout, })) : resolve(stdout)
));

const name = 'de.niklasg.native_ext'; // 'native_ext_v0.0.1';
const node = process.argv[1] === 'nexe.js' ? '' : 'node'; // 'node-dwe --pipe=ioe --';
const os = process.platform;
const windows = os === 'win32';
const scriptExt = windows ? '.bat' : '.sh';
const installDir = windows ? process.env.APPDATA +'\\'+ name : '~/.'+ name;
const outPath = path => Path.resolve(installDir, path);

async function install({ source, }) {
	try { source = require.resolve(source); } catch (_) { } node && (source = Path.resolve(source, '..'));
	const binTarget = outPath('bin') + (windows && !node ? '.exe' : '');
	const exec = (...args) => '@echo off\n\n'+ (node ? node +' '+ binTarget : binTarget) +' '+ args.map(JSON.stringify).join(' ');

	const manifest = {
		name, description: 'WebExtensions native connector',
		path: 'connect'+ scriptExt,
		type: 'stdio', // mandatory
	};

	(await Promise.all([
		node ? FS.remove(binTarget).then(() => FS.ensureSymlink(source, binTarget, 'junction')) : FS.copy(source, binTarget),
		FS.outputFile(outPath('chrome.json'),  JSON.stringify(manifest, null, '\t'), 'utf8'),
		FS.outputFile(outPath('firefox.json'), JSON.stringify(manifest, null, '\t'), 'utf8'),
		FS.mkdirs(outPath('vendors')),
		...(windows ? [
			FS.outputFile(outPath('connect.bat'), exec('connect', '%*'), 'utf8'),
			execute('REG', 'ADD', 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\'+ name, '/ve', '/t', 'REG_SZ', '/d', outPath('chrome.json'),  '/f'),
			execute('REG', 'ADD', 'HKCU\\Software\\Mozilla\\NativeMessagingHosts\\'+        name, '/ve', '/t', 'REG_SZ', '/d', outPath('firefox.json'), '/f'),
			FS.outputFile(outPath('uninstall.bat'), exec('uninstall', '%*'), 'utf8'),
			FS.outputFile(outPath('refresh.bat'), exec('refresh', '%*'), 'utf8'),
		] : [ ]),
		// TODO: link on Linux / MAC
	]));

	(await refresh(arguments[0]));
}

async function refresh() {
	const urls = [ ], ids = [ ];
	(await (await FS.readdir(outPath('vendors'))).map(name =>
		FS.readJson(outPath('vendors/'+ name))
		.then(config => {
			config['chrome-ext-urls'] && urls.push(...config['chrome-ext-urls']);
			config['firefox-ext-ids'] && ids.push(...config['firefox-ext-ids']);
		}).catch(error => console.error(error))
	));

	(await Promise.all([
		FS.outputFile(outPath('chrome.json'),  JSON.stringify(
			Object.assign((await FS.readJson(outPath('chrome.json'))), { allowed_origins: urls, }),
		null, '\t'), 'utf8'),
		FS.outputFile(outPath('firefox.json'),  JSON.stringify(
			Object.assign((await FS.readJson(outPath('firefox.json'))), { allowed_extensions: ids, }),
		null, '\t'), 'utf8'),
	]));
}

async function uninstall() {
	try {
		(await FS.remove(outPath('')));
	} catch (error) {
		throw error.code === 'EBUSY' ? new Error(`A file in the installation folder "${ outPath('') }" seems to be open. Please close all browsers and try again.`) : error;
	}
	(await Promise.all([
		...(windows ? [
			execute('REG', 'ADD', 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\'+ name, '/f').catch(_=>_),
			execute('REG', 'ADD', 'HKCU\\Software\\Mozilla\\NativeMessagingHosts\\'+        name, '/f').catch(_=>_),
		] : [ ]),
		// TODO: unlink on Linux / MAC
	]));
}

module.exports = { install, refresh, uninstall, };
