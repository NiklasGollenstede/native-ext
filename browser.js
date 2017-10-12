'use strict'; module.exports = async ({ version, port, }) => { const browser = { };

/**
 * This module collects and exposes information about the connecting browser and extension.
 * It is available as 'browser' for the extension modules.
 */

const FS = require('fs'), Path = require('path'), { promisify, } = require('util');
const realpath = promisify(FS.realpath);

void version; // nothing version specific so far


// 'chromium', 'chrome' or 'firefox'
browser.name = process.argv[3];


/// pid of the browser main process
lazy(browser, 'pid', getBrowserPid);
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

		const Struct = require('ref-struct'), ArrayType = require('ref-array');
		const tProcBasicInfo = Struct({
			Reserved1: tpVoid,
			PebBaseAddress: tpVoid, // refType(tPEB),
			Reserved2: ArrayType(tpVoid, 2),
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
	case 'linux': throw new Error(`Not implemented`);
	case 'darwin': throw new Error(`Not implemented`);
	default: throw new Error(`Unknown OS ${ process.platform }`);
} }


{ // get extId, profileDir and extDir or extFile
	switch (browser.name) {
		case 'chromium': case 'chrome': {
			const extId = browser.extId = (/^chrome-extension:\/\/(.*)\/?$/).exec(process.argv[4])[1];
			const { cwd, args, } = getBrowserArgs();
			console.info({ cwd, args, });
			const arg = args.find(arg => (/^"?--user-data-dir=/).test(arg)); // TODO: does /user-data-dir= work as well (on windows?)
			let cdd = arg && arg.replace(/^--user-data-dir=/, '').replace(/"/g, '').replace(/\\ /g, ' ');
			if (cdd && !Path.isAbsolute(cdd)) { throw new Error(`Chrome was started with the --user-data-dir argument, but the path (${cdd}) was not absolute. To use NativeExt, please supply an absolute path!`); }
			if (!cdd) { switch (process.platform) { // use default, currently ignores Chrome Beta/Dev/Canary
				case 'win32': {
					cdd = Path.join(process.env.LOCALAPPDATA, String.raw`Google\Chrome\User Data`);
				} break;
				case 'linux': {
					if (process.env.CHROME_USER_DATA_DIR) { return Path.resolve(process.env.CHROME_USER_DATA_DIR); }
					const config = (process.env.CHROME_CONFIG_HOME || process.env.XDG_CONFIG_HOME || '~/.config').replace(/^~(?=[\\\/])/, () => require('os').homedir());
					cdd = Path.join(config, browser.name === 'chromium' ? 'chromium' : 'google-chrome');
				} break;
				case 'darwin': {
					cdd = Path.join(require('os').homedir(), 'Library/Application Support', browser.name === 'chromium' ? 'Chromium' : 'Google/Chrome');
				} break;
				default: throw new Error(`Unknown OS ${ process.platform }`);
			} }
			try { FS.statSync(cdd); } catch (error) { throw new Error(`Failed to locate the chrome data dir, deducted "${cdd}" but that doesn't exist`); }

			try { browser.extDir = FS.realpathSync(Path.join(cdd, 'Default', 'Extensions', extId)); browser.profileDir = Path.join(cdd, 'Default'); }
			catch (error) { // the extension is not installed in the default profile.
				// This can have two causes: (1) the extension is installed as a temporary extension; (2) the current profile is not 'Default'
				// The former should only happen to developers (who should have read the docs), so this only handles the second case:
				const profile = (await port.request('init.getChromeProfileDirName'));
				try { FS.accessSync(Path.join(cdd, profile)); } catch (error) { throw new Error(`The Profile "${profile}" does not exist in "${cdd}"`); }
				try { browser.extDir = FS.realpathSync(Path.join(cdd, profile, 'Extensions', extId)); browser.profileDir = Path.join(cdd, profile); }
				catch (error) { throw new Error(`The extension ${extId} is not installed in ${ Path.join(cdd, profile) }. (Read the docs for unpacked extensions)`); }
			}
		} break;
		case 'firefox': {
			const extId = browser.extId = process.argv[5];
			if (process.env.MOZ_CRASHREPORTER_EVENTS_DIRECTORY) {
				browser.profileDir = Path.resolve(process.env.MOZ_CRASHREPORTER_EVENTS_DIRECTORY, '../..');
				const extPath = Path.join(browser.profileDir, 'extensions', extId);
				const [ extDir, extFile, ] = (await Promise.all([
					realpath(extPath).catch(() => null),
					realpath(extPath +'.xpi').catch(() => null),
				]));
				if (extDir && FS.statSync(extDir).isDirectory()) { browser.extDir = extDir; }
				else if (extFile && FS.statSync(extFile).isFile()) { browser.extFile = extFile; }
				else { throw new Error(`Can't locate extension at ${ extPath }(.xpi)`); }
			} else {
				throw new Error(`MOZ_CRASHREPORTER_EVENTS_DIRECTORY environment variable not set by Firefox`);
				// const args = getBrowserArgs();
				// -P / -p "profile_name"
				// -profile "profile_path" (precedence?)
				// otherwise: FS.readFileSync('%AppData%\Mozilla\Firefox\profiles.ini').trim().split(/(?:\r\n?\n){2}/g).find(_=>_.includes('Default=1')).match(/Path=(.*))[1]
			}
		} break;
		default: throw new Error(`Unknown browser ${ browser.name }`);
	}

	function getBrowserArgs() {
		const exec = require('child_process').execFileSync;
		switch (process.platform) {
			case 'win32': {
				const command = exec(
					'wmic', `process where processId=${ browser.pid } get CommandLine`.split(' '),
					{ encoding: 'utf-8', }
				).slice('CommandLine'.length + 2).trim();
				const args = [ ]; command.replace(/".*?"|(?:[^\s\\]|\\ |\\)+(?:".*?")?/g, s => (args.push(s), ''));
				return { cwd: null, args, };
			}
			case 'linux': throw new Error(`Not implemented`);
			case 'darwin': throw new Error(`Not implemented`);
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

return browser; };
