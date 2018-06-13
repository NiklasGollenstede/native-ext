'use strict'; let channel; module.exports = (async () => { (await null)/*why?*/;

/**
 * This module is run once on startup and prepares the process to run the node.js modules provided by the connecting extension.
 */


// set up communication
channel = new (require('./runtime-port.js'))({
	name: '',
	onData: process.stdin.on.bind(process.stdin, 'data'),
	write: process.stdout.write.bind(process.stdout),
}); process.stdin.pause(); // wait for now
require('./redirect-stdout.js')({ channel, }); // can't log to stdio if started by the browser ==> forward to browser console


const FS = Object.assign({ }, require('fs')), Path = require('path');
const Module = require('module');
const packageJson = JSON.parse(FS.readFileSync(Path.join(__dirname, 'package.json')));
const config = JSON.parse(FS.readFileSync(process.argv[3]));


const { modules, requireClean, exposeLazy, } = (() => { // patch `require()` to expose modules
	const modules = { __proto__: null, };
	const { _resolveFilename, _load, } = Module;
	const cwd = process.cwd();
	const isNexe = typeof FuseBox !== 'undefined'; /* global FuseBox */
	isNexe && (FuseBox.require = id => modules[id] || require(id));

	Module._resolveFilename = function(path) {
		if (path in modules) { return path; }
		return _resolveFilename.apply(Module, arguments);
	};
	Module._load = function(path) {
		if (path in modules) { return modules[path]; }
		return _load.apply(Module, arguments);
	};

	function requireClean(id) { // use local require and original cwd, restore and cleanup afterwards
		const currentCwd = process.cwd();
		Module._cache = Object.create(Module._cache);
		let exports; try {
			process.chdir(cwd);
			exports = module.require(_resolveFilename(id, module));
		} finally {
			Module._cache = Object.getPrototypeOf(Module._cache);
			process.chdir(currentCwd);
		} return exports;
	}

	function exposeLazy(name, getter) {
		Object.defineProperty(modules, name, { configurable: true, enumerable: true, get() {
			const value = getter();
			Object.defineProperty(modules, name, { value, });
			return value;
		}, });
	}

	return { modules, requireClean: isNexe ? require : requireClean, exposeLazy, };
})();


{ // expose and lazy load 'ffi' and 'ref'
	const unpacked = !process.versions.pkg && !process.__nexe;

	exposeLazy('ffi', unpacked ? () => requireClean('ffi') : makeLazyLoader('ffi', () => void modules.ref));
	exposeLazy('ref', unpacked ? () => requireClean('ref') : makeLazyLoader('ref'));
	exposeLazy('ref-array', () => requireClean('ref-array'));
	exposeLazy('ref-union', () => requireClean('ref-union'));
	exposeLazy('ref-struct', () => requireClean('ref-struct'));

	function makeLazyLoader(name, precond) { return () => {
		precond && precond();
		const nodePath = Path.join(process.argv[0], `../res/${name}.node`);
		let exports; try { // TODO: this doesn't work with nexe because the `require` in the shipped modules is that of fuse-box,
			// so nexe still creates the temp dirs in the cwd for the `.node` files
			modules.bindings = () => { /*console.log('loading', nodePath);*/ return requireClean(nodePath); };
			exports = requireClean(name);
		} finally {
			delete modules.bindings;
		} return exports;
	}; }
}


if (process.argv[2] === 'config') { // configuration mode
	const Port = require('multiport'), port = new Port(channel, Port.web_ext_Port);
	// only the management extension is allowed to connect like this
	port.addHandlers({
		ping() { return 'pong'; },
		locateProfile: require('./locate-profile.js')({ config, }),
		async writeProfile({ dir, ids, locations, }) {
			FS.accessSync(dir); const { browser, } = config;
			const manifest = (await require('./install.js').writeProfile({ browser, dir, ids, locations, }));
			return { name: manifest.name, version: packageJson.version, };
		},
	});
	process.stdin.resume(); return;
}


// load and expose 'browser' infos
const browser = modules.browser = (await require('./browser.js')({ config, }));
channel.name = browser.extId;


// set up file system
const extRoot = Path.resolve('/webext/'); let extDir; { // TODO: use ./patch-fs.js
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
	process.versions['native-ext'] = packageJson.version;
	const main = process.mainModule; // TODO: create a new Module(...) ?
	main.filename = extRoot + Path.sep +'.'; main.id = '.';
	main.paths = main.constructor._nodeModulePaths(main.filename);
	main.exports = null; main.children.splice(0, Infinity);
	process.argv.splice(0, Infinity); process.chdir(extDir);
}


{ // cleanup
	const { cache, } = require; // there are still references to the loaded modules ...
	cache && Object.keys(cache).forEach(key => delete cache[key]);
	global.gc && global.gc();
}


{ // init
	const config = (await new Promise(done => {
		channel.onMessage.addListener(function onMessage(config) {
			done(config); channel.onMessage.removeListener(onMessage);
		}); process.stdin.resume();
	}));
	if (!config.allowEval) {
		// this is incomplete (e.g. the 'vm' module is still available), but it should prevent accidental data evaluation
		const _Function = function noEval() { throw new Error(`new Function and eval are not allowed`); }.bind();
		Object.defineProperty(_Function, 'name', { value: 'Function', }); Object.defineProperty(_Function, 'length', { value: 1, });
		const _eval = { noEval() { throw new Error(`new Function and eval are not allowed`); }, }.noEval.bind();
		Object.defineProperty(_eval, 'name', { value: 'eval', }); Object.defineProperty(_eval, 'length', { value: 1, });
		(_Function.prototype = _Function.constructor.prototype).constructor = _Function; global.eval = _eval;
	}
	const entry = './'+ Path.posix.normalize(config.main);
	// TODO: process.argv.splice(0, Infinity, process.argv0, entry);
	(await process.mainModule.require(entry)(channel, config));
}

})().catch(error => {
	console.error(error); setTimeout(() => process.exit(-1));
	channel && channel.postMessage([ 'error', 0, JSON.stringify([ error.message, ]), ]);
});
