/**
 * Amana Pay — Database Layer (node:sqlite)
 * -----------------------------------------------------------------------------
 * طبقة وصول رقيقة فوق SQLite المدمج في Node. توفّر:
 *  - اتصالاً مفرداً (singleton) + تشغيل schema.sql عند الإقلاع
 *  - دوال مساعدة: run / get / all / tx (معاملة)
 *  - دوال وصول أساسية للكيانات (تُستخدم في المراحل اللاحقة)
 *
 * يُشغَّل مباشرة لتهيئة القاعدة:  node database/db.js --init
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config/config');

let _db = null;

/** فتح الاتصال (مع إنشاء المجلد إن لزم) وتشغيل المخطط. */
function connect() {
  if (_db) return _db;

  const dir = path.dirname(config.database.file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new DatabaseSync(config.database.file);
  _db.exec('PRAGMA foreign_keys = ON;');
  initSchema(_db);
  return _db;
}

/** تشغيل ملف schema.sql (idempotent بفضل IF NOT EXISTS) + ترحيلات خفيفة. */
function initSchema(db = connect()) {
  const sql = fs.readFileSync(config.database.schemaFile, 'utf8');
  db.exec(sql);
  runMigrations(db);
  return db;
}

/**
 * ترحيلات خفيفة لإضافة أعمدة جديدة على قواعد قائمة (CREATE IF NOT EXISTS
 * لا يضيف أعمدة لجدول موجود). آمنة وتُشغَّل عند كل إقلاع.
 */
function runMigrations(db) {
  const columnMissing = (table, column) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    return !cols.some((c) => c.name === column);
  };
  // إضافة عمود الباقة للتجار القدامى (النموذج المالي المتدرّج)
  if (columnMissing('merchants', 'plan')) {
    db.exec("ALTER TABLE merchants ADD COLUMN plan TEXT DEFAULT 'GROWTH'");
  }
  // إضافة عمود رابط العودة للمتجر (لزر «عودة للمتجر» — يصمد عبر إعادة توجيه الموافقة)
  if (columnMissing('payment_requests', 'return_url')) {
    db.exec('ALTER TABLE payment_requests ADD COLUMN return_url TEXT');
  }
}

function db() {
  return _db || connect();
}

// -----------------------------------------------------------------------------
// مساعدات عامة
// -----------------------------------------------------------------------------

/** تنفيذ أمر كتابة (INSERT/UPDATE/DELETE). يُرجع { changes, lastInsertRowid }. */
function run(sql, params = []) {
  return db().prepare(sql).run(...normalize(params));
}

/** جلب صف واحد أو undefined. */
function get(sql, params = []) {
  return db().prepare(sql).get(...normalize(params));
}

/** جلب كل الصفوف كمصفوفة. */
function all(sql, params = []) {
  return db().prepare(sql).all(...normalize(params));
}

/** تنفيذ دالة داخل معاملة (transaction). يتراجع تلقائياً عند الخطأ. */
function tx(fn) {
  const d = db();
  d.exec('BEGIN');
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

/**
 * تطبيع المعاملات: node:sqlite يقبل فقط (null, number, bigint, string, Uint8Array).
 * نحوّل boolean → 0/1، undefined → null، والكائنات → JSON.
 */
function normalize(params) {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (p instanceof Date) return p.toISOString();
    if (typeof p === 'object' && !(p instanceof Uint8Array)) return JSON.stringify(p);
    return p;
  });
}

/** إدراج صف من كائن { column: value }. يُرجع نتيجة run. */
function insert(table, obj) {
  const cols = Object.keys(obj);
  const placeholders = cols.map(() => '?').join(',');
  return run(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, cols.map((c) => obj[c]));
}

/** تحديث صف بالمعرّف من كائن جزئي { column: value }. */
function updateById(table, id, partial) {
  const cols = Object.keys(partial);
  if (!cols.length) return { changes: 0 };
  const setClause = cols.map((c) => `${c} = ?`).join(', ');
  return run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...cols.map((c) => partial[c]), id]);
}

// -----------------------------------------------------------------------------
// دوال وصول أساسية (Repositories) — يُبنى عليها في المراحل 3+
// -----------------------------------------------------------------------------
const merchants = {
  findById: (id) => get('SELECT * FROM merchants WHERE id = ?', [id]),
  findByApiKey: (key) => get('SELECT * FROM merchants WHERE api_key = ?', [key]),
  findByEmail: (email) => get('SELECT * FROM merchants WHERE email = ?', [email]),
  all: () => all('SELECT * FROM merchants ORDER BY created_at DESC'),
};

const payments = {
  findById: (id) => get('SELECT * FROM payment_requests WHERE id = ?', [id]),
  findByReference: (ref) => get('SELECT * FROM payment_requests WHERE reference = ?', [ref]),
  listByMerchant: (mid) =>
    all('SELECT * FROM payment_requests WHERE merchant_id = ? ORDER BY created_at DESC', [mid]),
  listPending: () =>
    all("SELECT * FROM payment_requests WHERE status IN ('PENDING','PROCESSING')"),
  listExpired: () =>
    all("SELECT * FROM payment_requests WHERE status IN ('PENDING','PROCESSING') AND datetime(expires_at) < datetime('now')"),
};

const transactions = {
  findById: (id) => get('SELECT * FROM transactions WHERE id = ?', [id]),
  listByMerchant: (mid) =>
    all('SELECT * FROM transactions WHERE merchant_id = ? ORDER BY received_at DESC', [mid]),
};

const customerConsents = {
  findById: (id) => get('SELECT * FROM customer_consents WHERE id = ?', [id]),
  // موافقة سارية قابلة لإعادة الاستخدام لعميل معيّن (عبر كل المتاجر)
  findReusableByPhone: (phone) =>
    get(
      "SELECT * FROM customer_consents WHERE phone = ? AND status = 'authorized' " +
        "AND datetime(expires_at) > datetime('now') ORDER BY authorized_at DESC LIMIT 1",
      [phone]
    ),
};

const audit = {
  log: ({ merchantId = null, entityType, entityId, action, details = null, jopaccApi = null }) =>
    run(
      'INSERT INTO audit_log (merchant_id, entity_type, entity_id, action, details, jopacc_api_called) VALUES (?,?,?,?,?,?)',
      [merchantId, entityType, entityId, action, details, jopaccApi]
    ),
};

const webhooks = {
  findById: (id) => get('SELECT * FROM webhook_deliveries WHERE id = ?', [id]),
  listPending: () =>
    all("SELECT * FROM webhook_deliveries WHERE status = 'pending' OR status = 'failed' ORDER BY created_at ASC"),
};

/** إغلاق الاتصال (للاختبارات/الإيقاف النظيف). */
function close() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = {
  connect,
  initSchema,
  db,
  run,
  get,
  all,
  tx,
  insert,
  updateById,
  close,
  merchants,
  payments,
  transactions,
  customerConsents,
  audit,
  webhooks,
};

// تشغيل مباشر للتهيئة: node database/db.js --init
if (require.main === module && process.argv.includes('--init')) {
  connect();
  // eslint-disable-next-line no-console
  console.log('[amana-pay] Database initialized at:', config.database.file);
  close();
}
