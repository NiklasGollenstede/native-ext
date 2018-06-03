(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Windows, },
	'node_modules/web-ext-utils/loader/views': Views,
}) => {

async function requestPermission({ id, message, }) {
	const { view, view: { document, }, windowId, } = (await Views.openView(
		// Views.getUrl({ name: 'prompt', }).replace('#', '?emulatePanel=true#'), 'popup',
		'prompt', /*'popup', //*/ 'panel',
		{ width: 435, height: 230, focused: true, useExisting: false, },
	));

	document.body.innerHTML = `<style>
		html { font-family: Segoe UI, Tahoma, sans-serif; font-size: 100%; overflow: hidden; }
		body>* { font-size: 120%; } /* chrome */
		body { background: #1c2227; } html, img { filter: invert(1) hue-rotate(180deg); }
		html { box-sizing: border-box; } * { box-sizing: inherit; }
		html { user-select: none; -moz-user-select: none; }
		body { margin: 0; } h3 { margin: 10px 0 5px 0; }
		#icon { float: left; padding: 10px; width: 84px; }
		#main { position: relative; margin-left: 78px; padding: 8px; }
		.id, #message { user-select: text; -moz-user-select: text; }
		#message { display: block; margin: .5em; padding: .5em 1em; background: #edf7ff; }
		#buttons { display: flex; width: 100%; } #buttons button { flex: 1; height: 40px; border: none; }
		#allow { color: #fff; background: #0996f8; } #allow:hover { background: #0675d3; } #allow:hover:active { background: #0568ba; }
		#deny  { color: #000; background: #e4e4e4; } #deny:hover  { background: #dfdfdf; } #deny:hover:active  { background: #dadada; }
	</style>
	<img id=icon src="/icon.svg">
	<div id=main>
		<h3>Allow <em class=id></em> to access your computer?</h3>
		<p>The extension <em class=id></em> has requested to use NativeExt.<br>
		Granting this request will give it <b>full access</b> to your computer, including all files of your user account.<p>
		<p>It claims it needs this for the following reason:</p>
		<quote id=message></quote>
	</div><div id=buttons>
		<button id=allow>Allow Full Access</button>
		<button id=deny>Not Now</button>
	</div>`;
	setTimeout(() => document.body.insertAdjacentHTML('beforeend', `<style> * { transition: background .16s linear; } </style>`), 16);

	document.querySelectorAll('.id').forEach(_=>(_.textContent = id));
	document.querySelector('#message').textContent = message;

	view.resize && view.resize();

	return new Promise((resolve, reject) => {
		listen(document.querySelector('#allow'), 'click', e => { if(!e.button) { resolve('allowed'); Windows.remove(windowId); } });
		listen(document.querySelector('#deny'), 'click', e => { if(!e.button) { resolve('denied'); Windows.remove(windowId); } });
		listen(view, 'unload', () => resolve('dismissed'));
		function listen(el, ev, lis) { el.addEventListener(
			ev, async e => { try { (await lis(e)); } catch (err) { reject(err); } }
		); }
	});
}

return { requestPermission, };

}); })(this);


