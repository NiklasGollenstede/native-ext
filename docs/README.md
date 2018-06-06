
## NativeExt API documentation

There are two locations where NativeExt exposes APIs to the extensions.

### As library in the Browser

The [index.js](./browser.md) script can be required in the background script of a WebExtension and exposes functions to use a shared or launch individual native processes.

### In the node.js process

NativeExt executes the node.js modules provided by the extensions in a slightly [modified node.js environment](./node-env.md)
and additionally [exposes some modules](./modules.md) that can be `require()`d, esp. `ffi` is available.
