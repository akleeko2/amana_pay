/* Nova Gadgets — صفحة تفاصيل المنتج */
(function () {
  'use strict';

  const root = document.getElementById('pd-root');
  if (!root) return;

  const { api, money, imageSrc } = window.NGStore;

  function starRow(rating, reviews) {
    return `<span class="icon" data-icon="star" data-icon-size="15"></span> ${rating.toFixed(1)} <span class="muted">(${reviews} تقييم)</span>`;
  }

  function render(p) {
    root.innerHTML = `
      <div class="pd-wrap">
        <div class="pd-image">
          <img src="${imageSrc(p.image)}" alt="${p.nameAr}" loading="lazy" />
        </div>
        <div class="pd-info">
          <div class="card-cat">${p.categoryAr}</div>
          <h1>${p.nameAr}</h1>
          <div class="card-rating">${starRow(p.rating, p.reviews)}</div>
          <div class="pd-price-row">
            <span class="now num">${money(p.price)} JOD</span>
            ${p.oldPrice ? `<span class="old num">${money(p.oldPrice)}</span>` : ''}
          </div>
          <p class="pd-desc">${p.description}</p>
          <div class="pd-qty">
            <div class="qty-ctrl" id="pd-qty-ctrl" style="background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:4px 10px">
              <button data-act="dec" type="button">−</button>
              <span id="pd-qty">1</span>
              <button data-act="inc" type="button">+</button>
            </div>
          </div>
          <button class="btn btn-brand" id="pd-add-btn" type="button" style="width:100%;max-width:320px">
            <span class="icon" data-icon="cart" data-icon-size="18"></span> أضف للسلة
          </button>
        </div>
      </div>`;
    window.NGIcons.hydrate(root);

    let qty = 1;
    const qtyEl = document.getElementById('pd-qty');
    document.getElementById('pd-qty-ctrl').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      qty = btn.getAttribute('data-act') === 'inc' ? qty + 1 : Math.max(1, qty - 1);
      qtyEl.textContent = qty;
    });
    document.getElementById('pd-add-btn').addEventListener('click', (btnEvt) => {
      window.NGAddToCart(p.id, qty, btnEvt.currentTarget);
    });

    document.title = `${p.nameAr} — Nova Gadgets`;
  }

  async function load() {
    const slug = new URLSearchParams(location.search).get('slug');
    if (!slug) {
      root.innerHTML = '<p class="muted" style="padding:60px 0;text-align:center">منتج غير موجود.</p>';
      return;
    }
    try {
      const data = await api('GET', `/products/${slug}`);
      render(data.product);
    } catch {
      root.innerHTML = '<p class="muted" style="padding:60px 0;text-align:center">منتج غير موجود.</p>';
    }
  }

  load();
})();
