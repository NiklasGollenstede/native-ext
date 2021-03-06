<b>NativeExt -- Management extension</b>

<!-- summary on AMO: -->

The NativeExt extension manages access to the NativeExt application, which gives other browser extensions full access to your computer.
NativeExt will explicitly ask you for every extension before granting it access to your system.

---

<!-- description on AMO: -->

To use NativeExt, you must download and install <a download href="https://github.com/NiklasGollenstede/native-ext#readme">its desktop application</a> as well. The extensions option page on <code>about:addons</code> will guide you through the process.


<b>Description</b>

NativeExt doesn't do anything on its own. It is a special module that extends the capabilities of other browser extensions. It allows extensions that were explicitly allowed by the user to execute node.js JavaScript code on the computer, with the full access of the current user account.
While this is, from a security perspective, generally equivalent to installing a program on the computer, it is much easier to install and update for the user (once initially set up, allowing an extension requires only a single click, and updates are implicitly included with the extension itself) and easier to develop and maintain for the developers (write/bundle standard node.js modules and ship them with the extension; no platform specific installation or update code required).

For more information on what and why NativeExt is, see the <a href="https://github.com/NiklasGollenstede/native-ext#readme">project homepage</a>.

<b>Permissions used</b>:<ul>
	<li> <b>Exchange messages with programs</b>: Manage and launch the extension process </li>
	<li> <b>Display notifications</b>: Inform about setup status, updates and errors </li>
	<li> <b>Recently closed tabs</b>: Remove own popups from recently closed windows </li>
	<li> <b>Access github.com and s3.amazonaws.com</b>: Download application updates </li>
</ul>
