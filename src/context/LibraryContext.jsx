import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createLibraryApi } from '../api/index.js'
import { apiClient, clearSessionTokens, getSessionTokens, setSessionTokens } from '../api/client.js'
import { getRoleForAccount, hasPermission } from '../utils/permissions.js'
import { formatRFID, normalizeRFID } from '../utils/rfid.js'
import { LibraryContext } from './LibraryContext.js'

const emptyState = () => ({ books: [], members: [], transactions: [], reservations: [], fines: [], users: [], currentUser: null, rfidLogs: [], rfidDevices: [], notifications: [], acquisitions: [], suppliers: [], auditLogs: [], inventoryAudits: [], settings: {}, lastRFIDScan: null })
const idOf = (v) => v && typeof v === 'object' ? String(v.id || v._id || v.copyId || v.transactionId || '') : v == null ? '' : String(v)
const obj = (v) => v && typeof v === 'object' ? v : {}
const status = (v) => ({ AVAILABLE: 'Available', ISSUED: 'Issued', OVERDUE: 'Issued', RESERVED: 'Reserved', DAMAGED: 'Damaged', LOST: 'Lost', UNDER_REPAIR: 'Under Repair', ACTIVE: 'Active', INACTIVE: 'Inactive', BLOCKED: 'Blocked', SUSPENDED: 'Blocked' })[String(v || '').toUpperCase()] || v || 'Unknown'
const date = (v) => v ? String(v).slice(0, 10) : null
const mapBook = (x) => {
  const title = obj(x.bookTitleId || x.title)
  const id = idOf(x.copyId || x.id || x._id)
  const titleGroupId = idOf(x.titleId || x.titleGroupId || x.bookTitleId || x.bookId)
  const authors = x.author || (Array.isArray(x.authors || title.authors) ? (x.authors || title.authors).join(', ') : x.authors || title.authors || '')
  const rfidId = x.rfidId || x.rfidUid || ''
  const availabilityStatus = status(x.availabilityStatus || x.status || title.status)
  return { ...title, ...x, id, bookId: id, copyId: id, titleId: titleGroupId, titleGroupId, title: x.title || title.title || '', author: authors, authors, subCategory: x.subCategory || x.subcategory || title.subcategory || '', category: x.category || title.category || '', department: x.department || title.department || '', isbn: x.isbn || title.isbn || '', publicationYear: x.publicationYear || title.publicationYear, edition: x.edition || title.edition, rfidId, rfidUid: rfidId, rfidStatus: rfidId ? 'Active' : 'Pending', availabilityStatus, status: availabilityStatus, condition: status(x.condition || 'GOOD'), location: x.location || x.shelfLocation || '', currentHolderId: idOf(x.currentHolderId || x.borrowerId) || null, currentHolder: x.currentHolderId && typeof x.currentHolderId === 'object' ? mapMember(x.currentHolderId) : null, dueDate: date(x.currentCirculationId?.dueDate || x.dueDate), archived: x.isActive === false || Boolean(x.archived), quantity: x.totalCopies ?? x.quantity ?? 1, totalCopies: x.totalCopies ?? x.quantity ?? 1, availableQuantity: x.availableCopies ?? x.availableQuantity ?? 0, availableCopies: x.availableCopies ?? x.availableQuantity ?? 0 }
}
const mapMember = (x) => {
  const registerNumber = x.registrationNumber || x.registerNumber || x.studentId || ''
  const rfidCardId = x.rfidCardId || x.rfidUid || ''
  return { ...x, id: idOf(x), memberId: idOf(x), studentId: x.studentId || registerNumber, registrationNumber: registerNumber, registerNumber, rfidCardId, rfidUid: rfidCardId, status: status(x.status || x.membershipStatus || (x.isActive === false ? 'INACTIVE' : 'ACTIVE')), memberType: x.memberType || 'Student', archived: x.isActive === false || Boolean(x.archived), booksIssued: x.booksIssued ?? x.totalBooksIssued ?? 0, booksReturned: x.booksReturned ?? x.totalBooksReturned ?? 0, borrowedBooks: x.borrowedBooks ?? x.currentBooksCount ?? 0, overdueBooks: x.overdueBooks ?? x.overdueBooksCount ?? 0, fineAmount: x.fineAmount ?? x.outstandingFine ?? 0, registrationDate: date(x.registrationDate || x.createdAt || x.joinDate), currentBooks: x.currentBooks || [], history: x.history || [] }
}
const mapTransaction = (x) => {
  const copy = obj(x.bookCopyId || x.copy)
  const title = obj(x.bookTitleId || x.book)
  const student = obj(x.studentId || x.student || x.member)
  const id = x.transactionId || x.id || x._id
  const copyId = copy.copyId || idOf(x.bookCopyId || x.copyId || x.bookId)
  return { ...x, id: String(id), transactionId: String(id), bookId: copyId, copyId, titleGroupId: idOf(x.bookTitleId || x.titleGroupId || copy.bookTitleId) || copyId, bookTitle: x.bookTitle || title.title || copy.title || '', memberId: idOf(x.studentId || x.memberId || student), memberName: x.memberName || student.name || '', memberRFID: student.rfidUid || student.rfidCardId || '', rfidId: x.bookRfid || x.rfidId || copy.rfidUid || '', bookRfid: x.bookRfid || x.rfidId || copy.rfidUid || '', issueDate: date(x.issueDate || x.issuedAt), dueDate: date(x.dueDate), returnedDate: date(x.returnDate || x.returnedDate), returnDate: date(x.returnDate || x.returnedDate), returnedAt: x.returnDate || x.returnedAt || null, status: status(x.status), renewalCount: x.renewalCount || 0, fine: x.fineAmount ?? x.fine?.amount ?? x.fine ?? 0, createdAt: x.createdAt || x.issueDate || '' }
}
const mapReservation = (x) => {
  const title = obj(x.bookTitleId || x.book)
  const student = obj(x.studentId || x.student)
  const copyValue = x.preferredCopyId || x.bookCopyId
  const copy = copyValue ? obj(copyValue) : null
  const id = x.reservationId || x.id || x._id
  const memberId = idOf(x.studentId || x.memberId || student)
  const reservationStatus = String(x.status || 'PENDING').toUpperCase()
  return { ...x, id: String(id), reservationId: String(id), bookId: copy?.copyId || idOf(copy || x.bookId || title), titleGroupId: idOf(x.bookTitleId || x.titleGroupId || title), bookTitle: x.bookTitle || title.title || '', category: title.category || '', subcategory: title.subcategory || '', authors: title.authors || [], memberId, studentId: memberId, memberName: x.memberName || student.name || '', studentRFID: student.rfidUid || '', student, bookCopy: copy, bookRFID: copy?.rfidUid || '', requestDate: x.requestDate || x.createdAt, createdAt: x.createdAt || x.requestDate, status: reservationStatus === 'FULFILLED' ? 'COMPLETED' : reservationStatus, assignedBookId: copy?.copyId || idOf(copy || x.assignedBookId) || null, queuePosition: x.queuePosition || 0, expiresAt: x.expiresAt || x.pickupDeadline || null, pickupDeadline: x.pickupDeadline || x.expiresAt || null }
}
const mapFine = (x) => {
  const student = obj(x.studentId || x.student)
  const circ = obj(x.circulationId || x.transaction)
  const title = obj(x.bookTitleId || circ.bookTitleId)
  const copy = obj(x.bookCopyId || circ.bookCopyId)
  const id = x.fineId || x.id || x._id
  return { ...x, id: String(id), fineId: String(id), memberId: idOf(x.studentId || x.memberId || student), studentId: idOf(x.studentId || x.memberId || student), memberName: x.memberName || student.name || '', transactionId: idOf(x.circulationId || x.transactionId || circ), bookId: idOf(x.bookCopyId || x.bookId || copy), titleGroupId: idOf(x.bookTitleId || title), bookTitle: x.bookTitle || title.title || '', dueDate: date(x.dueDate || circ.dueDate), returnedDate: date(x.returnedDate || circ.returnDate), daysLate: x.daysLate ?? x.daysOverdue ?? 0, amount: Number(x.amount || 0), paidAmount: Number(x.paidAmount || 0), remainingAmount: Number(x.remainingAmount ?? (Number(x.amount || 0) - Number(x.paidAmount || 0))), status: String(x.status || 'PENDING').toUpperCase(), reason: x.reason || x.waiverReason || '' }
}
const mapAcquisition = (x) => {
  const id = x.acquisitionId || x.id || x._id
  const items = (x.items || []).map((i) => ({ ...i, itemId: idOf(i) || i.itemId, quantity: i.quantityOrdered ?? i.quantity ?? 0, receivedQuantity: i.quantityReceived ?? i.receivedQuantity ?? 0, unitCost: i.unitCost ?? i.unitPrice ?? 0, totalCost: i.totalCost ?? 0, author: i.author || (Array.isArray(i.authors) ? i.authors.join(', ') : '') }))
  return { ...x, id: String(id), acquisitionId: String(id), purchaseOrderNumber: x.purchaseOrderNumber || x.acquisitionId || String(id), vendor: x.vendor || x.supplierId?.supplierName || '', supplierId: idOf(x.supplierId) || null, items, quantity: x.quantity ?? x.totalQuantity ?? items.reduce((n, i) => n + i.quantity, 0), quantityOrdered: x.quantityOrdered ?? x.totalQuantity ?? x.quantity, totalQuantity: x.totalQuantity ?? x.quantity, quantityReceived: x.quantityReceived ?? x.receivedQuantity ?? 0, receivedQuantity: x.receivedQuantity ?? x.quantityReceived ?? 0, total: x.total ?? x.totalCost ?? 0, totalCost: x.totalCost ?? x.total ?? 0, orderDate: date(x.orderDate || x.createdAt), expectedDelivery: date(x.expectedDelivery || x.expectedDate), status: String(x.status || 'ORDERED').toUpperCase() }
}
const mapSettings = (x = {}) => ({ ...x, libraryName: x.libraryName || '', branch: x.branch || '', workingHours: x.workingHours || x.libraryWorkingHours || '', loanPeriodDays: x.loanPeriodDays ?? x.defaultLoanPeriodDays ?? 0, finePerDay: x.finePerDay ?? x.dailyFineAmount ?? 0, borrowingLimit: x.borrowingLimit ?? x.maximumBooksPerStudent ?? 0, renewalLimit: x.renewalLimit ?? x.maximumRenewals ?? 0, pickupWindowDays: x.pickupWindowDays ?? x.reservationPickupDays ?? 0, maximumActiveReservations: x.maximumActiveReservations ?? x.maximumReservationsPerStudent ?? 0, blockBorrowingWithUnpaidFines: Boolean(x.blockBorrowingWithUnpaidFines), blockBorrowingWithOverdueBooks: Boolean(x.blockBorrowingWithOverdueBooks), allowRenewalWithReservations: Boolean(x.allowRenewalWithReservations), autoLookup: Boolean(x.autoLookup), autoFocus: Boolean(x.autoFocus), duplicateScanPrevention: Boolean(x.duplicateScanPrevention), simulationMode: Boolean(x.simulationMode), memberTypeRules: x.memberTypeRules || {} })
const mapUser = (x, preferences = {}) => ({ ...x, id: idOf(x), role: getRoleForAccount(x.role), memberId: idOf(x.memberId || x.studentId) || null, preferences })

export function LibraryProvider({ children }) {
  const [state, setState] = useState(emptyState)
  const [loading, setLoading] = useState(Boolean(getSessionTokens().accessToken))
  const [error, setError] = useState('')
  const stateRef = useRef(state)

  useEffect(() => { stateRef.current = state }, [state])

  const setUser = useCallback((raw) => {
    const preferences = JSON.parse(localStorage.getItem(`library-preferences:${idOf(raw)}`) || '{}')
    const user = mapUser(raw, preferences)
    setState((current) => {
      const next = { ...current, currentUser: user }
      stateRef.current = next
      return next
    })
    return user
  }, [])

  const loadData = useCallback(async (user) => {
    const role = getRoleForAccount(user.role)
    const staff = ['ADMIN', 'LIBRARIAN', 'ASSISTANT_LIBRARIAN'].includes(role)
    const canSettings = ['ADMIN', 'LIBRARIAN'].includes(role)
    const tasks = [apiClient.list('/book-copies', { limit: 100 }), apiClient.list('/notifications', { limit: 100 })]
    if (staff) {
      tasks.push(apiClient.list('/students', { limit: 100 }), apiClient.list('/circulation', { limit: 100 }), apiClient.list('/reservations', { limit: 100 }), apiClient.list('/fines', { limit: 100 }), apiClient.list('/suppliers', { limit: 100 }), apiClient.list('/acquisitions', { limit: 100 }), apiClient.list('/rfid/logs', { limit: 100 }), apiClient.get('/rfid/devices'), apiClient.list('/inventory/audits', { limit: 100 }), apiClient.list('/audit-logs', { limit: 100 }), apiClient.get('/inventory/summary'), apiClient.get('/dashboard/summary'))
      if (canSettings) tasks.push(apiClient.get('/settings'))
    } else if (['STUDENT', 'FACULTY'].includes(role)) tasks.push(apiClient.get('/students/me'))
    const results = await Promise.all(tasks)
    let members = [], transactions = [], reservations = [], fines = [], suppliers = [], acquisitions = [], rfidLogs = [], rfidDevices = [], inventoryAudits = [], auditLogs = [], summary = null, settings = mapSettings()
    let index = 2
    if (staff) {
      members = results[index++].data.map(mapMember)
      transactions = results[index++].data.map(mapTransaction)
      reservations = results[index++].data.map(mapReservation)
      fines = results[index++].data.map(mapFine)
      suppliers = results[index++].data.map((x) => ({ ...x, id: idOf(x), supplierId: idOf(x), status: status(x.status) }))
      acquisitions = results[index++].data.map(mapAcquisition)
      rfidLogs = results[index++].data.map((x) => ({ ...x, id: idOf(x), rfidId: x.rfidId || x.rfidUid || '', timestamp: x.timestamp || x.createdAt, event: x.event || x.operation, entityId: idOf(x.entityId || x.bookCopyId || x.studentId) }))
      const deviceData = results[index++]
      rfidDevices = (Array.isArray(deviceData) ? deviceData : deviceData?.devices || []).map((device) => ({
        ...device,
        id: idOf(device),
        name: device.name || device.deviceId,
        status: status(device.status),
        signal: device.signal || (device.status === 'ONLINE' ? 'Available' : 'Not detected'),
        totalScans: device.totalScans ?? 0,
      }))
      inventoryAudits = results[index++].data.map((x) => ({ ...x, id: idOf(x), expectedBookIds: x.expectedCopyIds || [], scannedBookIds: x.scannedCopyIds || [], missing: x.missingCopyIds || [], unexpected: x.unexpectedCopyIds || [], misplaced: x.misplacedCopyIds || [] }))
      auditLogs = results[index++].data.map((x) => ({
        ...x,
        id: idOf(x),
        entity: x.entity || x.entityType,
        user: x.user?.name || x.userName || x.performedBy?.name || idOf(x.performedBy) || 'System',
        timestamp: x.timestamp || x.createdAt,
      }))
      const inventorySummary = results[index++]
      summary = { ...(results[index++] || {}), inventory: inventorySummary }
      if (canSettings) settings = mapSettings(results[index])
    } else if (['STUDENT', 'FACULTY'].includes(role)) {
      const member = mapMember(results[index])
      members = [member]
      user = { ...user, memberId: member.id }
      const [loans, holds, memberFines] = await Promise.all([
        apiClient.list(`/circulation/student/${encodeURIComponent(member._id || member.id)}`, { limit: 100 }),
        apiClient.list(`/reservations/student/${encodeURIComponent(member._id || member.id)}`, { limit: 100 }),
        apiClient.list(`/students/${encodeURIComponent(member._id || member.id)}/fines`, { limit: 100 }),
      ])
      transactions = loans.data.map(mapTransaction)
      reservations = holds.data.map(mapReservation)
      fines = memberFines.data.map(mapFine)
    }
    const books = results[0].data.map(mapBook)
    const notifications = results[1].data.map((x) => ({ ...x, id: idOf(x), notificationId: idOf(x), memberId: idOf(x.studentId || x.memberId) || null, title: x.title || x.message, message: x.message || x.title, category: x.category || x.type, entity: x.entity || x.entityType, entityId: idOf(x.entityId), createdAt: x.createdAt || x.timestamp, read: Boolean(x.readAt || x.read) }))
    const currentUser = mapUser(user, stateRef.current.currentUser?.preferences || {})
    const next = { ...emptyState(), books, members, transactions, reservations, fines, suppliers, acquisitions, rfidLogs, rfidDevices, inventoryAudits, auditLogs, notifications, settings, dashboardSummary: summary, currentUser, users: [currentUser] }
    stateRef.current = next
    setState(next)
    setError('')
    return next
  }, [])

  const restoreSession = useCallback(async () => {
    if (!getSessionTokens().accessToken) return
    setLoading(true)
    try {
      const user = await apiClient.get('/auth/me')
      const current = setUser(user)
      if (!current.passwordChangeRequired) await loadData(current)
      else setLoading(false)
    } catch (loadError) {
      clearSessionTokens()
      const next = emptyState()
      stateRef.current = next
      setState(next)
      setError(loadError.message || 'Unable to restore your session.')
    } finally { setLoading(false) }
  }, [loadData, setUser])
  useEffect(() => { const timer = window.setTimeout(restoreSession, 0); return () => window.clearTimeout(timer) }, [restoreSession])

  const actions = useMemo(() => {
    const user = state.currentUser
    const role = getRoleForAccount(user?.role)
    const guard = (permission) => { if (!hasPermission(role, permission)) throw new Error('Access denied. Your role cannot perform this action.') }
    const refresh = async (result) => { if (stateRef.current.currentUser) await loadData(stateRef.current.currentUser); return result }
    const rememberScan = (rfidId, record, type) => {
      const next = {
        ...stateRef.current,
        lastRFIDScan: {
          rfidId: formatRFID(rfidId),
          title: record.title || record.name || '',
          type,
          timestamp: new Date().toISOString(),
        },
      }
      stateRef.current = next
      setState(next)
      return record
    }
    const mutate = async (path, method, body, convert = (x) => x) => refresh(convert(await apiClient[method](path, body)))
    const bookById = (id) => state.books.find((x) => x.id === id || x.copyId === id || x._id === id)
    const memberById = (id) => state.members.find((x) => x.id === id || x._id === id)
    const loanFor = (bookId, memberId) => state.transactions.find((x) => (x.bookId === bookId || x.copyId === bookId) && x.memberId === memberId && x.status === 'Issued')
    return {
      getBooks: () => state.books.filter((x) => !x.archived),
      getBook: (id) => bookById(id) || null,
      async getBookByRFID(uid) { return mapBook(await apiClient.get(`/book-copies/rfid/${encodeURIComponent(formatRFID(uid))}`)) },
      searchBooks: (query = '', filters = {}) => {
        const text = query.toLowerCase(), normalized = normalizeRFID(query)
        return state.books.filter((x) => !x.archived && (!['STUDENT', 'FACULTY'].includes(role) || x.availabilityStatus !== 'Pending Registration') && (!text || [x.title, x.author, x.isbn, x.rfidId, x.accessionNumber, x.titleGroupId, x.category, x.subCategory].some((v) => String(v || '').toLowerCase().includes(text)) || Boolean(normalized && normalizeRFID(x.rfidId) === normalized)) && (!filters.category || x.category === filters.category) && (!filters.status || x.availabilityStatus === filters.status) && (filters.rfid === undefined || Boolean(x.rfidId) === filters.rfid))
      },
      async createBook(input) {
        guard('BOOK_CREATE')
        const result = mapBook(await apiClient.post('/books', { ...input, authors: input.author || input.authors, subcategory: input.subcategory || input.subCategory, shelfLocation: input.location, rfidUid: input.rfidUid || input.rfidId, quantity: Number(input.quantity || 1) }))
        await refresh(result)
        return stateRef.current.books.find((copy) => copy.copyId === result.copyId) || result
      },
      async updateBook(id, changes) {
        guard('BOOK_EDIT')
        const book = bookById(id)
        const body = { ...changes, authors: changes.authors || changes.author, subcategory: changes.subcategory || changes.subCategory, rfidUid: changes.rfidUid || changes.rfidId, location: changes.location || [changes.branch, changes.floor, changes.section, changes.rack, changes.shelf].filter(Boolean).join(' / ') }
        const result = await apiClient.put(`/books/${encodeURIComponent(book?._id || id)}`, body)
        await refresh(result)
        return mapBook(result)
      },
      async archiveBook(id) { guard('BOOK_DELETE'); return mutate(`/books/${encodeURIComponent(bookById(id)?._id || id)}`, 'delete', undefined, () => true) },
      getMembers: () => state.members.filter((x) => !x.archived), getMember: (id) => memberById(id) || null,
      searchMembers: (query = '', filters = {}) => state.members.filter((x) => !x.archived && (!query || `${x.id} ${x.name} ${x.studentId} ${x.registrationNumber} ${x.libraryId} ${x.rfidCardId}`.toLowerCase().includes(query.toLowerCase())) && (!filters.year || String(x.year) === String(filters.year)) && (!filters.department || x.department === filters.department) && (!filters.section || x.section === filters.section) && (!filters.status || x.status === filters.status)),
      async createMember(input) { guard('MEMBER_CREATE'); return mutate('/students', 'post', { ...input, registerNumber: input.registerNumber || input.registrationNumber || input.studentId, rfidUid: input.rfidUid || input.rfidCardId }, mapMember) },
      async updateMember(id, changes) { guard('MEMBER_EDIT'); return mutate(`/students/${encodeURIComponent(memberById(id)?._id || id)}`, 'put', { ...changes, registerNumber: changes.registerNumber || changes.registrationNumber || changes.studentId, rfidUid: changes.rfidUid || changes.rfidCardId }, mapMember) },
      async archiveMember(id) { guard('MEMBER_DELETE'); return mutate(`/students/${encodeURIComponent(memberById(id)?._id || id)}`, 'delete', undefined, () => true) },
      getMemberCurrentLoans: (id) => state.transactions.filter((x) => x.memberId === id && x.status === 'Issued'),
      getMemberHistory: (id) => state.transactions.filter((x) => x.memberId === id), getMemberFines: (id) => state.fines.filter((x) => x.memberId === id), getMemberReservations: (id) => state.reservations.filter((x) => x.memberId === id),
      getBookQuantities: (titleId) => { const copies = state.books.filter((x) => !x.archived && x.titleGroupId === titleId); return { total: copies.length, available: copies.filter((x) => x.availabilityStatus === 'Available').length, issued: copies.filter((x) => x.availabilityStatus === 'Issued').length, reserved: copies.filter((x) => x.availabilityStatus === 'Reserved').length, lost: copies.filter((x) => x.condition === 'Lost').length, damaged: copies.filter((x) => x.condition === 'Damaged').length } },
      getBookCopies: (titleId) => state.books.filter((x) => x.titleGroupId === titleId), getBookCurrentHolders: (titleId) => state.transactions.filter((x) => x.titleGroupId === titleId && x.status === 'Issued'), getBookHistory: (titleId) => state.transactions.filter((x) => x.titleGroupId === titleId), getLoansByMember: (id) => state.transactions.filter((x) => x.memberId === id), getLoansByBookCopy: (id) => state.transactions.filter((x) => x.bookId === id),
      async validateIssue({ bookId, memberId, reservationId }) {
        const copy = bookById(bookId), member = memberById(memberId)
        if (!copy || !member) return { eligible: false, reasons: ['Book or member was not found.'], book: copy || null, member: member || null }
        const result = await apiClient.post('/circulation/validate-issue', { studentId: member._id || member.id, bookCopyId: copy._id || copy.copyId || copy.id, bookRfid: copy.rfidId, ...(reservationId ? { reservationId } : {}) })
        return { ...result, eligible: result.eligible !== false, book: copy, member, dueDate: date(result.dueDate) }
      },
      async issueBook({ bookId, memberId, bookRFID, reservationId }) {
        guard('ISSUE_BOOK')
        const copy = bookById(bookId), member = memberById(memberId)
        const result = await apiClient.post('/circulation/issue', { studentId: member?._id || memberId, bookCopyId: copy?._id || copy?.copyId || bookId, bookRfid: bookRFID || copy?.rfidId, ...(reservationId ? { reservationId } : {}) })
        await refresh(result)
        return mapTransaction(result.circulation || result)
      },
      async returnBook({ bookId, rfidId, memberId, memberRFID, bookRFID, condition = 'Good' }) {
        guard('RETURN_BOOK')
        const member = memberById(memberId) || state.members.find((x) => normalizeRFID(x.rfidCardId) === normalizeRFID(memberRFID))
        const result = await apiClient.post('/circulation/return', { studentId: member?._id || memberId, bookRfid: bookRFID || rfidId || bookById(bookId)?.rfidId, conditionAtReturn: String(condition).replaceAll(' ', '_').toUpperCase() })
        await refresh(result)
        return { ...result, transaction: mapTransaction(result.circulation), fine: result.fine ? mapFine(result.fine) : null, overdueDays: result.overdueDays || 0 }
      },
      async renewBook({ bookId, memberId }) {
        guard('RENEW_BOOK')
        const loan = loanFor(bookId, memberId)
        if (!loan) throw new Error('No active loan for this member and book.')
        const result = await apiClient.post(`/circulation/${encodeURIComponent(loan._id || loan.id)}/renew`, {})
        await refresh(result)
        return date(result.dueDate || result.circulation?.dueDate)
      },
      getActiveLoans: () => state.transactions.filter((x) => x.status === 'Issued'), getLoanHistory: () => state.transactions,
      getReservations: () => state.reservations,
      async createReservation({ bookId, memberId }) {
        guard('RESERVATION_CREATE')
        const book = bookById(bookId), member = memberById(memberId)
        return mutate('/reservations', 'post', { bookTitleId: book?.titleId || book?.titleGroupId, studentId: member?._id || memberId, preferredCopyId: book?._id }, mapReservation)
      },
      async cancelReservation(id) { const hold = state.reservations.find((x) => x.id === id || x._id === id); return mutate(`/reservations/${encodeURIComponent(hold?._id || id)}/cancel`, 'post', {}, () => true) },
      async approveReservation(id) {
        guard('RESERVATION_MANAGE')
        const hold = state.reservations.find((x) => x.id === id || x._id === id)
        const result = await apiClient.post(`/reservations/${encodeURIComponent(hold?._id || id)}/approve`, {})
        await refresh(result)
        return result.reservation ? mapReservation(result.reservation) : result
      },
      async rejectReservation(id, reason = '') {
        guard('RESERVATION_MANAGE')
        const hold = state.reservations.find((x) => x.id === id || x._id === id)
        return mutate(`/reservations/${encodeURIComponent(hold?._id || id)}/reject`, 'post', { reason })
      },
      async fulfillReservation(id) { const hold = state.reservations.find((x) => x.id === id || x._id === id); return mutate(`/reservations/${encodeURIComponent(hold?._id || id)}/fulfill`, 'post', {}, () => true) },
      async evaluateReservationDeadlines() {
        if (!['ADMIN', 'LIBRARIAN'].includes(role)) return 0
        const now = Date.now()
        const expired = state.reservations.filter((hold) => ['READY_FOR_PICKUP', 'PENDING'].includes(hold.status) && (hold.expiresAt || hold.pickupDeadline) && new Date(hold.expiresAt || hold.pickupDeadline).getTime() <= now)
        if (!expired.length) return 0
        await Promise.all(expired.map((hold) => apiClient.post(`/reservations/${encodeURIComponent(hold._id || hold.id)}/expire`, {})))
        await refresh(expired.length)
        return expired.length
      },
      getFines: () => state.fines,
      async payFine(id, paymentMethod, amount, paymentReference) {
        guard('FINE_PAY')
        const fine = state.fines.find((x) => x.id === id || x._id === id)
        const body = { amount: Number(amount), paymentMethod, ...(paymentReference ? { paymentReference } : {}) }
        return mutate(`/fines/${encodeURIComponent(fine?._id || id)}/pay`, 'post', body, () => true)
      },
      async payOwnFine(id, paymentMethod, amount, paymentReference) {
        const fine = state.fines.find((x) => x.id === id || x._id === id)
        const body = { amount: Number(amount), paymentMethod, ...(paymentReference ? { paymentReference } : {}) }
        return mutate(`/fines/${encodeURIComponent(fine?._id || id)}/pay`, 'post', body, () => true)
      },
      async waiveFine(id, reason) { guard('FINE_WAIVE'); const fine = state.fines.find((x) => x.id === id || x._id === id); return mutate(`/fines/${encodeURIComponent(fine?._id || id)}/waive`, 'post', { reason }, () => true) },
      async reverseFinePayment(id, paymentId, reason) {
        guard('FINE_PAY')
        const fine = state.fines.find((x) => x.id === id || x._id === id)
        return mutate(`/fines/${encodeURIComponent(fine?._id || id)}/reverse-payment`, 'post', { paymentId, reason }, () => true)
      },
      async scanRFID(uid) {
        const record = mapBook(await apiClient.get(`/rfid/book/${encodeURIComponent(formatRFID(uid))}`))
        return rememberScan(uid, record, 'BOOK_COPY')
      },
      async scanMemberRFID(uid) {
        const record = mapMember(await apiClient.get(`/rfid/student/${encodeURIComponent(formatRFID(uid))}`))
        return rememberScan(uid, record, 'STUDENT')
      },
      async lookupMemberRFID(uid) {
        const record = mapMember(await apiClient.get(`/rfid/student/${encodeURIComponent(formatRFID(uid))}`))
        return rememberScan(uid, record, 'STUDENT')
      },
      async lookupRFID(uid) {
        const value = await apiClient.get(`/rfid/${encodeURIComponent(formatRFID(uid))}`)
        const record = value.type === 'STUDENT' ? mapMember(value.student) : mapBook(value.copy)
        return rememberScan(uid, record, value.type)
      },
      async validateRFID(uid) { const x = await apiClient.post('/rfid/validate', { rfid: formatRFID(uid) }); return Boolean(x.valid && !x.registered) },
      async registerRFID(id, uid) { const copy = bookById(id); const copyRecord = copy?._id ? copy : (await apiClient.list('/book-copies', { limit: 100, search: copy?.copyId || id })).data.find((x) => x.copyId === copy?.copyId || x._id === id); if (!copyRecord?._id) throw new Error('The physical copy ID could not be resolved by the server.'); return mutate('/rfid/register', 'post', { type: 'BOOK_COPY', id: copyRecord._id, rfid: formatRFID(uid) }, mapBook) },
      async getRFIDLogs() { return (await apiClient.list('/rfid/logs', { limit: 100 })).data },
      async getRFIDDevices() { const x = await apiClient.get('/rfid/devices'); return Array.isArray(x) ? x : x?.devices || [] },
      async createRFID() { return (await apiClient.post('/rfid/generate', {})).rfidUid },
      async createMemberCard() { return (await apiClient.post('/rfid/generate', {})).rfidUid },
      async getInventoryStatus() { const x = await apiClient.get('/inventory/summary'); return { total: x.totalCopies || 0, available: x.availableCopies || 0, issued: x.issuedCopies || 0, lost: x.lostCopies || 0, damaged: x.damagedCopies || 0, audits: state.inventoryAudits } },
      async markBookLost(id) { guard('INVENTORY_VIEW'); return mutate(`/inventory/copy/${encodeURIComponent(bookById(id)?._id || id)}/condition`, 'patch', { condition: 'LOST' }, () => true) },
      async markBookDamaged(id) { guard('INVENTORY_VIEW'); return mutate(`/inventory/copy/${encodeURIComponent(bookById(id)?._id || id)}/condition`, 'patch', { condition: 'DAMAGED' }, () => true) },
      async markBookFound(id) { guard('INVENTORY_VIEW'); return mutate(`/inventory/copy/${encodeURIComponent(bookById(id)?._id || id)}/condition`, 'patch', { condition: 'GOOD' }, () => true) },
      async changeBookLocation(id, location) { return mutate(`/book-copies/${encodeURIComponent(bookById(id)?._id || id)}`, 'put', { location }, () => true) },
      async startInventoryAudit(filters = {}) { return mutate('/inventory/audits', 'post', filters, (x) => ({ ...x, id: idOf(x), expectedBookIds: x.expectedCopyIds || [] })) },
      async scanInventoryRFID(auditId, uid) {
        const x = await apiClient.post(`/inventory/audits/${encodeURIComponent(auditId)}/scan`, { rfid: formatRFID(uid) })
        await refresh(x)
        return { ...x, book: mapBook(x.copy), expected: x.expected, misplaced: x.misplaced }
      },
      async completeInventoryAudit(id) { return mutate(`/inventory/audits/${encodeURIComponent(id)}/complete`, 'post', {}, (x) => ({ ...x, id: idOf(x), missing: x.missingCopyIds || [] })) },
      getAcquisitions: () => state.acquisitions,
      async createAcquisition(input) {
        guard('ACQUISITION_MANAGE')
        const items = (input.items || [input]).map((x) => ({ ...x, authors: x.authors || x.author, quantityOrdered: Number(x.quantityOrdered || x.quantity), unitCost: Number(x.unitCost ?? x.unitPrice) }))
        return mutate('/acquisitions', 'post', { ...input, items }, mapAcquisition)
      },
      async updateAcquisition(id, changes) { return mutate(`/acquisitions/${encodeURIComponent(id)}`, 'put', changes, mapAcquisition) },
      async receiveAcquisition(id, quantity, itemIndex = 0) {
        const item = state.acquisitions.find((x) => x.id === id)?.items?.[itemIndex]
        return mutate(`/acquisitions/${encodeURIComponent(id)}/receive`, 'post', { items: [{ itemId: item?.itemId || item?._id, quantity: Number(quantity || item?.quantity) }] }, mapAcquisition)
      },
      async cancelAcquisition(id) { const order = state.acquisitions.find((x) => x.id === id || x._id === id); return mutate(`/acquisitions/${encodeURIComponent(order?._id || id)}`, 'delete', undefined, () => true) },
      getSuppliers: () => state.suppliers,
      async createSupplier(input) { return mutate('/suppliers', 'post', input, (x) => ({ ...x, id: idOf(x), supplierId: idOf(x) })) },
      async updateSupplier(id, changes) { return mutate(`/suppliers/${encodeURIComponent(id)}`, 'put', changes, (x) => ({ ...x, id: idOf(x), supplierId: idOf(x) })) },
      async deleteSupplier(id) { return mutate(`/suppliers/${encodeURIComponent(id)}`, 'delete', undefined, () => true) },
      getNotifications: () => state.notifications,
      async markNotificationRead(id) { return mutate(`/notifications/${encodeURIComponent(id)}/read`, 'patch', {}, () => true) },
      async markAllNotificationsRead() { return mutate('/notifications/read-all', 'patch', {}, () => true) },
      async getUsers() {
        guard('USER_MANAGE')
        return (await apiClient.list('/users', { limit: 100 })).data.map((record) => mapUser(record))
      },
      getSettings: () => state.settings,
      async updateSettings(changes) {
        guard('SETTINGS_MANAGE')
        const payload = { ...changes, dailyFineAmount: changes.dailyFineAmount ?? changes.finePerDay, defaultLoanPeriodDays: changes.defaultLoanPeriodDays ?? changes.loanPeriodDays, maximumBooksPerStudent: changes.maximumBooksPerStudent ?? changes.borrowingLimit, maximumReservationsPerStudent: changes.maximumReservationsPerStudent ?? changes.maximumActiveReservations, reservationPickupDays: changes.reservationPickupDays ?? changes.pickupWindowDays, maximumRenewals: changes.maximumRenewals ?? changes.renewalLimit, libraryWorkingHours: changes.libraryWorkingHours ?? changes.workingHours }
        return mutate('/settings', 'put', payload, mapSettings)
      },
      async updateProfile(changes) {
        const x = await apiClient.patch('/users/me/profile', changes)
        const preferences = changes.preferences || user?.preferences || {}
        localStorage.setItem(`library-preferences:${idOf(x)}`, JSON.stringify(preferences))
        const currentUser = mapUser(x, preferences)
        const next = { ...stateRef.current, currentUser, users: [currentUser] }
        stateRef.current = next
        setState(next)
        return currentUser
      },
      async login(credentials) {
        setLoading(true); setError('')
        try {
          const data = await apiClient.post('/auth/login', { email: credentials.email, password: credentials.password }, { auth: false })
          if (!(data.accessToken || data.token) || !data.refreshToken || !data.user) throw new Error('The login response is missing user or session tokens.')
          setSessionTokens(data)
          const current = setUser(data.user)
          if (!data.passwordChangeRequired && !current.passwordChangeRequired) await loadData(current)
          return current
        } catch (e) { setError(e.message || 'Unable to sign in.'); throw e }
        finally { setLoading(false) }
      },
      async changePassword(currentPassword, newPassword) {
        const result = await apiClient.put('/auth/change-password', { currentPassword, newPassword })
        const current = setUser(result.user)
        await loadData(current)
        return current
      },
      async logout() {
        let failure
        try { await apiClient.post('/auth/logout', {}) } catch (e) { failure = e }
        clearSessionTokens()
        const next = emptyState(); stateRef.current = next; setState(next)
        if (failure) throw failure
        return true
      },
      getState: () => stateRef.current, getRecentActivity: () => state.auditLogs.slice(0, 12),
      async getReport(type, query = {}) {
        guard('REPORT_VIEW')
        const path = { Books: 'books', Members: 'students', Circulation: 'circulation', Overdue: 'overdue', Fines: 'fines', Reservations: 'reservations', Inventory: 'inventory', Acquisitions: 'acquisitions' }[type]
        if (!path) throw new Error(`Unsupported report type: ${type}`)
        return (await apiClient.list(`/reports/${path}`, query)).data
      },
      async getAnalytics(days = 30) {
        guard('ANALYTICS_VIEW')
        return Promise.all(['overview', 'most-borrowed-books', 'most-borrowed-categories', 'most-active-students', 'department-usage', 'circulation-trends', 'overdue-trends', 'reservation-demand'].map((name) => apiClient.get(`/analytics/${name}`, { query: { days } })))
      },
    }
  }, [state, loadData, setUser])

  // The action facade only invokes ref-backed state accessors when a consumer calls an action.
  // eslint-disable-next-line react-hooks/refs
  const api = useMemo(() => createLibraryApi(actions), [actions])
  const value = useMemo(() => ({ ...state, actions: api, api, loading, error, can: (name) => hasPermission(getRoleForAccount(state.currentUser?.role), name) }), [state, api, loading, error])
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
