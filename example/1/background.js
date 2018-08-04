(function(global) {

/// handles each instance of the options page
global.initOptionsView = async window => {
	const { document, } = window;

	const request = document.querySelector('#request');
	const output = document.querySelector('#output');
	const content = document.querySelector('#content');
	const start = document.querySelector('#start'), stop = document.querySelector('#stop');


	const Native = await global.require.async('node_modules/native-ext/');
	log('NativeExt library loaded');


	/// #request access to NativeExt
	request.onclick = () => Native.requestPermission({ message: 'Wanna do great stuff', })
	.then(status => log('requestPermission result:', status));


	/// #start & #stop watching file #path
	start.onclick = async () => { try {
		start.disabled = true;
		let path = document.querySelector('#path').value;

		log('Blocking until the permission is granted ...');
		await Native.do(async process => {

			const { homedir, browser, } = await process.require(require.resolve('/utils.node.js'));
			path = path.replace(/^~(?=[\\/])/, () => homedir);
			log('Current browser', browser);

			log('Loading', path);
			const fs = await process.require(require.resolve('/fs.node.js'));
			content.textContent = await fs.readFile(path, 'utf-8');

			log('Watching the file. Changes should be updated in the textarea automatically');
			fs.watch(path, { }, onChange);

			start.style.display = 'none'; stop.style.display = 'unset';

			await new Promise((onclick, onExit) => {
				stop.onclick = onclick;
				process.onExit(onExit);
				window.onunload = () => onExit(new Error('Window closed'));
			});

			log('Closing file watcher');
			fs.unwatch(onChange);

			async function onChange(type, name) {
				log('File', name, type +'d');
				content.textContent = await fs.readFile(path, 'utf-8');
			}
		});
	} catch(error) {
		log('ERROR:', error.message, '\n', error.stack);
	} finally {
		start.disabled = false; start.style.display = 'unset';
		stop.style.display = 'none'; stop.onclick = null;
		content.textContent = '';
	} };


	/// logs stuff to the #output box
	function log(...args) {
		console.log('#output +=', ...args);
		output.textContent += args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') +'\n';
	}
};

})(this);



