'use strict'; /* global Buffer, */

/**
 * Transforms the `.on('data')` and `.write()` methods of the stdio streams of a node.js
 * native messaging app into a `browser.runtime.Port`.
 * Buffers incoming messages without limit and does not check the outgoing message sizes.
 * Sending messages that are to large will cause the browser to disconnect.
 * @param  {string}       .name       Value for `Port.name`.
 * @param  {function}     .onData     `stdin.on.bind(stdin, 'data')`.
 * @param  {function}     .write      `stdout.write.bind(stdout)`.
 * @return {runtime.Port}             Object of:
 * @property {string}     name            ID of the connecting extension.
 * @property {function}   postMessage     Sends a JSON value to the `.onMessage` on the other end.
 * @property {function}   disconnect      Kills the process.
 * @property {Event}      onMessage       `browser.events.Event` that receives the`.postMessage`.
 * @property {Event}      onDisconnect    Event that never fires.
 */
module.exports = function runtimePort({ name, onData, write, }) {
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
		name, postMessage,
		disconnect() { process.exit(0); },
		onMessage: Event(onMessage),
		onDisconnect: Event(new Set),
	};
};

function Event(set) { return {
	addListener: set.add.bind(set),
	hasListener: set.has.bind(set),
	removeListener: set.delete.bind(set),
}; }
