'use strict';

const FS = require('fs-extra');
const Path = require('path');

const output = process.stdout, input = process.stdin;

{ // can't log to stdio if started by the browser ==> log to './log.txt'.
	const logPath = Path.resolve(__dirname, __dirname.endsWith('bin') ? '..' : '.', 'log.txt');
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
	// TODO: redirect uncaught errors
}

const Port = require('multiport');
const port = new Port({ in: input, out: output, }, require('./port.js'));

port.addHandler(function echo(arg) { return arg; });

port.addHandler(async function init({ script, sourceURL, }) {
	port.removeHandler('init');
	return void (await new Function(
		'require',
		`return (${ script }).call(this, arguments[arguments.length - 1]);
		//# sourceURL=${ sourceURL || 'native.js' }`
	).call(global, requireNative, port));
});

console.log('running');

const nativeModules = [ 'fs', 'path', ]; // TODO: list all native modules
function requireNative(id) {
	if (!nativeModules.includes(id)) { throw new TypeError(`No such native module "${ id }"`); }
	return require(id);
}
