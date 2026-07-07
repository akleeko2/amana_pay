-- =============================================================================
-- Amana Pay — Database Schema (SQLite / node:sqlite)
-- مطابق لمخطط implementation_plan.md مع امتداد customer_consents لإعادة الاستخدام.
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- التجار
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT,
    email TEXT UNIQUE NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    api_secret TEXT NOT NULL,
    -- معلومات الحساب البنكي (من Open Finance APIs)
    bank_name TEXT,
    bank_name_ar TEXT,
    bank_bic TEXT,
    cliq_alias TEXT,                      -- معرّف CliQ (خيار استنتاجي؛ المضمون IBAN/accountId)
    account_name TEXT,                    -- من IBAN Confirmation (accountOwner.name.enName)
    account_name_ar TEXT,                 -- من IBAN Confirmation (accountOwner.name.arName)
    iban TEXT,
    jopacc_account_id TEXT,
    account_type_code TEXT,               -- من Accounts API (accountType.code = CHK.BUS)
    account_holder_type TEXT,             -- individual / corporate
    -- حالة الحساب (IBAN Confirmation + Accounts + Balances)
    account_status TEXT DEFAULT 'active', -- active/inactive
    locked_for_credit INTEGER DEFAULT 0,  -- BOOLEAN: من IBAN Confirmation/Accounts
    last_known_balance REAL,              -- آخر رصيد معروف من Balances API
    last_balance_check TEXT,              -- وقت آخر فحص للرصيد (ISO)
    -- حالة Consent (موافقة التاجر على قراءة حسابه)
    consent_id TEXT,
    consent_status TEXT DEFAULT 'none',
    consent_expires_at TEXT,
    consent_permissions TEXT,
    -- الباقة (نموذج الربح): STARTER / GROWTH / ENTERPRISE
    plan TEXT DEFAULT 'GROWTH',
    -- عام
    webhook_url TEXT,
    webhook_secret TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_merchants_api_key ON merchants(api_key);
CREATE INDEX IF NOT EXISTS idx_merchants_cliq ON merchants(cliq_alias);

-- -----------------------------------------------------------------------------
-- موافقات العملاء (طويلة الأمد، قابلة لإعادة الاستخدام عبر كل المتاجر)
-- تدعم نموذج Express/Verified: مرتبطة بالعميل تجاه Amana Pay كـ TPP.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_consents (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,                  -- معرّف العميل الأساسي (CliQ Alias / phone)
    account_id TEXT,                      -- من Accounts API
    iban TEXT,                            -- IBAN العميل (لمطابقة debtorAccount)
    customer_name TEXT,                   -- من IBAN Confirmation
    bank_bic TEXT,
    permissions TEXT,                     -- JSON: AccountInfo/Balances/Transactions
    access_token TEXT,                    -- رمز وهمي (mock)
    status TEXT DEFAULT 'authorized',     -- pending/authorized/revoked/expired
    authorized_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,             -- صلاحية حتى 90 يوماً
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_consents_phone ON customer_consents(phone);
CREATE INDEX IF NOT EXISTS idx_consents_status ON customer_consents(status);

-- -----------------------------------------------------------------------------
-- طلبات الدفع
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_requests (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    order_id TEXT,
    -- المبالغ
    original_amount REAL NOT NULL,
    dynamic_amount REAL NOT NULL,
    currency TEXT DEFAULT 'JOD',
    estimated_fee REAL,                   -- رسوم متوقعة (Fees API: SST اليوم/CliQ لاحقاً)
    estimated_net REAL,                   -- الصافي المتوقع للتاجر
    -- المرجع والتعليمات
    reference TEXT UNIQUE NOT NULL,
    cliq_alias TEXT,
    bank_name TEXT,
    account_name TEXT,
    -- هوية العميل المتوقعة (Verified فقط؛ NULL في Express)
    expected_debtor_phone TEXT,
    expected_debtor_account_id TEXT,
    expected_debtor_iban TEXT,            -- معزِّز SENDER_IDENTITY (غيابه لا يمنع التأكيد)
    expected_debtor_name TEXT,
    payment_tier TEXT DEFAULT 'EXPRESS',  -- EXPRESS / VERIFIED
    -- التحقق قبل الدفع
    pre_check_status TEXT,                -- passed/failed (IBAN Confirmation)
    pre_check_locked_for_credit INTEGER,  -- BOOLEAN
    balance_before REAL,                  -- baseline رصيد التاجر (Balances API)
    balance_after REAL,
    -- الحالة
    status TEXT DEFAULT 'PENDING',
    -- المطابقة
    matched_transaction_id TEXT,
    confidence_score REAL,
    match_factors TEXT,                   -- JSON
    match_mode TEXT,                      -- BALANCE_ONLY / FULL
    apis_used TEXT,                       -- JSON
    -- نموذج الربح (SaaS + رسوم حركة)
    commission_amount REAL,               -- رسوم هذه الحركة: 0 ضمن السقف، أو overageFee فوقه
    is_free_tier INTEGER DEFAULT 0,       -- BOOLEAN: ضمن سقف الباقة المجاني
    -- الأوقات
    expires_at TEXT NOT NULL,
    confirmed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    customer_name TEXT,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_merchant ON payment_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payment_requests(reference);
CREATE INDEX IF NOT EXISTS idx_payments_dynamic_amount ON payment_requests(dynamic_amount);

-- -----------------------------------------------------------------------------
-- المعاملات (من Open Finance: Balance Change / Transactions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    bank_transaction_id TEXT,
    payment_request_id TEXT REFERENCES payment_requests(id),
    -- تفاصيل المعاملة
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'JOD',
    reference TEXT,
    transaction_type TEXT,                -- CliQ_CREDIT, TRANSFER_CREDIT
    status TEXT,                          -- completed, pending, failed
    -- المرسل (من debtorComplexType)
    debtor_name TEXT,
    debtor_iban TEXT,
    debtor_bank TEXT,
    -- المستقبل (من creditorComplexType)
    creditor_iban TEXT,
    creditor_name TEXT,
    -- المطابقة
    match_status TEXT DEFAULT 'UNMATCHED', -- MATCHED, UNMATCHED, REVIEW
    confidence_score REAL,
    match_factors TEXT,                    -- JSON
    detection_source TEXT,                 -- balances / transactions
    -- أوقات
    bank_timestamp TEXT,
    received_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tx_match_status ON transactions(match_status);

-- -----------------------------------------------------------------------------
-- Webhook Deliveries
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    payment_request_id TEXT,
    event_type TEXT NOT NULL,             -- payment.confirmed, payment.expired, payment.failed
    url TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending',        -- pending, sent, failed
    status_code INTEGER,
    attempts INTEGER DEFAULT 0,
    next_retry_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhook_deliveries(status);

-- -----------------------------------------------------------------------------
-- سجل التدقيق
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id TEXT,
    entity_type TEXT,                     -- payment, transaction, consent, merchant
    entity_id TEXT,
    action TEXT,                          -- created, updated, matched, confirmed, expired
    details TEXT,                         -- JSON
    jopacc_api_called TEXT,               -- أي API تم استدعاؤه
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
