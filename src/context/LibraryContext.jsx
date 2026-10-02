import { useCallback, useMemo, useRef, useState } from 'react'
import { createLibraryApi } from '../api/index.js'
import { createInitialState } from '../data/mockData.js'
import { createAccessionNumber, createId, generateRFID } from '../utils/idGenerator.js'
import { getRoleForAccount, hasPermission } from '../utils/permissions.js'
import { LibraryContext } from './LibraryContext.js'

const STORAGE_KEY = 'northbridge-library-state-v1'
const dateString = (date) => date.toISOString().slice(0, 10)
const isoNow = () => new Date().toISOString()
const getStored = () => {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current) {
      const parsed = JSON.parse(current)
      if (parsed?.books && parsed?.members && parsed?.settings) return parsed
    }
    const initial = createInitialState()
    const oldBooks = localStorage.getItem('library-demo-books')
    const oldMembers = localStorage.getItem('library-demo-members')
    const oldUser = localStorage.getItem('library-demo-user')
    if (oldBooks) initial.books = JSON.parse(oldBooks)
    if (oldMembers) initial.members = JSON.parse(oldMembers)
    if (oldUser) {
      const account = JSON.parse(oldUser)
      initial.currentUser = {
        ...account,
        id: account.role === 'Administrator' ? 'U-001' : account.role === 'Librarian' ? 'U-002' : 'U-005',
        role: getRoleForAccount(account.role),
        memberId: account.role === 'Student' ? 'M-1001' : account.role === 'Faculty' ? 'M-1005' : null,
      }
    }
    return initial
  } catch (error) {
    console.error('Unable to load saved library demo data; starting with the initial dataset.', error)
    return createInitialState()
  }
}

function addEvent(state, { action, description, entity, entityId, notification, category = 'Library' }) {
  const timestamp = isoNow()
  const userName = state.currentUser?.name || 'Demo user'
  const audit = {
    id: createId('AUD'), action, description, entity, entityId, user: userName, timestamp,
  }
  const next = {
    ...state,
    auditLogs: [audit, ...(state.auditLogs || [])],
  }
  if (notification) {
    next.notifications = [{
      id: createId('NOT'), title: notification, category, entity, entityId, read: false, createdAt: timestamp,
    }, ...(state.notifications || [])]
  }
  return next
}

function permission(state, name) {
  const role = getRoleForAccount(state.currentUser?.role)
  if (!hasPermission(role, name)) throw new Error('Access denied. Your role cannot perform this action.')
}

function resequenceReservations(reservations, bookId) {
  const orderedIds = reservations
    .filter((item) => item.bookId === bookId && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((item) => item.id)
  const positions = new Map(orderedIds.map((id, index) => [id, index + 1]))
  return reservations.map((item) => positions.has(item.id) ? { ...item, queuePosition: positions.get(item.id) } : item)
}

function ensureUniqueRFID(state, rfid, exceptId) {
  if (!rfid) return
  if (!/^RFID-[A-Z]{3}-\d{4}-\d{6}$/.test(rfid)) throw new Error('RFID must use the format RFID-IND-2026-000001.')
  const existing = state.books.find((book) => book.rfidId === rfid && book.id !== exceptId)
  if (existing) throw new Error(`RFID already assigned to ${existing.title} (${existing.accessionNumber}).`)
}

export function LibraryProvider({ children }) {
  const [state, setState] = useState(getStored)
  const stateRef = useRef(state)

  const commit = useCallback((transform) => {
    const next = transform(stateRef.current)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      console.error('Unable to persist library demo data.', error)
      throw new Error('The change could not be saved to this browser.', { cause: error })
    }
    stateRef.current = next
    setState(next)
    return next
  }, [])

  const actions = useMemo(() => {
    const read = (selector) => () => selector(state)
    const requireRecord = (list, id, label) => {
      const record = list.find((item) => item.id === id)
      if (!record) throw new Error(`${label} was not found.`)
      return record
    }
    const createBook = (input) => {
      permission(state, 'BOOK_CREATE')
      if (!input.title?.trim() || !input.author?.trim() || !input.category?.trim()) throw new Error('Title, author, and category are required.')
      if (input.isbn && !/^(?:\d{9}[\dX]|\d{13})$/.test(input.isbn.replace(/[- ]/g, ''))) throw new Error('Enter a valid 10- or 13-digit ISBN.')
      ensureUniqueRFID(state, input.rfidId)
      const timestamp = isoNow()
      const book = {
        ...input,
        id: createId('BK'),
        accessionNumber: createAccessionNumber(state.books),
        bookCode: createId('B'),
        rfidStatus: input.rfidId ? 'Active' : 'Pending',
        availabilityStatus: 'Available',
        condition: input.condition || 'Good',
        totalCopies: 1,
        availableCopies: 1,
        issuedCopies: 0,
        reservedCopies: 0,
        borrowerId: null,
        dueDate: null,
        createdAt: timestamp,
        archived: false,
      }
      commit((current) => {
        let next = addEvent({ ...current, books: [book, ...current.books] }, {
          action: 'BOOK_CREATED', description: `Registered ${book.title}.`, entity: 'book',
          entityId: book.id, notification: `New book registered: ${book.title}`, category: 'Catalog',
        })
        if (book.rfidId) next = { ...next, rfidLogs: [{ id: createId('RFLOG'), rfidId: book.rfidId, bookId: book.id, bookTitle: book.title, event: 'REGISTER', result: 'SUCCESS', device: 'Simulation Bridge', user: current.currentUser?.name || 'Demo user', location: book.location || 'Central Library', timestamp }, ...next.rfidLogs] }
        return next
      })
      return book
    }
    const updateBook = (id, changes) => {
      permission(state, 'BOOK_EDIT')
      const existing = requireRecord(state.books, id, 'Book')
      ensureUniqueRFID(state, changes.rfidId ?? existing.rfidId, id)
      const conditionChanged = changes.condition && changes.condition !== existing.condition
      if (conditionChanged && state.transactions.some((item) => item.bookId === id && item.status === 'Issued')) throw new Error('Book condition cannot be changed while it has an active loan.')
      const updated = {
        ...existing,
        ...changes,
        id,
        rfidStatus: (changes.rfidId ?? existing.rfidId) ? 'Active' : 'Pending',
        ...(conditionChanged ? {
          availabilityStatus: ['Lost', 'Damaged'].includes(changes.condition) ? changes.condition : 'Available',
          availableCopies: ['Lost', 'Damaged'].includes(changes.condition) ? 0 : 1,
        } : {}),
        updatedAt: isoNow(),
      }
      commit((current) => addEvent({ ...current, books: current.books.map((book) => book.id === id ? updated : book) }, {
        action: 'BOOK_UPDATED', description: `Updated ${updated.title}.`, entity: 'book', entityId: id,
        notification: `Book updated: ${updated.title}`, category: 'Catalog',
      }))
      if (updated.rfidId && updated.rfidId !== existing.rfidId) {
        commit((current) => addEvent({
          ...current,
          rfidLogs: [{ id: createId('RFLOG'), rfidId: updated.rfidId, bookId: id, bookTitle: updated.title, event: 'REGISTER', result: 'SUCCESS', device: 'Simulation Bridge', user: current.currentUser?.name || 'Demo user', location: updated.location || 'Central Library', timestamp: isoNow() }, ...current.rfidLogs],
        }, { action: 'RFID_REGISTERED', description: `Registered RFID ${updated.rfidId} to ${updated.title}.`, entity: 'book', entityId: id, notification: `RFID tag registered successfully for ${updated.title}.`, category: 'RFID' }))
      }
      return updated
    }
    const archiveBook = (id) => {
      permission(state, 'BOOK_DELETE')
      const book = requireRecord(state.books, id, 'Book')
      const active = state.transactions.some((item) => item.bookId === id && item.status === 'Issued')
      if (active) throw new Error('This book cannot be archived while it has an active loan.')
      commit((current) => addEvent({ ...current, books: current.books.map((item) => item.id === id ? { ...item, archived: true, archivedAt: isoNow() } : item) }, {
        action: 'BOOK_ARCHIVED', description: `Archived ${book.title}.`, entity: 'book', entityId: id,
        notification: `${book.title} was archived.`, category: 'Catalog',
      }))
      return true
    }
    const createMember = (input) => {
      permission(state, 'MEMBER_CREATE')
      if (!input.name?.trim() || !input.studentId?.trim() || !input.email?.trim()) throw new Error('Name, student ID, and email are required.')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Enter a valid email address.')
      if (state.members.some((member) => member.studentId.toLowerCase() === input.studentId.toLowerCase())) throw new Error('That student ID is already registered.')
      if (input.rfidCardId && state.members.some((member) => member.rfidCardId === input.rfidCardId)) throw new Error('That member RFID card is already assigned.')
      const member = { ...input, id: createId('M'), libraryId: input.libraryId || createId('LIB'), status: input.status || 'Active', borrowedBooks: 0, fineAmount: 0, createdAt: isoNow(), archived: false }
      commit((current) => addEvent({ ...current, members: [member, ...current.members] }, {
        action: 'MEMBER_CREATED', description: `Registered member ${member.name}.`, entity: 'member',
        entityId: member.id, notification: `New library member registered: ${member.name}`, category: 'Members',
      }))
      return member
    }
    const updateMember = (id, changes) => {
      permission(state, 'MEMBER_EDIT')
      const member = requireRecord(state.members, id, 'Member')
      if (changes.studentId && state.members.some((item) => item.id !== id && item.studentId.toLowerCase() === changes.studentId.toLowerCase())) throw new Error('That student ID is already registered.')
      const updated = { ...member, ...changes, id, updatedAt: isoNow() }
      commit((current) => addEvent({ ...current, members: current.members.map((item) => item.id === id ? updated : item) }, {
        action: 'MEMBER_UPDATED', description: `Updated member ${updated.name}.`, entity: 'member', entityId: id,
      }))
      return updated
    }
    const archiveMember = (id) => {
      permission(state, 'MEMBER_DELETE')
      const member = requireRecord(state.members, id, 'Member')
      if (state.transactions.some((item) => item.memberId === id && item.status === 'Issued')) throw new Error('This member cannot be archived while they have active loans.')
      commit((current) => addEvent({ ...current, members: current.members.map((item) => item.id === id ? { ...item, archived: true, status: 'Inactive' } : item) }, {
        action: 'MEMBER_ARCHIVED', description: `Archived member ${member.name}.`, entity: 'member', entityId: id,
      }))
      return true
    }
    const issueBook = ({ bookId, memberId }) => {
      permission(state, 'ISSUE_BOOK')
      const book = requireRecord(state.books, bookId, 'Book')
      const member = requireRecord(state.members, memberId, 'Member')
      if (member.status !== 'Active') throw new Error('This member account is not active.')
      const readyHold = state.reservations.find((item) => item.bookId === bookId && item.status === 'READY_FOR_PICKUP')
      const heldForMember = readyHold?.memberId === memberId
      if (book.archived || (book.availabilityStatus !== 'Available' && !(book.availabilityStatus === 'Reserved' && heldForMember))) throw new Error('This book is not available for checkout.')
      const activeLoans = state.transactions.filter((item) => item.memberId === memberId && item.status === 'Issued').length
      if (activeLoans >= state.settings.borrowingLimit) throw new Error(`Borrowing limit reached (${state.settings.borrowingLimit} active loans).`)
      if (member.fineAmount >= state.settings.blockingFineAmount) throw new Error('Outstanding fines exceed the circulation limit.')
      if (readyHold && !heldForMember) throw new Error('This book is held for another member.')
      const timestamp = isoNow()
      const dueDate = dateString(new Date(Date.now() + state.settings.loanPeriodDays * 86400000))
      const transaction = { id: createId('TR'), bookId, bookTitle: book.title, memberId, memberName: member.name, rfidId: book.rfidId, issueDate: dateString(new Date()), dueDate, returnedDate: null, status: 'Issued', fine: 0, renewalCount: 0, createdAt: timestamp }
      commit((current) => {
        const next = {
          ...current,
          books: current.books.map((item) => item.id === bookId ? { ...item, availabilityStatus: 'Issued', availableCopies: Math.max(0, (item.availableCopies || 1) - 1), issuedCopies: (item.issuedCopies || 0) + 1, reservedCopies: Math.max(0, (item.reservedCopies || 0) - (heldForMember ? 1 : 0)), borrowerId: memberId, dueDate } : item),
          members: current.members.map((item) => item.id === memberId ? { ...item, borrowedBooks: (item.borrowedBooks || 0) + 1 } : item),
          transactions: [transaction, ...current.transactions],
          reservations: heldForMember ? resequenceReservations(current.reservations.map((item) => item.id === readyHold.id ? { ...item, status: 'FULFILLED', fulfilledAt: timestamp } : item), bookId) : current.reservations,
        }
        return addEvent(next, { action: 'BOOK_ISSUED', description: `${book.title} issued to ${member.name}.`, entity: 'book', entityId: bookId, notification: `${book.title} issued to ${member.name}.`, category: 'Circulation' })
      })
      return transaction
    }
    const returnBook = ({ bookId, rfidId } = {}) => {
      permission(state, 'RETURN_BOOK')
      const book = bookId ? requireRecord(state.books, bookId, 'Book') : state.books.find((item) => item.rfidId === rfidId)
      if (!book) throw new Error('No book matches that RFID.')
      const transaction = state.transactions.find((item) => item.bookId === book.id && item.status === 'Issued')
      if (!transaction) throw new Error('This book has no active circulation record.')
      const returnedAt = new Date()
      const overdueDays = Math.max(0, Math.ceil((returnedAt - new Date(`${transaction.dueDate}T23:59:59`)) / 86400000))
      const fineAmount = overdueDays * state.settings.finePerDay
      const timestamp = isoNow()
      const fine = fineAmount ? { id: createId('FINE'), transactionId: transaction.id, memberId: transaction.memberId, memberName: transaction.memberName, bookId: book.id, bookTitle: book.title, dueDate: transaction.dueDate, returnedDate: dateString(returnedAt), daysLate: overdueDays, amount: fineAmount, status: 'PENDING', createdAt: timestamp } : null
      commit((current) => {
        let reservations = current.reservations
        const nextHold = reservations.filter((item) => item.bookId === book.id && item.status === 'PENDING').sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
        if (nextHold) reservations = reservations.map((item) => item.id === nextHold.id ? { ...item, status: 'READY_FOR_PICKUP', expiresAt: dateString(new Date(Date.now() + 2 * 86400000)) } : item)
        let next = {
          ...current,
          books: current.books.map((item) => item.id === book.id ? { ...item, availabilityStatus: nextHold ? 'Reserved' : 'Available', availableCopies: (item.availableCopies || 0) + (nextHold ? 0 : 1), issuedCopies: Math.max(0, (item.issuedCopies || 1) - 1), borrowerId: null, dueDate: null } : item),
          members: current.members.map((item) => item.id === transaction.memberId ? { ...item, borrowedBooks: Math.max(0, (item.borrowedBooks || 1) - 1), fineAmount: (item.fineAmount || 0) + fineAmount } : item),
          transactions: current.transactions.map((item) => item.id === transaction.id ? { ...item, status: 'Returned', returnedDate: dateString(returnedAt), fine: fineAmount } : item),
          reservations,
          fines: fine ? [fine, ...current.fines] : current.fines,
          rfidLogs: [{ id: createId('RFLOG'), rfidId: book.rfidId, bookId: book.id, bookTitle: book.title, event: 'RETURN', result: 'SUCCESS', device: 'Simulation Bridge', user: current.currentUser?.name || 'Demo user', location: book.location, timestamp }, ...current.rfidLogs],
        }
        next = addEvent(next, { action: 'BOOK_RETURNED', description: `${book.title} returned${fineAmount ? `; fine ${fineAmount}` : ''}.`, entity: 'book', entityId: book.id, notification: `${book.title} returned successfully.${fineAmount ? ` Fine due: ₹${fineAmount}.` : ''}`, category: 'Circulation' })
        if (nextHold) next = addEvent(next, { action: 'RESERVATION_READY', description: `${book.title} is ready for ${nextHold.memberName}.`, entity: 'reservation', entityId: nextHold.id, notification: `${book.title} is ready for pickup.`, category: 'Reservations' })
        return next
      })
      return { transaction, fine, overdueDays }
    }
    const renewBook = ({ bookId, memberId }) => {
      permission(state, 'RENEW_BOOK')
      const transaction = state.transactions.find((item) => item.bookId === bookId && item.memberId === memberId && item.status === 'Issued')
      if (!transaction) throw new Error('No active loan for this member and book.')
      const role = getRoleForAccount(state.currentUser?.role)
      if (['STUDENT', 'FACULTY'].includes(role) && memberId !== state.currentUser?.memberId) throw new Error('You can only renew your own loans.')
      const member = requireRecord(state.members, memberId, 'Member')
      if (member.status !== 'Active') throw new Error('Inactive members cannot renew loans.')
      if (transaction.renewalCount >= state.settings.renewalLimit) throw new Error('Renewal limit reached.')
      if (state.reservations.some((item) => item.bookId === bookId && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status))) throw new Error('This book has a reservation queue and cannot be renewed.')
      const dueDate = dateString(new Date(Date.now() + state.settings.loanPeriodDays * 86400000))
      commit((current) => addEvent({
        ...current,
        transactions: current.transactions.map((item) => item.id === transaction.id ? { ...item, dueDate, renewalCount: item.renewalCount + 1 } : item),
        books: current.books.map((item) => item.id === bookId ? { ...item, dueDate } : item),
      }, { action: 'BOOK_RENEWED', description: `Renewed ${transaction.bookTitle} for ${member.name}.`, entity: 'book', entityId: bookId, notification: `${transaction.bookTitle} renewed until ${dueDate}.`, category: 'Circulation' }))
      return dueDate
    }
    const createReservation = ({ bookId, memberId }) => {
      permission(state, 'RESERVATION_CREATE')
      const book = requireRecord(state.books, bookId, 'Book')
      const member = requireRecord(state.members, memberId, 'Member')
      const role = getRoleForAccount(state.currentUser?.role)
      if (['STUDENT', 'FACULTY'].includes(role) && memberId !== state.currentUser?.memberId) throw new Error('You can only reserve books for your own account.')
      if (book.archived || ['Lost', 'Damaged'].includes(book.condition)) throw new Error('Lost, damaged, or archived books cannot be reserved.')
      if (member.status !== 'Active') throw new Error('Inactive members cannot place reservations.')
      if (state.reservations.some((item) => item.bookId === bookId && item.memberId === memberId && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status))) throw new Error('You already have an active reservation for this book.')
      const queuePosition = state.reservations.filter((item) => item.bookId === bookId && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)).length + 1
      const reservation = { id: createId('RES'), bookId, bookTitle: book.title, memberId, memberName: member.name, createdAt: isoNow(), queuePosition, status: 'PENDING', expiresAt: null }
      commit((current) => addEvent({ ...current, reservations: [reservation, ...current.reservations], books: current.books.map((item) => item.id === bookId ? { ...item, reservedCopies: (item.reservedCopies || 0) + 1 } : item) }, {
        action: 'RESERVATION_CREATED', description: `${member.name} reserved ${book.title} (queue ${queuePosition}).`, entity: 'reservation', entityId: reservation.id,
        notification: `Reservation placed for ${book.title}.`, category: 'Reservations',
      }))
      return reservation
    }
    const cancelReservation = (id) => {
      const reservation = requireRecord(state.reservations, id, 'Reservation')
      if (!['PENDING', 'READY_FOR_PICKUP'].includes(reservation.status)) throw new Error('Only pending or ready reservations can be cancelled.')
      const role = getRoleForAccount(state.currentUser?.role)
      if (role === 'STUDENT' || role === 'FACULTY') {
        if (reservation.memberId !== state.currentUser?.memberId) throw new Error('You can only cancel your own reservations.')
      } else permission(state, 'RESERVATION_MANAGE')
      const wasReady = reservation.status === 'READY_FOR_PICKUP'
      const anotherReadyHold = state.reservations.some((item) => item.id !== id && item.bookId === reservation.bookId && item.status === 'READY_FOR_PICKUP')
      const nextPending = wasReady && !anotherReadyHold
        ? state.reservations.filter((item) => item.id !== id && item.bookId === reservation.bookId && item.status === 'PENDING').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0]
        : null
      commit((current) => addEvent({
        ...current,
        reservations: resequenceReservations(current.reservations.map((item) => {
          if (item.id === id) return { ...item, status: 'CANCELLED', cancelledAt: isoNow() }
          if (nextPending && item.id === nextPending.id) return { ...item, status: 'READY_FOR_PICKUP', expiresAt: dateString(new Date(Date.now() + 2 * 86400000)) }
          return item
        }), reservation.bookId),
        books: current.books.map((item) => item.id === reservation.bookId ? {
          ...item,
          reservedCopies: Math.max(0, (item.reservedCopies || 0) - 1),
          ...(wasReady && !anotherReadyHold && !nextPending ? { availabilityStatus: 'Available', availableCopies: (item.availableCopies || 0) + 1 } : {}),
        } : item),
      }, { action: 'RESERVATION_CANCELLED', description: `Cancelled reservation for ${reservation.bookTitle}.`, entity: 'reservation', entityId: id }))
      if (nextPending) {
        commit((current) => addEvent(current, {
          action: 'RESERVATION_READY',
          description: `${reservation.bookTitle} moved to the next member in the hold queue.`,
          entity: 'reservation',
          entityId: nextPending.id,
          notification: `${reservation.bookTitle} is ready for ${nextPending.memberName}.`,
          category: 'Reservations',
        }))
      }
      return true
    }
    const fulfillReservation = (id) => {
      permission(state, 'RESERVATION_MANAGE')
      const reservation = requireRecord(state.reservations, id, 'Reservation')
      if (reservation.status !== 'READY_FOR_PICKUP') throw new Error('Only a reservation ready for pickup can be fulfilled.')
      issueBook({ bookId: reservation.bookId, memberId: reservation.memberId })
      commit((current) => addEvent(current, {
        action: 'RESERVATION_FULFILLED', description: `Fulfilled hold for ${reservation.bookTitle}.`, entity: 'reservation', entityId: id,
        notification: `Reservation fulfilled for ${reservation.bookTitle}.`, category: 'Reservations',
      }))
      return true
    }
    const approveReservation = (id) => {
      permission(state, 'RESERVATION_MANAGE')
      const reservation = requireRecord(state.reservations, id, 'Reservation')
      if (reservation.status !== 'PENDING') throw new Error('Only pending reservations can be approved.')
      const book = requireRecord(state.books, reservation.bookId, 'Book')
      const approved = book.availabilityStatus === 'Available' && !state.reservations.some((item) => item.bookId === book.id && item.status === 'READY_FOR_PICKUP')
      commit((current) => addEvent({
        ...current,
        reservations: resequenceReservations(current.reservations.map((item) => item.id === id ? { ...item, status: approved ? 'READY_FOR_PICKUP' : 'PENDING', approvedAt: isoNow(), expiresAt: approved ? dateString(new Date(Date.now() + 2 * 86400000)) : null } : item), reservation.bookId),
        books: approved ? current.books.map((item) => item.id === book.id ? { ...item, availabilityStatus: 'Reserved', availableCopies: Math.max(0, item.availableCopies - 1) } : item) : current.books,
      }, { action: 'RESERVATION_APPROVED', description: `${reservation.bookTitle} reservation reviewed.`, entity: 'reservation', entityId: id, notification: approved ? `${reservation.bookTitle} is ready for pickup.` : `Reservation for ${reservation.bookTitle} remains in the queue.`, category: 'Reservations' }))
      return approved
    }
    const settleFine = (id, status, reason = '') => {
      permission(state, status === 'PAID' ? 'FINE_PAY' : 'FINE_WAIVE')
      const fine = requireRecord(state.fines, id, 'Fine')
      if (fine.status !== 'PENDING') throw new Error(`Only pending fines can be ${status.toLowerCase()}.`)
      commit((current) => addEvent({
        ...current,
        fines: current.fines.map((item) => item.id === id ? { ...item, status, settledAt: isoNow(), settledBy: current.currentUser?.name, reason } : item),
        members: current.members.map((item) => item.id === fine.memberId ? { ...item, fineAmount: Math.max(0, (item.fineAmount || 0) - fine.amount) } : item),
      }, { action: status === 'PAID' ? 'FINE_PAID' : 'FINE_WAIVED', description: `${status === 'PAID' ? 'Paid' : `Waived (${reason || 'no reason provided'})`} fine ₹${fine.amount} for ${fine.memberName}.`, entity: 'fine', entityId: id, notification: `Fine ${status === 'PAID' ? 'payment recorded' : 'waived'} for ${fine.bookTitle}.`, category: 'Fines' }))
      return true
    }
    const reverseFinePayment = (id, reason = '') => {
      permission(state, 'FINE_PAY')
      const fine = requireRecord(state.fines, id, 'Fine')
      if (fine.status !== 'PAID') throw new Error('Only paid fines can be reversed.')
      commit((current) => addEvent({
        ...current,
        fines: current.fines.map((item) => item.id === id ? { ...item, status: 'PENDING', reversedAt: isoNow(), reversalReason: reason } : item),
        members: current.members.map((item) => item.id === fine.memberId ? { ...item, fineAmount: (item.fineAmount || 0) + fine.amount } : item),
      }, { action: 'FINE_PAYMENT_REVERSED', description: `Reversed ₹${fine.amount} fine payment for ${fine.memberName}: ${reason || 'no reason provided'}.`, entity: 'fine', entityId: id }))
      return true
    }
    const scanRFID = (rfid, options = {}) => {
      permission(state, 'RFID_SCAN')
      if (!state.settings.simulationMode) throw new Error('RFID simulation is disabled; physical reader integration is not available in this prototype.')
      const uid = String(rfid || '').trim().toUpperCase()
      if (!uid) throw new Error('Enter an RFID tag UID to scan.')
      if (!/^RFID-[A-Z]{3}-\d{4}-\d{6}$/.test(uid)) throw new Error('RFID UID format is invalid.')
      const book = state.books.find((item) => item.rfidId === uid)
      const timestamp = isoNow()
      const duplicate = state.settings.duplicateScanPrevention && state.lastRFIDScan?.rfidId === uid && Date.now() - new Date(state.lastRFIDScan.timestamp).getTime() < 1500
      if (duplicate) return book || null
      const log = { id: createId('RFLOG'), rfidId: uid, bookId: book?.id || null, bookTitle: book?.title || 'Unknown RFID', event: options.event || 'LOOKUP', result: book ? 'SUCCESS' : 'NOT_FOUND', device: 'Simulation Bridge', user: state.currentUser?.name || 'Demo user', location: options.location || 'Central Library', timestamp }
      commit((current) => addEvent({
        ...current,
        lastRFIDScan: { rfidId: uid, bookId: book?.id || null, title: book?.title || null, timestamp },
        rfidLogs: [log, ...current.rfidLogs],
        rfidDevices: current.rfidDevices.map((device, index) => index === 0 ? { ...device, totalScans: device.totalScans + 1, status: 'CONNECTED', lastHeartbeat: timestamp } : device),
      }, { action: 'RFID_SCANNED', description: `Scanned RFID ${uid}${book ? ` (${book.title})` : ' (not found)'}.`, entity: 'book', entityId: book?.id || uid, notification: book ? `RFID tag scanned: ${book.title}` : null, category: 'RFID' }))
      return book || null
    }
    const registerRFID = (bookId, rfid) => {
      permission(state, 'RFID_REGISTER')
      const book = requireRecord(state.books, bookId, 'Book')
      ensureUniqueRFID(state, rfid, bookId)
      if (!rfid) throw new Error('Scan or enter an RFID UID before assigning it.')
      const updated = { ...book, rfidId: rfid.toUpperCase(), rfidStatus: 'Active', updatedAt: isoNow() }
      commit((current) => addEvent({ ...current, books: current.books.map((item) => item.id === bookId ? updated : item), rfidLogs: [{ id: createId('RFLOG'), rfidId: rfid, bookId, bookTitle: book.title, event: 'REGISTER', result: 'SUCCESS', device: 'Simulation Bridge', user: current.currentUser?.name || 'Demo user', location: book.location, timestamp: isoNow() }, ...current.rfidLogs] }, {
        action: 'RFID_REGISTERED', description: `Registered RFID ${rfid} to ${book.title}.`, entity: 'book', entityId: bookId,
        notification: `RFID tag registered successfully for ${book.title}.`, category: 'RFID',
      }))
      return updated
    }
    const markCondition = (id, condition) => {
      permission(state, 'INVENTORY_VIEW')
      const book = requireRecord(state.books, id, 'Book')
      if (state.transactions.some((item) => item.bookId === id && item.status === 'Issued')) throw new Error('Book condition cannot be changed while it has an active loan.')
      commit((current) => addEvent({
        ...current,
        books: current.books.map((item) => item.id === id ? { ...item, condition, availabilityStatus: condition === 'Lost' ? 'Lost' : condition === 'Damaged' ? 'Damaged' : 'Available', availableCopies: condition === 'Good' ? Math.max(1, item.availableCopies || 0) : 0 } : item),
        inventoryAudits: condition === 'Good' ? current.inventoryAudits.map((audit) => {
          const missing = (audit.missing || []).some((item) => item.id === id)
          return {
            ...audit,
            missing: (audit.missing || []).filter((item) => item.id !== id),
            found: audit.found + (missing ? 1 : 0),
            scannedRFIDs: book.rfidId ? [...new Set([...(audit.scannedRFIDs || []), book.rfidId])] : audit.scannedRFIDs,
          }
        }) : current.inventoryAudits,
      }, {
        action: `BOOK_MARKED_${condition.toUpperCase()}`, description: `${book.title} marked ${condition.toLowerCase()}.`, entity: 'book', entityId: id,
        notification: `${book.title} marked ${condition.toLowerCase()}.`, category: 'Inventory',
      }))
      return true
    }
    const changeBookLocation = (id, location) => {
      permission(state, 'INVENTORY_VIEW')
      if (!location?.trim()) throw new Error('Enter a valid shelf location.')
      const book = requireRecord(state.books, id, 'Book')
      commit((current) => addEvent({
        ...current,
        books: current.books.map((item) => item.id === id ? { ...item, location, updatedAt: isoNow() } : item),
        inventoryAudits: current.inventoryAudits.map((audit) => ({
          ...audit,
          misplaced: (audit.misplaced || []).filter((item) => item.id !== id),
          missing: (audit.missing || []).filter((item) => item.id !== id),
        })),
      }, {
        action: 'BOOK_LOCATION_CHANGED', description: `Moved ${book.title} to ${location}.`, entity: 'book', entityId: id,
      }))
      return true
    }
    const createAcquisition = (input) => {
      permission(state, 'ACQUISITION_MANAGE')
      if (!input.vendor?.trim() || !input.title?.trim() || Number(input.quantity) < 1 || Number(input.unitPrice) < 0) throw new Error('Vendor, title, positive quantity, and non-negative unit price are required.')
      const acquisition = { ...input, id: createId('PO'), quantity: Number(input.quantity), unitPrice: Number(input.unitPrice), total: Number(input.quantity) * Number(input.unitPrice), receivedQuantity: 0, status: 'REQUESTED', createdAt: isoNow() }
      commit((current) => addEvent({ ...current, acquisitions: [acquisition, ...current.acquisitions] }, {
        action: 'ACQUISITION_CREATED', description: `Created purchase request for ${acquisition.quantity} × ${acquisition.title}.`, entity: 'acquisition', entityId: acquisition.id,
        notification: `Acquisition request created: ${acquisition.title}`, category: 'Acquisitions',
      }))
      return acquisition
    }
    const receiveAcquisition = (id, quantity) => {
      permission(state, 'ACQUISITION_MANAGE')
      const order = requireRecord(state.acquisitions, id, 'Acquisition')
      const received = Number(quantity || order.quantity)
      if (received < 1 || received + (order.receivedQuantity || 0) > order.quantity) throw new Error('Received quantity must be positive and cannot exceed the remaining ordered quantity.')
      let accessionSeed = state.books
      const copies = Array.from({ length: received }, (_, index) => {
        const nextAcc = createAccessionNumber(accessionSeed)
        accessionSeed = [...accessionSeed, { accessionNumber: nextAcc }]
        return { id: createId('BK'), accessionNumber: nextAcc, bookCode: createId('B'), title: order.title, author: order.author || 'To be catalogued', isbn: order.isbn || '', publisher: order.vendor, category: order.category || 'General Knowledge', department: order.department || 'General', language: 'English', publicationYear: new Date().getFullYear(), edition: 1, pages: 0, format: 'Paperback', description: `Received from acquisition ${order.id}.`, rfidId: null, rfidStatus: 'Pending', availabilityStatus: 'Available', condition: 'New', shelf: '', rack: '', floor: '', location: 'Acquisitions / Uncatalogued', totalCopies: 1, availableCopies: 1, issuedCopies: 0, reservedCopies: 0, price: order.unitPrice, acquisitionDate: dateString(new Date()), borrowerId: null, dueDate: null, createdAt: isoNow(), acquisitionId: id, copyNumber: (order.receivedQuantity || 0) + index + 1, archived: false }
      })
      const receivedTotal = (order.receivedQuantity || 0) + received
      const status = receivedTotal === order.quantity ? 'RECEIVED' : 'PARTIALLY_RECEIVED'
      commit((current) => addEvent({
        ...current,
        books: [...copies, ...current.books],
        acquisitions: current.acquisitions.map((item) => item.id === id ? { ...item, receivedQuantity: receivedTotal, status, receivedAt: isoNow() } : item),
      }, { action: 'ACQUISITION_RECEIVED', description: `Received ${received} copy/copies of ${order.title}.`, entity: 'acquisition', entityId: id, notification: `Received ${received} copy/copies of ${order.title}; RFID tagging pending.`, category: 'Acquisitions' }))
      return copies
    }
    const cancelAcquisition = (id) => {
      permission(state, 'ACQUISITION_MANAGE')
      const acquisition = requireRecord(state.acquisitions, id, 'Acquisition')
      commit((current) => addEvent({ ...current, acquisitions: current.acquisitions.map((item) => item.id === id ? { ...item, status: 'CANCELLED', cancelledAt: isoNow() } : item) }, {
        action: 'ACQUISITION_CANCELLED', description: `Cancelled acquisition ${acquisition.id} for ${acquisition.title}.`, entity: 'acquisition', entityId: id,
      }))
      return true
    }
    const updateAcquisition = (id, changes) => {
      permission(state, 'ACQUISITION_MANAGE')
      const acquisition = requireRecord(state.acquisitions, id, 'Acquisition')
      if (['RECEIVED', 'CANCELLED'].includes(acquisition.status)) throw new Error('Received or cancelled acquisition orders cannot be edited.')
      const updated = { ...acquisition, ...changes, quantity: Number(changes.quantity ?? acquisition.quantity), unitPrice: Number(changes.unitPrice ?? acquisition.unitPrice), updatedAt: isoNow() }
      if (updated.quantity < (updated.receivedQuantity || 0) || updated.quantity < 1 || updated.unitPrice < 0) throw new Error('Quantity must be positive and not below the number of copies already received.')
      updated.total = updated.quantity * updated.unitPrice
      commit((current) => addEvent({ ...current, acquisitions: current.acquisitions.map((item) => item.id === id ? updated : item) }, {
        action: 'ACQUISITION_UPDATED', description: `Updated acquisition ${updated.id} for ${updated.title}.`, entity: 'acquisition', entityId: id,
      }))
      return updated
    }
    const createAudit = (filters = {}) => {
      permission(state, 'INVENTORY_AUDIT')
      const expected = state.books.filter((book) => !book.archived && (!filters.location || book.location === filters.location))
      const scanned = expected.filter((book, index) => index % 13 !== 0)
      const misplaced = state.books.filter((book) => !book.archived && filters.location && book.location !== filters.location && book.rfidId).slice(0, 1).map((book) => ({ ...book, detectedLocation: filters.location }))
      const audit = { id: createId('AUDIT'), ...filters, startedAt: isoNow(), completedAt: isoNow(), expected: expected.length, found: scanned.length, missing: expected.filter((book) => !scanned.includes(book)), unexpected: [], misplaced, scannedRFIDs: [...scanned, ...misplaced].map((book) => book.rfidId) }
      commit((current) => addEvent({ ...current, inventoryAudits: [audit, ...current.inventoryAudits] }, {
        action: 'INVENTORY_AUDIT_COMPLETED', description: `RFID shelf audit completed: ${audit.found}/${audit.expected} found.`, entity: 'inventoryAudit', entityId: audit.id,
        notification: `Inventory audit completed: ${audit.missing.length} items need review.`, category: 'Inventory',
      }))
      return audit
    }
    const updateSettings = (changes) => {
      permission(state, 'SETTINGS_MANAGE')
      const nextSettings = { ...state.settings, ...changes }
      for (const key of ['loanPeriodDays', 'finePerDay', 'borrowingLimit', 'renewalLimit']) {
        if (Number(nextSettings[key]) < 0 || !Number.isFinite(Number(nextSettings[key]))) throw new Error(`${key} must be a non-negative number.`)
      }
      commit((current) => addEvent({ ...current, settings: nextSettings }, {
        action: 'SETTINGS_UPDATED', description: 'Updated library circulation or RFID settings.', entity: 'settings', entityId: 'library',
      }))
      return nextSettings
    }
    const updateProfile = (changes) => {
      const allowed = {
        name: changes.name,
        email: changes.email,
        department: changes.department,
        preferences: changes.preferences ?? state.currentUser?.preferences ?? { emailNotifications: true, compactTables: false },
      }
      if (!allowed.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allowed.email || '')) throw new Error('Enter a valid name and email address.')
      const updated = { ...state.currentUser, ...allowed }
      commit((current) => ({ ...current, currentUser: updated, users: current.users.map((item) => item.id === updated.id ? { ...item, ...allowed } : item) }))
      return updated
    }
    const markNotificationRead = (id) => commit((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === id ? { ...item, read: true } : item) }))
    const markAllNotificationsRead = () => commit((current) => ({ ...current, notifications: current.notifications.map((item) => ({ ...item, read: true })) }))
    const setCurrentUser = (account) => {
      const user = state.users.find((item) => item.role === getRoleForAccount(account.role)) || {}
      const accountRole = getRoleForAccount(account.role)
      const resolved = { ...user, ...account, role: accountRole, id: user.id || createId('U'), memberId: accountRole === 'STUDENT' ? 'M-1001' : accountRole === 'FACULTY' ? 'M-1005' : null, preferences: account.preferences || user.preferences || { emailNotifications: true, compactTables: false } }
      commit((current) => ({ ...current, currentUser: resolved }))
      return resolved
    }
    const logout = () => commit((current) => ({ ...current, currentUser: null }))
    const resetDemoData = () => {
      permission(state, 'SETTINGS_MANAGE')
      const initial = createInitialState()
      initial.currentUser = state.currentUser
      localStorage.removeItem('library-demo-books')
      localStorage.removeItem('library-demo-members')
      localStorage.removeItem('library-demo-user')
      commit(() => initial)
      return true
    }
    const createInventoryAudit = (filters) => createAudit(filters)
    const auditScan = (auditId, rfid) => {
      const audit = requireRecord(state.inventoryAudits, auditId, 'Inventory audit')
      const book = state.books.find((item) => item.rfidId === rfid)
      if (!book) throw new Error('RFID is not associated with a library book.')
      commit((current) => ({ ...current, inventoryAudits: current.inventoryAudits.map((item) => item.id === auditId ? { ...item, scannedRFIDs: [...new Set([...item.scannedRFIDs, rfid])] } : item) }))
      return { audit, book }
    }
    const updateProfileData = updateProfile
    return {
      getBooks: () => state.books.filter((book) => !book.archived).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
      getBook: (id) => state.books.find((book) => book.id === id) || null,
      getBookByRFID: (rfid) => state.books.find((book) => book.rfidId === rfid) || null,
      searchBooks: (query = '', filters = {}) => state.books.filter((book) => !book.archived && (!query || [book.title, book.author, book.isbn, book.rfidId, book.accessionNumber, book.category].some((value) => String(value || '').toLowerCase().includes(query.toLowerCase()))) && (!filters.category || book.category === filters.category) && (!filters.status || book.availabilityStatus === filters.status) && (!filters.rfid || Boolean(book.rfidId) === filters.rfid)).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
      createBook, updateBook, archiveBook,
      getMembers: () => state.members.filter((member) => !member.archived).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
      getMember: (id) => state.members.find((member) => member.id === id) || null,
      searchMembers: (query = '') => state.members.filter((member) => !member.archived && `${member.id} ${member.name} ${member.studentId} ${member.libraryId} ${member.rfidCardId}`.toLowerCase().includes(query.toLowerCase())),
      createMember, updateMember, archiveMember,
      issueBook, returnBook, renewBook,
      getActiveLoans: () => state.transactions.filter((item) => item.status === 'Issued'),
      getLoanHistory: () => state.transactions,
      getReservations: read((current) => current.reservations),
      createReservation, cancelReservation, approveReservation, fulfillReservation,
      getFines: read((current) => current.fines),
      payFine: (id) => settleFine(id, 'PAID'),
      waiveFine: (id, reason) => settleFine(id, 'WAIVED', reason),
      reverseFinePayment,
      scanRFID, lookupRFID: (rfid) => state.books.find((book) => book.rfidId === rfid) || null,
      validateRFID: (rfid, exceptId) => /^RFID-[A-Z]{3}-\d{4}-\d{6}$/.test(rfid || '') && !state.books.some((book) => book.rfidId === rfid && book.id !== exceptId),
      registerRFID, getRFIDLogs: read((current) => current.rfidLogs), getRFIDDevices: read((current) => current.rfidDevices),
      markBookLost: (id) => markCondition(id, 'Lost'),
      markBookDamaged: (id) => markCondition(id, 'Damaged'),
      markBookFound: (id) => markCondition(id, 'Good'),
      changeBookLocation,
      getInventoryStatus: () => ({
        total: state.books.filter((book) => !book.archived).length,
        available: state.books.filter((book) => !book.archived && book.availabilityStatus === 'Available').length,
        issued: state.transactions.filter((item) => item.status === 'Issued').length,
        lost: state.books.filter((book) => book.condition === 'Lost').length,
        damaged: state.books.filter((book) => book.condition === 'Damaged').length,
        audits: state.inventoryAudits,
      }),
      startInventoryAudit: createInventoryAudit, scanInventoryRFID: auditScan, completeInventoryAudit: (filters) => createAudit(filters),
      getAcquisitions: read((current) => current.acquisitions), createAcquisition, updateAcquisition, receiveAcquisition, cancelAcquisition,
      getNotifications: read((current) => current.notifications),
      markNotificationRead, markAllNotificationsRead,
      getSettings: read((current) => current.settings), updateSettings, resetDemoData,
      updateProfile: updateProfileData, login: setCurrentUser, logout,
      createRFID: () => generateRFID(state.books),
      createMemberCard: () => `CARD-${String(Date.now()).slice(-8)}`,
      getState: () => state,
      getRecentActivity: () => state.auditLogs.slice(0, 12),
    }
  }, [state, commit])

  // This facade retains action functions without invoking ref-backed commits during render.
  // eslint-disable-next-line react-hooks/refs
  const api = useMemo(() => createLibraryApi(actions), [actions])
  const value = useMemo(() => ({
    ...state,
    actions: api,
    api,
    can: (permissionName) => hasPermission(getRoleForAccount(state.currentUser?.role), permissionName),
    resetDemoData: actions.resetDemoData,
  }), [state, actions, api])

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
