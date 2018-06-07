
# NativeExt — easy Native Messaging for WebExtensions


## For users

This application enables browser extensions/add-ons to be truly awesome (again). If an extension you installed brought you here, please follow the instructions below:


### Installation

Get the extension for your browser(s):

 * Chrome: <sub><a href="https://chrome.google.com/webstore/detail/nativeext/kfabpijabfmojngneeaipepnbnlpkgcf/"><img src="./resources/get-chrome-ext-206x58" width="103" height="29"></a><sub>
 * Firefox: <sub><a href="https://addons.mozilla.org/firefox/addon/native-ext/"><img src="./resources/get-firefox-ext-172x60.png" width="86" height="30"></a><sub>

Then follow the (short) instructions on the options page to install and connect the application.


### Update

The extension is automatically updated by the browser and should take care of everything else.


### Uninstallation

The extension can be removed like any other extension.
There is no automated uninstallation for the application yet. The application is installed in the home folder, specifically in `%APPDATA%\de.niklasg.native_ext` on Windows, `~/.de.niklasg.native_ext` on Linux and `~/Library/Application Support/de.niklasg.native_ext` on macOS.
Besides the files in that folder, each configuration in `profiles/` is linked elsewhere so that the browser can find it. There is a `unlink` script in every configuration folder.
To remove NativeExt without traces, call all those `unlink` scripts and delete the installation/configuration folder.


### Issues & Support

If you have any questions not answered here or problems with the setup of NativeExt, please look for [existing issues](https://github.com/NiklasGollenstede/native-ext/issues?q=is:issue) and create a new one if your issue isn't opened yet.


## For developers

This package tries to solve a problem that arises with the deprecation of classical Add-Ons in Firefox.\
From Firefox version 57 onwards (November 2017), Firefox only supports "WebExtensions", which are very similar to the extensions running in Chrome, other Chromium based browsers and even Microsoft Edge.\
While Firefox Add-ons could previously dig very deep into the Firefox code, capable of changing nearly every aspect of the browser, and even doing binary system calls, this is no longer possible with WebExtensions.
They can only access normal web APIs (XHR, IndexedDB, ...) and a set of APIs in the `browser`/`chrome` namespace explicitly  designed for them.
This means that browser extensions can now only do things that are, at least to a certain extend, intended by the browser vendors.
Many innovative things that could previously be implemented in Firefox Add-Ons are no longer possible.\
The only way (partially) around this is to use "Native Messaging": WebExtensions in Chrome and Firefox can send JSON-messages to native applications running on the host system — if the target applications are explicitly designed for it.


### The Problem

The problem with the Native Messaging approach is twofold. Where it was previously enough to develop and install a single JavaSceipt extension for a browser,
- the developer now needs to write, pack and update an application for multiple operating systems and
- the user needs to install and update that additional application for every extension that makes use of Native Messaging.


### Proposed solution

It seems that there is no way around Native Messaging. If you want to implement functionality that exceeds the APIs provided by the Browser, it is the only way forward.\
Therefore, both developing and installing and updating the native applications needs to be as easy as possible, to lower the barrier to entry for developers and users.\
The NativeExt framework provides a very simple work flow for both developers and users:

**User** install the NativeExt extension and follow simple and short instructions to install and connect the native application endpoint. Once installed, the extension and application update themselves. Allowing extensions to use NativeExt only requires a single click; all configuration is written automatically.

**Developers** have two choices, they can either use the bare-bone connection and communication protocols of NativeExt directly, or they can use the library included in this project.
Extensions have to ask the user for permission and can then load any node.js modules they wish.
Everything except the most basic code to initialize the node.js process is included in the extensions themselves, so software components are always updated in the browser and node.js parts of extensions at the same time: when the extension receives its update through the normal browser update mechanism.


### Implementation status

Mostly done. Outstanding work:

 * Publish extension in the stores of Chrome and Firefox
 * Update node.js from version 8.3 to ... (10.x ?)
 * Update dependencies and hand-puck them for the `package-lock.json`
 * Support for Edge, Opera, Vivaldi, ...
 * Write an uninstaller


### [API](./docs/README.md)


### Example

An example using the library:

```js
const Native = await require.async('node_modules/native-ext/');

await Native.requestPermission({ message: 'Wanna do great stuff', });
// assume the NativeExt extension is set up and the user grants permission right away

const file = await Native.do(process => { // keep process alive until this function exits

	const fs = await Native.require(require.resolve('./fs.node.js'));
	const file = await fs.readFile(somePath, 'utf8');

	fs.watch(someOtherPath, { }, onChange); // can even send callbacks
	await waitSomeTime();
	fs.unwatch(onChange); // remove listener after the connection closed

	return file;
});

function onChange(type, name) {
	console.log('File', name, type +'d');
}
```
`./fs.node.js`:
```js
'use strict'; /* global require, module, exports, process, Buffer, */

const { promisify, } = require('util'), promisifyAll = ...; // work with promises

const fs = promisifyAll(require('fs')); // any native module, 'ffi', 'browser' or any file included in the extension

port.addHandlers('fs.', fs); // expose the fs module under the 'fs.' prefix

// handle special case of `fs.watch`
const cb2watcher = new WeakSet, { watch, } = fs;
fs.watch = (path, options, callback) => {
	const watcher = watch(path, options, callback);
	ch2watcher.set(callback, watcher);
};
fs.unwatch = callback => {
	const watcher = ch2watcher.get(callback);
	watcher && watcher.close();
	ch2watcher.delete(callback);
}

module.exports = fs;
```


### Extension location
<!-- TODO: outdated -->

As NativeExt loads code from inside the extension package, it needs to locate the local extension installation.
Currently, the only supported location is in the `extensions/` (or `Extensions/`) folder in the profile, which is correct for normal extension installations.

Extensions that are temporary loaded during development have to be linked or copied to the extension folder to be accessible.
There are several supported ways to do this:
- zip the extension and place it as `{ext-id}.xpi` inside the extensions folder (Firefox only)
- copy the unpacked extension to the extension folder
- link the (packed or unpacked) extension to the extension folder (not recommended, the browsers tend to (recursively) delete everything in that folder on restart)
- put a text file called `{ext-id}` inside the extension folder, whose only content is the absolute path to your unpacked extension


### Building

This project contains three sub-projects: the application itself, the extension that manages it, and the library for other extensions to work with the former two.

#### Building (application)

Building the NativeExt application requires node.js in the exact version listed in the `package.json`/`"scripts"`.`"build"` command (currently 8.3), npm and [node-gyp](https://github.com/nodejs/node-gyp#installation) including its dependencies. After cloning or downloading the sources, step in the `application` directory and install the dependencies with:

`npm install`

Now you can either install directly from the sources (this creates symlinks, so keep the sources and node.js of the correct version):

`node . install`

build only for your current system:

`npm run build`

or for all supported platforms:

`npm run build-all` (these will not work with Chrome or extensions that rely on `ffi`, which needs to be build explicitly for each platform).

The builds will be placed in the `/release` folder.

#### Building (library)

The library does not need to be build, but is needs to be linked for the extension. Prepare that by stepping in the `library` directory and running:

`npm link`

#### Building (extension)

Step in the `extension` directory and install and build with `npm install`. Use `npm start` to re-build.


### Debugging

To be able to attach an inspector to the native process, install from sources and add `--node-options=--inspect` or `--node-options=--inspect-brk` as install argument. E.g.:

`node . install --node-options=--inspect-brk`.
