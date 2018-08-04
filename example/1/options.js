new Promise(done => (window.chrome || window.browser).runtime.getBackgroundPage(done))
.then(_=>_.initOptionsView(window)); // pass the UI view to the background page, see ./background.js
