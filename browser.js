'use strict';

const FS = require('fs'), Path = require('path');

const browser = exports;

function getBrowserPid() { switch (process.platform) {
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

		const tProcBasicInfo = require('ref-struct')({
			Reserved1: tpVoid,
			PebBaseAddress: tpVoid,
			Reserved2a: tpVoid,
			Reserved2b: tpVoid,
			UniqueProcessId: tpVoid,
			Reserved3: types.ulong,
		});

		function ppid(pid) {
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
		}

		return ppid(ppid(process.pid));
	}
	default: throw new Error(`Unknown OS ${ process.platform }`);
} }
lazy(browser, 'pid', getBrowserPid);

{ // get extId, profileDir and extDir or extFile
	switch (process.argv[3]) {
		case 'chromium': case 'chrome': {
			const extId = browser.extId = (/^chrome-extension:\/\/(.*)\/?$/).exec(process.argv[4])[1];
			const pid = browser.pid;
			console.info({ extId, pid, }, getBrowserArgs());
			throw new Error(`Not implemented`);
			// defaults:
			// %LOCALAPPDATA%\Google\Chrome\User Data\Default
			// ~/.config/google-chrome/Default/Extensions/
			// ~/.config/chromium/Default/Extensions
			// ~/Library/Application\ Support/Google/Chrome/Default/Extensions
		}
		case 'firefox': {
			const extId = browser.extId = process.argv[5];
			if (process.env.MOZ_CRASHREPORTER_EVENTS_DIRECTORY) {
				const extPath = FS.realpathSync(Path.resolve(process.env.MOZ_CRASHREPORTER_EVENTS_DIRECTORY, '../../extensions', extId +'.xpi'));
				let stat; try { stat = FS.statSync(extPath); } catch (error) { throw new Error(`Can't access extension at ${ extPath }`); }
				browser[stat.isDirectory() ? 'extDir' : 'extFile'] = extPath;
			} else {
				throw new Error(`MOZ_CRASHREPORTER_EVENTS_DIRECTORY environment variable not set by Firefox`);
				// const args = getBrowserArgs();
				// -P / -p "profile_name"
				// -profile "profile_path" (precedence?)
				// otherwise: FS.readFileSync('%AppData%\Mozilla\Firefox\profiles.ini').trim().split(/(?:\r\n?\n){2}/g).find(_=>_.includes('Default=1')).match(/Path=(.*))[1]
			}
		} break;
		default: throw new Error(`Unknown browser ${ process.argv[2] }`);
	}

	function getBrowserArgs() {
		const exec = require('child_process').execFileSync;
		switch (process.platform) {
			case 'win32': {
				return { cwd: null, command: exec(
					'wmic', `process where processId=${ browser.pid } get CommandLine`.split(' '),
					{ encoding: 'utf-8', }
				).slice('CommandLine'.length + 2).trim(), };
			}
			default: throw new Error(`Unknown OS ${ process.platform }`);
		}
	}
}


function lazy(obj, prop, getter) {
	Object.defineProperty(obj, prop, { configurable: true, enumerable: true, get() {
		const value = getter();
		Object.defineProperty(obj, prop, { value, });
		return value;
	}, });
}
