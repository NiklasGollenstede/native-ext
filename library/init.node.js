/* eslint-env node */ /* eslint-disable strict */ 'use strict'; module.exports =  async (channel, config) => {

{ process.argv[0] = process.argv0; /* bugfix for native-ext v0.3.1 */ } // TODO: fix in app and remove

if (config.inspect) {
	const { port, host, break: doBreak, } = config.inspect;
	require('inspector').open(port, host, doBreak);
	if (doBreak) { debugger; } // eslint-disable-line no-debugger
}

const Path = require('path');

const Port = require('multiport'), port = new Port(channel, Port.web_ext_Port);

process.on('uncaughtException',  async error => !(await port.request('uncaught', error)) && process.exit(1));
process.on('unhandledRejection', async error => !(await port.request('rejected', error)) && process.exit(1));

port.addHandlers({
	async require(path, options, callback) {
		if (!(/(?:\bn(?:ative|ode)|(?:^|[\\/])n(?:ative|ode)[\\/].*)\.js$/).test(path)) {
			throw new Error(`path must contain /node/ or /native/ or end with \\bnode.js or \\bnative.js`);
		}
		const exports = (await process.mainModule.require(Path.join(process.mainModule.filename, path)));
		(await typeof exports !== 'object' ? callback(exports) : callback(...[].concat(...Object.entries(exports))));
	},
});

port.post('ready');
// console.info('native-ext running in', process.cwd());

};
