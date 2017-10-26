/* eslint-disable strict */ (function(global) { 'use strict'; const factory = function es6lib_functional(exports) { // license: MIT

return class Tar {
	constructor(files) {
		this._buffers = [ ];
		if (Array.isArray(files)) { files.forEach(file => this.append(file)); }
		else if (files) { throw new TypeError(`files must be an Array of appendable file objects`); }
	}

	append({ name, data, encoding, mode, mtime, uid, gid, owner, group, }) {
		if (typeof data === 'string') {
			data = global.Buffer ? global.Buffer.from(data, encoding) : new global.TextEncoder(encoding || 'utf-8').encode(data);
		} else { data = data.slice(); }

		const header = Tar.alloc(512); { let pos = 0;
			function write(length, string) {
				if (typeof string === 'number') { string = (string || 0).toString(8).padStart(length - 1, '0'); }
				for (const start = pos, end = pos + Math.min(string.length, length); pos < end; ++pos) {
					header[pos] = string.charCodeAt(pos - start);
				}
				if (length > string.length) { pos += length - string.length; }
			}
			write(100, name+'');
			write(  8, mode == null ? 0o777 : typeof mode === 'string' ? parseInt(mode, 8) : +mode);
			write(  8, +uid || 0);
			write(  8, +gid || 0);
			write( 12, data.length);
			write( 12, +mtime || Math.floor(Date.now() / 1000));
			write(  8, '        '); // checksum (placeholder)
			write(  1, '0'); // type = file
			write(100, ''); // no link name
			write(  8, 'ustar  '); // magic value
			write( 32, owner ? owner+'' : '');
			write( 32, group ? group+'' : '');
			// leave the rest blank

			pos = 100 + 3*8 + 2*12; // seek to checksum
			write(  8, header.reduce((a, b) => a + b) +' \0'); // checksum
		}

		this._buffers.push(header, data, Tar.alloc((512 - data.length % 512) % 512));
		return this;
	}

	toBlob() {
		return new global.Blob(this._buffers, { type: 'application/x-tar', });
	}
	toBuffer() {
		const size = this._buffers.reduce((s, b) => s + b.length, 0);
		const out = Tar.alloc(size); let offset = 0;
		this._buffers.forEach(buffer => { out.set(buffer, offset); offset += buffer.length; });
		return out;
	}
	get out() { return this.toBuffer(); }

	static alloc(size) { return global.Buffer ? global.Buffer.alloc(+size) : new global.Uint8Array(+size); }
};

}; if (typeof define === 'function' && define.amd) { define([ 'exports', ], factory); } else { const exp = { }, result = factory(exp) || exp; if (typeof exports === 'object' && typeof module === 'object') { module.exports = result; } else { global[factory.name] = result; } } })((function() { return this; })()); // eslint-disable-line
