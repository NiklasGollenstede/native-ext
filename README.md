
# NativeExt — easy Native Messaging for WebExtensions


## For users

This application enables browser extensions/add-ons to be truly awesome (again). If an extension you installed brought you here, please follow the instructions below:

### Installation

1. **Download**: Unless you know that you need a specific version, get the latest (topmost) version matching your operating system from the [releases page](https://github.com/NiklasGollenstede/native-ext/releases).\
Alternatively, you can [build NativeExt](#building) yourself.
2. **Installation**: Just double-click (run/open) the downloaded file. It should not require elevated privileges of any kind. After a few seconds, you should see a success message.
3. **Extension registration**: For the browsers to allow the communication between your extensions and NativeExt, the extensions need to be registered. If the extension in question provided you with an registration script, run that and you are done.\
*Otherwise*:
	- a) Open the installation directory, which is `%APPDATA%\de.niklasg.native_ext` on Windows, `~/.de.niklasg.native_ext` on Linux and `~/Library/Application Support/de.niklasg.native_ext` on macOS.
	- b) Create a file in the `/vendors/` subdir as described in the [registration files](#registration-files) section below.
	- c) Run the `refresh.bat`/`refresh.sh` file in the installation root.

### Uninstallation

If you want to unregister an extension, delete its registration file from the `/vendors/` directory, then run the refresh script again.

To completely uninstall NativeExt, run the `uninstall.sh` script in the installation directory (see above). On windows, call the installer with `uninstall` as first argument or simply delete the installation directory.


## For developers

This package tries to solve a problem that arises with the deprecation of classical Add-Ons in Firefox.\
From Firefox version 57 onward (November 2017), Firefox will only support "WebExtensions", which are very similar to the extensions running in Chrome, other Chromium based browsers and even Microsoft Edge.\
While Firefox Add-ons could previously dig very deep into the Firefox code, capable of changing nearly every aspect of the browser, and even do binary system calls, this is no longer possible with WebExtensions. They can only access normal web APIs (XHR, IndexedDB, ...) and a set of APIs in the `browser`/`chrome` namespace explicitly  designed for them. This means that browser extensions can now only do things that are, at least to a certain extend, intended by the browser vendors. Many innovative things that could previously be implemented in Firefox Add-Ons are no longer possible.\
The only way around this is to use "Native Messaging": WebExtensions in Chrome and Firefox can send JSON-messages to native applications running on the host system — if the target applications are explicitly designed for it.

### The Problem

The problem with the Native Messaging approach is twofold. Where it was previously enough to develop and install a single JavaSceipt extension for a browser,
- the developer now needs to write, pack and update an application for multiple operating systems
- and the user needs to install and update that additional application for every extension that makes use of Native Messaging.

### Proposed solution

It seems that there is no way around Native Messaging. If you want to implement functionality that exceeds the APIs provided by the Browser, it is the only way forward.\
Therefore, both developing and installing and updating the native applications needs to be as easy as possible, to lower the barrier to entry for developers and users.\
This software aims to do that. Once everything is implemented as intended, the development - deploy - update cycle should be as follows:

- The developer writes a node.js script
	- the script is written in same language as the extension itself
- The user installs this free and open software with as few clicks as possible
	- this only needs to be done once
	- since this software has no own functionality and the protocol is simple, no updates should be necessary (once the API is finalized)
- The extension prompts the user to download and run a very short and simple script that registers the extension with this software
	- the script places a file with its extension IDs and a signing key in a predefined directory and calls a refresh script
	- writing the IDs is technically necessary and the signing is a security precaution
	- scripts are so generic that they can be generated automatically, users who don't trust the scripts can perform their actions manually in about 30 seconds
- The extension can now contact this software without further user interaction
	- it sends a signed node.js script that is executed and can respond to further messages
	- to update the "native application", it is enough to include a new signed script in the extension
	- this way, the versions of the extension and the native application always match

### Implementation status

Building, installation and connecting from Chrome and Firefox works on Windows, Linux and macOS.\
The API for the connection establishment is neither finalized nor documented.\
Signing is not implemented at all.

### API

The API is not finalized and may be subject to breaking changes.
One part that is unlikely to change is the usage of [Multiport](https://github.com/NiklasGollenstede/multiport) for the communication.

```js
const connect = require('node_modules/web-ext-utils/loader/native');

const port = (await connect({ // returns a multiport/Port, see above
	script: (await (await fetch('./native.js')).text()),
	sourceURL: require.toUrl('./native.js'), // optional, for stack traces
	// the browser implicitly sends the extensions ID
	// signature: // TBD
}));

// the async main function of ./native.js has returned

const file = (await port.request('fs.readFile', somePath, 'utf8'));

port.post('fs.watch', somePath, { }, onChange); // can even send callbacks
port.afterEnded('fs.unwatch', onChange); // remove listener after the connection closed

function onChange(type, name) {
	console.log('File', name, type +'d');
}
```
`./native.js`:
```js
async port => {
	const { promisify, } = require('util'), promisifyAll = ...; // work with promises

	const fs = promisifyAll(require('fs')); // any native module

	port.addHandlers('fs.', fs); // expose the fs module under the 'fs.' prefix

	// handle special case of `fs.watch`
	const cb2watcher = new WeakSet;
	port.removeHandler('fs.watch').addHandler('fs.watch', (path, options, callback) => {
		const watcher = fs.watch(path, options, callback);
		ch2watcher.set(callback, watcher);
	}).addHandler('fs.unwatch', callback => {
		const watcher = ch2watcher.get(callback);
		watcher && watcher.close();
		ch2watcher.delete(callback);
	});
}

```

### Registration files

Browsers only allow extensions to connect to native applications it the extensions id is listed in the native messaging manifest of the application.
NativeExt can automatically update its manifest, but the ids of the allowed extensions must be known. To register an extension, place a JSON file of the following format (but without the comments) in the `/vandors/` directory in NativeExts installation directory.
```json5
{
	// list of chrome extension URL-prefixes, starting with `chrome-extension://` and ending with a `/` after the id
	"chrome-ext-urls": [
		// these ids are only constant for extensions hosted in the chrome store
		// otherwise, they are different for every (development mode) installation of the extension
		"chrome-extension://bifnmhkpejedfmdgiigmomljbieidegk/"
	],
	// list of Firefox WebExtension application ids, they always contain an @ symbol
	"firefox-ext-ids": [
		"@re-style" // you must set this in the "applications" entry in your extensions manifest.json
	],
	"key": "..." // TBD, see Implementation status
}

```
The name of your file should be your extensions name/id/domain or that of its developing organization and should probably not contain spaces.


### Building

Building NativeExt requires node.js v8+ and npm. After cloning or downloading the sources, install the dependencies with:

`npm install`

Now you can either install directly from the sources (this creates symlinks, so keep the sources and node.js v8+):

`node install`

build only for your current system:

`npm run build`

or for all supported platforms:

`npm run build-all`

The builds will be placed in the `/release` folder.
