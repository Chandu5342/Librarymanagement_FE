export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function createAccessionNumber(books) {
  const highest = books.reduce((max, book) => {
    const number = Number(String(book.accessionNumber || '').replace(/\D/g, ''))
    return Number.isFinite(number) ? Math.max(max, number) : max
  }, 900)
  return `ACC-${String(highest + 1).padStart(6, '0')}`
}

export function generateRFID(books) {
  const used = new Set(books.map((book) => book.rfidId).filter(Boolean))
  let uid
  do {
    uid = `RFID-IND-2026-${String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0')}`
  } while (used.has(uid))
  return uid
}
