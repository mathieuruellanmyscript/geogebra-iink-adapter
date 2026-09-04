# Local input-method adapter host

Reference GeoGebra input-method adapter, wrapping MyScript iink-ts.
Lives outside the GeoGebra repo on purpose: GeoGebra only knows the
`window.GeoGebraInputMethods.register(...)` contract.

## Contents

| file | what |
|---|---|
| `myscript-iink-adapter.js` | the adapter — the only file GeoGebra loads |
| `iink.min.js` | iink-ts 4.1.0, loaded by the adapter, relative to its own URL |
| `serve.sh` | `python3 -m http.server 8090` over this directory |

Replace `iink.min.js` with any newer iink-ts release without touching GeoGebra.
4.x ships no `iink.css` — styles live in the bundle — and its entry point is
`iink.Canvas.load(element, 'INTERACTIVE_INK', options)`, so an upgrade across a
major version may need matching edits in `myscript-iink-adapter.js`.

## Run

```sh
./serve.sh
# -> http://localhost:8090/myscript-iink-adapter.js
```

Then point a GeoGebra applet at it:

```html
<div class="applet_container"
     data-param-appName="graphing"
     data-param-inputMethodUrl="http://localhost:8090/myscript-iink-adapter.js"
     data-param-showKeyboardOnFocus="true"
     data-param-width="800" data-param-height="600"></div>
<script src="https://www.geogebra.org/apps/deployggb.js"></script>
<script>GGBApplet({}, '5.0', 'applet_container').inject();</script>
```

To test against a locally built war instead, serve `source/web/web/war` and load
`.../web3d/web3d.nocache.js` the usual way, keeping the same
`data-param-inputMethodUrl`.

`test.html` in this directory does the above against a local war; edit the two
paths at the top if yours differ.

## First run

The keyboard's switcher shows a pencil button. Clicking it prompts for the two
settings the adapter declares (MyScript application key + HMAC key). They are
stored in this browser under `inputMethod.iink.*` and not asked again.

Clear them with:

```js
localStorage.removeItem('inputMethod.iink.applicationKey');
localStorage.removeItem('inputMethod.iink.hmacKey');
```

Note: the HMAC key is normally a server-side secret. Anyone with devtools access
to the page can read it back out of local storage and spend the account's quota.

## Serving from a different origin

`file://` will not work — `document.currentScript.src` needs a real URL.
Any other origin is fine as-is: classic script and stylesheet loads are not
CORS-checked. If you later switch the adapter to `fetch`/ES modules, the host
will need `Access-Control-Allow-Origin`.
