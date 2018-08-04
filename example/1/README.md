
# Example: file read and watch

This is a very basic example extension demonstrating how to use the NativeExt library in an extension.
it is intentionally minimal and uses only the bare minimum of code and modules necessary.
Error handling, notifications and setup instructions are not included.


## Usage

Install the NativeExt extension and add `@native-ext-example-1`: `<repo-root>/example/1` to the external extensions.\
Then run `npm install` in this folder and load it as unpacked extension.

Now visit its options page of `NativeExt - Example 1`.
Here you can set the path to an existing text file on your hard drive.
On `Start`, the extension will read and watch the file for changes.
Experiment with multiple tabs and killing the `native-ext`(`.exe`|`.bin`) process and watching from multiple tabs at once.
Since this example doesn't use `manager#on`, the processes won't restart (but their termination is handled).


## Packing

To pack the extension, the files in this folder and all used modules from `node_modules` must be packed.
To get those, use all functions of the extension and call `Obejct.keys(require.cache)` and `require('node_modules/native-ext/').do(_=>_.require('/utils.node.js').then(_=>_.getModules().then(_=>console.log(_))))` from the extension debuggers console.
