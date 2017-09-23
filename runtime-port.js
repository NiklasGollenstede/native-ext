'use strict'; /* global Buffer, */

/**
 * Transforms the stdio streams of a node.js native messaging app into something resembling a browser.runtime.Port.
 * @param  {stream.Readable}  stdin
 * @param  {stream.Writable}  stdout
 * @return {object}                   Object of { postMessage, onMessage, onDisconnect, }.
 */
module.exports = function runtimePort(stdin, stdout) {
	const onMessage = new Set, onDisconnect = new Set;
	const empty = Buffer.alloc(0);

	let expect = null, buffer = empty;
	stdin.on('data', data => {
		// console.log('data', data.length);
		buffer = buffer === empty ? data : Buffer.concat([ buffer, data, ]);
		if (expect == null) {
			if (buffer.length < 4) { return; }
			expect = buffer.readInt32LE(0);
			buffer = buffer.length === 4 ? empty : buffer.slice(4);
			// console.log('expect', expect);
		}
		if (buffer.length >= expect) {
			const message = JSON.parse(buffer.toString('utf8', 0, expect));
			buffer = buffer.length === expect ? empty : Buffer.from(buffer.slice(expect));
			expect = null;
			// console.log('message', message);
			emit(onMessage, message);
		}
	});

	function emit(event, data) {
		event.forEach(func => { try { func(data); } catch (error) { console.error('Error in Port event', error); } });
	}

	function postMessage(message) {
		// console.log('reply', message);
		const string = JSON.stringify(message);
		const length = Buffer.byteLength(string, 'utf8');
		const buffer = Buffer.allocUnsafe(4 + length);
		buffer.writeInt32LE(length);
		buffer.write(string, 4, length, 'utf8');
		stdout.write(buffer);
	}

	return {
		postMessage,
		onMessage: {
			addListener: onMessage.add.bind(onMessage),
			removeListener: onMessage.delete.bind(onMessage),
		},
		onDisconnect: {
			addListener: onDisconnect.add.bind(onDisconnect),
			removeListener: onDisconnect.delete.bind(onDisconnect),
		},
	};
}
