
## NativeExt — easy Native Messaging for WebExtensions

This package tries to solve a problem that arises with the deprecation of classical Add-Ons in Firefox.\
From Firefox version 57 onward (November 2017), Firefox will only support "WebExtensions", which are very similar to the extensions running in Chrome, other Chromium based browsers and even Microsoft Edge.\
While Firefox Add-Ons could previously dig very deep into the Firefox code, capable of changing nearly every aspect of the browser, and even do binary system calls, this is no longer possible with WebExtensions. They can only access normal web APIs (XHR, IndexedDB, ...) and a set of APIs in the `browser`/`chrome` namespace explicitly  designed for them. This means that browser extensions can now only do things that are, at least to a certain extend, intended by the browser vendors. Many innovative things that could previously be implemented in Firefox Add-Ons are no longer possible.\
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
	- since this software has no own functionality and the protocol is simple, no updates should be necessary
- The extension prompts the user to download and run a very short and simple script that registers the extension with this software
	- the script places a file with its extension IDs and a signing key in a predefined directory and calls a refresh script
	- writing the IDs is technically necessary and the signing is a security precaution
	- scripts are so generic that they can be generated automatically, users who don't trust the scripts can perform their actions manually in about 30 seconds
- The extension can now contact this software without further user interaction
	- it sends a signed node.js script that is executed and can respond to further messages
	- to update the "native application", it is enough to include a new signed script in the extension
	- this way, the versions of the extension and the native application always match

### Implementation status

Building, installation and connecting from Chrome and Firefox works on Windows.\
Mac and Linux support shouldn't be a problem, but isn't implemented.\
Signing is not implemented at all.

### API

The API is not finalized. Here is a rough outline of the semantics:

```js
const { connect, } = require('... native-ext ...');
const port = (await connect({
	script: (await (await fetch('./native.js')).text()),
	signature: 'base64 signed hash of script',
	// the browser implicitly sends the extensions ID
}));

const file = (await port.request('fs.readFile', somePath, 'utf8'));

port.post('fs.watch', somePath, onChange); // can even send callbacks
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
	port.removeHandler('fs.watch').addHandler('fs.watch', (path, callback) => {
		const watcher = fs.watch(path, { }, callback);
		ch2watcher.set(callback, watcher);
	}).addHandler('fs.unwatch', callback => {
		const watcher = ch2watcher.get(callback);
		watcher && watcher.close();
		ch2watcher.delete(callback);
	});
}

```
