'use strict'; /* global Buffer, */

const empty = Buffer.alloc(0);

class NativeConect /* implements multiport/PortAdapter */ {

	constructor(pipes, onData, onEnd) {
		void onEnd; // do stdin/out ever close? what would that mean?
		this.out = pipes.out;
		let expect = null, buffer = empty;
		pipes.in.on('data', data => {
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
				// console.log('message', message[0], message[1], message[2].length);
				onData(message[0], message[1], JSON.parse(message[2]));
			}
		});
	}

	send(name, id, args) {
		// console.log('reply', name, id, args.length);
		const message = [ name, id, JSON.stringify(args), ];
		const string = JSON.stringify(message);
		const length = Buffer.byteLength(string, 'utf8');
		const buffer = Buffer.allocUnsafe(4 + length);
		buffer.writeInt32LE(length);
		buffer.write(string, 4, length, 'utf8');
		this.out.write(buffer);
	}

	destroy() {
		// TODO: ??
	}
}

module.exports = NativeConect;
