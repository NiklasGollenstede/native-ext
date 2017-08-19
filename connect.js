'use strict';

const FS = require('fs-extra');
const Path = require('path');

const { stdin, stdout, } = process;
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
		const console = new (require('console').Console)(stdout, stderr);
		require('console-stamp')(console, {
			pattern: 'yyyy-mm-dd HH:MM:ss.l',
			label: true, stdout, stderr,
		});
		Object.defineProperty(global, 'console', { get() { return console; }, });
		// TODO: could also log to 'setup' or a different 'channel'
	}
	// TODO: redirect uncaught errors
}


const Port = require('multiport'), { runtimePort, Multiplex, } = require('./port.js');
const channel = new runtimePort(stdin, stdout);
const setup = new Port({ port: channel, channel: '-', }, Multiplex);
// global.setup = setup; global.stdout = stdout; global.stdin = stdin;
let lastId = 0;

setup.addHandler(function echo(arg) { return arg; });

setup.addHandler(async function init({ script, sourceURL, }) {
	const id = ++lastId +'';
	const port = new Port({ port: channel, channel: id, }, Multiplex);

	(await global.eval( // using a Function with named args inserts two additional lines
		`require => (${ script })\n//# sourceURL=${ sourceURL || 'native.js' }`
	)(requireNative)(port));

	return id;
});

console.info('running');

const nativeModules = new Set([
	'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'crypto', 'dgram', 'dns',
	'events', 'fs', 'http', 'http2', 'https', 'net', 'os', 'path', 'querystring', 'readline', 'repl',
	'stream', 'string_decoder', 'tls', 'tty', 'url', 'utils', 'v8', 'vm', 'zlib',
]);
function requireNative(id) {
	if (!nativeModules.has(id)) { throw new TypeError(`No such native module "${ id }"`); }
	return require(id);
}
