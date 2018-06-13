'use strict';

// nexe messes with the local require of the included modules, which prevents the require hooks from working, but we need them here.
typeof FuseBox !== 'undefined' && ({ require, } = FuseBox); // eslint-disable-line

switch (process.platform) {
	case 'win32': {
		const ffi = require('ffi'), { alloc, types, refType, } = require('ref'), tpVoid = refType(types.void);
		const Kernel32 = ffi.Library('Kernel32', {
			'OpenProcess': [ 'int32', [ 'ulong', 'byte', 'ulong', ], ],
			'CloseHandle': [ 'byte', [ 'int32', ], ],
		});
		const Ntdll = ffi.Library('Ntdll', {
			'NtQueryInformationProcess': [ 'long', [
				/*proc*/'int32'/*handle*/, /*type*/'ulong', /*out buffer* */'pointer'/*tProcBasicInfo*/,
				/*bufferLength*/'ulong', /*out usedLength*/'pointer'/*ulong*/,
			], ],
		});

		const Struct = require('ref-struct'), ArrayType = require('ref-array');
		const tProcBasicInfo = Struct({
			Reserved1: tpVoid,
			PebBaseAddress: tpVoid, // refType(tPEB),
			Reserved2: ArrayType(tpVoid, 2),
			UniqueProcessId: tpVoid,
			Reserved3: types.ulong,
		});

		module.exports = function ppid(pid) {
			const pbi = new tProcBasicInfo;
			const pUsedLength = alloc('ulong');
			const hProc = Kernel32.OpenProcess(0x1000, false, pid);
			try {
				const status = Ntdll.NtQueryInformationProcess(hProc, 0, pbi.ref(), pbi.ref().length, pUsedLength);
				if (status < 0) { throw new Error(`status: ${status}`); }
				if (pUsedLength.deref() !== pbi.ref().length) { throw new Error(`bad size ${pUsedLength.deref()} should ${pbi.ref().length}`); }
			} finally {
				Kernel32.CloseHandle(hProc);
			}
			return pbi.Reserved3;
		};
	} break;
	case 'linux': {
		const FS = require('fs');
		module.exports = function ppid(pid) {
			return FS.readFileSync(`/proc/${pid}/stat`, 'utf-8').match(/^\d+ \(.*?\) \w+? (\d+)/)[1] -0;
		};
	} break;
	case 'darwin': {
		const exec = require('child_process').execFileSync;
		const getppid = require('ffi').Library('libc', { getppid: [ 'long', [ ], ], }).getppid;
		module.exports = function ppid(pid) {
			if (pid === process.pid) { return getppid(); } // this should be quite a bit faster
			return +(/\d+/).exec(exec('ps', [ '-p', pid+'', '-o', 'ppid', ]))[0];
		};
	} break;
	default: throw new Error(`Unknown OS ${process.platform}`);
}
