'use strict'; module.exports = ({ config, }) => { /* globals Buffer, */

const FS = require('fs'), Path = require('path');
const home = require('os').homedir();

/**
 * Tries to locate the current profile based on a magic value the management extension has written
 * to its `browser.storage.local`. It basically checks all default locations for profiles for that value.
 * @param  {string}  magic   Random string (base64 to avoid encoding issues) in the `browser.storage.local`.
 * @param  {string}  extId   Extension id of the management extension.
 * @return {string}
 */
return async function({ magic, extId, }) {

	// step 1: find all dirs that contain the profiles to check
	let parents = [ ]; switch (config.browser) { case 'firefox': {
		switch (process.platform) { // use default, no configuration in for firefox
			case 'win32': {
				parents = [ process.env.APPDATA + String.raw`\Mozilla\Firefox\Profiles`, ];
			} break;
			case 'linux': {
				parents = [ home +'/.mozilla/firefox', ]; // directly in there
			} break;
			case 'darwin': {
				parents = [ home +'/Library/Application Support/Firefox/Profiles/', ];
			} break;
			default: throw new Error(`Unknown OS ${process.platform}`);
		}
	} break; case 'chromium': case 'chrome': { // get the chrome data dir
		// docs: https://chromium.googlesource.com/chromium/src.git/+/HEAD/docs/user_data_dir.md
		// TODO: on linux this could probably yield better results by cecking `/proc/${browser.pid}/fd` for a symlink to a file whose path ends with '/Extension State/LOCK'

		const { cwd, args, } = getBrowserArgs(); // get from cli
		const arg = args.find(arg => (/^"?--user-data-dir=/).test(arg)); if (arg) { // TODO: does /user-data-dir= work as well (on windows?)
			let cdd = arg.replace(/"/g, '').replace(/^--user-data-dir=/, '').replace(/\\ /g, ' ');
			if (!Path.isAbsolute(cdd)) {
				if (cdd.startsWith('~/')) { if (process.platform !== 'win32') { cdd = Path.join(home, cdd.slice(2)); } }
				else { if (cwd) { cdd = Path.resolve(cwd, cdd); } }
			}
			parents = [ cdd, ];
		} else { // get from env or default
			switch (process.platform) {
				case 'win32': {
					const prefix = process.env.LOCALAPPDATA;
					parents = (config.browser === 'chromium' ? [
						String.raw`Chromium\User Data`, // chromium
					] : [
						String.raw`Google\Chrome\User Data`, // release
						String.raw`Google\Chrome Beta\User Data`, // beta
						String.raw`Google\Chrome SxS\User Data`, // canary
					]).map(suffix => Path.join(prefix, suffix));
				} break;
				case 'linux': {
					if (process.env.CHROME_USER_DATA_DIR) {
						parents = [ Path.resolve(process.env.CHROME_USER_DATA_DIR), ];
					} else {
						const prefix = (process.env.CHROME_CONFIG_HOME || process.env.XDG_CONFIG_HOME || '~/.config').replace(/^~(?=[\\/])/, () => home);
						parents = (config.browser === 'chromium' ? [
							'chromium',
						] : [
							'google-chrome',
							'google-chrome-beta',
							'google-chrome-unstable',
						]).map(suffix => Path.join(prefix, suffix));
					}
				} break;
				case 'darwin': {
					const prefix = home +'/Library/Application Support';
					parents = (config.browser === 'chromium' ? [
						String.raw`Chromium`, // chromium
					] : [
						String.raw`Google\Chrome`, // release
						String.raw`Google\Chrome Beta`, // beta
						String.raw`Google\Chrome Canary`, // canary
					]).map(suffix => Path.join(prefix, suffix));
				} break;
				default: throw new Error(`Unknown OS ${process.platform}`);
			}
		}
	} }

	magic = Buffer.from(magic, 'utf-8');
	const path = config.browser === 'firefox'
	? `/browser-extension-data/${extId}/storage.js`
	: `/Local Extension Settings/${extId}/000003.log`;

	// step 2: check all possible locations for that magic value
	return (await Promise.all([ ].concat(...parents.map(dir => { try {
		return FS.readdirSync(dir).map(name => Path.join(dir, name));
	} catch (_) { return null; } }).filter(_=>_)).map(profile => new Promise(done => {
		FS.readFile(profile + path, (error, data) => {
			if (error) { done(null); return; }
			done(data.includes(magic) ? profile : null);
		});
	})))).find(_=>_);

};

function getBrowserArgs() {
	const exec = require('child_process').execFileSync;
	const ppid = require('./get-ppid.js'), pid = ppid(ppid(process.pid));
	switch (process.platform) {
		case 'win32': {
			const command = exec(
				'wmic', `process where processId=${pid} get CommandLine`.split(' '),
				{ encoding: 'utf-8', }
			).slice('CommandLine'.length + 2).trim();
			const args = [ ]; command.replace(/".*?"|(?:[^\s\\]|\\ |\\)+(?:".*?")?/g, s => (args.push(s), ''));
			return { cwd: null, args, };
		}
		case 'linux': {
			const cwd = FS.realpathSync(`/proc/${pid}/cwd`);
			const command = FS.readFileSync(`/proc/${pid}/cmdline`, 'utf-8').replace(/\0$/, '');
			const args = [ ]; command.replace(/".*?"|(?:[^\s\\]|\\ |\\)+(?:".*?")?/g, s => (args.push(s), ''));
			return { cwd, args, };
		}
		case 'darwin': {
			// see stackoverflow.com/q/8327139 for cwd and possibly a ffi solution
			const command = exec('ps', [ '-p', pid+'', '-o', 'command', ], { encoding: 'utf-8', }).split(/\n/g)[1];
			const args = [ ]; command.replace(/".*?"|(?:[^\s\\]|\\ |\\)+(?:".*?")?/g, s => (args.push(s), ''));
			return { cwd: null, args, };
		}
		default: throw new Error(`Unknown OS ${process.platform}`);
	}
}

};
