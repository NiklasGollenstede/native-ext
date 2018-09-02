
# NativeExt — easy Native Messaging for WebExtensions


## For users

This application enables browser extensions/add-ons to be truly awesome (again). If an extension you installed brought you here, please follow the instructions below:


### Installation

Get the extension for your browser(s): <sub><sub><a href="https://addons.mozilla.org/firefox/addon/native-ext/"><img src="./resources/get-firefox-ext-172x60.png" width="86" height="30"></a></sub></sub> <sub><sub><a href="https://chrome.google.com/webstore/detail/nativeext/kfabpijabfmojngneeaipepnbnlpkgcf/"><img src="./resources/get-chrome-ext-206x58.png" width="103" height="29"></a></sub></sub>

Then follow the (short) instructions on the options page to install and connect the application.


### Update

The extension is automatically updated by the browser and should take care of everything else.


### Uninstallation

The extension can be removed like any other extension.
There is no automated uninstallation for the application yet. The application is installed in the home folder, specifically in `%APPDATA%\de.niklasg.native_ext` on Windows, `~/.de.niklasg.native_ext` on Linux and `~/Library/Application Support/de.niklasg.native_ext` on macOS.
Besides the files in that folder, each configuration in its `profiles/` subdirectory is linked elsewhere so that the browser can find it. There is a `unlink` script in every configuration folder.
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

**Users** install the NativeExt extension and follow simple and short instructions to install and connect the native application endpoint. Once installed, the extension and the application update themselves. Allowing extensions to use NativeExt only requires a single click; all configuration is written automatically.

**Developers** have two choices, they can either use the bare-bone connection and communication protocols of NativeExt directly, or they can use the library included in this project.
Extensions have to ask the user for permission and can then load any node.js modules they wish.
Everything except the most basic code to initialize the node.js process is included in the extensions themselves, so software components are always updated in the browser and node.js parts of extensions at the same time: when the extension receives its update through the normal browser update mechanism.


### Architecture

To use Native Messaging in an extension, the target application has to be installed on the computer already and needs to whitelist the extensions ID (browser/protocol requirements).
The majority of the code executed in the node.js environment is supposed to be supplied by the extension installed in the browser.
To avoid `eval`ing code strings explicitly send by the extension vis the messaging protocol, NativeExt locates the installed extension and loads the code directly from disk, which requires knowledge of the current browser profile location.
Since browsers don't tell the native application this location, it has to be managed by NativeExt itself. Automatic detection is often, but not always reliably, possible and also takes some time.

The NativeExt project is therefore split up in three parts:

 * the application itself, which is basically just the node.js runtime, some messaging code and the functionality to write configurations
 * a browser management extension which guides through the installation of the application, has the UI for the configuration by the user and initiates updates of the application
 * library components that can be included in other extensions to gain access through the management extension and to manage application processes afterwards


### Implementation status

Mostly done. Outstanding work:

 * a proper installer
	 * should also take care of uninstallation
	 * can include bare node.js (easier runtime updates)
 * automatic builds for MacOS (the CI, AppVeyor, plans to support MacOS [by the end of 2018](https://help.appveyor.com/discussions/questions/23413-are-there-plans-to-make-mac-os-images-available))
 * updated dependencies and hand-pick them for the `package-lock.json`
 * support for other browsers (but Edge uses a completely different protocol)


### API

There are two locations where NativeExt exposes APIs to the extensions.

#### As library in the Browser

The [library/](./library/) modules can be installed via `npm i native-ext` and be required in the background script of a WebExtension.
It provides functions and classes to use automatically or explicitly managed native processes.
For now, please refer to the function and class documentation in the source files.

#### In the node.js process

NativeExt executes the node.js modules provided by the extensions in a slightly modified node.js environment and additionally exposes some modules.

The **environment** in the node.js process is still subject to change. It should be brought closer to "vanilla" node.js.
This currently works:

 * `require()`ing included files by relative path
 * reading included files with the `fs` module
 * passing `fs.realpath(...)` of included files to other application

But extensions should not write th the extension folder or rely on its location within the file system.

The **modules** exposed by `native-ext` are `ffi`, `ref`, `ref-array`, `ref-union` and `ref-struct` to interact with native functions and a custom `browser` module.
These modules can be required like build-in modules (e.g. `require('ref')`).

The **`browser`** module exports the following constants:

 * `name`: One of `'chromium'`, `'chrome'` or `'firefox'`.
 * `profileDir`: The current browser profile location, e.g. `C:\Users\<user>\AppData\Roaming\Mozilla\Firefox\Profiles\<rand>.<name>` or `C:\Users\<user>\AppData\Local\Google\Chrome\User Data\Default`
 * `extId` The ID of the current extension (string).
 * `extDir` or `extFile`: The directory or file the extension is loaded from. Only the applicable one is set.
 * `pid`: Process ID of the current browsers main process (integer). (This is retrieved lazily and may be expensive to obtain.)


### Example

An complete example using the library can be found in [`example/1`](./example/1). Here are the basic components:

`npm i native-ext multiport web-ext-utils pbq` (and make the required files available in the packed extension)

```js
const Native = await require.async('node_modules/native-ext/');

await Native.requestPermission({ message: 'Wanna do great stuff', });
// assume the NativeExt extension is set up and the user grants permission right away

const file = await Native.do(async process => { // keep process alive until this function exits

	const fs = await process.require(require.resolve('/fs.node.js'));
	const file = await fs.readFile(somePath, 'utf-8');

	fs.watch(someOtherPath, { }, onChange); // can even send callbacks
	await waitSomeTime();
	fs.unwatch(onChange); // remove listener

	return file;
});

function onChange(type, name) {
	console.log('File', name, type +'d');
}
```
`/fs.node.js`:
```js
'use strict'; /* globals require, module, exports, process, Buffer, */

const { promisify, } = require('util'), promisifyAll = ...; // work with promises

const fs = promisifyAll(require('fs')); // any native module, 'ffi', 'browser' or any file included in the extension

// handle special case of `fs.watch`
const cb2watcher = new WeakSet, { watch, } = require('fs');
fs.watch = (path, options, callback) => {
	const watcher = watch(path, options, callback);
	cb2watcher.set(callback, watcher);
};
fs.unwatch = callback => {
	const watcher = cb2watcher.get(callback);
	watcher && watcher.close();
	cb2watcher.delete(callback);
};

module.exports = fs;
```


### Extension location

As NativeExt loads code from inside the extension package, it needs to locate the local extension installation.
Currently, the only supported location is in the `extensions/` (or `Extensions/`) folder in the profile, which is correct for normal extension installations.

The location of other extensions, especially unpacked ones during development, must be explicitly set under "External extensions" on the options page of the NativeExt extension for each profile.
An alternative workaround is to place a copy of the extension (in the browser specific format) in the correct location.


### Building

This project contains three sub-projects: the application itself, the extension that manages it, and the library for other extensions to work with the former two.

#### Building (application)

Building the NativeExt application requires node.js in the exact version listed in the `package.json`/`"scripts"`.`"build"` command (currently 8.3), npm and [node-gyp](https://github.com/nodejs/node-gyp#installation) including its dependencies.
After cloning or downloading the sources, step in the `application` directory and install the dependencies with:

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

Step in the `extension` directory, then install, link and build with `npm install`. Use `npm start` to re-build.


### Debugging

To be able to attach an inspector to the native process, install from sources and add `--node-options=--inspect` or `--node-options=--inspect-brk` as install argument. E.g.:

`node . install --node-options=--inspect-brk`.
