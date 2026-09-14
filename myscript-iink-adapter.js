/*
 * GeoGebra input method adapter for MyScript iink-ts.
 *
 * Ships and is versioned OUTSIDE the GeoGebra repository. GeoGebra loads it via
 *   <div data-param-inputMethodUrl="https://your.host/ggb-iink-adapter.js" ...>
 * and knows nothing about iink: everything MyScript-specific lives here.
 *
 * iink.min.js is fetched relative to this script's own URL.
 */
(function () {
  'use strict';

  var IINK_BASE = new URL('.', document.currentScript.src).href;
  var assets = null;

  // Fixed default keys, for this reference host. Public repo: rotate on abuse.
  var DEFAULT_APPLICATION_KEY = '2d9f86d7-d163-435e-bd0e-835d2b9716fb';
  var DEFAULT_HMAC_KEY = 'e2b8ce99-16d4-4dc5-a4dd-3319510ac87c';

  function loadAssets() {
    if (assets) {
      return assets;
    }
    assets = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = IINK_BASE + 'iink.min.js';
      script.onload = resolve;
      script.onerror = function () {
        assets = null;
        reject(new Error('failed to load iink.min.js'));
      };
      document.head.appendChild(script);
    });
    return assets;
  }

  function configuration(settings) {
    settings = settings || {};
    return {
      configuration: {
        server: {
          scheme: 'https',
          host: 'cloud.myscript.com',
          applicationKey: settings.applicationKey || DEFAULT_APPLICATION_KEY,
          hmacKey: settings.hmacKey || DEFAULT_HMAC_KEY
        },
        recognition: {
          'raw-content': {
            recognition: { types: ['math'] },
            classification: { types: ['math'] },
            gestures: ['scratch-out', 'strike-through']
          },
          gesture: { enable: true, ignoreGestureStrokes: false }
        },
        // strike-through erases the struck strokes (iink default is 'draw')
        gesture: { strikeThrough: 'erase' },
        // no toolbars at all: GeoGebra owns the UI, and convert is unwanted
        menu: { enable: false },
        // no solver: GeoGebra computes, iink only recognizes
        math: { computation: { autoCompute: false } }
      }
    };
  }

  // GeoGebra's algebra input parses bare {...} as a list, not a LaTeX group,
  // so "x^{2}" becomes x times the list {2}. Rewrite braced sub/superscripts
  // to GeoGebra's own syntax (parens) before handing the LaTeX to onResult.
  function toGeoGebraSyntax(latex) {
    var result = latex;
    var previous;
    // Braces can nest (e.g. "^{3^{3}}"), so re-run brace/command rewrites
    // until nothing changes: each pass only converts the innermost level.
    do {
      previous = result;
      // A single alphanumeric char needs no grouping: x^{2} -> x^2, not x^(2).
      result = result.replace(/([\^_])\{([^{}]*)\}/g, function (m, op, inner) {
        return /^[0-9a-zA-Z]$/.test(inner) ? op + inner : op + '(' + inner + ')';
      });
      result = result.replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)');
      result = result.replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
    } while (result !== previous);
    // \left( / \right) etc. are just sizing hints; GeoGebra wants plain delimiters.
    result = result.replace(/\\left|\\right/g, '');
    return result.replace(/\s+/g, '');
  }

  // INTERACTIVE_INK exports JIIX only; the LaTeX of a math block is its label.
  function latexFrom(exports) {
    var jiix = exports && exports['application/vnd.myscript.jiix'];
    var elements = (jiix && jiix.elements) || [];
    var parts = [];
    for (var i = 0; i < elements.length; i++) {
      if (elements[i].type === 'Math' && elements[i].label) {
        parts.push(elements[i].label);
      }
    }
    return parts.join(' ');
  }

  window.GeoGebraInputMethods.register({
    id: 'iink',
    label: 'MyScript handwriting',

    mount: function (element, context) {
      var canvas = null;

      element.addEventListener('exported', function (event) {
        var rawLatex = latexFrom(event.detail);
        var latex = toGeoGebraSyntax(rawLatex);
        console.log('[iink-adapter] latex -> ggb:', rawLatex, '->', latex);
        if (latex) {
          context.onResult(latex);
        }
      });

      loadAssets()
          .then(function () {
            return iink.Canvas.load(element, 'INTERACTIVE_INK',
                configuration(context.settings));
          })
          .then(function (loaded) {
            canvas = loaded;
          })
          .catch(function (error) {
            context.onError('iink-ts: ' + error);
          });

      return {
        clear: function () {
          if (canvas) {
            canvas.clear();
          }
        },
        resize: function () {
          if (canvas) {
            canvas.resize();
          }
        },
        destroy: function () {
          if (canvas) {
            canvas.destroy();
            canvas = null;
          }
        }
      };
    }
  });
})();
