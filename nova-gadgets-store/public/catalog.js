/* Nova Gadgets — كتالوج الصفحة الرئيسية: جلب المنتجات، الفلاتر، وعرض البطاقات */
(function () {
  'use strict';

  const grid = document.getElementById('product-grid');
  const chipsWrap = document.getElementById('chips');
  if (!grid) return;

  const { api, money, imageSrc } = window.NGStore;

  let activeCategory = null;

  function starRow(rating) {
    return `<span class="icon" data-icon="star" data-icon-size="14"></span> ${rating.toFixed(1)}`;
  }

  function cardHtml(p) {
    return `
      <div class="card" data-slug="${p.slug}">
        <a href="/product.html?slug=${p.slug}" class="card-img-link">
          <div class="card-img">
            ${p.badge ? `<span class="card-badge">${p.badgeAr}</span>` : ''}
            <img src="${imageSrc(p.image)}" alt="${p.nameAr}" loading="lazy" />
          </div>
        </a>
        <div class="card-body">
          <a href="/product.html?slug=${p.slug}" class="card-img-link">
            <div class="card-cat">${p.categoryAr}</div>
            <div class="card-title">${p.nameAr}</div>
          </a>
          <div class="card-rating">${starRow(p.rating)} <span class="muted">(${p.reviews})</span></div>
          <div class="card-price">
            <span class="now num">${money(p.price)} JOD</span>
            ${p.oldPrice ? `<span class="old num">${money(p.oldPrice)}</span>` : ''}
          </div>
        </div>
        <div class="card-actions">
          <button class="add-btn" data-id="${p.id}" type="button">
            <span class="icon" data-icon="plus" data-icon-size="16"></span> أضف للسلة
          </button>
        </div>
      </div>`;
  }

  function render(products) {
    grid.innerHTML = products.map(cardHtml).join('') || '<p class="muted">لا توجد منتجات في هذا التصنيف.</p>';
    window.NGIcons.hydrate(grid);
    grid.querySelectorAll('.add-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.NGAddToCart(btn.getAttribute('data-id'), 1, btn);
      });
    });
  }

  function renderChips(categories) {
    const chips = [{ en: null, ar: 'الكل' }, ...categories];
    chipsWrap.innerHTML = chips.map((c) =>
      `<button class="chip ${c.en === activeCategory ? 'active' : ''}" data-cat="${c.en || ''}" type="button">${c.ar}</button>`
    ).join('');
    chipsWrap.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        activeCategory = chip.getAttribute('data-cat') || null;
        load();
      });
    });
  }

  async function load() {
    const qs = activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : '';
    const data = await api('GET', '/products' + qs);
    render(data.products);
    renderChips(data.categories);
  }

  load();
})();
