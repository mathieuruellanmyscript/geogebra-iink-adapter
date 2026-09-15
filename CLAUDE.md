# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file browser adapter that lets a GeoGebra applet use MyScript iink-ts
as a handwriting input method. No build system, no package manager, no tests —
four hand-written files plus one vendored iink-ts asset (`iink.min.js`).

## Commands

```sh
./serve.sh   # python3 -m http.server 8090 over this directory
```

Dev key override: copy `.env.example` to `.env` (gitignored) and fill
`MYSCRIPT_APPLICATION_KEY` / `MYSCRIPT_HMAC_KEY`. `serve.sh` turns it into
`dev-keys.js` (gitignored, regenerated/removed on every run). The adapter loads
that file itself before `iink.min.js` — only when served from localhost, and a
404 is fine — then prefers `window.MYSCRIPT_DEV_KEYS` over its `DEFAULT_*`
constants (`context.settings` still wins over both). So any applet pointed at
the local adapter URL picks up the keys, not just `test.html`.

Then open `test.html` (needs a local GeoGebra war on :8080), or point any
applet at `http://localhost:8090/myscript-iink-adapter.js` via
`data-param-inputMethodUrl`. See README.md for the applet snippet.

After pushing to GitHub, purge the jsDelivr CDN cache so consumers pointed at
the `gh` CDN path pick up the change immediately:

```sh
curl https://purge.jsdelivr.net/gh/mathieuruellanmyscript/geogebra-iink-adapter@main/myscript-iink-adapter.js
```

Upgrading iink-ts = replacing `iink.min.js` and `iink.min.js.map` (from the same
npm `iink-ts` release, `dist/iink.min.js.map`); nothing else changes as long as
the API does not. Vendored version is **4.1.0** (iink-ts 4.x ships no `iink.css` —
styles are in the bundle). The 4.x entry point is
`iink.Canvas.load(element, 'INTERACTIVE_INK', options)`; 3.x used
`iink.Editor.load(element, 'INTERACTIVEINK', ...)` with a different config shape.
After an upgrade, check the bundle:
`grep -o "INTERACTIVE[_A-Z]*" iink.min.js`, and compare against the upstream
example
https://github.com/MyScript/iinkTS/blob/master/examples/interactive-canvas/interactive_canvas_math_computation_modes.html
(project: https://github.com/MyScript/iinkTS/).

## Architecture

The only contract with GeoGebra is `window.GeoGebraInputMethods.register(...)`.
GeoGebra loads this one script by URL and knows nothing about iink — that is why
the repo lives outside the GeoGebra tree. Keep MyScript-specific code here and
resist adding GeoGebra-side assumptions.

`myscript-iink-adapter.js` is an IIFE that:

1. Derives `IINK_BASE` from `document.currentScript.src`, so `iink.min.js` is
   always fetched relative to the adapter's own URL. This is why `file://` does
   not work.
2. Lazy-loads that script on first `mount` (memoized in `assets`; the promise
   is reset to `null` on error so a later mount can retry).
3. No `settings` declared, so GeoGebra never prompts. `applicationKey`/
   `hmacKey` are the hardcoded `DEFAULT_*` constants; `context.settings` (if
   GeoGebra ever passes one) can still override them.
4. Returns a `{ clear, resize, destroy }` handle from `mount`, each guarded
   because `canvas` is only assigned after the async `iink.Canvas.load` resolves.

Recognition path: the iink canvas emits an `exported` DOM event on the mount
element. `INTERACTIVE_INK` exports JIIX only (no `application/x-latex`, unlike
3.x `INTERACTIVEINKSSR`), so `latexFrom()` walks
`detail['application/vnd.myscript.jiix'].elements` and joins the `label` of each
`Math` element — that label is the LaTeX. Load failures go to `context.onError`.
Server config is `cloud.myscript.com`, raw-content recognition restricted to
`math`, `math.computation.autoCompute` off (GeoGebra does the computing),
`menu.enable` off (no iink toolbars — no convert button; GeoGebra owns the UI),
and two gestures: `scratch-out` (erase by scribbling) and `strike-through`,
the latter forced to `gesture.strikeThrough: 'erase'` since iink defaults it
to `draw`.

Written in ES5-style plain JS (`var`, `function`, no modules) so it can be
served as a classic script. Classic `<script>` loads are not
CORS-checked, which is what lets the stdlib http server suffice — switching to
`fetch` or ES modules would require CORS headers on the host.

`toGeoGebraSyntax()` fixes up the exported LaTeX before it reaches
`context.onResult`, since GeoGebra's algebra-input parser is not a LaTeX
parser and rejects/misreads plain LaTeX braces and sizing commands: braced
sub/superscripts (`^{..}`/`_{..}`) become `^(..)`/`_(..)`, `\sqrt{..}` becomes
`sqrt(..)`, `\frac{..}{..}`/`\dfrac{..}{..}` become `(..)/(..)`, and
`\left`/`\right` are stripped. Braces can nest (e.g. `^{3^{3}}`), so the
rewrite passes loop to a fixed point rather than running once. Any newly
observed bad conversion should be checked against the live GeoGebra algebra
input bar, not against `iink.min.js`'s JIIX renderer or GeoGebra's own
JLaTeXMath renderer (`Commands.java` upstream) — neither implements the
algebra-input parser's grammar.

## Known caveat

The HMAC key is normally a server-side secret. Here it is hardcoded in
`myscript-iink-adapter.js` as a default (settings can still override it) and
also sits in the browser's localStorage, readable via devtools. This repo is
public, so both keys are public too — acceptable only for this reference
host; rotate them if abused, never reuse for production.
