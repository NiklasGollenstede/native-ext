/* eslint-env node */ /* eslint-disable strict, no-console */ 'use strict'; /* global require, module, */ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

async function install(name, data) {
	const Path = require('path'), OS = require('os'), { promisify, } = require('util');
	const FS = require('fs'), writeFile = promisify(FS.writeFile), chmod = promisify(FS.chmod), unlink = promisify(FS.unlink);
	const CP = require('child_process'), exec = promisify(CP.execFile);

	name = name.replace(/(?:\.exe|\.bin)?$/, exe => '-'+ Math.random().toString(32).slice(2) + exe);
	const path =  Path.resolve(OS.tmpdir(), name);
	(await writeFile(path, data, 'base64')); // can handle url-base64 as well
	(await chmod(path, '754'));
	try { console.log('installed', (await exec(path, [ 'install', '--no-dialog', ], { }))); }
	catch (error) { console.error(error.stderr); throw error; }
	finally { try { (await unlink(path)); } catch (_) { } }
}

module.exports = { // dummy
	unpacked: !process.versions.pkg,
	version: process.versions['native-ext'],
	install,
};
