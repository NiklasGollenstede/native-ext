/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals module, */ // license: MPL-2.0
module.exports = function({ options, /*packageJson,*/ manifestJson, files, }) {

	// manifestJson.applications.chrome = { id: '...', };

	manifestJson.permissions.push(
		'nativeMessaging',
		'notifications',
		'sessions', // remove closed popups
	);

	!options.viewRoot && (options.viewRoot = options.chrome ? 'NativeExt.html' : 'NativeExt');

	manifestJson.options_ui.open_in_tab = false;

	delete manifestJson.browser_action;

	delete manifestJson.background.persistent; // TODO: try event page in chrome

	// TODO: only include necessary files
	files.node_modules = [
		'multiport/index.js',
		'native-ext/index.js',
		'native-ext/init.node.js',
		'native-ext/manager.js',
		'native-ext/process.js',
		'native-ext/test.node.js',
		'pbq/require.js',
		'web-ext-utils/browser/index.js',
		'web-ext-utils/browser/storage.js',
		'web-ext-utils/browser/version.js',
		'web-ext-utils/loader/_background.html',
		'web-ext-utils/loader/_background.js',
		'web-ext-utils/loader/_view.html',
		'web-ext-utils/loader/_view.js',
		'web-ext-utils/loader/views.js',
		'web-ext-utils/options/editor/about.css',
		'web-ext-utils/options/editor/about.js',
		'web-ext-utils/options/editor/index.css',
		'web-ext-utils/options/editor/index.js',
		'web-ext-utils/options/editor/inline.css',
		'web-ext-utils/options/editor/inline.js',
		'web-ext-utils/options/index.js',
		'web-ext-utils/tabview/index.css',
		'web-ext-utils/tabview/index.js',
		'web-ext-utils/update/index.js',
		'web-ext-utils/utils/icons/',
		'web-ext-utils/utils/event.js',
		'web-ext-utils/utils/files.js',
		'web-ext-utils/utils/notify.js',
		'web-ext-utils/utils/semver.js',
	];

};
