CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  razorpay_payment_link_id TEXT NOT NULL,
  firebase_uid TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise IN (4900, 39900)),
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  status TEXT NOT NULL CHECK (status = 'paid'),
  paid_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_firebase_uid ON payments(firebase_uid);
CREATE TABLE IF NOT EXISTS subscriptions (
  firebase_uid TEXT PRIMARY KEY,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_payment_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
