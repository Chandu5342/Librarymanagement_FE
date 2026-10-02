import { formatRFID, normalizeRFID } from './rfid.js'

export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function createAccessionNumber(books) {
  const highest = books.reduce((max, book) => {
    const number = Number(String(book.accessionNumber || '').split('-').at(-1))
    return Number.isFinite(number) ? Math.max(max, number) : max
  }, 900)
  return `ACC-${new Date().getFullYear()}-${String(highest + 1).padStart(5, '0')}`
}

export function generateRFID(books) {
  const used = new Set(books.map((book) => normalizeRFID(book.rfidId)).filter(Boolean))
  let sequence = 1
  while (used.has(sequence.toString(16).toUpperCase().padStart(8, '0'))) sequence += 1
  return formatRFID(sequence.toString(16).toUpperCase().padStart(8, '0'))
}

export function generateMemberRFID(members) {
  const used = new Set(members.map((member) => normalizeRFID(member.rfidCardId)).filter(Boolean))
  let sequence = 1
  while (used.has(sequence.toString(16).toUpperCase().padStart(8, '0'))) sequence += 1
  return formatRFID(sequence.toString(16).toUpperCase().padStart(8, '0'))
}
