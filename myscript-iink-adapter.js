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
    return {
      configuration: {
        server: {
          scheme: 'https',
          host: 'cloud.myscript.com',
          applicationKey: settings.applicationKey,
          hmacKey: settings.hmacKey
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
    settings: [
      { key: 'applicationKey', label: 'MyScript application key' },
      { key: 'hmacKey', label: 'MyScript HMAC key', secret: true }
    ],

    mount: function (element, context) {
      var canvas = null;

      element.addEventListener('exported', function (event) {
        var latex = latexFrom(event.detail);
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
