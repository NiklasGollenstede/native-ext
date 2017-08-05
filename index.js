'use strict'; let dialog; (async () => {

Error.stackTraceLimit = Infinity; // get them all ...

const args = process.argv.slice(2);
!args.includes('--no-dialog') && (dialog = require('dialog')); // see https://github.com/tomas/dialog/issues/7

switch (args[0]) {
	// case 'eval': { console.log(eval(args.slice(1).join(' '))); } break;
	case undefined: // started from file system / without args ==> install
	case 'install': case 'refresh': case 'uninstall': {
		const command = args[0] || 'install';
		(await require('./install.js')[command]({
			source: process.argv[1] === 'nexe.js' ? process.argv[0] : __dirname,
		}));
		dialog && dialog.info(_(`Operation ${ command } successful`), 'Native-Ext', dialoged);
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
	dialog && dialog.err(_(`Operation failed: ${ error.message || error }`), 'Error: Native-Ext', dialoged);
	process.exitCode = 1;
});

function _(string) { return string.replace(/"/g, `''`); }
function dialoged(_, __, error) { error && console.log('Dialog error', error); }
