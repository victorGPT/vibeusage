'use strict';

function toBigInt(v) {
  if (typeof v === 'bigint') return v >= 0n ? v : 0n;
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return 0n;
    return BigInt(Math.floor(v));
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!/^[0-9]+$/.test(s)) return 0n;
    try {
      return BigInt(s);
    } catch (_e) {
      return 0n;
    }
  }
  return 0n;
}

function toPositiveIntOrNull(v) {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!/^[0-9]+$/.test(s)) return null;
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (typeof v === 'bigint') {
    if (v <= 0n) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function toPositiveInt(v) {
  const n = toPositiveIntOrNull(v);
  return n == null ? 0 : n;
}

module.exports = {
  toBigInt,
  toPositiveInt,
  toPositiveIntOrNull
};

