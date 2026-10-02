import { useCallback, useMemo, useRef, useState } from 'react'
import { createLibraryApi } from '../api/index.js'
import { createInitialState } from '../data/mockData.js'
import { createAccessionNumber, createId, generateMemberRFID, generateRFID } from '../utils/idGenerator.js'
import { getRoleForAccount, hasPermission } from '../utils/permissions.js'
import { formatRFID, isValidRFID, normalizeRFID } from '../utils/rfid.js'
import { LibraryContext } from './LibraryContext.js'

const STORAGE_KEY = 'northbridge-library-state-v3'
const dateString = (date) => date.toISOString().slice(0, 10)
const isoNow = () => new Date().toISOString()
const cleanKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
const categoryCode = (value, prefix) => `${prefix}-${String(value || 'GEN').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase().padEnd(2, 'X')}`

function normalizeState(source) {
  const next = { ...source }
  const groupIds = new Map()
  const categoryIds = new Map()
  const subcategoryIds = new Map()
  let groupSequence = 1
  let categorySequence = 1
  let subcategorySequence = 1
  const usedBookRFIDs = new Set()
  next.books = (source.books || []).map((book, index) => {
    const groupingKey = `${cleanKey(book.title)}|${cleanKey(book.isbn) || cleanKey(book.author)}|${book.edition || 1}`
    if (!groupIds.has(groupingKey)) groupIds.set(groupingKey, `TITLE-${String(groupSequence++).padStart(6, '0')}`)
    const categoryKey = cleanKey(book.category)
    if (!categoryIds.has(categoryKey)) categoryIds.set(categoryKey, `${categoryCode(book.category, 'CAT')}-${String(categorySequence++).padStart(3, '0')}`)
    const subcategoryKey = cleanKey(book.subCategory || book.category)
    if (!subcategoryIds.has(subcategoryKey)) subcategoryIds.set(subcategoryKey, `${categoryCode(book.subCategory || book.category, 'SUB')}-${String(subcategorySequence++).padStart(3, '0')}`)
    let rfidId = book.rfidId ? formatRFID(book.rfidId) : null
    if (rfidId && (!isValidRFID(rfidId, 'book') || usedBookRFIDs.has(normalizeRFID(rfidId)))) {
      rfidId = generateRFID([...next.books.slice(0, index), ...[...usedBookRFIDs].map((value) => ({ rfidId: value }))])
    }
    if (!rfidId && book.availabilityStatus !== 'Pending Registration') rfidId = generateRFID([...next.books.slice(0, index), ...[...usedBookRFIDs].map((value) => ({ rfidId: value }))])
    if (rfidId) usedBookRFIDs.add(normalizeRFID(rfidId))
    return {
      ...book,
      bookId: book.bookId || book.id,
      copyId: book.copyId || book.id,
      titleGroupId: book.titleGroupId || groupIds.get(groupingKey),
      categoryId: book.categoryId || categoryIds.get(categoryKey),
      subcategoryId: book.subcategoryId || subcategoryIds.get(subcategoryKey),
      copyNumber: book.copyNumber || index + 1,
      accessionNumber: book.accessionNumber || createAccessionNumber(next.books.slice(0, index)),
      rfidId,
      rfidUid: rfidId,
      authors: book.authors || book.author || '',
      quantity: book.quantity || book.totalCopies || 1,
      availableQuantity: book.availableQuantity ?? book.availableCopies ?? 1,
      status: book.status || book.availabilityStatus || 'Available',
      currentHolderId: book.currentHolderId || book.currentBorrowerId || book.borrowerId || null,
      createdAt: book.createdAt || isoNow(),
      updatedAt: book.updatedAt || book.createdAt || isoNow(),
    }
  })
  const memberRfids = new Set()
  next.members = (source.members || []).map((member) => {
    let rfidCardId = member.rfidCardId ? formatRFID(member.rfidCardId) : null
    if (rfidCardId && (!isValidRFID(rfidCardId, 'member') || memberRfids.has(normalizeRFID(rfidCardId)))) {
      rfidCardId = generateMemberRFID([...memberRfids].map((value) => ({ rfidCardId: value })))
    }
    if (rfidCardId) memberRfids.add(normalizeRFID(rfidCardId))
    return {
      ...member,
      rfidCardId,
      rfidUid: rfidCardId,
      registrationNumber: member.registrationNumber || member.studentId || '',
      registerNumber: member.registerNumber || member.registrationNumber || member.studentId || '',
      booksIssued: member.booksIssued || 0,
      booksReturned: member.booksReturned || 0,
      currentBooks: member.currentBooks || [],
      overdueBooks: member.overdueBooks || 0,
      history: member.history || [],
      registrationDate: member.registrationDate || member.joinDate || '',
      membershipExpiry: member.membershipExpiry || '',
      createdAt: member.createdAt || isoNow(),
      updatedAt: member.updatedAt || member.createdAt || isoNow(),
      archived: Boolean(member.archived),
    }
  })
  const booksById = new Map(next.books.map((book) => [book.id, book]))
  next.transactions = (source.transactions || []).map((transaction) => ({
    ...transaction,
    transactionId: transaction.transactionId || transaction.id,
    titleGroupId: transaction.titleGroupId || booksById.get(transaction.bookId)?.titleGroupId || transaction.bookId,
    bookRfid: transaction.bookRfid || transaction.rfidId || booksById.get(transaction.bookId)?.rfidId || '',
    returnedAt: transaction.returnedAt || transaction.returnedDate || null,
  }))
  next.reservations = (source.reservations || []).map((reservation) => ({
    ...reservation,
    reservationId: reservation.reservationId || reservation.id,
    studentId: reservation.studentId || reservation.memberId,
    bookId: reservation.bookId,
    requestDate: reservation.requestDate || reservation.createdAt,
    titleGroupId: reservation.titleGroupId || booksById.get(reservation.bookId)?.titleGroupId || reservation.bookId,
    pickupDeadline: reservation.pickupDeadline || reservation.expiresAt || null,
    expiresAt: reservation.expiresAt || reservation.pickupDeadline || null,
  }))
  next.fines = (source.fines || []).map((fine) => ({
    ...fine,
    fineId: fine.fineId || fine.id,
    studentId: fine.studentId || fine.memberId,
    paidAmount: Number(fine.paidAmount || 0),
    remainingAmount: Number(fine.remainingAmount ?? Math.max(0, Number(fine.amount || 0) - Number(fine.paidAmount || 0))),
    titleGroupId: fine.titleGroupId || booksById.get(fine.bookId)?.titleGroupId || fine.bookId,
  }))
  next.rfidLogs = (source.rfidLogs || []).map((log) => {
    const book = booksById.get(log.bookId)
    const member = next.members.find((item) => item.id === log.memberId || item.id === log.entityId)
    return book ? { ...log, rfidId: book.rfidId, rfidType: 'BOOK', entityId: book.id, entityName: book.title } : member ? { ...log, rfidId: member.rfidCardId, rfidType: 'MEMBER', entityId: member.id, entityName: member.name } : { ...log, rfidType: log.rfidType || 'BOOK' }
  })
  next.acquisitions = (source.acquisitions || []).map((order) => ({
    ...order,
    acquisitionId: order.acquisitionId || order.id,
    purchaseOrderNumber: order.purchaseOrderNumber || order.id,
    quantityOrdered: order.quantityOrdered || order.quantity,
    totalQuantity: order.totalQuantity ?? order.quantity,
    totalCost: order.totalCost ?? order.total,
    items: order.items || [{
      title: order.title, author: order.author || '', category: order.category || '',
      edition: order.edition || '', quantity: order.quantity || 0,
      unitCost: order.unitPrice || 0, totalCost: order.total ?? Number(order.quantity || 0) * Number(order.unitPrice || 0),
    }],
    quantityReceived: order.quantityReceived ?? order.receivedQuantity ?? 0,
    orderDate: order.orderDate || order.createdAt,
    expectedDelivery: order.expectedDelivery || order.expectedDate || '',
    subcategory: order.subcategory || '',
  }))
  next.suppliers = (source.suppliers || []).map((supplier) => ({
    ...supplier,
    supplierId: supplier.supplierId || supplier.id,
    status: supplier.status || 'Active',
  }))
  next.inventoryAudits = (source.inventoryAudits || []).map((audit) => ({
    ...audit,
    status: audit.status || 'COMPLETED',
    scannedRFIDs: audit.scannedRFIDs || [],
    scannedBookIds: audit.scannedBookIds || [],
    expectedBookIds: audit.expectedBookIds || [],
    unexpected: audit.unexpected || [],
    misplaced: audit.misplaced || [],
  }))
  next.settings = {
    ...source.settings,
    workingHours: source.settings?.workingHours || '08:00-20:00',
    pickupWindowDays: source.settings?.pickupWindowDays || 2,
    maximumActiveReservations: source.settings?.maximumActiveReservations || 5,
    blockBorrowingWithUnpaidFines: source.settings?.blockBorrowingWithUnpaidFines ?? true,
    allowRenewalWithReservations: source.settings?.allowRenewalWithReservations ?? false,
    memberTypeRules: source.settings?.memberTypeRules || {
      Student: { borrowingLimit: source.settings?.borrowingLimit || 5, loanPeriodDays: source.settings?.loanPeriodDays || 14 },
      Faculty: { borrowingLimit: 10, loanPeriodDays: 30 },
      Staff: { borrowingLimit: source.settings?.borrowingLimit || 5, loanPeriodDays: 21 },
    },
  }
  const activeTransactions = next.transactions.filter((transaction) => transaction.status === 'Issued')
  const copiesByTitle = new Map()
  for (const book of next.books.filter((item) => !item.archived)) {
    const titleId = book.titleGroupId || book.id
    copiesByTitle.set(titleId, [...(copiesByTitle.get(titleId) || []), book])
  }
  const transactionsByCopy = new Map(activeTransactions.map((transaction) => [transaction.bookId, transaction]))
  next.books = next.books.map((book) => {
    const activeLoan = transactionsByCopy.get(book.id)
    const titleCopies = copiesByTitle.get(book.titleGroupId || book.id) || [book]
    let availabilityStatus = book.availabilityStatus || 'Available'
    if (activeLoan) availabilityStatus = 'Issued'
    else if (['Issued', 'Overdue'].includes(availabilityStatus)) availabilityStatus = 'Available'
    else if (['Damaged', 'Lost', 'Under Repair'].includes(book.condition)) availabilityStatus = book.condition
    const quantityCounts = {
      total: titleCopies.length,
      available: titleCopies.filter((copy) => !transactionsByCopy.has(copy.id) && copy.availabilityStatus === 'Available').length,
      issued: titleCopies.filter((copy) => transactionsByCopy.has(copy.id)).length,
      reserved: titleCopies.filter((copy) => copy.availabilityStatus === 'Reserved').length,
      damaged: titleCopies.filter((copy) => copy.condition === 'Damaged' || copy.availabilityStatus === 'Damaged').length,
      lost: titleCopies.filter((copy) => copy.condition === 'Lost' || copy.availabilityStatus === 'Lost').length,
      underRepair: titleCopies.filter((copy) => copy.condition === 'Under Repair' || copy.availabilityStatus === 'Under Repair').length,
    }
    return {
      ...book,
      author: book.author || book.authors || '',
      authors: book.author || book.authors || '',
      rfidUid: book.rfidId,
      availabilityStatus,
      status: availabilityStatus,
      quantity: quantityCounts.total,
      totalCopies: quantityCounts.total,
      availableQuantity: quantityCounts.available,
      availableCopies: quantityCounts.available,
      issuedCopies: quantityCounts.issued,
      reservedCopies: quantityCounts.reserved,
      damagedCopies: quantityCounts.damaged,
      lostCopies: quantityCounts.lost,
      underRepairCopies: quantityCounts.underRepair,
      borrowerId: activeLoan?.memberId || null,
      currentBorrowerId: activeLoan?.memberId || null,
      currentHolderId: activeLoan?.memberId || null,
      currentTransactionId: activeLoan?.id || null,
      dueDate: activeLoan?.dueDate || null,
    }
  })
  next.members = next.members.map((member) => {
    const history = next.transactions.filter((transaction) => transaction.memberId === member.id)
    const currentBooks = history.filter((transaction) => transaction.status === 'Issued')
    const fineAmount = next.fines.filter((fine) => fine.memberId === member.id && ['PENDING', 'PARTIALLY_PAID'].includes(fine.status))
      .reduce((total, fine) => total + Number(fine.remainingAmount ?? fine.amount ?? 0), 0)
    return {
      ...member,
      booksIssued: history.length,
      booksReturned: history.filter((transaction) => transaction.status === 'Returned').length,
      currentBooks,
      borrowedBooks: currentBooks.length,
      overdueBooks: currentBooks.filter((transaction) => transaction.dueDate < dateString(new Date())).length,
      history,
      fineAmount,
    }
  })
  return next
}

const getStored = () => {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current) {
      const parsed = JSON.parse(current)
      if (parsed?.books && parsed?.members && parsed?.settings) {
        const normalized = normalizeState(parsed)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
        return normalized
      }
    }
    const normalized = normalizeState(createInitialState())
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    return normalized
  } catch (error) {
    console.error('Unable to load saved library demo data; starting with the initial dataset.', error)
    return createInitialState()
  }
}

function addEvent(state, { action, description, entity, entityId, notification, category = 'Library', memberId }) {
  const timestamp = isoNow()
  const userName = state.currentUser?.name || 'Demo user'
  const audit = {
    id: createId('AUD'), logId: null, action, description, entity, entityType: entity, entityId, user: userName, performedBy: userName, timestamp,
  }
  audit.logId = audit.id
  const next = {
    ...state,
    auditLogs: [audit, ...(state.auditLogs || [])],
  }
  if (notification) {
    const addNotification = (targetMemberId) => {
      const notificationId = createId('NOT')
      return {
        id: notificationId, notificationId, userId: targetMemberId || null, memberId: targetMemberId || null,
        title: notification, message: notification, type: category, category, entity, entityId,
        read: false, timestamp, createdAt: timestamp,
      }
    }
    const createdNotifications = [addNotification(memberId)]
    if (memberId) createdNotifications.push(addNotification(null))
    next.notifications = [...createdNotifications, ...(state.notifications || [])]
  }
  return next
}

function permission(state, name) {
  const role = getRoleForAccount(state.currentUser?.role)
  if (!hasPermission(role, name)) throw new Error('Access denied. Your role cannot perform this action.')
}

function resequenceReservations(reservations, bookId) {
  const orderedIds = reservations
    .filter((item) => (item.titleGroupId || item.bookId) === bookId && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((item) => item.id)
  const positions = new Map(orderedIds.map((id, index) => [id, index + 1]))
  return reservations.map((item) => positions.has(item.id) ? { ...item, queuePosition: positions.get(item.id) } : item)
}

function isReservationEligible(reservation, state) {
  const member = state.members.find((item) => item.id === reservation.memberId)
  if (!member || member.archived || member.status !== 'Active' || (member.membershipExpiry && member.membershipExpiry < dateString(new Date()))) return false
  const titleGroupId = reservation.titleGroupId || state.books.find((copy) => copy.id === reservation.bookId)?.titleGroupId || reservation.bookId
  const activeLoans = state.transactions.filter((item) => item.memberId === member.id && item.status === 'Issued')
  if (activeLoans.some((item) => (item.titleGroupId || state.books.find((copy) => copy.id === item.bookId)?.titleGroupId || item.bookId) === titleGroupId)) return false
  const memberRules = state.settings.memberTypeRules?.[member.memberType] || {}
  if (activeLoans.length >= Number(memberRules.borrowingLimit || state.settings.borrowingLimit)) return false
  if (state.settings.blockBorrowingWithOverdueBooks && activeLoans.some((item) => item.dueDate < dateString(new Date()))) return false
  const outstanding = state.fines.filter((fine) => fine.memberId === member.id && ['PENDING', 'PARTIALLY_PAID'].includes(fine.status))
    .reduce((sum, fine) => sum + Number(fine.remainingAmount ?? fine.amount ?? 0), 0)
  if (state.settings.blockBorrowingWithUnpaidFines && Number(state.settings.blockingFineAmount) > 0 && outstanding >= Number(state.settings.blockingFineAmount)) return false
  return true
}

function promoteWaitingReservations(state, titleGroupId) {
  let nextState = state
  const queue = nextState.reservations
    .filter((item) => item.status === 'PENDING' && (item.titleGroupId || item.bookId) === titleGroupId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  for (const reservation of queue) {
    if (!isReservationEligible(reservation, nextState)) continue
    const copy = nextState.books.find((item) => !item.archived && (item.titleGroupId || item.id) === titleGroupId
      && ['Good', 'Fair'].includes(item.condition) && item.availabilityStatus === 'Available')
    if (!copy) break
    const timestamp = isoNow()
    const expiresAt = dateString(new Date(Date.now() + Number(nextState.settings.pickupWindowDays || 2) * 86400000))
    nextState = {
      ...nextState,
      books: nextState.books.map((item) => item.id === copy.id ? { ...item, availabilityStatus: 'Reserved', availableCopies: 0, updatedAt: timestamp } : item),
      reservations: resequenceReservations(nextState.reservations.map((item) => item.id === reservation.id
        ? { ...item, status: 'READY_FOR_PICKUP', assignedBookId: copy.id, readyAt: timestamp, fulfilledAt: null, expiresAt, pickupDeadline: expiresAt }
        : item), titleGroupId),
    }
    nextState = addEvent(nextState, {
      action: 'RESERVATION_READY',
      description: `${reservation.bookTitle} is ready for ${reservation.memberName} until ${expiresAt}.`,
      entity: 'reservation',
      entityId: reservation.id,
      notification: `Your reserved book '${reservation.bookTitle}' is ready for pickup. Please collect it before ${expiresAt}.`,
      category: 'Reservations',
      memberId: reservation.memberId,
    })
  }
  return nextState
}

function ensureUniqueRFID(state, rfid, exceptId) {
  if (!rfid) return
  if (!isValidRFID(rfid, 'book')) throw new Error('Enter an 8-digit hexadecimal RFID UID (spaces and hyphens are accepted).')
  const existing = state.books.find((book) => normalizeRFID(book.rfidId) === normalizeRFID(rfid) && book.id !== exceptId)
  if (existing) throw new Error(`RFID already assigned to ${existing.title} (${existing.accessionNumber}).`)
}

function resolveTitleGroupId(books, input) {
  const key = cleanKey(input.title)
  const candidate = books.find((book) => !book.archived && (
    input.isbn ? book.isbn === input.isbn && Number(book.edition || 1) === Number(input.edition || 1)
      : cleanKey(book.title) === key && cleanKey(book.author) === cleanKey(input.author) && Number(book.edition || 1) === Number(input.edition || 1)
  ))
  if (candidate) return candidate.titleGroupId || candidate.id
  const highest = books.reduce((max, book) => Math.max(max, Number(String(book.titleGroupId || '').replace(/\D/g, '')) || 0), 0)
  return `TITLE-${String(highest + 1).padStart(6, '0')}`
}

function classificationId(books, field, label, prefix) {
  const idField = field === 'subCategory' ? 'subcategoryId' : `${field}Id`
  const same = books.find((book) => cleanKey(book[field]) === cleanKey(label) && book[idField])
  if (same) return same[idField]
  const highest = books.reduce((max, book) => Math.max(max, Number(String(book[idField] || '').replace(/\D/g, '')) || 0), 0)
  const code = String(label || 'GEN').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase().padEnd(2, 'X')
  return `${prefix}-${code}-${String(highest + 1).padStart(3, '0')}`
}

export function LibraryProvider({ children }) {
  const [state, setState] = useState(getStored)
  const stateRef = useRef(state)

  const commit = useCallback((transform) => {
    const next = normalizeState(transform(stateRef.current))
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
      const quantity = Number(input.quantity || 1)
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Quantity must be a positive whole number.')
      const firstRFID = input.rfidId?.trim() ? formatRFID(input.rfidId) : ''
      ensureUniqueRFID(state, firstRFID)
      const timestamp = isoNow()
      const titleGroupId = input.titleGroupId || resolveTitleGroupId(state.books, input)
      const existingTitleCopies = state.books.filter((copy) => !copy.archived && copy.titleGroupId === titleGroupId).length
      const copiesCreated = []
      const copies = Array.from({ length: quantity }, (_, index) => {
        const id = createId('BK')
        const rfidId = index === 0 && firstRFID
          ? firstRFID
          : generateRFID([...state.books, ...copiesCreated])
        const copy = {
          ...input,
          id,
          bookId: id,
          copyId: id,
          accessionNumber: createAccessionNumber([...state.books, ...copiesCreated]),
          titleGroupId,
          copyNumber: existingTitleCopies + index + 1,
          categoryId: input.categoryId || classificationId(state.books, 'category', input.category, 'CAT'),
          subcategoryId: input.subcategoryId || classificationId(state.books, 'subCategory', input.subCategory || input.category, 'SUB'),
          bookCode: createId('B'),
          author: input.author.trim(),
          authors: input.author.trim(),
          rfidId,
          rfidUid: rfidId,
          rfidStatus: 'Active',
          availabilityStatus: ['Damaged', 'Lost', 'Under Repair'].includes(input.condition) ? input.condition : 'Available',
          status: ['Damaged', 'Lost', 'Under Repair'].includes(input.condition) ? input.condition : 'Available',
          condition: input.condition || 'Good',
          quantity,
          totalCopies: quantity,
          availableQuantity: ['Damaged', 'Lost', 'Under Repair'].includes(input.condition) ? 0 : quantity,
          availableCopies: ['Damaged', 'Lost', 'Under Repair'].includes(input.condition) ? 0 : quantity,
          issuedCopies: 0,
          reservedCopies: 0,
          borrowerId: null,
          currentHolderId: null,
          dueDate: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          archived: false,
        }
        copiesCreated.push(copy)
        return copy
      })
      const book = copies[0]
      commit((current) => {
        let next = addEvent({ ...current, books: [...copies, ...current.books] }, {
          action: 'BOOK_CREATED', description: `Registered ${book.title}.`, entity: 'book',
          entityId: book.id, notification: `${book.title} added with ${quantity} physical cop${quantity === 1 ? 'y' : 'ies'}.`, category: 'Catalog',
        })
        next = { ...next, rfidLogs: [...copies.map((copy) => ({ id: createId('RFLOG'), rfidId: copy.rfidId, rfidType: 'BOOK', entityId: copy.id, entityName: copy.title, bookId: copy.id, bookTitle: copy.title, event: 'REGISTER', operation: 'RFID_REGISTER', result: 'SUCCESS', device: 'Simulation Bridge', user: current.currentUser?.name || 'Demo user', location: copy.location || 'Central Library', timestamp })), ...next.rfidLogs] }
        return promoteWaitingReservations(next, titleGroupId)
      })
      return book
    }
    const updateBook = (id, changes) => {
      permission(state, 'BOOK_EDIT')
      const existing = requireRecord(state.books, id, 'Book')
      if (existing.availabilityStatus === 'Pending Registration' && !String(changes.rfidId || existing.rfidId || '').trim()) throw new Error('Assign a unique RFID tag before registering this physical copy.')
      ensureUniqueRFID(state, changes.rfidId ?? existing.rfidId, id)
      const conditionChanged = changes.condition && changes.condition !== existing.condition
      if (conditionChanged && state.transactions.some((item) => item.bookId === id && item.status === 'Issued')) throw new Error('Book condition cannot be changed while it has an active loan.')
      const updated = {
        ...existing,
        ...changes,
        id,
        rfidId: changes.rfidId === undefined ? existing.rfidId : String(changes.rfidId || '').trim() ? formatRFID(changes.rfidId) : null,
        rfidStatus: (changes.rfidId ?? existing.rfidId) ? 'Active' : 'Pending',
        ...(existing.availabilityStatus === 'Pending Registration' && changes.rfidId ? { availabilityStatus: 'Available', availableCopies: 1 } : {}),
        ...(conditionChanged ? {
          availabilityStatus: ['Lost', 'Damaged', 'Under Repair'].includes(changes.condition) ? changes.condition : 'Available',
          availableCopies: ['Lost', 'Damaged', 'Under Repair'].includes(changes.condition) ? 0 : 1,
        } : {}),
        updatedAt: isoNow(),
      }
      const bibliographicFields = ['title', 'author', 'authors', 'isbn', 'publisher', 'edition', 'publicationYear', 'category', 'categoryId', 'subCategory', 'subcategoryId', 'department', 'language', 'pages', 'description', 'tags']
      const bibliographicChanges = Object.fromEntries(bibliographicFields.filter((field) => changes[field] !== undefined).map((field) => [field, updated[field]]))
      commit((current) => {
        const next = addEvent({ ...current, books: current.books.map((book) => book.id === id ? updated : book.titleGroupId === existing.titleGroupId ? { ...book, ...bibliographicChanges, updatedAt: updated.updatedAt } : book) }, {
          action: 'BOOK_UPDATED', description: `Updated ${updated.title}.`, entity: 'book', entityId: id,
          notification: `Book updated: ${updated.title}`, category: 'Catalog',
        })
        return promoteWaitingReservations(next, updated.titleGroupId || updated.id)
      })
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
      if (!input.name?.trim() || !(input.studentId || input.registrationNumber)?.trim()) throw new Error('Name and registration number are required.')
      if (input.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Enter a valid email address.')
      const registrationNumber = (input.registrationNumber || input.studentId).trim()
      if (state.members.some((member) => (member.registrationNumber || member.studentId || '').toLowerCase() === registrationNumber.toLowerCase())) throw new Error('That student ID is already registered.')
      const rfidCardId = input.rfidCardId?.trim() ? formatRFID(input.rfidCardId) : generateMemberRFID(state.members)
      if (!isValidRFID(rfidCardId, 'member')) throw new Error('Enter an 8-digit hexadecimal member RFID UID (spaces and hyphens are accepted).')
      if (state.members.some((member) => normalizeRFID(member.rfidCardId) === normalizeRFID(rfidCardId))) throw new Error('That member RFID card is already assigned.')
      const timestamp = isoNow()
      const member = { ...input, studentId: registrationNumber, registrationNumber, registerNumber: registrationNumber, rfidCardId, rfidUid: rfidCardId, id: createId('M'), memberId: createId('MEM'), libraryId: input.libraryId || createId('LIB'), status: input.status || 'Active', borrowedBooks: 0, booksIssued: 0, booksReturned: 0, currentBooks: [], overdueBooks: 0, history: [], fineAmount: 0, registrationDate: timestamp.slice(0, 10), membershipExpiry: input.membershipExpiry || '', createdAt: timestamp, updatedAt: timestamp, archived: false }
      commit((current) => addEvent({ ...current, members: [member, ...current.members] }, {
        action: 'MEMBER_CREATED', description: `Registered member ${member.name}.`, entity: 'member',
        entityId: member.id, notification: `New library member registered: ${member.name}`, category: 'Members',
      }))
      return member
    }
    const updateMember = (id, changes) => {
      permission(state, 'MEMBER_EDIT')
      const member = requireRecord(state.members, id, 'Member')
      const registrationNumber = changes.registrationNumber || changes.studentId
      if (registrationNumber && state.members.some((item) => item.id !== id && (item.registrationNumber || item.studentId || '').toLowerCase() === registrationNumber.toLowerCase())) throw new Error('That student ID is already registered.')
      const rfidCardId = changes.rfidCardId?.trim() ? formatRFID(changes.rfidCardId) : ''
      if (rfidCardId && (!isValidRFID(rfidCardId, 'member') || state.members.some((item) => item.id !== id && normalizeRFID(item.rfidCardId) === normalizeRFID(rfidCardId)))) throw new Error('Member RFID must be valid and unique.')
      const updated = { ...member, ...changes, registrationNumber: changes.registrationNumber || changes.studentId || member.registrationNumber || member.studentId, registerNumber: changes.registerNumber || changes.registrationNumber || changes.studentId || member.registerNumber || member.studentId, id, updatedAt: isoNow() }
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
    const validateIssue = ({ bookId, memberId }) => {
      const book = state.books.find((item) => item.id === bookId)
      const member = state.members.find((item) => item.id === memberId)
      const reasons = []
      if (!book) reasons.push('Book not found.')
      if (!member) reasons.push('Member not found.')
      if (!book || !member) return { eligible: false, reasons, book: book || null, member: member || null }
      if (member.archived || member.status !== 'Active' || (member.membershipExpiry && member.membershipExpiry < dateString(new Date()))) reasons.push('Member account is inactive or membership has expired.')
      if (!book.rfidId) reasons.push('This physical copy has no RFID tag assigned.')
      if (book.archived || ['Lost', 'Damaged', 'Under Repair', 'Pending Registration'].includes(book.availabilityStatus) || ['Lost', 'Damaged', 'Under Repair'].includes(book.condition)) reasons.push(`This copy is ${book.availabilityStatus.toLowerCase()} and cannot be issued.`)
      const titleGroupId = book.titleGroupId || book.id
      const activeForMember = state.transactions.filter((item) => item.memberId === memberId && item.status === 'Issued')
      if (activeForMember.some((item) => (item.titleGroupId || state.books.find((copy) => copy.id === item.bookId)?.titleGroupId || item.bookId) === titleGroupId)) {
        reasons.push('You already have this book title issued to you. Return the existing copy before borrowing another copy.')
      }
      const readyHolds = state.reservations.filter((item) => item.status === 'READY_FOR_PICKUP' && (item.titleGroupId || state.books.find((copy) => copy.id === item.bookId)?.titleGroupId || item.bookId) === titleGroupId)
      const assignedHold = readyHolds.find((item) => item.assignedBookId === bookId) || readyHolds.find((item) => !item.assignedBookId && item.bookId === bookId)
      if (assignedHold && assignedHold.memberId !== memberId) reasons.push(`This book is currently reserved for ${assignedHold.memberName} and cannot be issued to this student.`)
      if (book.availabilityStatus === 'Reserved' && assignedHold?.memberId !== memberId) reasons.push('This copy is reserved for another member.')
      if (!['Available', 'Reserved'].includes(book.availabilityStatus)) reasons.push('This physical copy is not available for checkout.')
      const typeRules = state.settings.memberTypeRules?.[member.memberType] || {}
      const borrowingLimit = Number(typeRules.borrowingLimit || state.settings.borrowingLimit)
      if (activeForMember.length >= borrowingLimit) reasons.push(`Borrowing limit reached (${borrowingLimit} active loans for ${member.memberType || 'this member type'}).`)
      const overdueLoans = activeForMember.filter((item) => item.dueDate < dateString(new Date()))
      if (state.settings.blockBorrowingWithOverdueBooks && overdueLoans.length) reasons.push(`Borrowing is blocked while this member has ${overdueLoans.length} overdue book${overdueLoans.length === 1 ? '' : 's'}.`)
      const outstandingFine = state.fines.filter((fine) => fine.memberId === memberId && ['PENDING', 'PARTIALLY_PAID'].includes(fine.status)).reduce((total, fine) => total + Number(fine.remainingAmount ?? fine.amount ?? 0), 0)
      if (state.settings.blockBorrowingWithUnpaidFines && Number(state.settings.blockingFineAmount) > 0 && outstandingFine >= Number(state.settings.blockingFineAmount)) reasons.push(`Outstanding fines of ₹${outstandingFine} exceed the borrowing threshold.`)
      if (Array.isArray(book.allowedMemberTypes) && !book.allowedMemberTypes.includes(member.memberType)) reasons.push(`This item is not available to ${member.memberType} members.`)
      const loanDays = Number(typeRules.loanPeriodDays || state.settings.loanPeriodDays)
      const dueDate = dateString(new Date(Date.now() + loanDays * 86400000))
      return { eligible: reasons.length === 0, reasons, book, member, titleGroupId, borrowingLimit, loanDays, dueDate, outstandingFine }
    }
    const issueBook = ({ bookId, memberId, memberRFID, bookRFID } = {}) => {
      permission(state, 'ISSUE_BOOK')
      if (!memberRFID || !bookRFID) throw new Error('Scan both the student/member RFID and the physical book RFID before issuing.')
      if (memberRFID) {
        const resolvedMember = state.members.find((item) => normalizeRFID(item.rfidCardId) === normalizeRFID(memberRFID))
        if (!resolvedMember || resolvedMember.id !== memberId) throw new Error('Scanned member RFID does not match the selected member.')
      }
      if (bookRFID) {
        const resolvedBook = state.books.find((item) => normalizeRFID(item.rfidId) === normalizeRFID(bookRFID))
        if (!resolvedBook || resolvedBook.id !== bookId) throw new Error('Scanned book RFID does not match the selected copy.')
      }
      const validation = validateIssue({ bookId, memberId })
      if (!validation.eligible) throw new Error(validation.reasons[0])
      const { book, member, titleGroupId, dueDate } = validation
      const readyHold = state.reservations.find((item) => item.status === 'READY_FOR_PICKUP' && (item.titleGroupId || item.bookId) === titleGroupId && (item.assignedBookId === bookId || (!item.assignedBookId && item.bookId === bookId)))
      const heldForMember = readyHold?.memberId === memberId
      const timestamp = isoNow()
      const transactionId = createId('TR')
      const transaction = { id: transactionId, transactionId, bookId, copyId: book.id, titleGroupId, bookTitle: book.title, memberId, memberName: member.name, rfidId: book.rfidId, bookRfid: book.rfidId, memberRFID: member.rfidCardId, issueDate: dateString(new Date()), issuedAt: timestamp, dueDate, returnedDate: null, returnDate: null, returnedAt: null, status: 'Issued', fine: 0, renewalCount: 0, issuedBy: state.currentUser?.name || 'Demo user', createdAt: timestamp }
      commit((current) => {
        let next = {
          ...current,
          books: current.books.map((item) => item.id === bookId ? { ...item, availabilityStatus: 'Issued', availableCopies: 0, issuedCopies: (item.issuedCopies || 0) + 1, reservedCopies: Math.max(0, (item.reservedCopies || 0) - (heldForMember ? 1 : 0)), borrowerId: memberId, currentBorrowerId: memberId, currentTransactionId: transaction.id, issuedAt: timestamp, dueDate } : item),
          members: current.members.map((item) => item.id === memberId ? { ...item, borrowedBooks: (item.borrowedBooks || 0) + 1 } : item),
          transactions: [transaction, ...current.transactions],
          reservations: heldForMember ? resequenceReservations(current.reservations.map((item) => item.id === readyHold.id ? { ...item, status: 'FULFILLED', fulfilledAt: timestamp } : item), titleGroupId) : current.reservations,
          rfidLogs: [
            { id: createId('RFLOG'), rfidId: book.rfidId, rfidType: 'BOOK', entityId: bookId, entityName: book.title, bookId, bookTitle: book.title, event: 'ISSUE', operation: 'BOOK_CHECKOUT', result: 'SUCCESS', deviceId: 'Simulation Bridge', userId: current.currentUser?.id || current.currentUser?.name || 'Demo user', device: 'Simulation Bridge', user: current.currentUser?.name || 'Demo user', timestamp },
            { id: createId('RFLOG'), rfidId: member.rfidCardId, rfidType: 'MEMBER', entityId: memberId, entityName: member.name, memberId, event: 'ISSUE', operation: 'MEMBER_ISSUE_CONFIRMATION', result: 'SUCCESS', deviceId: 'Simulation Bridge', userId: current.currentUser?.id || current.currentUser?.name || 'Demo user', device: 'Simulation Bridge', user: current.currentUser?.name || 'Demo user', timestamp },
            ...current.rfidLogs,
          ],
        }
        return addEvent(next, { action: 'BOOK_ISSUED', description: `${book.title} (${book.accessionNumber}, ${book.rfidId}) issued to ${member.name} (${member.studentId}) · transaction ${transaction.id}.`, entity: 'transaction', entityId: transaction.id, notification: `${book.title} issued to ${member.name}.`, category: 'Circulation', memberId: member.id })
      })
      return transaction
    }
    const returnBook = ({ bookId, rfidId, memberId, memberRFID, bookRFID, condition = 'Good' } = {}) => {
      permission(state, 'RETURN_BOOK')
      if (!memberRFID || !(bookRFID || rfidId)) throw new Error('Scan both the student/member RFID and the physical book RFID before returning.')
      const uid = normalizeRFID(bookRFID || rfidId || '')
      const book = bookId ? state.books.find((item) => item.id === bookId) : state.books.find((item) => normalizeRFID(item.rfidId) === uid)
      if (!book) throw new Error('No book matches that RFID.')
      if (!['Good', 'Fair', 'Damaged', 'Lost', 'Under Repair'].includes(condition)) throw new Error('Choose a valid returned-book condition.')
      const transaction = state.transactions.find((item) => item.bookId === book.id && item.status === 'Issued')
      if (!transaction) throw new Error('This book has no active circulation record.')
      const scannedMember = memberRFID ? state.members.find((item) => normalizeRFID(item.rfidCardId) === normalizeRFID(memberRFID)) : null
      const resolvedMemberId = scannedMember?.id || memberId
      if (resolvedMemberId && resolvedMemberId !== transaction.memberId) throw new Error(`This copy is issued to ${transaction.memberName}, not the scanned member.`)
      if (memberRFID && !scannedMember) throw new Error('Member RFID not found.')
      if (bookRFID && uid !== normalizeRFID(book.rfidId)) throw new Error('Book RFID does not match the selected physical copy.')
      const returnedAt = new Date()
      const returnedDate = dateString(returnedAt)
      const overdueDays = Math.max(0, Math.ceil((returnedAt - new Date(`${transaction.dueDate}T23:59:59`)) / 86400000))
      const fineAmount = overdueDays * state.settings.finePerDay
      const timestamp = isoNow()
      const fine = fineAmount ? { id: createId('FINE'), fineId: null, transactionId: transaction.id, memberId: transaction.memberId, studentId: transaction.memberId, memberName: transaction.memberName, bookId: book.id, titleGroupId: transaction.titleGroupId || book.titleGroupId, bookTitle: book.title, dueDate: transaction.dueDate, returnedDate, daysLate: overdueDays, amount: fineAmount, paidAmount: 0, remainingAmount: fineAmount, status: 'PENDING', reason: `${overdueDays} overdue day${overdueDays === 1 ? '' : 's'} at ₹${state.settings.finePerDay}/day`, createdAt: timestamp } : null
      if (fine) fine.fineId = fine.id
      const titleGroupId = transaction.titleGroupId || book.titleGroupId || book.id
      const returnConditionAllowsIssue = ['Good', 'Fair'].includes(condition)
      const afterReturnState = {
        ...state,
        transactions: state.transactions.map((item) => item.id === transaction.id ? { ...item, status: 'Returned' } : item),
        fines: fine ? [fine, ...state.fines] : state.fines,
      }
      const nextHold = returnConditionAllowsIssue ? state.reservations.filter((item) => item.status === 'PENDING' && (item.titleGroupId || state.books.find((copy) => copy.id === item.bookId)?.titleGroupId || item.bookId) === titleGroupId && isReservationEligible(item, afterReturnState)).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0] : null
      const pickupDeadline = nextHold ? dateString(new Date(Date.now() + Number(state.settings.pickupWindowDays || 2) * 86400000)) : null
      commit((current) => {
        let next = {
          ...current,
          books: current.books.map((item) => item.id === book.id ? { ...item, condition, availabilityStatus: nextHold ? 'Reserved' : ['Good', 'Fair'].includes(condition) ? 'Available' : condition, availableCopies: nextHold || !returnConditionAllowsIssue ? 0 : 1, issuedCopies: Math.max(0, (item.issuedCopies || 1) - 1), borrowerId: null, currentBorrowerId: null, currentHolderId: null, currentTransactionId: null, issuedAt: null, dueDate: null, updatedAt: timestamp } : item),
          members: current.members.map((item) => item.id === transaction.memberId ? { ...item, borrowedBooks: Math.max(0, (item.borrowedBooks || 1) - 1), fineAmount: (item.fineAmount || 0) + fineAmount } : item),
          transactions: current.transactions.map((item) => item.id === transaction.id ? { ...item, status: 'Returned', returnedDate, returnDate: returnedDate, returnedAt: timestamp, overdueDays, fine: fineAmount } : item),
          reservations: nextHold ? resequenceReservations(current.reservations.map((item) => item.id === nextHold.id ? { ...item, status: 'READY_FOR_PICKUP', assignedBookId: book.id, readyAt: timestamp, pickupDeadline, expiresAt: pickupDeadline } : item), titleGroupId) : current.reservations,
          fines: fine ? [fine, ...current.fines] : current.fines,
          rfidLogs: [
            { id: createId('RFLOG'), rfidId: book.rfidId, rfidType: 'BOOK', entityId: book.id, entityName: book.title, bookId: book.id, bookTitle: book.title, event: 'RETURN', operation: 'BOOK_CHECKIN', result: 'SUCCESS', deviceId: 'Simulation Bridge', userId: current.currentUser?.id || current.currentUser?.name || 'Demo user', device: 'Simulation Bridge', user: current.currentUser?.name || 'Demo user', location: book.location, timestamp },
            ...(scannedMember ? [{ id: createId('RFLOG'), rfidId: scannedMember.rfidCardId, rfidType: 'MEMBER', entityId: scannedMember.id, entityName: scannedMember.name, memberId: scannedMember.id, event: 'RETURN', operation: 'MEMBER_RETURN_CONFIRMATION', result: 'SUCCESS', deviceId: 'Simulation Bridge', userId: current.currentUser?.id || current.currentUser?.name || 'Demo user', device: 'Simulation Bridge', user: current.currentUser?.name || 'Demo user', timestamp }] : []),
            ...current.rfidLogs,
          ],
        }
        next = addEvent(next, { action: 'BOOK_RETURNED', description: `${book.title} (${book.accessionNumber}) returned by ${transaction.memberName}${fineAmount ? `; ${overdueDays} overdue day(s), fine ₹${fineAmount}` : ''}.`, entity: 'transaction', entityId: transaction.id, notification: `${book.title} returned successfully.${fineAmount ? ` Fine due: ₹${fineAmount}.` : ''}`, category: 'Circulation', memberId: transaction.memberId })
        if (fine) next = addEvent(next, { action: 'FINE_CREATED', description: `Fine ₹${fineAmount} created for transaction ${transaction.id}.`, entity: 'fine', entityId: fine.id, notification: `An overdue fine of ₹${fineAmount} was created for ${book.title}.`, category: 'Fines', memberId: transaction.memberId })
        if (nextHold) next = addEvent(next, { action: 'RESERVATION_READY', description: `${book.title} is ready for ${nextHold.memberName} until ${pickupDeadline}.`, entity: 'reservation', entityId: nextHold.id, notification: `Your reserved book '${book.title}' is ready for pickup. Please collect it before ${pickupDeadline}.`, category: 'Reservations', memberId: nextHold.memberId })
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
      if (!state.settings.allowRenewalWithReservations && state.reservations.some((item) => (item.titleGroupId || item.bookId) === (transaction.titleGroupId || bookId) && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status))) throw new Error('This title has a reservation queue and cannot be renewed.')
      const loanDays = Number(state.settings.memberTypeRules?.[member.memberType]?.loanPeriodDays || state.settings.loanPeriodDays)
      const dueDate = dateString(new Date(Date.now() + loanDays * 86400000))
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
      if (book.archived || ['Lost', 'Damaged', 'Under Repair'].includes(book.condition)) throw new Error('Lost, damaged, under-repair, or archived books cannot be reserved.')
      if (member.status !== 'Active') throw new Error('Inactive members cannot place reservations.')
      const titleGroupId = book.titleGroupId || book.id
      const groupBooks = state.books.filter((item) => !item.archived && (item.titleGroupId || item.id) === titleGroupId)
      if (groupBooks.some((item) => item.availabilityStatus === 'Available')) throw new Error('A copy of this title is available now. Borrow an available copy instead of reserving.')
      const activeForMember = state.reservations.filter((item) => item.memberId === memberId && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status))
      if (activeForMember.some((item) => (item.titleGroupId || state.books.find((copy) => copy.id === item.bookId)?.titleGroupId || item.bookId) === titleGroupId)) throw new Error('You already have an active reservation for this title.')
      if (activeForMember.length >= Number(state.settings.maximumActiveReservations || 5)) throw new Error(`Maximum active reservations reached (${state.settings.maximumActiveReservations}).`)
      const queuePosition = state.reservations.filter((item) => (item.titleGroupId || state.books.find((copy) => copy.id === item.bookId)?.titleGroupId || item.bookId) === titleGroupId && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)).length + 1
      const reservationId = createId('RES')
      const requestDate = isoNow()
      const reservation = { id: reservationId, reservationId, bookId, titleGroupId, bookTitle: book.title, memberId, studentId: memberId, memberName: member.name, createdAt: requestDate, requestDate, queuePosition, status: 'PENDING', pickupDeadline: null, expiresAt: null, fulfilledAt: null, cancelledAt: null }
      commit((current) => addEvent({ ...current, reservations: resequenceReservations([reservation, ...current.reservations], titleGroupId) }, {
        action: 'RESERVATION_CREATED', description: `${member.name} reserved ${book.title} (${titleGroupId}, queue ${queuePosition}).`, entity: 'reservation', entityId: reservation.id,
        notification: `Reservation placed for ${book.title}.`, category: 'Reservations', memberId: member.id,
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
      const groupId = reservation.titleGroupId || state.books.find((item) => item.id === reservation.bookId)?.titleGroupId || reservation.bookId
      const wasReady = reservation.status === 'READY_FOR_PICKUP'
      const availableCopyId = reservation.assignedBookId || reservation.bookId
      const nextPending = wasReady
        ? state.reservations.filter((item) => item.id !== id && (item.titleGroupId || state.books.find((copy) => copy.id === item.bookId)?.titleGroupId || item.bookId) === groupId && item.status === 'PENDING' && isReservationEligible(item, state)).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0]
        : null
      const pickupDeadline = nextPending ? dateString(new Date(Date.now() + Number(state.settings.pickupWindowDays || 2) * 86400000)) : null
      commit((current) => addEvent({
        ...current,
        reservations: resequenceReservations(current.reservations.map((item) => {
          if (item.id === id) return { ...item, status: 'CANCELLED', cancelledAt: isoNow() }
          if (nextPending && item.id === nextPending.id) return { ...item, status: 'READY_FOR_PICKUP', assignedBookId: availableCopyId, readyAt: isoNow(), pickupDeadline, expiresAt: pickupDeadline }
          return item
        }), groupId),
        books: current.books.map((item) => {
          if (item.id !== availableCopyId || !wasReady) return item
          return nextPending ? item : { ...item, availabilityStatus: 'Available', availableCopies: 1 }
        }),
      }, { action: 'RESERVATION_CANCELLED', description: `Cancelled reservation for ${reservation.bookTitle}.`, entity: 'reservation', entityId: id }))
      if (nextPending) {
        commit((current) => addEvent({
          ...current,
          books: current.books.map((item) => item.id === availableCopyId ? { ...item, availabilityStatus: 'Reserved', availableCopies: 0 } : item),
        }, {
          action: 'RESERVATION_READY',
          description: `${reservation.bookTitle} moved to ${nextPending.memberName} in the title hold queue.`,
          entity: 'reservation',
          entityId: nextPending.id,
          notification: `Your reserved book '${reservation.bookTitle}' is ready for pickup. Please collect it before ${pickupDeadline}.`,
          category: 'Reservations',
          memberId: nextPending.memberId,
        }))
      }
      return true
    }
    const fulfillReservation = (id, { memberRFID, bookRFID } = {}) => {
      permission(state, 'RESERVATION_MANAGE')
      const reservation = requireRecord(state.reservations, id, 'Reservation')
      if (reservation.status !== 'READY_FOR_PICKUP') throw new Error('Only a reservation ready for pickup can be fulfilled.')
      issueBook({ bookId: reservation.assignedBookId || reservation.bookId, memberId: reservation.memberId, memberRFID, bookRFID })
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
      const groupId = reservation.titleGroupId || state.books.find((item) => item.id === reservation.bookId)?.titleGroupId || reservation.bookId
      if (!isReservationEligible(reservation, state)) throw new Error('This student is not currently eligible to collect a reserved copy.')
      const firstEligible = state.reservations.filter((item) => item.status === 'PENDING' && (item.titleGroupId || state.books.find((copy) => copy.id === item.bookId)?.titleGroupId || item.bookId) === groupId && isReservationEligible(item, state)).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0]
      if (firstEligible && firstEligible.id !== id) throw new Error(`Queue position #${firstEligible.queuePosition} must be handled first.`)
      const book = state.books.find((item) => !item.archived && (item.titleGroupId || item.id) === groupId && item.availabilityStatus === 'Available')
      const approved = Boolean(book)
      const pickupDeadline = approved ? dateString(new Date(Date.now() + Number(state.settings.pickupWindowDays || 2) * 86400000)) : null
      commit((current) => addEvent({
        ...current,
        reservations: resequenceReservations(current.reservations.map((item) => item.id === id ? { ...item, status: approved ? 'READY_FOR_PICKUP' : 'PENDING', approvedAt: isoNow(), assignedBookId: approved ? book.id : null, pickupDeadline, expiresAt: pickupDeadline } : item), groupId),
        books: approved ? current.books.map((item) => item.id === book.id ? { ...item, availabilityStatus: 'Reserved', availableCopies: 0 } : item) : current.books,
      }, { action: 'RESERVATION_APPROVED', description: `${reservation.bookTitle} reservation reviewed.`, entity: 'reservation', entityId: id, notification: approved ? `Your reserved book '${reservation.bookTitle}' is ready for pickup. Please collect it before ${pickupDeadline}.` : `Reservation for ${reservation.bookTitle} remains in the queue.`, category: 'Reservations', memberId: reservation.memberId }))
      return approved
    }
    const evaluateReservationDeadlines = () => {
      const today = dateString(new Date())
      const expired = state.reservations.filter((item) => item.status === 'READY_FOR_PICKUP' && (item.pickupDeadline || item.expiresAt) && (item.pickupDeadline || item.expiresAt) < today)
      if (!expired.length) return 0
      const reservations = state.reservations.map((item) => ({ ...item }))
      const books = state.books.map((item) => ({ ...item }))
      let nextState = { ...state, reservations, books }
      for (const oldHold of expired) {
        const hold = reservations.find((item) => item.id === oldHold.id)
        if (!hold || hold.status !== 'READY_FOR_PICKUP') continue
        const groupId = hold.titleGroupId || books.find((item) => item.id === hold.bookId)?.titleGroupId || hold.bookId
        const releasedBook = books.find((item) => item.id === hold.assignedBookId) || books.find((item) => item.id === hold.bookId)
        hold.status = 'EXPIRED'
        hold.expiredAt = isoNow()
        if (releasedBook) {
          releasedBook.availabilityStatus = 'Available'
          releasedBook.availableCopies = 1
        }
        const nextPending = reservations.filter((item) => item.status === 'PENDING' && (item.titleGroupId || books.find((copy) => copy.id === item.bookId)?.titleGroupId || item.bookId) === groupId && isReservationEligible(item, { ...state, books, reservations })).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0]
        if (nextPending && releasedBook) {
          const pickupDeadline = dateString(new Date(Date.now() + Number(state.settings.pickupWindowDays || 2) * 86400000))
          nextPending.status = 'READY_FOR_PICKUP'
          nextPending.assignedBookId = releasedBook.id
          nextPending.readyAt = isoNow()
          nextPending.pickupDeadline = pickupDeadline
          nextPending.expiresAt = pickupDeadline
          releasedBook.availabilityStatus = 'Reserved'
          releasedBook.availableCopies = 0
          nextState = addEvent(nextState, {
            action: 'RESERVATION_READY',
            description: `${nextPending.bookTitle} moved to ${nextPending.memberName} after the previous pickup expired.`,
            entity: 'reservation',
            entityId: nextPending.id,
            notification: `Your reserved book '${nextPending.bookTitle}' is ready for pickup. Please collect it before ${pickupDeadline}.`,
            category: 'Reservations',
            memberId: nextPending.memberId,
          })
        }
        nextState = addEvent(nextState, {
          action: 'RESERVATION_EXPIRED',
          description: `Pickup window expired for ${hold.bookTitle} reserved by ${hold.memberName}.`,
          entity: 'reservation',
          entityId: hold.id,
          notification: `Your pickup window for '${hold.bookTitle}' expired.`,
          category: 'Reservations',
          memberId: hold.memberId,
        })
      }
      for (const groupId of new Set(reservations.filter((item) => ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)).map((item) => item.titleGroupId || item.bookId))) {
        nextState.reservations = resequenceReservations(nextState.reservations, groupId)
      }
      commit(() => nextState)
      return expired.length
    }
    const settleFine = (id, status, reason = '', paymentMethod = 'Cash', paymentAmount) => {
      permission(state, status === 'PAID' ? 'FINE_PAY' : 'FINE_WAIVE')
      const fine = requireRecord(state.fines, id, 'Fine')
      if (!['PENDING', 'PARTIALLY_PAID'].includes(fine.status)) throw new Error(`Only unpaid fines can be ${status.toLowerCase()}.`)
      const settledAt = isoNow()
      const remaining = Number(fine.remainingAmount ?? (fine.amount - (fine.paidAmount || 0)))
      const paidNow = status === 'PAID' ? Number(paymentAmount ?? remaining) : 0
      if (status === 'PAID' && (!Number.isFinite(paidNow) || paidNow <= 0 || paidNow > remaining)) throw new Error(`Payment must be greater than zero and no more than the remaining balance of ₹${remaining}.`)
      const paidAmount = status === 'PAID' ? Number(fine.paidAmount || 0) + paidNow : Number(fine.paidAmount || 0)
      const remainingAmount = status === 'WAIVED' ? 0 : Math.max(0, remaining - paidNow)
      const nextFineStatus = status === 'WAIVED' ? 'WAIVED' : remainingAmount === 0 ? 'PAID' : 'PARTIALLY_PAID'
      const paymentReference = status === 'PAID' ? `PAY-${id}-${Date.now()}` : null
      const payment = status === 'PAID' ? { amount: paidNow, paymentMethod, paymentReference, paidAt: settledAt, paidBy: state.currentUser?.name || 'Demo user' } : null
      commit((current) => addEvent({
        ...current,
        fines: current.fines.map((item) => item.id === id ? { ...item, status: nextFineStatus, paidAmount, remainingAmount, payments: payment ? [...(item.payments || []), payment] : item.payments || [], settledAt: remainingAmount === 0 ? settledAt : item.settledAt, settledBy: current.currentUser?.name, paidAt: remainingAmount === 0 && status === 'PAID' ? settledAt : item.paidAt, paymentDate: status === 'PAID' ? settledAt : item.paymentDate, paymentReference: paymentReference || item.paymentReference, paymentMethod: status === 'PAID' ? paymentMethod : item.paymentMethod, collectedBy: status === 'PAID' ? current.currentUser?.name : item.collectedBy, waivedAt: status === 'WAIVED' ? settledAt : item.waivedAt, waivedBy: status === 'WAIVED' ? current.currentUser?.name : item.waivedBy, waiverReason: status === 'WAIVED' ? reason : item.waiverReason, reason: status === 'WAIVED' ? reason : item.reason } : item),
        members: current.members.map((item) => item.id === fine.memberId ? { ...item, fineAmount: Math.max(0, (item.fineAmount || 0) - (status === 'PAID' ? paidNow : remaining)) } : item),
      }, { action: status === 'PAID' ? 'FINE_PAID' : 'FINE_WAIVED', description: `${status === 'PAID' ? `Payment ₹${paidNow} recorded` : `Waived remaining ₹${remaining} (${reason || 'no reason provided'})`} for ${fine.memberName}; balance ₹${remainingAmount}.`, entity: 'fine', entityId: id, notification: `Fine ${status === 'PAID' ? 'payment recorded' : 'waived'} for ${fine.bookTitle}. Remaining balance ₹${remainingAmount}.`, category: 'Fines', memberId: fine.memberId }))
      return true
    }
    const payOwnFine = (id, paymentMethod = 'Cash', paymentAmount) => {
      const fine = requireRecord(state.fines, id, 'Fine')
      const role = getRoleForAccount(state.currentUser?.role)
      if (!['STUDENT', 'FACULTY'].includes(role) || fine.memberId !== state.currentUser?.memberId) throw new Error('You can only pay fines linked to your own library account.')
      if (!['Cash', 'UPI', 'Card'].includes(paymentMethod)) throw new Error('Choose a supported payment method.')
      if (!['PENDING', 'PARTIALLY_PAID'].includes(fine.status)) throw new Error('This fine has no outstanding balance.')
      const remaining = Number(fine.remainingAmount ?? (fine.amount - (fine.paidAmount || 0)))
      const paidNow = Number(paymentAmount ?? remaining)
      if (!Number.isFinite(paidNow) || paidNow <= 0 || paidNow > remaining) throw new Error(`Payment must be greater than zero and no more than the remaining balance of ₹${remaining}.`)
      const paidAmount = Number(fine.paidAmount || 0) + paidNow
      const remainingAmount = Math.max(0, remaining - paidNow)
      const settledAt = isoNow()
      const paymentReference = `PAY-${id}-${Date.now()}`
      commit((current) => addEvent({
        ...current,
        fines: current.fines.map((item) => item.id === id ? { ...item, status: remainingAmount === 0 ? 'PAID' : 'PARTIALLY_PAID', paidAmount, remainingAmount, payments: [...(item.payments || []), { amount: paidNow, paymentMethod, paymentReference, paidAt: settledAt, paidBy: current.currentUser?.name || 'Self-service' }], paidAt: remainingAmount === 0 ? settledAt : item.paidAt, settledAt: remainingAmount === 0 ? settledAt : item.settledAt, paymentDate: settledAt, paymentReference, paymentMethod, collectedBy: 'Self-service', settledBy: current.currentUser?.name } : item),
        members: current.members.map((item) => item.id === fine.memberId ? { ...item, fineAmount: Math.max(0, (item.fineAmount || 0) - paidNow) } : item),
      }, {
        action: 'FINE_PAID', description: `${fine.memberName} paid ₹${paidNow} via ${paymentMethod} for ${fine.bookTitle}; balance ₹${remainingAmount}.`, entity: 'fine', entityId: id,
        notification: `Payment of ₹${paidNow} recorded for ${fine.bookTitle}. Remaining balance ₹${remainingAmount}.`, category: 'Fines', memberId: fine.memberId,
      }))
      return true
    }
    const reverseFinePayment = (id, reason = '') => {
      permission(state, 'FINE_PAY')
      const fine = requireRecord(state.fines, id, 'Fine')
      if (fine.status !== 'PAID') throw new Error('Only paid fines can be reversed.')
      commit((current) => addEvent({
        ...current,
        fines: current.fines.map((item) => item.id === id ? { ...item, status: 'PENDING', paidAmount: 0, remainingAmount: item.amount, paidAt: null, reversedAt: isoNow(), reversalReason: reason } : item),
        members: current.members.map((item) => item.id === fine.memberId ? { ...item, fineAmount: (item.fineAmount || 0) + fine.amount } : item),
      }, { action: 'FINE_PAYMENT_REVERSED', description: `Reversed ₹${fine.amount} fine payment for ${fine.memberName}: ${reason || 'no reason provided'}.`, entity: 'fine', entityId: id }))
      return true
    }
    const scanRFID = (rfid, options = {}) => {
      permission(state, 'RFID_SCAN')
      if (!state.settings.simulationMode) throw new Error('RFID simulation is disabled; physical reader integration is not available in this prototype.')
      const uid = formatRFID(rfid)
      if (!uid) throw new Error('Enter an RFID tag UID to scan.')
      if (!isValidRFID(uid, 'book')) throw new Error('Book RFID UID format is invalid.')
      const normalizedUid = normalizeRFID(uid)
      const book = state.books.find((item) => normalizeRFID(item.rfidId) === normalizedUid)
      const timestamp = isoNow()
      const duplicate = state.settings.duplicateScanPrevention && normalizeRFID(state.lastRFIDScan?.rfidId) === normalizedUid && Date.now() - new Date(state.lastRFIDScan.timestamp).getTime() < 1500
      if (duplicate) return book || null
      const log = { id: createId('RFLOG'), rfidId: uid, rfidType: 'BOOK', entityId: book?.id || uid, entityName: book?.title || 'Unknown RFID', bookId: book?.id || null, bookTitle: book?.title || 'Unknown RFID', event: options.event || 'LOOKUP', operation: options.event || 'LOOKUP', result: book ? 'SUCCESS' : 'NOT_FOUND', device: 'Simulation Bridge', user: state.currentUser?.name || 'Demo user', location: options.location || 'Central Library', timestamp }
      commit((current) => addEvent({
        ...current,
        lastRFIDScan: { rfidId: uid, rfidType: 'BOOK', bookId: book?.id || null, title: book?.title || null, timestamp },
        rfidLogs: [log, ...current.rfidLogs],
        rfidDevices: current.rfidDevices.map((device, index) => index === 0 ? { ...device, totalScans: device.totalScans + 1, status: 'CONNECTED', lastHeartbeat: timestamp } : device),
      }, { action: 'RFID_SCANNED', description: `Scanned RFID ${uid}${book ? ` (${book.title})` : ' (not found)'}.`, entity: 'book', entityId: book?.id || uid, notification: book ? `RFID tag scanned: ${book.title}` : null, category: 'RFID' }))
      return book || null
    }
    const scanMemberRFID = (rfid, options = {}) => {
      permission(state, 'RFID_SCAN')
      if (!state.settings.simulationMode) throw new Error('RFID simulation is disabled; physical reader integration is not available in this prototype.')
      const uid = formatRFID(rfid)
      if (!isValidRFID(uid, 'member')) throw new Error('Member RFID UID format is invalid.')
      const normalizedUid = normalizeRFID(uid)
      const member = state.members.find((item) => normalizeRFID(item.rfidCardId) === normalizedUid && !item.archived)
      const timestamp = isoNow()
      if (state.settings.duplicateScanPrevention && normalizeRFID(state.lastRFIDScan?.rfidId) === normalizedUid && Date.now() - new Date(state.lastRFIDScan.timestamp).getTime() < 1500) return member || null
      const log = { id: createId('RFLOG'), rfidId: uid, rfidType: 'MEMBER', entityId: member?.id || uid, entityName: member?.name || 'Unknown member RFID', memberId: member?.id || null, event: options.event || 'MEMBER_LOOKUP', operation: options.event || 'MEMBER_LOOKUP', result: member ? 'SUCCESS' : 'NOT_FOUND', device: 'Simulation Bridge', user: state.currentUser?.name || 'Demo user', timestamp }
      commit((current) => addEvent({
        ...current,
        lastRFIDScan: { rfidId: uid, rfidType: 'MEMBER', memberId: member?.id || null, title: member?.name || null, timestamp },
        rfidLogs: [log, ...current.rfidLogs],
        rfidDevices: current.rfidDevices.map((device, index) => index === 0 ? { ...device, totalScans: device.totalScans + 1, status: 'CONNECTED', lastHeartbeat: timestamp } : device),
      }, { action: 'RFID_MEMBER_SCANNED', description: `Scanned member RFID ${uid}${member ? ` (${member.name})` : ' (not found)'}.`, entity: 'member', entityId: member?.id || uid, notification: null, category: 'RFID' }))
      return member || null
    }
    const lookupMemberRFID = (rfid) => state.members.find((item) => normalizeRFID(item.rfidCardId) === normalizeRFID(rfid) && !item.archived) || null
    const registerRFID = (bookId, rfid) => {
      permission(state, 'RFID_REGISTER')
      const book = requireRecord(state.books, bookId, 'Book')
      const uid = formatRFID(rfid)
      ensureUniqueRFID(state, uid, bookId)
      if (!uid) throw new Error('Scan or enter an RFID UID before assigning it.')
      const timestamp = isoNow()
      const registered = book.availabilityStatus === 'Pending Registration'
      const updated = { ...book, rfidId: uid, rfidStatus: 'Active', availabilityStatus: registered ? 'Available' : book.availabilityStatus, availableCopies: registered ? 1 : book.availableCopies, updatedAt: timestamp }
      commit((current) => {
        const next = addEvent({ ...current, books: current.books.map((item) => item.id === bookId ? updated : item), rfidLogs: [{ id: createId('RFLOG'), rfidId: uid, rfidType: 'BOOK', entityId: bookId, entityName: book.title, bookId, bookTitle: book.title, event: 'REGISTER', operation: 'RFID_REGISTER', result: 'SUCCESS', device: 'Simulation Bridge', user: current.currentUser?.name || 'Demo user', location: book.location, timestamp }, ...current.rfidLogs] }, {
          action: 'RFID_REGISTERED', description: `Registered RFID ${rfid} to ${book.title}.`, entity: 'book', entityId: bookId,
          notification: `RFID tag registered successfully for ${book.title}.`, category: 'RFID',
        })
        return registered ? promoteWaitingReservations(next, book.titleGroupId || book.id) : next
      })
      return updated
    }
    const markCondition = (id, condition) => {
      permission(state, 'INVENTORY_VIEW')
      const book = requireRecord(state.books, id, 'Book')
      if (!['Good', 'Fair', 'Damaged', 'Lost', 'Under Repair'].includes(condition)) throw new Error('Choose a valid book condition.')
      if (state.transactions.some((item) => item.bookId === id && item.status === 'Issued')) throw new Error('Book condition cannot be changed while it has an active loan.')
      commit((current) => {
        const next = addEvent({
          ...current,
          books: current.books.map((item) => item.id === id ? { ...item, condition, availabilityStatus: ['Lost', 'Damaged', 'Under Repair'].includes(condition) ? condition : 'Available', availableCopies: ['Good', 'Fair'].includes(condition) ? 1 : 0, updatedAt: isoNow() } : item),
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
        })
        return ['Good', 'Fair'].includes(condition) ? promoteWaitingReservations(next, book.titleGroupId || book.id) : next
      })
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
    const createSupplier = (input) => {
      permission(state, 'ACQUISITION_MANAGE')
      if (!input.supplierName?.trim()) throw new Error('Supplier name is required.')
      if (input.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Enter a valid supplier email address.')
      const supplierId = createId('SUP')
      const supplier = { ...input, id: supplierId, supplierId, supplierName: input.supplierName.trim(), status: input.status || 'Active', createdAt: isoNow(), updatedAt: isoNow() }
      commit((current) => addEvent({ ...current, suppliers: [supplier, ...(current.suppliers || [])] }, {
        action: 'SUPPLIER_CREATED', description: `Added supplier ${supplier.supplierName}.`, entity: 'supplier', entityId: supplierId,
      }))
      return supplier
    }
    const updateSupplier = (id, changes) => {
      permission(state, 'ACQUISITION_MANAGE')
      const supplier = requireRecord(state.suppliers || [], id, 'Supplier')
      if (!changes.supplierName?.trim()) throw new Error('Supplier name is required.')
      if (changes.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) throw new Error('Enter a valid supplier email address.')
      const updated = { ...supplier, ...changes, supplierName: changes.supplierName.trim(), updatedAt: isoNow() }
      commit((current) => addEvent({ ...current, suppliers: current.suppliers.map((item) => item.id === id ? updated : item) }, {
        action: 'SUPPLIER_UPDATED', description: `Updated supplier ${updated.supplierName}.`, entity: 'supplier', entityId: id,
      }))
      return updated
    }
    const deleteSupplier = (id) => {
      permission(state, 'ACQUISITION_MANAGE')
      const supplier = requireRecord(state.suppliers || [], id, 'Supplier')
      if (state.acquisitions.some((item) => item.supplierId === id)) throw new Error('This supplier is linked to purchase orders and cannot be deleted.')
      commit((current) => addEvent({ ...current, suppliers: current.suppliers.filter((item) => item.id !== id) }, {
        action: 'SUPPLIER_DELETED', description: `Deleted supplier ${supplier.supplierName}.`, entity: 'supplier', entityId: id,
      }))
      return true
    }
    const createAcquisition = (input) => {
      permission(state, 'ACQUISITION_MANAGE')
      const requestedItems = input.items?.length ? input.items : [input]
      if (!input.vendor?.trim() || requestedItems.some((item) => !item.title?.trim() || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || !Number.isFinite(Number(item.unitCost ?? item.unitPrice)) || Number(item.unitCost ?? item.unitPrice) < 0)) throw new Error('Vendor, each item title, positive whole quantity, and non-negative unit cost are required.')
      const timestamp = isoNow()
      const acquisitionId = createId('ACQ')
      const purchaseOrderNumber = `PO-${new Date().getFullYear()}-${String(state.acquisitions.length + 1).padStart(4, '0')}`
      const supplier = (state.suppliers || []).find((item) => item.id === input.supplierId)
      const items = requestedItems.map((item, index) => {
        const quantity = Number(item.quantity)
        const unitCost = Number(item.unitCost ?? item.unitPrice)
        return { ...item, itemId: item.itemId || `${acquisitionId}-ITEM-${index + 1}`, title: item.title.trim(), quantity, unitCost, totalCost: quantity * unitCost, receivedQuantity: 0 }
      })
      const quantity = items.reduce((total, item) => total + item.quantity, 0)
      const total = items.reduce((sum, item) => sum + item.totalCost, 0)
      const firstItem = items[0]
      const acquisition = { ...input, ...firstItem, vendor: supplier?.supplierName || input.vendor, supplierId: supplier?.id || input.supplierId || null, id: acquisitionId, acquisitionId, purchaseOrderNumber, quantity, quantityOrdered: quantity, totalQuantity: quantity, quantityReceived: 0, unitPrice: firstItem.unitCost, total, totalCost: total, items, receivedQuantity: 0, orderDate: input.orderDate || dateString(new Date()), expectedDate: input.expectedDelivery || input.expectedDate || '', expectedDelivery: input.expectedDelivery || input.expectedDate || '', status: 'ORDERED', createdAt: timestamp }
      commit((current) => addEvent({ ...current, acquisitions: [acquisition, ...current.acquisitions] }, {
        action: 'ACQUISITION_CREATED', description: `Created purchase order for ${items.length} title(s), ${acquisition.quantity} total copies.`, entity: 'acquisition', entityId: acquisition.id,
        notification: `Acquisition request created: ${items.map((item) => item.title).join(', ')}`, category: 'Acquisitions',
      }))
      return acquisition
    }
    const receiveAcquisition = (id, quantity, itemIndex = 0) => {
      permission(state, 'ACQUISITION_MANAGE')
      const order = requireRecord(state.acquisitions, id, 'Acquisition')
      if (['CANCELLED', 'RECEIVED'].includes(order.status)) throw new Error('This acquisition is already cancelled or fully received.')
      const orderItems = order.items?.length ? order.items : [{ ...order, quantity: order.quantity, unitCost: order.unitPrice, receivedQuantity: order.receivedQuantity || 0 }]
      const selectedItem = orderItems[itemIndex]
      if (!selectedItem) throw new Error('Select a valid purchase order item.')
      const received = Number(quantity || selectedItem.quantity)
      if (received < 1 || received + Number(selectedItem.receivedQuantity || 0) > selectedItem.quantity) throw new Error('Received quantity must be positive and cannot exceed this item’s remaining quantity.')
      let accessionSeed = state.books
      let copySeed = state.books
      const titleGroupId = resolveTitleGroupId(state.books, selectedItem)
      const copies = Array.from({ length: received }, (_, index) => {
        const nextAcc = createAccessionNumber(accessionSeed)
        accessionSeed = [...accessionSeed, { accessionNumber: nextAcc }]
        const copyId = createId('BK')
        const rfidId = generateRFID(copySeed)
        const copy = { id: copyId, bookId: copyId, copyId, accessionNumber: nextAcc, titleGroupId, copyNumber: (selectedItem.receivedQuantity || 0) + index + 1, bookCode: createId('B'), title: selectedItem.title, author: selectedItem.author || 'To be catalogued', authors: selectedItem.author || 'To be catalogued', isbn: selectedItem.isbn || '', publisher: order.vendor, category: selectedItem.category || 'General Knowledge', categoryId: selectedItem.categoryId || classificationId(state.books, 'category', selectedItem.category || 'General Knowledge', 'CAT'), subCategory: selectedItem.subcategory || selectedItem.subCategory || '', subcategoryId: selectedItem.subcategoryId || classificationId(state.books, 'subCategory', selectedItem.subcategory || selectedItem.subCategory || '', 'SUB'), department: selectedItem.department || order.department || 'General', language: 'English', publicationYear: Number(selectedItem.publicationYear || new Date().getFullYear()), edition: Number(selectedItem.edition || 1), pages: Number(selectedItem.pages || 0), format: 'Paperback', description: `Received from acquisition ${order.purchaseOrderNumber || order.id}.`, rfidId, rfidUid: rfidId, rfidStatus: 'Active', availabilityStatus: 'Available', status: 'Available', condition: 'Good', shelf: '', rack: '', floor: '', location: 'Central Library / Acquisitions', quantity: 1, totalCopies: 1, availableQuantity: 1, availableCopies: 1, issuedCopies: 0, reservedCopies: 0, price: selectedItem.unitCost ?? order.unitPrice, acquisitionDate: dateString(new Date()), borrowerId: null, currentHolderId: null, dueDate: null, createdAt: isoNow(), updatedAt: isoNow(), acquisitionId: id, archived: false }
        copySeed = [...copySeed, copy]
        return copy
      })
      const updatedItems = orderItems.map((item, index) => index === itemIndex ? { ...item, receivedQuantity: Number(item.receivedQuantity || 0) + received } : item)
      const receivedTotal = updatedItems.reduce((sum, item) => sum + Number(item.receivedQuantity || 0), 0)
      const status = updatedItems.every((item) => Number(item.receivedQuantity || 0) >= Number(item.quantity)) ? 'RECEIVED' : receivedTotal > 0 ? 'PARTIALLY_RECEIVED' : 'ORDERED'
      commit((current) => addEvent({
        ...current,
        books: [...copies, ...current.books],
        acquisitions: current.acquisitions.map((item) => item.id === id ? { ...item, items: updatedItems, receivedQuantity: receivedTotal, quantityReceived: receivedTotal, status, receivedAt: isoNow() } : item),
      }, { action: 'ACQUISITION_RECEIVED', description: `Received ${received} tagged, available copy/copies of ${selectedItem.title}.`, entity: 'acquisition', entityId: id, notification: `Received ${received} copy/copies of ${selectedItem.title}; unique RFID tags assigned.`, category: 'Acquisitions' }))
      commit((current) => promoteWaitingReservations(current, titleGroupId))
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
      updated.totalQuantity = updated.quantity
      updated.totalCost = updated.total
      updated.quantityOrdered = updated.quantity
      updated.items = [{ title: updated.title, author: updated.author || '', category: updated.category || '', edition: updated.edition || '', quantity: updated.quantity, unitCost: updated.unitPrice, totalCost: updated.total }]
      commit((current) => addEvent({ ...current, acquisitions: current.acquisitions.map((item) => item.id === id ? updated : item) }, {
        action: 'ACQUISITION_UPDATED', description: `Updated acquisition ${updated.id} for ${updated.title}.`, entity: 'acquisition', entityId: id,
      }))
      return updated
    }
    const createAudit = (filters = {}) => {
      permission(state, 'INVENTORY_AUDIT')
      if (state.inventoryAudits.some((audit) => audit.status === 'IN_PROGRESS')) throw new Error('Complete the active inventory audit before starting another.')
      const expected = state.books.filter((book) => !book.archived && (!filters.location || book.location === filters.location))
      const audit = { id: createId('AUDIT'), ...filters, startedAt: isoNow(), completedAt: null, status: 'IN_PROGRESS', expected: expected.length, expectedBookIds: expected.map((book) => book.id), found: 0, missing: [], unexpected: [], misplaced: [], scannedRFIDs: [], scannedBookIds: [] }
      commit((current) => ({ ...current, inventoryAudits: [audit, ...current.inventoryAudits] }))
      return audit
    }
    const completeAudit = (auditId) => {
      permission(state, 'INVENTORY_AUDIT')
      const audit = requireRecord(state.inventoryAudits, auditId, 'Inventory audit')
      if (audit.status !== 'IN_PROGRESS') throw new Error('This inventory audit is not active.')
      const scannedBookIds = audit.scannedBookIds || []
      const missing = (audit.expectedBookIds || []).filter((id) => !scannedBookIds.includes(id)).map((id) => state.books.find((book) => book.id === id)).filter(Boolean)
      const found = (audit.expectedBookIds || []).filter((id) => scannedBookIds.includes(id)).length
      const completedAt = isoNow()
      commit((current) => addEvent({
        ...current,
        inventoryAudits: current.inventoryAudits.map((item) => item.id === auditId ? { ...item, status: 'COMPLETED', completedAt, found, missing } : item),
      }, {
        action: 'INVENTORY_AUDIT_COMPLETED', description: `RFID shelf audit completed: ${found}/${audit.expected} found.`, entity: 'inventoryAudit', entityId: auditId,
        notification: `Inventory audit completed: ${missing.length} items need review.`, category: 'Inventory',
      }))
      return { ...audit, status: 'COMPLETED', completedAt, found, missing }
    }
    const updateSettings = (changes) => {
      permission(state, 'SETTINGS_MANAGE')
      const nextSettings = { ...state.settings, ...changes }
      for (const key of ['loanPeriodDays', 'finePerDay', 'borrowingLimit', 'renewalLimit']) {
        if (Number(nextSettings[key]) < 0 || !Number.isFinite(Number(nextSettings[key]))) throw new Error(`${key} must be a non-negative number.`)
      }
      if (Number(nextSettings.loanPeriodDays) < 1 || Number(nextSettings.borrowingLimit) < 1) throw new Error('Loan period and borrowing limit must be at least one.')
      for (const key of ['pickupWindowDays', 'maximumActiveReservations']) {
        if (!Number.isInteger(Number(nextSettings[key])) || Number(nextSettings[key]) < 1) throw new Error(`${key} must be a positive whole number.`)
      }
      for (const [memberType, rule] of Object.entries(nextSettings.memberTypeRules || {})) {
        if (!Number.isInteger(Number(rule.borrowingLimit)) || Number(rule.borrowingLimit) < 1 || !Number.isInteger(Number(rule.loanPeriodDays)) || Number(rule.loanPeriodDays) < 1) throw new Error(`${memberType} borrowing limit and loan period must be positive whole numbers.`)
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
    const markNotificationRead = (id) => {
      const target = requireRecord(state.notifications, id, 'Notification')
      const role = getRoleForAccount(state.currentUser?.role)
      if (['STUDENT', 'FACULTY'].includes(role) && target.memberId !== state.currentUser?.memberId) throw new Error('You can only mark your own notifications as read.')
      return commit((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === id || item.notificationId === id ? { ...item, read: true } : item) }))
    }
    const markAllNotificationsRead = () => {
      const role = getRoleForAccount(state.currentUser?.role)
      return commit((current) => ({ ...current, notifications: current.notifications.map((item) => !['STUDENT', 'FACULTY'].includes(role) || item.memberId === current.currentUser?.memberId ? { ...item, read: true } : item) }))
    }
    const setCurrentUser = (account) => {
      const user = state.users.find((item) => item.role === getRoleForAccount(account.role)) || {}
      const accountRole = getRoleForAccount(account.role)
      const resolved = { ...user, ...account, role: accountRole, id: user.id || createId('U'), memberId: accountRole === 'STUDENT' ? account.memberId || state.members[0]?.id || null : account.memberId || null, preferences: account.preferences || user.preferences || { emailNotifications: true, compactTables: false } }
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
      permission(state, 'INVENTORY_AUDIT')
      const audit = requireRecord(state.inventoryAudits, auditId, 'Inventory audit')
      if (audit.status !== 'IN_PROGRESS') throw new Error('This inventory audit is not active.')
      const uid = formatRFID(rfid)
      const book = scanRFID(uid, { event: 'INVENTORY_AUDIT_SCAN', location: audit.location || 'All locations' })
      if (!book) throw new Error(`Book not found for RFID ${uid}.`)
      if ((audit.scannedBookIds || []).includes(book.id)) throw new Error(`${book.title} has already been scanned in this audit.`)
      const expected = (audit.expectedBookIds || []).includes(book.id)
      const misplaced = audit.location && book.location !== audit.location
        ? { ...book, detectedLocation: audit.location }
        : null
      commit((current) => ({
        ...current,
        inventoryAudits: current.inventoryAudits.map((item) => item.id === auditId ? {
          ...item,
          scannedRFIDs: [...new Set([...(item.scannedRFIDs || []), uid])],
          scannedBookIds: [...new Set([...(item.scannedBookIds || []), book.id])],
          found: (item.found || 0) + (expected ? 1 : 0),
          unexpected: expected ? item.unexpected || [] : [...(item.unexpected || []), book],
          misplaced: misplaced ? [...(item.misplaced || []), misplaced] : item.misplaced || [],
        } : item),
      }))
      return { audit, book, expected, misplaced: Boolean(misplaced) }
    }
    const updateProfileData = updateProfile
    return {
      getBooks: () => state.books.filter((book) => !book.archived).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
      getBook: (id) => state.books.find((book) => book.id === id) || null,
      getBookByRFID: (rfid) => state.books.find((book) => normalizeRFID(book.rfidId) === normalizeRFID(rfid)) || null,
      searchBooks: (query = '', filters = {}) => {
        const text = query.trim().toLowerCase()
        const normalized = normalizeRFID(query)
        return state.books.filter((book) => !book.archived
          && (!['STUDENT', 'FACULTY'].includes(getRoleForAccount(state.currentUser?.role)) || book.availabilityStatus !== 'Pending Registration')
          && (!text || [book.title, book.author, book.isbn, book.rfidId, book.accessionNumber, book.titleGroupId, book.category, book.categoryId, book.subCategory, book.subcategoryId].some((value) => String(value || '').toLowerCase().includes(text)) || Boolean(normalized && normalizeRFID(book.rfidId) === normalized))
          && (!filters.category || book.category === filters.category)
          && (!filters.status || book.availabilityStatus === filters.status)
          && (!filters.rfid || Boolean(book.rfidId) === filters.rfid))
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      },
      createBook, updateBook, archiveBook,
      getMembers: () => state.members.filter((member) => !member.archived).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
      getMember: (id) => state.members.find((member) => member.id === id) || null,
      searchMembers: (query = '', filters = {}) => {
        const text = query.trim().toLowerCase()
        const normalized = normalizeRFID(query)
        return state.members.filter((member) => !member.archived
          && (!text || `${member.id} ${member.memberId} ${member.name} ${member.studentId} ${member.registrationNumber} ${member.libraryId} ${member.rfidCardId}`.toLowerCase().includes(text) || Boolean(normalized && normalizeRFID(member.rfidCardId) === normalized))
          && (!filters.year || String(member.year) === String(filters.year))
          && (!filters.department || member.department === filters.department)
          && (!filters.section || member.section === filters.section)
          && (!filters.status || member.status === filters.status))
      },
      getMemberCurrentLoans: (memberId) => state.transactions.filter((item) => item.memberId === memberId && item.status === 'Issued'),
      getMemberHistory: (memberId) => state.transactions.filter((item) => item.memberId === memberId),
      getMemberFines: (memberId) => state.fines.filter((item) => item.memberId === memberId),
      getMemberReservations: (memberId) => state.reservations.filter((item) => item.memberId === memberId),
      getBookQuantities: (titleGroupId) => {
        const copies = state.books.filter((item) => !item.archived && (item.titleGroupId || item.id) === titleGroupId)
        return {
          total: copies.length,
          available: copies.filter((item) => item.availabilityStatus === 'Available').length,
          issued: copies.filter((item) => item.availabilityStatus === 'Issued' || item.availabilityStatus === 'Overdue').length,
          reserved: copies.filter((item) => ['Reserved', 'Ready for Pickup', 'READY_FOR_PICKUP'].includes(item.availabilityStatus)).length,
          lost: copies.filter((item) => item.condition === 'Lost' || item.availabilityStatus === 'Lost').length,
          damaged: copies.filter((item) => item.condition === 'Damaged' || item.availabilityStatus === 'Damaged').length,
        }
      },
      getBookCopies: (titleGroupId) => state.books.filter((item) => item.titleGroupId === titleGroupId),
      getBookCurrentHolders: (titleGroupId) => state.transactions.filter((item) => item.titleGroupId === titleGroupId && item.status === 'Issued'),
      getBookHistory: (titleGroupId) => state.transactions.filter((item) => item.titleGroupId === titleGroupId),
      getLoansByMember: (memberId) => state.transactions.filter((item) => item.memberId === memberId),
      getLoansByBookCopy: (copyId) => state.transactions.filter((item) => item.bookId === copyId),
      createMember, updateMember, archiveMember,
      lookupMemberRFID, scanMemberRFID,
      issueBook, returnBook, renewBook, validateIssue,
      getActiveLoans: () => state.transactions.filter((item) => item.status === 'Issued'),
      getLoanHistory: () => state.transactions,
      getReservations: read((current) => current.reservations),
      createReservation, cancelReservation, approveReservation, fulfillReservation,
      getFines: read((current) => current.fines),
      payFine: (id, paymentMethod, amount) => settleFine(id, 'PAID', '', paymentMethod, amount),
      payOwnFine,
      waiveFine: (id, reason) => settleFine(id, 'WAIVED', reason),
      reverseFinePayment,
      scanRFID, lookupRFID: (rfid) => state.books.find((book) => normalizeRFID(book.rfidId) === normalizeRFID(rfid)) || null,
      validateRFID: (rfid, exceptId) => {
        const uid = formatRFID(rfid)
        return isValidRFID(uid, 'book') && !state.books.some((book) => normalizeRFID(book.rfidId) === normalizeRFID(uid) && book.id !== exceptId)
      },
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
      startInventoryAudit: createInventoryAudit, scanInventoryRFID: auditScan, completeInventoryAudit: completeAudit,
      getAcquisitions: read((current) => current.acquisitions), createAcquisition, updateAcquisition, receiveAcquisition, cancelAcquisition,
      getSuppliers: read((current) => current.suppliers || []), createSupplier, updateSupplier, deleteSupplier,
      evaluateReservationDeadlines,
      getNotifications: read((current) => current.notifications),
      markNotificationRead, markAllNotificationsRead,
      getSettings: read((current) => current.settings), updateSettings, resetDemoData,
      updateProfile: updateProfileData, login: setCurrentUser, logout,
      createRFID: () => generateRFID(state.books),
      createMemberCard: () => generateMemberRFID(state.members),
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
