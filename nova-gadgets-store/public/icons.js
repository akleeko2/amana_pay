/* Nova Gadgets — مكتبة أيقونات SVG صغيرة (بلا إيموجي) */
(function () {
  'use strict';
  var P = {
    cart: '<path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/>',
    star: '<polygon points="12 2 15 9 22 9.5 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.5 9 9"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><polyline points="16 9.5 11 15 8 12"/>',
    arrowLeft: '<line x1="20" y1="12" x2="5" y2="12"/><polyline points="11 6 5 12 11 18"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.2-3.2 7.6-7.5 8.5-4.3-.9-7.5-4.3-7.5-8.5V6L12 3z"/>',
    truck: '<rect x="1" y="7" width="13" height="10" rx="1.5"/><path d="M14 10h4l3 3v4h-7"/><circle cx="6" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>',
    headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="14" width="4" height="6" rx="1.5"/><rect x="17.5" y="14" width="4" height="6" rx="1.5"/>',
    watch: '<rect x="7.5" y="7.5" width="9" height="9" rx="2"/><path d="M9 7.5V4h6v3.5M9 16.5V20h6v-3.5"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    lamp: '<path d="M9 3h6l3 7H6l3-7z"/><path d="M12 10v6"/><path d="M8 21h8"/><path d="M9 21c0-2 1.3-3 3-3s3 1 3 3"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h1M10 10h1M14 10h1M18 10h1M6 14h12"/>',
    camera: '<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
    stand: '<path d="M6 3l12 4-4 12L6 15z"/><path d="M8 15l-2 6M14 17l2 4"/>',
    speaker: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><circle cx="12" cy="8" r="2.2"/><circle cx="12" cy="16" r="3"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><line x1="10.5" y1="18.5" x2="13.5" y2="18.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.6" fill="currentColor"/>',
    menu: '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
  };
  function svg(name, size) {
    var p = P[name]; if (!p) return '';
    var s = size || 22;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      el.innerHTML = svg(el.getAttribute('data-icon'), el.getAttribute('data-icon-size') ? +el.getAttribute('data-icon-size') : 22);
    });
  }
  window.NGIcon = svg;
  window.NGIcons = { hydrate: hydrate };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { hydrate(); });
  else hydrate();
})();
