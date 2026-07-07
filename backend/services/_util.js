/**
 * Amana Pay — Shared service utilities
 */
'use strict';

/** تقريب لـ 3 منازل عشرية (الدينار الأردني = 1000 فلس). */
function round3(n) {
  return Number(Number(n).toFixed(3));
}

/** الوقت الحالي بالمللي ثانية. */
function nowMs() {
  return Date.now();
}

/** تحويل ISO/Date إلى مللي ثانية (آمن). */
function toMs(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** ISO timestamp الحالي. */
function nowIso() {
  return new Date().toISOString();
}

/** تحليل JSON بأمان مع قيمة افتراضية. */
function safeParse(json, fallback = null) {
  if (json == null) return fallback;
  if (typeof json !== 'string') return json;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

module.exports = { round3, nowMs, toMs, nowIso, safeParse };
