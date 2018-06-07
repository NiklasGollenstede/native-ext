(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Runtime, Windows, isGecko, },
	'node_modules/web-ext-utils/loader/views': Views,
	'common/options': options,
}) => {

async function requestPermission({ id, message, }) {
	const { view, view: { document, }, windowId, } = (await Views.openView(
		'prompt', /*'popup', //*/ 'panel',
		{ width: 470, height: 230, focused: true, useExisting: false, },
	));

	document.body.innerHTML = `<style>
		html { font-family: Segoe UI, Tahoma, sans-serif; font-size: 100%; overflow: hidden; }
		body>* { font-size: 16px; } /* chrome has a rule on the body itself */
		body { background: #1c2227; } html, img { filter: invert(1) hue-rotate(180deg); }
		html { box-sizing: border-box; } * { box-sizing: inherit; }
		html { user-select: none; -moz-user-select: none; }
		body { margin: 0; } h3 { margin: 10px 0 5px 0; }
		#main, #warning { position: relative; padding: 8px 8px 8px 86px; }
		.icon { position: absolute; left: 0; padding: 10px; width: 84px; }
		.id, #message { user-select: text; -moz-user-select: text; }
		#message { display: block; white-space: pre-wrap; margin: .5em; padding: .5em 1em; background: #edf7ff; }
		#buttons { display: flex; width: 100%; } #buttons button { flex: 1; height: 56px; border: none; font-size: inherit; }
		#allow { color: #fff; background: #0996f8; } #allow:hover { background: #0675d3; } #allow:hover:active { background: #0568ba; }
		#deny  { color: #000; background: #e4e4e4; } #deny:hover  { background: #dfdfdf; } #deny:hover:active  { background: #dadada; }
		#warning { background: #ffb833; }
	</style>
	<div id=main>
		<img class=icon src="/icon.svg">
		<h3>Allow <em class=id></em> to access your computer?</h3>
		<p>The extension <span class=chrome>with the id </span><em class=id></em> has requested to use NativeExt.<br>
		Granting this request will give it <b>full access</b> to your computer, including all files of your user account.<p>
		<p>It claims it needs this for the following reason:</p>
		<quote id=message></quote>
	</div>
	<div id=buttons>
		<button id=allow>Allow Full Access</button>
		<button id=deny>Not Now</button>
	</div>
	<div id=warning style="display: none">
		<img class=icon src="/node_modules/web-ext-utils/utils/icons/error.svg" style="transform: scale(1.65); transform-origin: 95% 100%; filter: saturate(2);">
	</div>`;
	setTimeout(() => document.body.insertAdjacentHTML('beforeend', `<style> * { transition: background .16s linear; } </style>`), 16);

	!isGecko && (id = id.replace(/\w{4}/g, s => '\u00AD'+ s).slice(1));
	isGecko && document.querySelectorAll('.chrome').forEach(_=>(_.style.display = 'none'));
	document.querySelectorAll('.id').forEach(_=>(_.textContent = id));
	document.querySelector('#message').textContent = message;
	if (!options.config.children.name.value) {
		const warning = document.querySelector('#warning');
		warning.style.display = 'block';
		warning.insertAdjacentHTML('beforeend', `
			NativeExt's setup is not completed yet!<br>
			While you can grant the permission now, the extension won't be able to use NativeExt untill you completed the setup as described on <a href id=options>the options page</a>.
		`);
		warning.querySelector('#options').addEventListener('click',e => { if(!e.button) { Runtime.openOptionsPage(); e.preventDefault(); } });
	}

	view.resize && view.resize(); Windows.update(windowId, { focused: true, }); setTimeout(() => Windows.update(windowId, { focused: true, }), 300);
	document.querySelector('#allow').focus();
	document.addEventListener('keydown', e => e.code === 'Escape' && Windows.remove(windowId).catch(()=>0));

	return new Promise((resolve, reject) => {
		listen(document.querySelector('#allow'), 'click', e => { if(!e.button) { resolve('allowed'); Windows.remove(windowId).catch(()=>0); } });
		listen(document.querySelector('#deny'), 'click', e => { if(!e.button) { resolve('denied'); Windows.remove(windowId).catch(()=>0); } });
		listen(view, 'unload', () => { resolve('dismissed'); });
		function listen(el, ev, lis) { el.addEventListener(
			ev, async e => { try { (await lis(e)); } catch (err) { reject(err); } }
		); }
	});
}

return { requestPermission, };

}); })(this);


