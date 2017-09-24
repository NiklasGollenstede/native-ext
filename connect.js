'use strict';

const FS = global.FS = Object.assign({ }, require('fs')), Path = require('path');

// set up communication
const Port = require('multiport'), port = new Port(
	new (require('./runtime-port.js'))(process.stdin, process.stdout),
	Port.web_ext_Port,
);

{ // can't log to stdio if started by the browser ==> log to './log.txt'.
	if (process.versions.electron) { // started in debug mode, console is fine, but need to redirect stdio to it
		const { Writable, } = require('stream'), stream = name => new Writable({ write(chunk, encoding, callback) {
			console.log(name, chunk); callback && Promise.resolve().then(callback); // eslint-disable-line
		}, });
		const stdout = stream('stdout'), stderr = stream('stderr');
		Object.defineProperty(process, 'stdout', { get() { return stdout; }, });
		Object.defineProperty(process, 'stderr', { get() { return stderr; }, });
	} else {
		const cwd = process.cwd();
		const logPath = Path.resolve(cwd, cwd.endsWith('bin') ? '..' : '.', 'log.txt');
		const stdout = FS.createWriteStream(logPath, /*{ flags: 'r+', }*/);
		const stderr = FS.createWriteStream(logPath, /*{ flags: 'r+', }*/);
		Object.defineProperty(process, 'stdout', { get() { return stdout; }, });
		Object.defineProperty(process, 'stderr', { get() { return stderr; }, });
		const timezone = new Date().getTimezoneOffset() * -60e3;
		const timespamp = level => `[${ new Date(Date.now() + timezone).toISOString().replace('T', ' ').slice(0, -1) }] [${ level }]`;
		const console = new class extends require('console').Console {
			constructor() { super(...arguments); }
			log    (...args) { return super.log    (timespamp('log'),    ...args); }
			info   (...args) { return super.info   (timespamp('info'),   ...args); }
			warn   (...args) { return super.warn   (timespamp('warn'),   ...args); }
			error  (...args) { return super.error  (timespamp('error'),  ...args); }
			dir    (...args) { return super.dir    (timespamp('dir'),    ...args); }
			trace  (...args) { return super.trace  (timespamp('trace'),  ...args); }
			assert (...args) { return super.assert (timespamp('assert'), ...args); }
		}(stdout, stderr);
		Object.defineProperty(global, 'console', { get() { return console; }, });
		// TODO: could also log to 'setup' or a different 'channel'
		// or (for firefox) just pipe everything to stderr, with is logged in the browser or extension console
	}
	// TODO: redirect uncaught errors
}



// get extId and profDir
const browser = process.argv[3]; let extId, extPath; {
	const extPaths = JSON.parse(FS.readFileSync('./ext-paths.json', 'utf-8'));

	switch (browser) {
		case 'chromium': case 'chrome': {
			extId = (/^chrome-extension:\/\/(.*)\/?$/).exec(process.argv[4])[1];
			if (extPaths[extId]) { extPath = Path.resolve(extPaths[extId]); break; }
			const { args, cwd, } = getBrowserArgs();
			console.info({ args, cwd, });
			throw new Error(`Not implemented`);
			// defaults:
			// %LOCALAPPDATA%\Google\Chrome\User Data\Default
			// ~/.config/google-chrome/Default/Extensions/
			// ~/.config/chromium/Default/Extensions
			// ~/Library/Application\ Support/Google/Chrome/Default/Extensions
		}
		case 'firefox': {
			extId = process.argv[5];
			if (extPaths[extId]) { extPath = Path.resolve(extPaths[extId]); break; }

			if (process.env.MOZ_CRASHREPORTER_EVENTS_DIRECTORY) {
				extPath = Path.resolve(process.env.MOZ_CRASHREPORTER_EVENTS_DIRECTORY, '../../extensions', extId);
			} else {
				throw new Error(`MOZ_CRASHREPORTER_EVENTS_DIRECTORY environment variable not set by Firefox`);
				// const args = getBrowserArgs();
				// -P / -p "profile_name"
				// -profile "profile_path" (precedence?)
				// otherwise: FS.readFileSync('%AppData%\Mozilla\Firefox\profiles.ini').trim().split(/(?:\r\n?\n){2}/g).find(_=>_.includes('Default=1')).match(/Path=(.*))[1]
			}
		} break;
		default: throw new Error(`Unknown browser ${ process.argv[2] }`);
	}

	function getBrowserArgs() {
		const exec = require('child_process').execFileSync;
		switch (process.platform) {
			case 'win32': {
				const ppid =  exec('wmic', `process where processId=${ process.pid } get parentprocessid`.split(' '), { encoding: 'utf-8', }).match(/\d+/)[0];
				const pppid = exec('wmic', `process where processId=${ ppid } get parentprocessid`.split(' '), { encoding: 'utf-8', }).match(/\d+/)[0];
				return { cwd: null, args: exec('wmic', `process where processId=${ pppid } get CommandLine`.split(' '), { encoding: 'utf-8', }).slice('CommandLine'.length + 2).trim(), };
			}
			default: throw new Error(`Unknown OS ${ process.platform }`);
		}
	}
}


{ // set up file system
	const extRoot = Path.resolve('/webext/');
	let stat; try { stat = FS.statSync(extPath); } catch (error) { throw new Error(`Can't access extension at ${ extPath }`); }
	let exec, extDir; if (stat.isDirectory()) {
		extDir = extPath;
		exec = (key, path, args) => FS[key](extDir + path, ...args); // TODO: translate errors
	} else {
		throw new Error(`Not implemented`);
	}
	const target = require('fs'), { URL, } = require('url'), { Buffer, } = global;
	let url2path; {
		const dummy = { __proto__: FS.ReadStream.prototype, path: null, _events: 42, }, options = { start: '', encoding: 'utf-8', };
		url2path = url => {
			try { dummy.path = null; FS.ReadStream.call(dummy, url, options); }
			catch (error) { if (error.message !== '"start" option must be a Number') { throw error; } }
			return dummy.path || url;
		};
	}
	[
		'accessSync', 'access', 'appendFileSync', 'appendFile', 'chmodSync', 'chmod', 'chownSync', 'chown',
		'createReadStream', 'createWriteStream', 'existsSync', 'exists', 'lchmodSync', 'lchmod', 'lchownSync', 'lchown',
		'linkSync', 'link', 'lstatSync', 'lstat', 'mkdirSync', 'mkdir', 'mkdtempSync', 'mkdtemp', 'openSync', 'open',
		'readdirSync', 'readdir', 'readFileSync', 'readFile', 'readlinkSync', 'readlink', 'realpathSync', 'realpath',
		'renameSync', 'rename', 'rmdirSync', 'rmdir', 'statSync', 'stat', 'symlinkSync', 'symlink', 'truncateSync', 'truncate',
		'unlinkSync', 'unlink', 'unwatchFile', 'utimesSync', 'utimes', 'watch', 'watchFile', 'writeFileSync', 'writeFile',
	].forEach(key => FS[key] && (target[key] = function(path, ...args) {
		if (Buffer.isBuffer(path)) { path = path.toString('utf-8'); }
		if (path instanceof URL && path.protocol === 'file:') { path = url2path(path); }
		if (
			typeof path === 'string' && (path = Path.resolve(path))
			&& path.startsWith(extRoot) && (path.length === extRoot.length || path[extRoot.length] === '\\' || path[extRoot.length] === '/')
		) { return exec(key, path.slice(extRoot.length), args); }
		return FS[key](arguments[0], ...args);
	}));

	[ 'win32', 'posix', ].forEach(os => {
		const orig = Path[os]._makeLong;
		Path[os]._makeLong = path => {
			if (typeof path !== 'string') { return orig(path); }
			path = Path[os].resolve(path);
			if (path.startsWith(extRoot) && (path.length === extRoot.length || path[extRoot.length] === '\\' || path[extRoot.length] === '/'))
			{ path = extDir + path.slice(extRoot.length); }
			return orig(path);
		};
	});
	{
		const Module = require('module'), { _findPath, } = Module;
		Module._findPath = function(path) {
			path = _findPath(path);
			if (path.startsWith(extDir) && (path.length === extDir.length || path[extDir.length] === '\\' || path[extDir.length] === '/'))
			{ path = extRoot + path.slice(extDir.length); }
			return path;
		};
	}
	process.mainModule.filename = extRoot + Path.sep +'.';
	process.mainModule.paths = module.constructor._nodeModulePaths(extRoot + Path.sep +'.');
	process.chdir(extDir);
}

port.addHandler(function ping() { return 'pong'; });

port.addHandler('require', async (path, options, callback) => {
	if (!(/\bn(?:ative|ode)\.js$|(?:^|[\\\/])n(?:ative|ode)[\\\/]/).test(path)) {
		throw new Error(`path must contain /node/ or /native/ or end with \bnode.js or \bnative.js`);
	}
	const exports = (await process.mainModule.require(Path.join('/webext/', path)));
	(await typeof exports !== 'object' ? callback(exports) : callback(...[].concat(...Object.entries(exports))));
});

console.info('running');
