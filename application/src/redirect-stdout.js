'use strict'; /* globals setImmediate, */

const { Writable, } = require('stream');

/**
 * Redirects writes to stdout and stderr to the port, so they can be logged by the native-ext lib
 * in the extensions console in the browser.
 * @param  {Port}  port  multiport/Port connected to the extension.
 */
module.exports = function({ channel, }) {
	const stream = name => new Writable({ write(chunk, encoding, callback) {
		if ((/^utf-?8$/i).test(encoding) && typeof chunk === 'string') { encoding = ''; }
		else if (encoding !== 'buffer') { chunk = global.Buffer.from(chunk, encoding); }
		if (typeof chunk !== 'string') { chunk = chunk.toString('base64'); }
		channel.postMessage([ name, 0, JSON.stringify([ encoding, chunk, ]), ]);
		callback && setImmediate(callback);
	}, decodeStrings: false, });
	const stdout = stream('stdout'), stderr = stream('stderr');

	// When the process is being `--inspect`ed, the functions of the global console are overwritten
	// and the arguments logged to the inspector before they are passed on tho the original global console.
	// Replacing the global console object would thus break the logging in the inspector.
	// The original console calls the public `.write()` methods on the original process.stdout/err streams,
	// so replacing those methods with the ones from the new streams prevents the console from actually writing to fd 1 or 2.
	// This should also help with all other (js) modules which already grabbed the original process.stdout/err.
	process.stdout.write = stdout.write.bind(stdout); Object.defineProperty(process, 'stdout', { value: stdout, });
	process.stderr.write = stderr.write.bind(stderr); Object.defineProperty(process, 'stderr', { value: stderr, });
};
