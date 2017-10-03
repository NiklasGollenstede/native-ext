
This is the API documentation of the [`/index.js`](..index.js) module. For a conceptual description of NativeExt, see the [`/README.md`](../README.md).

## Loading the module

```js
const Native = await require.async('node_modules/native-ext/');
```

The browser API of native-ext currently requires [`web-ext-utils`](https://github.com/NiklasGollenstede/web-ext-utils) as a peer-dependency.
At least the files
 * `node_modules/web-ext-utils/browser/index.js`
 * [`node_modules/web-ext-utils/lib/multiport/index.js`](https://github.com/NiklasGollenstede/multiport)
 * [`node_modules/web-ext-utils/lib/pbq/require.js`](https://github.com/NiklasGollenstede/pbq/blob/master/require.js)
 * `node_modules/web-ext-utils/utils/event.js`
must be loadable. The `require` above is the global value set by `pbq/require.js`.


# API

```js
async function require(path, { onDisconnect, } = { }) { return exports; }
/**
 * Requires a file included in the extension inside the NativeExt node.js process and returns a unique remote representation of its exports.
 * All require calls are directed at the same process, which is kept alive until all returned exports objects or functions are `unref()`ed.
 * @param  {string}    path                  Path to the node module file relative from the extension root. May omit the '.js' extension.
 * @param  {function}  options.onDisconnect  Optional. A callback (error?) => void that is called if the connection to the native process terminates
 *                                           before the exports value is `unref()`ed. Ignored if exports is not a object or function.
 * @return {object|function|any}             If the value exported by the required module is a primitive, then that primitive.
 *                                           If it is a function, then an asynchronous [mulitport/Port](https://github.com/NiklasGollenstede/multiport) callback wrapper of that function.
 *                                           Otherwise an object whose direct properties are remote callbacks if they were functions or JSON values otherwise.
 */
```

```
function unref(ref) { return unrefed; }
/**
 * Drops the reference a non-primitive value returned by `require()` holds on the remote process.
 * Once all references are dropped, that is,`unref()` was called (at least once) on any non-primitive returned by `require()`,
 * the remote process is terminated to free it's resources. All callbacks exchanged with the native process,
 * which don't hold references themselves, will stop working at that point.
 * @param  {object|function}  ref  A non-primitive value that was returned by `require()`.
 * @return {bool}                  `true` iff the reference count was actually decreased,
 *                                 `false` e.g. if `unref()` was called with the same value twice.
 */
```

```
/**
 * @type {runtime.Event} onUncaughtException
 * Event that is fired when `process.on('uncaughtException')` occurred. If this event is not handled
 * (i.e. not at least one listener is added and runs without throwing or rejecting), the native process exits,
 */
```

```
/**
 * @type {runtime.Event} onUnhandledRejection
 * Event that is fired when `process.on('unhandledRejection')` occurred. If this event is not handled
 * (i.e. not at least one listener is added and runs without throwing or rejecting), the native process exits,
 */
```

```
function nuke() { }
/**
 * Closes the port to the remote port and kills the native process, for example as a consequence of `onUncaughtException`.
 */
```
