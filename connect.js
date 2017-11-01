'use strict'; const ready = (async () => { (await null);

/**
 * This module is run once on startup and prepares the process to run the node.js modules provided by the connecting extension.
 */

// Not sure who messed this up, but the path to the manifest file passed by firefox is split into two args on macos. This is an ugly workaround
process.platform === 'darwin' && process.argv[3] === 'firefox' && process.argv[4] === '/Users/user/Library/Application' && process.argv.splice(4, 2, process.argv[4] +' '+ process.argv[5]);


const FS = Object.assign({ }, require('fs')), Path = require('path');
const _package = module.require(Path.join(__dirname, 'package.json'));
const Module = require('module');


// set up communication
const Port = require('./node_modules/multiport/index.js'), port = new Port(
	new (require('./runtime-port.js'))(process.stdin.on.bind(process.stdin, 'data'), process.stdout.write.bind(process.stdout)),
	Port.web_ext_Port,
);


{ // can't log to stdio if started by the browser ==> forward to browser console
	const { Writable, } = require('stream'); let stream;
	if (process.versions.electron) { // console is fine (doesn't write to stdio), but need to redirect explicit stdio writes to it
		stream = name => new Writable({ write(chunk, encoding, callback) {
			console.log(name, chunk, encoding); callback && Promise.resolve().then(callback); // eslint-disable-line
		}, });
	} else {
		stream = name => new Writable({ write(chunk, encoding, callback) {
			if ((/^utf-?8$/i).test(encoding)) { encoding = ''; }
			else if (encoding !== 'buffer') { chunk = global.Buffer.from(chunk, encoding); }
			if (typeof chunk !== 'string') { chunk = chunk.toString('base64'); }
			port.post(name, encoding, chunk);
			callback && Promise.resolve().then(callback);
		}, decodeStrings: false, });
	}
	const stdout = stream('stdout'), stderr = stream('stderr');

	// When the process is being `--inspect`ed, the functions of the global console are overwritten
	// and the arguments logged to the inspector before they are passed on tho the original global console.
	// Replacing the global console object would thus break the logging in the inspector.
	// The original console calls the public `.write()` methods on the original process.stdout/err streams,
	// so replacing those methods with the ones from the new streams prevents the console from actually writing to fd 1 or 2.
	// This should also help with all other (js) modules which already grabbed the original process.stdout/err.
	process.stdout.write = stdout.write.bind(stdout); Object.defineProperty(process, 'stdout', { value: stdout, });
	process.stderr.write = stderr.write.bind(stderr); Object.defineProperty(process, 'stderr', { value: stderr, });

	process.on('uncaughtException', async error => !(await port.request('error', error)) && process.exit(1));
	process.on('unhandledRejection', async error => !(await port.request('reject', error)) && process.exit(1));
}


let protocol; { // protocol negotiation
	const remote = (await new Promise(done => port.addHandler('init', opts => { done(opts); port.removeHandler('init'); return ready; })));
	const local = [ '0.2', ]; protocol = remote.versions.find(_=>local.includes(_));
	if (!protocol) { throw new Error(`Protocol version mismatch, extension supports ${remote.versions} and the installed version ${_package.version} of NativeExt supports ${local}`); }
}


const modules = { __proto__: null, }; let originalRequireResolve; { // extend require
	const { _resolveFilename, _load, } = Module;
	originalRequireResolve = _resolveFilename;
	Module._resolveFilename = function(path) {
		if (path in modules) { return path; }
		return _resolveFilename.apply(Module, arguments);
	};
	Module._load = function(path) {
		if (path in modules) { return modules[path]; }
		return _load.apply(Module, arguments);
	};
} function exposeLazy(name, getter) {
	Object.defineProperty(modules, name, { configurable: true, enumerable: true, get() {
		const value = getter();
		Object.defineProperty(modules, name, { value, });
		return value;
	}, });
}


{ // expose and lazy load 'ffi' and 'ref'
	const cwd = process.cwd(), bindingsPath = require.resolve('bindings'); let bindingsModule;

	exposeLazy('ffi', makeLazyLoader('ffi', () => void modules.ref));
	exposeLazy('ref', makeLazyLoader('ref'));
	exposeLazy('ref-array', () => requireClean('ref-array'));
	exposeLazy('ref-struct', () => requireClean('ref-struct'));

	function makeLazyLoader(name, precond) { return () => {
		precond && precond();
		if (!bindingsModule) { module.require(bindingsPath); bindingsModule = require.cache[bindingsPath]; }
		const bindingsExports = bindingsModule.exports;
		const nodePath = Path.join(cwd, `res/${name}.node`);
		Module._cache = Object.create(Module._cache);
		let exports; try {
			bindingsModule.exports = () => module.require(nodePath);
			exports = requireClean(name);
		} finally {
			Module._cache = Object.getPrototypeOf(Module._cache);
			bindingsModule.exports = bindingsExports;
		} return exports;
	}; }

	function requireClean(id) { // use local require and original cwd, restore and cleanup afterwards
		const currentCwd = process.cwd();
		Module._cache = Object.create(Module._cache);
		let exports; try {
			process.chdir(cwd);
			exports = module.require(originalRequireResolve(id, module));
		} finally {
			Module._cache = Object.getPrototypeOf(Module._cache);
			process.chdir(currentCwd);
		} return exports;
	}
}


// load and expose 'browser' infos
const browser = modules.browser = (await require('./browser.js')({ versions: protocol, port, }));


// set up file system
const extRoot = Path.resolve('/webext/'); let extDir; {
	({ extDir, } = browser); if (!extDir) { if (browser.extFile) {
		const tmp = require('tmp'); tmp.setGracefulCleanup(); // dirs are not being deleted
		extDir = tmp.dirSync({ prefix: 'webext-', }).name;
		(await new Promise((resolve, reject) => require('extract-zip')(browser.extFile, { dir: extDir, unsafeCleanup: true, }, err => err ? reject(err) : resolve())));
	} else {
		throw new Error(`Can't find extension on disk`);
	} }
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
		) { return FS[key](extDir + path.slice(extRoot.length), ...args); } // TODO: translate errors?
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
		const { _findPath, } = Module;
		Module._findPath = function(path) {
			path = _findPath.apply(Module, arguments);
			if (path && path.startsWith(extDir) && (path.length === extDir.length || path[extDir.length] === '\\' || path[extDir.length] === '/'))
			{ path = extRoot + path.slice(extDir.length); }
			return path;
		};
	}
}


{ // general process fixes
	process.versions.native_ext = _package.version;
	process.argv.splice(0, Infinity);
	process.mainModule.filename = extRoot + Path.sep +'.';
	process.mainModule.paths = module.constructor._nodeModulePaths(process.mainModule.filename);
	process.mainModule.exports = null;
	process.mainModule.children.splice(0, Infinity);
	process.chdir(extDir);
}


// add permanent handlers
port.addHandlers({
	async require(path, options, callback) {
		if (!(/\bn(?:ative|ode)\.js$|(?:^|[\\\/])n(?:ative|ode)[\\\/]/).test(path)) {
			throw new Error(`path must contain /node/ or /native/ or end with \\bnode.js or \\bnative.js`);
		}
		const exports = (await process.mainModule.require(Path.join('/webext/', path)));
		(await typeof exports !== 'object' ? callback(exports) : callback(...[].concat(...Object.entries(exports))));
	},
});


{ // cleanup
	const { cache, } = require; // there are still references to the loaded modules ...
	Object.keys(cache).forEach(key => delete cache[key]);
	global.gc && global.gc();
}
console.info('native-ext running in', process.cwd());

})();
