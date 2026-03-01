// LEXIUM Rebrand Patch v3 — Fix innerHTML SVG via DOMParser
// Corrección señalada: innerHTML en <div> para SVG puede fallar en algunos contextos.
// Solución: DOMParser + importNode (robusto en todos los navegadores modernos).

(function() {
  'use strict';

  // ── Helper: parsea SVG string y devuelve elemento SVGElement seguro ──
  function parseSVG(svgString) {
    var parser = new window.DOMParser();
    var doc = parser.parseFromString(svgString, 'image/svg+xml');
    var err = doc.querySelector('parsererror');
    if (err) {
      console.warn('[LEXIUM] SVG parse error:', err.textContent);
      return null;
    }
    return document.importNode(doc.documentElement, true);
  }

  function applyLEXIUMRebrand() {

    // ── 1. DOCUMENT TITLE ────────────────────────────────────────────
    document.title = 'LEXIUM | Gestión Legal Inteligente';

    // ── 2. REPLACE TEXT NODES "AppBogado" → "LEXIUM" ────────────────
    function replaceText(node) {
      if (node.nodeType === 3) {
        if (node.nodeValue && node.nodeValue.indexOf('AppBogado') !== -1) {
          node.nodeValue = node.nodeValue.split('AppBogado').join('LEXIUM');
        }
      } else if (node.nodeType === 1 &&
                 node.tagName !== 'SCRIPT' &&
                 node.tagName !== 'STYLE') {
        var children = Array.prototype.slice.call(node.childNodes);
        for (var i = 0; i < children.length; i++) {
          replaceText(children[i]);
        }
      }
    }
    replaceText(document.body);

    // ── 3. ALT ATTRIBUTES ───────────────────────────────────────────
    var imgs = document.querySelectorAll('[alt="AppBogado"]');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].setAttribute('alt', 'LEXIUM');
    }

    // ── 4. SVG STRINGS ──────────────────────────────────────────────
    var SVG_SIDEBAR = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">',
      '<defs>',
      '<linearGradient id="lxg1" x1="0%" y1="0%" x2="100%" y2="100%">',
      '<stop offset="0%" stop-color="#06b6d4"/>',
      '<stop offset="100%" stop-color="#0e7490"/>',
      '</linearGradient>',
      '</defs>',
      '<path d="M22 3L6 10v11c0 10 7 18.5 16 21 9-2.5 16-11 16-21V10z"',
      ' fill="rgba(6,182,212,0.07)" stroke="url(#lxg1)" stroke-width="1.8" stroke-linejoin="round"/>',
      '<circle cx="14" cy="18" r="1.4" fill="#06b6d4" opacity="0.8"/>',
      '<circle cx="22" cy="14" r="1.6" fill="#06b6d4"/>',
      '<circle cx="30" cy="18" r="1.4" fill="#06b6d4" opacity="0.8"/>',
      '<circle cx="18" cy="26" r="1.3" fill="#06b6d4" opacity="0.7"/>',
      '<circle cx="26" cy="26" r="1.3" fill="#06b6d4" opacity="0.7"/>',
      '<line x1="14" y1="18" x2="22" y2="14" stroke="#06b6d4" stroke-width="0.8" opacity="0.5"/>',
      '<line x1="22" y1="14" x2="30" y2="18" stroke="#06b6d4" stroke-width="0.8" opacity="0.5"/>',
      '<line x1="14" y1="18" x2="18" y2="26" stroke="#06b6d4" stroke-width="0.8" opacity="0.5"/>',
      '<line x1="30" y1="18" x2="26" y2="26" stroke="#06b6d4" stroke-width="0.8" opacity="0.5"/>',
      '<line x1="18" y1="26" x2="26" y2="26" stroke="#06b6d4" stroke-width="0.8" opacity="0.5"/>',
      '<line x1="22" y1="16" x2="22" y2="30" stroke="#06b6d4" stroke-width="1.2" opacity="0.85"/>',
      '<line x1="15" y1="20" x2="29" y2="20" stroke="#06b6d4" stroke-width="1.2" opacity="0.85"/>',
      '<path d="M12.5 23.5 Q15 21.5 17.5 23.5" fill="none" stroke="#06b6d4" stroke-width="1" opacity="0.85"/>',
      '<path d="M24.5 23.5 Q27 21.5 29.5 23.5" fill="none" stroke="#06b6d4" stroke-width="1" opacity="0.85"/>',
      '</svg>'
    ].join('');

    var SVG_LOGIN = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">',
      '<defs>',
      '<linearGradient id="lxg2" x1="0%" y1="0%" x2="100%" y2="100%">',
      '<stop offset="0%" stop-color="#22d3ee"/>',
      '<stop offset="100%" stop-color="#0891b2"/>',
      '</linearGradient>',
      '<filter id="lxglow">',
      '<feGaussianBlur stdDeviation="2" result="b"/>',
      '<feComposite in="SourceGraphic" in2="b" operator="over"/>',
      '</filter>',
      '</defs>',
      '<path d="M30 4L8 13v15c0 14 9.5 25.5 22 29 12.5-3.5 22-15 22-29V13z"',
      ' fill="rgba(6,182,212,0.09)" stroke="url(#lxg2)" stroke-width="2"',
      ' stroke-linejoin="round" filter="url(#lxglow)"/>',
      '<path d="M30 11L13 18v11c0 11 7.5 20 17 22.5 9.5-2.5 17-11.5 17-22.5V18z"',
      ' fill="rgba(6,182,212,0.04)" stroke="rgba(34,211,238,0.25)" stroke-width="0.8"/>',
      '<circle cx="19" cy="26" r="2" fill="#22d3ee" opacity="0.85"/>',
      '<circle cx="30" cy="20" r="2.4" fill="#22d3ee"/>',
      '<circle cx="41" cy="26" r="2" fill="#22d3ee" opacity="0.85"/>',
      '<circle cx="24" cy="37" r="1.8" fill="#22d3ee" opacity="0.75"/>',
      '<circle cx="36" cy="37" r="1.8" fill="#22d3ee" opacity="0.75"/>',
      '<line x1="19" y1="26" x2="30" y2="20" stroke="#22d3ee" stroke-width="1" opacity="0.5"/>',
      '<line x1="30" y1="20" x2="41" y2="26" stroke="#22d3ee" stroke-width="1" opacity="0.5"/>',
      '<line x1="19" y1="26" x2="24" y2="37" stroke="#22d3ee" stroke-width="1" opacity="0.5"/>',
      '<line x1="41" y1="26" x2="36" y2="37" stroke="#22d3ee" stroke-width="1" opacity="0.5"/>',
      '<line x1="24" y1="37" x2="36" y2="37" stroke="#22d3ee" stroke-width="1" opacity="0.5"/>',
      '<line x1="30" y1="22" x2="30" y2="42" stroke="#22d3ee" stroke-width="1.6" opacity="0.9"/>',
      '<line x1="20" y1="29" x2="40" y2="29" stroke="#22d3ee" stroke-width="1.6" opacity="0.9"/>',
      '<path d="M17 34 Q20 31 23 34" fill="none" stroke="#22d3ee" stroke-width="1.4" opacity="0.9"/>',
      '<path d="M37 34 Q40 31 43 34" fill="none" stroke="#22d3ee" stroke-width="1.4" opacity="0.9"/>',
      '</svg>'
    ].join('');

    // ── 5. REPLACE LOGOS via DOMParser + importNode ─────────────────
    // Corrección del bug señalado: no usar innerHTML para SVG.
    // DOMParser con 'image/svg+xml' + importNode es la forma correcta y robusta.

    var sideImg = document.querySelector('#side .logo .logo-img');
    if (sideImg) {
      var svgSide = parseSVG(SVG_SIDEBAR);
      if (svgSide) {
        svgSide.style.cssText = 'display:block;flex-shrink:0;';
        sideImg.parentNode.replaceChild(svgSide, sideImg);
      }
    }

    var loginImg = document.querySelector('.login-left-logo img');
    if (loginImg) {
      var svgLogin = parseSVG(SVG_LOGIN);
      if (svgLogin) {
        svgLogin.style.cssText = 'display:block;flex-shrink:0;';
        loginImg.parentNode.replaceChild(svgLogin, loginImg);
      }
    }

    // ── 6. Z-INDEX FIX — corrige superposición de texto sobre canvas ─
    if (!document.getElementById('lexium-patch-css')) {
      var css = document.createElement('style');
      css.id = 'lexium-patch-css';
      css.textContent =
        '#login-canvas{position:absolute!important;z-index:0!important;pointer-events:none!important;}' +
        '.login-left-hero,.login-left-logo,.login-left-content,' +
        '.login-left-footer,.login-left-pillars{position:relative!important;z-index:10!important;}' +
        '.logo-name{letter-spacing:0.13em!important;font-weight:800!important;}' +
        '.login-left-logo-name{letter-spacing:0.16em!important;font-weight:800!important;}';
      document.head.appendChild(css);
    }

    console.log('[LEXIUM] Rebrand v3 aplicado — DOMParser fix.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLEXIUMRebrand);
  } else {
    applyLEXIUMRebrand();
  }

})();
