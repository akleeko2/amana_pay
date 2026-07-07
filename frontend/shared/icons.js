/* =============================================================================
   Amana Pay — SVG Icon System (professional, stroke-based, no emojis)
   - يحقن الأيقونات في أي عنصر يحمل [data-icon="name"]
   - ويوفّر window.APIcon(name, size?) لإرجاع SVG كنص (للمحتوى الديناميكي)
   ============================================================================= */
(function () {
  'use strict';

  // مسارات على نمط Lucide (viewBox 24، stroke=currentColor)
  var P = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/>',
    swap: '<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>',
    percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="7" cy="7" r="2.2"/><circle cx="17" cy="17" r="2.2"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
    store: '<path d="M4 9l1.2-5h13.6L20 9"/><path d="M4 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 4 0"/><path d="M5 12v8h14v-8"/><path d="M9 20v-5h6v5"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.2-3.2 7.6-7.5 8.5-4.3-.9-7.5-4.3-7.5-8.5V6L12 3z"/>',
    shieldCheck: '<path d="M12 3l7.5 3v5.5c0 4.2-3.2 7.6-7.5 8.5-4.3-.9-7.5-4.3-7.5-8.5V6L12 3z"/><path d="M9 12l2 2 4-4"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.7-3.8 3.8-6 7.5-6s6.8 2.2 7.5 6"/>',
    wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17a2 2 0 0 1 2 2v.5"/><rect x="3" y="7.5" width="18" height="12" rx="2.5"/><path d="M16.5 13.5h2.5"/>',
    bank: '<path d="M3 21h18"/><path d="M12 3l9 5H3z"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><polyline points="16 9.5 11 15 8 12"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2.2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 1 0-7.1-7.1L11 5"/><path d="M14 11a5 5 0 0 0-7.1 0L4.5 13.4a5 5 0 1 0 7.1 7.1L13 19"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2.5"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.8 5.7 3.8 9S14.5 18.5 12 21C9.5 18.5 8.2 15.3 8.2 12S9.5 5.5 12 3z"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    arrowRight: '<line x1="4" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>',
    arrowLeft: '<line x1="20" y1="12" x2="5" y2="12"/><polyline points="11 6 5 12 11 18"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    trendingUp: '<polyline points="3 17 9.5 10.5 13.5 14.5 21 7"/><polyline points="15 7 21 7 21 13"/>',
    logout: '<path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/><polyline points="15 17 20 12 15 7"/><line x1="20" y1="12" x2="9" y2="12"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><line x1="10.5" y1="18.5" x2="13.5" y2="18.5"/>',
    receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    layers: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<polyline points="21 7 21 3 17 3"/><path d="M21 3l-5 5a7 7 0 1 0 2 5"/>',
    info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.6" fill="currentColor"/>',
  };

  function svg(name, size) {
    var p = P[name];
    if (!p) return '';
    var s = size || 24;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      if (el.dataset.iconDone) return;
      var html = svg(el.getAttribute('data-icon'), el.getAttribute('data-icon-size') ? +el.getAttribute('data-icon-size') : 24);
      if (html) { el.innerHTML = html; el.dataset.iconDone = '1'; }
    });
  }

  window.APIcon = svg;
  window.APIcons = { hydrate: hydrate };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { hydrate(); });
  else hydrate();
})();
