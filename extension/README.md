
# NativeExt -- Management extension

<!-- summary -->
The NativeExt extension manages access to the NativeExt application, which gives other browser extensions full access to your computer.<br>
NativeExt will explicitly ask you for every extension before granting it access to your system.<br>
To use NativeExt, you must <a download href="https://latest.native-ext.niklasg.de/download/${os}-${arch}/">download</a> and <b>install</b> the application, and then click the <b><code>Apply</code></b> button in the options.

## Description

NativeExt doesn't do anything on its own. It is a special module that extends the capabilities of other browser extensions.
It allows extensions that were explicitly allowed by the user to execute node.js JavaScript code on the computer, with the full access of the current user account.
While this is, from a security perspective, generally equivalent to installing a program on the computer, it is much easier to install and update for the user (once initially set up, allowing an extension requires only a single click, and updates are implicitly included with the extension itself) and easier to develop and maintain for the developers (write/bundle standard node.js modules and ship them with the extension; no platform specific installation or update code required).

For more information on what and why NativeExt is, see the <a href="https://github.com/NiklasGollenstede/native-ext#readme">project homepage</a>

<b>Permissions used</b>:<ul>
	<li> <b>Exchange messages with programs</b>: Manage and launch the extension process </li>
	<li> <b>Display notifications</b>: Inform about setup status and errors </li>
	<li> <b>Recently closed tabs</b>: Remove own popups from closed windows </li>
</ul>
