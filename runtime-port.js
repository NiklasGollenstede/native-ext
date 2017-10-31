'use strict'; /* global Buffer, */

/**
 * Transforms the .on('data') and .write() methods of the stdio streams of a node.js native messaging app
 * into something resembling a browser.runtime.Port (which never fires onDisconnect).
 * Buffers incoming messages without limit and does not check the outgoing message sizes.
 * Sending messages that are to large will cause the browser to disconnect.
 * @param  {function}  onData  stdin.on.bind(stdin, 'data')
 * @param  {function}  write   stdout.write.bind(stdout)
 * @return {object}            Object of { postMessage, onMessage, onDisconnect, }.
 */
module.exports = function runtimePort(onData, write) {
	const onMessage = new Set, empty = Buffer.alloc(0);

	let expect = null, buffer = empty; onData(function onData(data) {
		data !== empty && (buffer = buffer === empty ? data : Buffer.concat([ buffer, data, ]));
		if (expect == null) {
			if (buffer.length < 4) { return; }
			expect = buffer.readInt32LE(0); // might want to exit if expect <= 0
			buffer = buffer.length === 4 ? empty : buffer.slice(4);
		}
		if (buffer.length < expect) { return; }
		const message = JSON.parse(buffer.toString('utf8', 0, expect));
		buffer = buffer.length === expect ? empty : Buffer.from(buffer.slice(expect));
		expect = null;
		onMessage.forEach(func => { try { func(message); } catch (error) { console.error('Error in Port event', error); } });
		onData(empty); // may have another message in buffer
	});

	function postMessage(message) {
		// console.log('reply', message);
		const string = JSON.stringify(message);
		const length = Buffer.byteLength(string, 'utf8');
		const buffer = Buffer.allocUnsafe(4 + length);
		buffer.writeInt32LE(length);
		buffer.write(string, 4, length, 'utf8');
		write(buffer);
	}

	return {
		postMessage,
		onMessage: {
			addListener: onMessage.add.bind(onMessage),
			removeListener: onMessage.delete.bind(onMessage),
		},
		onDisconnect: { addListener() { }, removeListener() { }, },
	};
};
