'use strict'; (async () => {

Error.stackTraceLimit = Infinity; // get them all ...

const args = process.argv.slice(2);

switch (args[0]) {
	case 'eval': { console.log(eval(args.slice(1).join(' '))); } break;
	case undefined: // started from file system / without args ==> install
	case 'install': case 'refresh': case 'uninstall': {
		const command = args[0] || 'install';
		(await require('./install.js')[command]({
			source: process.argv[1] === 'nexe.js' ? process.argv[0] : __dirname,
		}));
		dialog('info', 'Native-Ext', `Operation ${ command } successful`);
	} break;
	case 'connect': {
		// chrome sends "chrome-extension://"... as (first(?)) arg (and on windows a handle to the main window (as second arg?))

		// firefox sends the path to the manifest (firefox.json) as the first arg and (since ff55) the extensions id as second arg
		// but for some reason (the .bat indirection?) those seem to end up in a single space separated arg

		require('./connect.js');
	} break;
	default: {
		console.error(`Bad arguments ${ JSON.stringify(process.argv) }`.trim());
		process.exit(-1);
	}
}

})().catch(error => {
	console.error('Startup failed', error);
	dialog('error', 'Error: Native-Ext', `Operation failed, see the command window for more information`);
	process.exitCode = 1;
});

function dialog(type, title, message) {
	if (process.argv.includes('--no-dialog')) { return; }
	if (process.platform !== 'win32') {
		require('dialog')[ type === 'warn' ? 'warning' : type](message, title, (_, __, error) => error && console.error('Dialog error', error));
	}
	type = ({ info: 64, warn: 48, error: 16, })[type] || 0;
	const escape = str => require('querystring').escape(str).replace(/'/g, '%27');
	require('child_process').execFile('mshta', [
		`javascript:var sh = new ActiveXObject('WScript.Shell'); sh.Popup(unescape('${ escape(message) }'), 60, unescape('${ escape(title) }'), ${type});close()`,
	]);
}
