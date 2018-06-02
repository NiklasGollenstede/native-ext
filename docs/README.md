
## NativeExt API documentation

There are two locations where NativeExt exposes APIs to the extensions.

### In the Browser

The [index.js](./browser.md) can be required in the background script of a WebExtension and exposes functions to start, use and kill the native process.
This is the only file in this project that should be included in the extension package. All other files are installed with the NativeExt application.

### In the node.js process

NativeExt executes the node.js modules provided by the extensions in a slightly [modified node.js environment](./node-env.md)
and additionally [exposes some modules](./modules.md) that can be `require()`d.
