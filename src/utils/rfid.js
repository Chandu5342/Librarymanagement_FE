export function normalizeRFID(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function formatRFID(value) {
  const normalized = normalizeRFID(value)
  if (/^[A-F0-9]{8}$/.test(normalized)) return normalized.match(/.{2}/g).join(' ')
  return normalized
}

export function isValidRFID(value, type) {
  const normalized = normalizeRFID(value)
  if (type === 'member') return /^[A-F0-9]{8}$/.test(normalized) || /^RFIDMEMBER\d{6}$/.test(normalized)
  if (type === 'book') return /^[A-F0-9]{8}$/.test(normalized) || /^RFIDBOOK[A-Z0-9]{6}$/.test(normalized)
  return /^[A-F0-9]{8}$/.test(normalized) || /^RFID(?:BOOK[A-Z0-9]{6}|MEMBER\d{6})$/.test(normalized)
}
