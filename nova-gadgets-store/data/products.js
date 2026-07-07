/**
 * Nova Gadgets — كتالوج المنتجات (بيانات ثابتة للعرض التوضيحي)
 */
'use strict';

const products = [
  {
    id: 'ng-001',
    slug: 'aero-wireless-earbuds',
    name: 'Aero Wireless Earbuds',
    nameAr: 'سماعة Aero اللاسلكية',
    category: 'Audio',
    categoryAr: 'صوتيات',
    price: 24.900,
    oldPrice: 32.000,
    rating: 4.7,
    reviews: 312,
    badge: 'Bestseller',
    badgeAr: 'الأكثر مبيعاً',
    image: 'audio-1',
    short: 'Active noise cancellation, 30-hour battery life.',
    shortAr: 'إلغاء ضوضاء نشط، وبطارية تدوم 30 ساعة.',
    description:
      'سماعة Aero اللاسلكية تمنحك صوتاً نقياً وعزلاً كاملاً عن الضوضاء المحيطة. مزوّدة ببطارية تدوم حتى 30 ساعة مع علبة الشحن، ومقاومة للماء والعرق (IPX5)، وتوصيل فوري عبر Bluetooth 5.3.',
  },
  {
    id: 'ng-002',
    slug: 'pulse-smartwatch',
    name: 'Pulse Smartwatch Pro',
    nameAr: 'ساعة Pulse الذكية Pro',
    category: 'Wearables',
    categoryAr: 'أجهزة قابلة للارتداء',
    price: 54.500,
    oldPrice: null,
    rating: 4.6,
    reviews: 189,
    badge: 'New',
    badgeAr: 'جديد',
    image: 'watch-1',
    short: 'Heart-rate, sleep tracking, and 7-day battery.',
    shortAr: 'قياس نبض، تتبّع نوم، وبطارية تدوم 7 أيام.',
    description:
      'ساعة Pulse Pro تراقب معدّل ضربات القلب ونومك ونشاطك اليومي بدقة عالية. شاشة AMOLED ساطعة، ومقاومة للماء حتى 50 متراً، وبطارية تدوم أسبوعاً كاملاً بشحنة واحدة.',
  },
  {
    id: 'ng-003',
    slug: 'volt-fast-charger-65w',
    name: 'Volt 65W Fast Charger',
    nameAr: 'شاحن Volt سريع 65 واط',
    category: 'Accessories',
    categoryAr: 'إكسسوارات',
    price: 12.750,
    oldPrice: 16.000,
    rating: 4.8,
    reviews: 540,
    badge: 'Sale',
    badgeAr: 'خصم',
    image: 'charger-1',
    short: 'GaN technology, charges 3 devices at once.',
    shortAr: 'تقنية GaN، يشحن 3 أجهزة بنفس الوقت.',
    description:
      'شاحن Volt بقوة 65 واط يعتمد تقنية GaN المتقدمة لشحن أسرع وحجم أصغر. ثلاث مخارج (USB-C × 2 و USB-A) لشحن اللابتوب والهاتف والسماعة معاً بأمان كامل.',
  },
  {
    id: 'ng-004',
    slug: 'lumen-desk-lamp',
    name: 'Lumen Smart Desk Lamp',
    nameAr: 'مصباح مكتب Lumen الذكي',
    category: 'Home',
    categoryAr: 'المنزل',
    price: 18.990,
    oldPrice: null,
    rating: 4.5,
    reviews: 98,
    badge: null,
    badgeAr: null,
    image: 'lamp-1',
    short: 'Touch dimming, 3 color modes, USB charging port.',
    shortAr: 'تعتيم باللمس، 3 أوضاع إضاءة، منفذ شحن USB.',
    description:
      'مصباح Lumen الذكي يوفّر إضاءة قابلة للتعديل بثلاث درجات حرارة لونية، مع تحكّم باللمس وذاكرة آخر إعداد. مزوّد بمنفذ USB لشحن هاتفك أثناء العمل أو القراءة.',
  },
  {
    id: 'ng-005',
    slug: 'shift-mechanical-keyboard',
    name: 'Shift Mechanical Keyboard',
    nameAr: 'لوحة مفاتيح Shift الميكانيكية',
    category: 'Computing',
    categoryAr: 'حوسبة',
    price: 39.000,
    oldPrice: 45.000,
    rating: 4.9,
    reviews: 421,
    badge: 'Bestseller',
    badgeAr: 'الأكثر مبيعاً',
    image: 'keyboard-1',
    short: 'Hot-swappable switches, RGB backlight, compact 75%.',
    shortAr: 'مفاتيح قابلة للتبديل، إضاءة RGB، تصميم مضغوط 75%.',
    description:
      'لوحة مفاتيح Shift الميكانيكية بتصميم 75% مضغوط، مع مفاتيح قابلة للتبديل السريع بدون لحام، وإضاءة RGB قابلة للتخصيص بالكامل. مثالية للألعاب والكتابة الطويلة.',
  },
  {
    id: 'ng-006',
    slug: 'orbit-webcam-4k',
    name: 'Orbit 4K Webcam',
    nameAr: 'كاميرا ويب Orbit 4K',
    category: 'Computing',
    categoryAr: 'حوسبة',
    price: 29.500,
    oldPrice: null,
    rating: 4.4,
    reviews: 76,
    badge: null,
    badgeAr: null,
    image: 'webcam-1',
    short: '4K resolution, auto-focus, built-in privacy shutter.',
    shortAr: 'دقة 4K، تركيز تلقائي، غطاء خصوصية مدمج.',
    description:
      'كاميرا Orbit توفّر جودة فيديو 4K واضحة لاجتماعاتك ومحتواك، مع تركيز تلقائي ذكي وغطاء خصوصية مدمج يغلق العدسة عند عدم الاستخدام. توصيل USB-C فوري بدون برامج إضافية.',
  },
  {
    id: 'ng-007',
    slug: 'drift-portable-speaker',
    name: 'Drift Portable Speaker',
    nameAr: 'مكبّر صوت Drift المحمول',
    category: 'Audio',
    categoryAr: 'صوتيات',
    price: 21.900,
    oldPrice: 26.000,
    rating: 4.6,
    reviews: 264,
    badge: 'Sale',
    badgeAr: 'خصم',
    image: 'speaker-1',
    short: 'Waterproof IPX7, 360° sound, 12-hour playtime.',
    shortAr: 'مقاوم للماء IPX7، صوت 360 درجة، تشغيل 12 ساعة.',
    description:
      'مكبّر صوت Drift المحمول يمنحك صوتاً محيطياً بزاوية 360 درجة، مع مقاومة كاملة للماء (IPX7) تجعله مثالياً للرحلات والمسبح. بطارية تدوم 12 ساعة متواصلة.',
  },
  {
    id: 'ng-008',
    slug: 'grip-phone-stand',
    name: 'Grip Adjustable Phone Stand',
    nameAr: 'حامل هاتف Grip القابل للتعديل',
    category: 'Accessories',
    categoryAr: 'إكسسوارات',
    price: 7.500,
    oldPrice: null,
    rating: 4.3,
    reviews: 152,
    badge: null,
    badgeAr: null,
    image: 'stand-1',
    short: 'Foldable, adjustable angle, works with all phones.',
    shortAr: 'قابل للطي، زاوية قابلة للتعديل، يناسب كل الهواتف.',
    description:
      'حامل Grip المعدني القابل للطي يثبّت هاتفك بأي زاوية تناسبك، مثالي لمشاهدة الفيديو أو مكالمات الفيديو أو الطبخ حسب وصفة. خفيف الوزن ويسهل حمله في الحقيبة.',
  },
];

function all() {
  return products;
}

function findById(id) {
  return products.find((p) => p.id === id);
}

function findBySlug(slug) {
  return products.find((p) => p.slug === slug);
}

function categories() {
  const seen = new Map();
  for (const p of products) {
    if (!seen.has(p.category)) seen.set(p.category, p.categoryAr);
  }
  return Array.from(seen, ([en, ar]) => ({ en, ar }));
}

module.exports = { all, findById, findBySlug, categories };
