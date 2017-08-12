'use strict'; /* global Buffer, */

/**
 * Transforms the stdio streams of a node.js native messaging app into something resembling a browser.runtime.Port.
 * @param  {stream.Readable}  stdin
 * @param  {stream.Writable}  stdout
 * @return {object}                   Object of { postMessage, onMessage, onDisconnect, }.
 */
function runtimePort(stdin, stdout) {
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

class Multiplex {
	constructor({ port, thisArg, channel, }, onData, onEnd) {
		if (!(/^[\w-]+$/).test(channel)) { throw new TypeError(`Channel names must be alphanumeric (plus '-' and '_')`); }
		this.port = port;
		this.onMessage = data => {
			data[0].startsWith(channel) && onData(data[0].slice(channel.length), data[1], JSON.parse(data[2]), thisArg);
			data[0] === '$destroy' && data[2] === channel && onEnd();
		};
		this.onDisconnect = () => onEnd();
		this.port.onMessage.addListener(this.onMessage);
		this.port.onDisconnect.addListener(this.onDisconnect);
		this.channel = (channel += '$');
	}
	send(name, id, args) {
		args = JSON.stringify(args); // explicitly stringify args to throw any related errors here.
		try { this.port.postMessage([ this.channel + name, id, args, ]); }
		catch (error) { this.onDisconnect(); }
	}
	destroy() {
		try { this.port.postMessage([ '$destroy', 0, this.channel, ]); } catch (_) { }
		this.port.onMessage.removeListener(this.onMessage);
		this.port.onDisconnect.removeListener(this.onDisconnect);
		this.port = this.onMessage = this.onDisconnect = null;
	}
}

module.exports = {
	runtimePort,
	Multiplex,
};
