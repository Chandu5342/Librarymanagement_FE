import { useEffect, useMemo, useRef, useState } from 'react'
import { categories, departments } from '../data/mockData.js'
import { RFIDScanner } from '../components/common/RFIDScanner.jsx'
import { useLibrary } from '../hooks/useLibrary.js'
import { getRoleForAccount } from '../utils/permissions.js'
import { formatRFID, isValidRFID, normalizeRFID } from '../utils/rfid.js'

const accounts = [
  { name: 'Aditi Verma', role: 'Administrator', email: 'admin@northbridge.edu', department: 'Administration' },
  { name: 'Nisha Rao', role: 'Librarian', email: 'librarian@northbridge.edu', department: 'Library Services' },
  { name: 'Sanjay Das', role: 'Assistant Librarian', email: 'assistant@northbridge.edu', department: 'Library Services' },
  { name: 'Dr. Kavita Menon', role: 'Faculty', email: 'faculty@northbridge.edu', department: 'Computer Science' },
  { name: 'Ganireddy Pujeetha', role: 'Student', email: '23l31a0414@library.edu', department: 'ECE', memberId: 'MEM-00001' },
]

const allNavigation = [
  ['dashboard', 'Dashboard', null],
  ['catalog', 'Catalog', 'BOOK_VIEW'],
  ['register', 'Register book', 'BOOK_CREATE'],
  ['rfid', 'RFID operations', 'RFID_SCAN'],
  ['circulation', 'Circulation', 'ISSUE_BOOK'],
  ['members', 'Members', 'MEMBER_VIEW'],
  ['reservations', 'Reservations', 'RESERVATION_CREATE'],
  ['fines', 'Fines', 'FINE_VIEW'],
  ['inventory', 'Inventory', 'INVENTORY_VIEW'],
  ['acquisitions', 'Acquisitions', 'ACQUISITION_VIEW'],
  ['reports', 'Reports', 'REPORT_VIEW'],
  ['analytics', 'Analytics', 'ANALYTICS_VIEW'],
  ['devices', 'RFID devices', 'RFID_MANAGE'],
  ['notifications', 'Notifications', null],
  ['audit', 'Audit logs', 'AUDIT_VIEW'],
  ['profile', 'My profile', null],
  ['settings', 'Settings', 'SETTINGS_MANAGE'],
]

const initialBookForm = {
  title: '', author: '', isbn: '', publisher: '', edition: '1', publicationYear: new Date().getFullYear(),
  language: 'English', category: 'Computer Science', subCategory: '', department: 'Computer Science',
  quantity: 1, pages: '', price: '', description: '', branch: 'Central Library', floor: 'Floor 2',
  section: 'Computer Science', rack: 'Rack A', shelf: 'A-12', condition: 'Good', rfidId: '',
}

const initialMemberForm = {
  name: '', studentId: '', libraryId: '', email: '', phone: '', department: 'ECE',
  program: '', year: '1st Year', section: '', memberType: 'Student', rfidCardId: '', status: 'Active', address: '', membershipExpiry: '',
}
const initialAcquisitionForm = { vendor: '', title: '', author: '', isbn: '', quantity: 1, unitPrice: 0, category: 'Computer Science', subcategory: '', department: 'Computer Science', orderDate: new Date().toISOString().slice(0, 10), expectedDelivery: '', notes: '' }
const initialAcquisitionItem = { title: '', author: '', isbn: '', quantity: 1, unitCost: 0, category: 'Computer Science', subcategory: '', department: 'Computer Science', edition: '1', publicationYear: new Date().getFullYear() }
const initialSupplierForm = { supplierName: '', contactPerson: '', email: '', phone: '', address: '', status: 'Active' }

function routeFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (parts[0] === 'catalog' && parts[1] === 'register') return { page: 'register', detailId: null }
  if (parts[0] === 'books' && parts[1] === 'create') return { page: 'register', detailId: null }
  if (parts[0] === 'books' && parts[1]) return { page: 'catalog', detailId: parts[1] }
  if (parts[0] === 'members' && parts[1]) return { page: 'members', detailId: parts[1] }
  const routes = {
    books: 'catalog', register: 'register', rfid: 'rfid', circulation: 'circulation', reservations: 'reservations',
    fines: 'fines', inventory: 'inventory', acquisitions: 'acquisitions', reports: 'reports',
    analytics: 'analytics', devices: 'devices', notifications: 'notifications', audit: 'audit',
    profile: 'profile', settings: 'settings', dashboard: 'dashboard', 'my-books': 'my-books',
  }
  return { page: routes[parts[0]] || 'dashboard', detailId: null }
}

function pathFor(page, id) {
  if (id && page === 'catalog') return `/books/${encodeURIComponent(id)}`
  if (id && page === 'members') return `/members/${encodeURIComponent(id)}`
  const aliases = { catalog: 'books', 'my-books': 'my-books' }
  return `/${aliases[page] || page}`
}

function messageFor(error) {
  return error instanceof Error ? error.message : 'The operation could not be completed.'
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="workspace-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={`workspace-modal ${wide ? 'wide-modal' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="workspace-modal-header">
          <h3>{title}</h3>
          <button type="button" className="ghost-button" onClick={onClose} aria-label="Close dialog">Close</button>
        </header>
        {children}
      </section>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', children, required = false, ...props }) {
  return (
    <label className="workspace-field">
      {label}
      {children || <input required={required} type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props} />}
    </label>
  )
}

function Status({ value }) {
  const tone = /available|active|paid|returned|connected|good|fulfilled|received/i.test(value || '')
    ? 'ok'
    : /lost|damaged|blocked|overdue|offline|waived|cancelled/i.test(value || '') ? 'danger' : 'warn'
  return <span className={`status-pill ${tone}`}>{String(value || 'Unknown').replaceAll('_', ' ')}</span>
}

function exportCSV(filename, rows) {
  if (!rows.length) throw new Error('There are no records to export.')
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const content = [columns.map(escape).join(','), ...rows.map((row) => columns.map((column) => escape(Array.isArray(row[column]) ? row[column].join('; ') : row[column])).join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function pickRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

export function LibraryWorkspace() {
  const library = useLibrary()
  const {
    books, members, transactions = [], reservations = [], fines = [], notifications: allNotifications = [],
    acquisitions = [], suppliers = [], rfidLogs = [], rfidDevices = [], auditLogs = [], inventoryAudits = [],
    settings, currentUser, actions, can,
  } = library
  const [requestedPage, setRequestedPage] = useState(() => routeFromPath().page)
  const [detailId, setDetailId] = useState(() => routeFromPath().detailId)
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [rfidFilter, setRfidFilter] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(initialBookForm)
  const [memberForm, setMemberForm] = useState(initialMemberForm)
  const [acquisitionForm, setAcquisitionForm] = useState(initialAcquisitionForm)
  const [acquisitionItems, setAcquisitionItems] = useState([])
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm)
  const [receiveQuantity, setReceiveQuantity] = useState(1)
  const [receiveItemIndex, setReceiveItemIndex] = useState(0)
  const [finePaymentMethod, setFinePaymentMethod] = useState('UPI')
  const [toast, setToast] = useState(null)
  const [globalSearch, setGlobalSearch] = useState('')
  const [menu, setMenu] = useState('')
  const [selectedBook, setSelectedBook] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [rfid, setRfid] = useState('')
  const [rfidBusy, setRfidBusy] = useState(false)
  const [rfidResult, setRfidResult] = useState(null)
  const [circulationMode, setCirculationMode] = useState('')
  const [circulationStep, setCirculationStep] = useState(1)
  const [circulationMemberRFID, setCirculationMemberRFID] = useState('')
  const [circulationBookRFID, setCirculationBookRFID] = useState('')
  const [circulationMember, setCirculationMember] = useState(null)
  const [circulationBook, setCirculationBook] = useState(null)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentYearFilter, setStudentYearFilter] = useState('')
  const [studentDepartmentFilter, setStudentDepartmentFilter] = useState('')
  const [studentSectionFilter, setStudentSectionFilter] = useState('')
  const [bookSearch, setBookSearch] = useState('')
  const [memberYearFilter, setMemberYearFilter] = useState('')
  const [memberDepartmentFilter, setMemberDepartmentFilter] = useState('')
  const [memberSectionFilter, setMemberSectionFilter] = useState('')
  const [loanSearch, setLoanSearch] = useState('')
  const [transactionSearch, setTransactionSearch] = useState('')
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('')
  const [loanDepartmentFilter, setLoanDepartmentFilter] = useState('')
  const [loanYearFilter, setLoanYearFilter] = useState('')
  const [loanTimingFilter, setLoanTimingFilter] = useState('')
  const [memberScanError, setMemberScanError] = useState('')
  const [bookScanError, setBookScanError] = useState('')
  const [auditLocation, setAuditLocation] = useState('')
  const [auditRFID, setAuditRFID] = useState('')
  const [settingsDraft, setSettingsDraft] = useState(settings)
  const [profileDraft, setProfileDraft] = useState({ name: currentUser?.name || '', email: currentUser?.email || '', department: currentUser?.department || '', preferences: currentUser?.preferences || { emailNotifications: true, compactTables: false } })
  const [reportCategory, setReportCategory] = useState('')
  const [reportStatus, setReportStatus] = useState('')
  const [reportDepartment, setReportDepartment] = useState('')
  const [reportStart, setReportStart] = useState('')
  const [reportEnd, setReportEnd] = useState('')
  const [reportType, setReportType] = useState('Books')
  const [reservationSearch, setReservationSearch] = useState('')
  const [reservationStatus, setReservationStatus] = useState('')
  const [reservationDepartment, setReservationDepartment] = useState('')
  const [reservationYear, setReservationYear] = useState('')
  const [reservationBook, setReservationBook] = useState('')
  const [inventoryDepartment, setInventoryDepartment] = useState('')
  const [inventoryCategory, setInventoryCategory] = useState('')
  const [inventoryStatus, setInventoryStatus] = useState('')
  const [inventoryLocation, setInventoryLocation] = useState('')
  const [analyticsRange, setAnalyticsRange] = useState(30)
  const [resetRequested, setResetRequested] = useState(false)
  const rfidInputRef = useRef(null)

  const role = getRoleForAccount(currentUser?.role)
  const ownMember = members.find((member) => member.id === currentUser?.memberId)
  const studentScope = ['STUDENT', 'FACULTY'].includes(role)
  const canOpen = (key) => {
    const item = allNavigation.find(([navKey]) => navKey === key)
    if (!item) return key === 'my-books' && studentScope
    return !item[2] || can(item[2])
  }
  const page = canOpen(requestedPage) ? requestedPage : studentScope ? 'catalog' : 'dashboard'
  const setPage = (nextPage) => setRequestedPage(canOpen(nextPage) ? nextPage : studentScope ? 'catalog' : 'dashboard')
  const notifications = allNotifications.filter((item) => studentScope ? item.memberId === currentUser.memberId : !item.memberId)
  const unreadCount = notifications.filter((item) => !item.read).length
  const visibleNav = allNavigation.filter(([key, , permission]) => {
    if (key === 'my-books') return role === 'STUDENT' || role === 'FACULTY'
    if (key === 'dashboard' || key === 'notifications' || key === 'profile') return true
    return permission && can(permission)
  }).concat((role === 'STUDENT' || role === 'FACULTY') ? [['my-books', 'My books', 'BOOK_VIEW']] : [])

  useEffect(() => {
    const onPopState = () => {
      const route = routeFromPath()
      setRequestedPage(route.page)
      setDetailId(route.detailId)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (page === 'rfid' && settings.autoFocus) rfidInputRef.current?.focus()
  }, [page, settings.autoFocus])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const notify = (text, kind = 'success') => setToast({ text, kind })
  const navigate = (nextPage, id = null) => {
    if (!canOpen(nextPage)) {
      notify('Access denied. This area is not available for your role.', 'error')
      return
    }
    setPage(nextPage)
    setDetailId(id)
    setGlobalSearch('')
    setMenu('')
    window.history.pushState({}, '', pathFor(nextPage, id))
    if (!id) setSelectedBook(null)
  }
  useEffect(() => {
    if (page !== requestedPage) window.history.replaceState({}, '', pathFor(page))
  }, [page, requestedPage])
  const runAction = (fn, successMessage) => {
    try {
      const result = fn()
      if (successMessage) notify(successMessage)
      return result
    } catch (error) {
      notify(messageFor(error), 'error')
      return null
    }
  }

  const activeLoans = transactions.filter((item) => item.status === 'Issued')
  const overdueLoans = activeLoans.filter((item) => new Date(`${item.dueDate}T00:00:00`) < new Date())
  const filteredActiveLoans = activeLoans.filter((loan) => {
    const member = members.find((item) => item.id === loan.memberId)
    const book = books.find((item) => item.id === loan.bookId)
    const remainingDays = Math.ceil((new Date(`${loan.dueDate}T00:00:00`) - new Date(new Date().toDateString())) / 86400000)
    const queryMatches = !loanSearch || `${loan.bookTitle} ${book?.accessionNumber} ${book?.rfidId} ${member?.name} ${member?.studentId} ${member?.rfidCardId}`.toLowerCase().includes(loanSearch.toLowerCase())
    const timingMatches = !loanTimingFilter || loanTimingFilter === 'overdue' && remainingDays < 0 || loanTimingFilter === 'due-soon' && remainingDays >= 0 && remainingDays <= 3
    return queryMatches && (!loanDepartmentFilter || member?.department === loanDepartmentFilter) && (!loanYearFilter || String(member?.year) === loanYearFilter) && timingMatches
  })
  const liveBooks = books.filter((book) => !book.archived)
  const availableBooks = liveBooks.filter((book) => book.availabilityStatus === 'Available')
  const titleGroups = (() => {
    const groups = new Map()
    for (const copy of liveBooks) {
      const key = copy.titleGroupId || copy.id
      const group = groups.get(key) || { id: key, title: copy.title, author: copy.author, category: copy.category, department: copy.department, copies: [] }
      group.copies.push(copy)
      groups.set(key, group)
    }
    return [...groups.values()]
  })()
  const titleUsageRows = (() => {
    const borrowCountTotal = transactions.length
    return titleGroups.map((group) => {
      const history = transactions.filter((transaction) => transaction.titleGroupId === group.id)
      const active = history.filter((transaction) => transaction.status === 'Issued')
      const reservationsForTitle = reservations.filter((reservation) => reservation.titleGroupId === group.id)
      const durations = history.filter((transaction) => transaction.returnedDate).map((transaction) => Math.max(0, Math.ceil((new Date(transaction.returnedDate) - new Date(transaction.issueDate)) / 86400000)))
      return {
        ...group,
        totalBorrowed: history.length,
        currentDemand: active.length,
        reservationCount: reservationsForTitle.length,
        available: group.copies.filter((copy) => copy.availabilityStatus === 'Available').length,
        averageLoanDays: durations.length ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length) : 0,
        usageShare: borrowCountTotal ? (history.length / borrowCountTotal * 100).toFixed(1) : '0.0',
      }
    })
  })()
  const borrowStats = (() => {
    const countBy = (keyFor) => {
      const counts = new Map()
      transactions.forEach((transaction) => {
        const book = books.find((item) => item.id === transaction.bookId)
        const member = members.find((item) => item.id === transaction.memberId)
        const key = keyFor(transaction, book, member)
        if (key) counts.set(key, (counts.get(key) || 0) + 1)
      })
      return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    }
    const mostBorrowedStudents = countBy((_transaction, _book, member) => member?.name)
    const categoryCounts = countBy((_transaction, book) => book?.category)
    const departmentCounts = countBy((_transaction, book) => book?.department)
    return { mostBorrowedStudents, categoryCounts, departmentCounts }
  })()
  const highDemandBooks = titleUsageRows.filter((item) => item.totalBorrowed > 0 && item.available <= 1)
    .sort((a, b) => b.totalBorrowed - a.totalBorrowed || a.available - b.available).slice(0, 10)
  const myLoans = activeLoans.filter((item) => item.memberId === currentUser?.memberId)
  const studentOptions = useMemo(() => actions.searchMembers(studentSearch, {
    year: studentYearFilter || undefined,
    department: studentDepartmentFilter || undefined,
    section: studentSectionFilter || undefined,
  }), [actions, studentSearch, studentYearFilter, studentDepartmentFilter, studentSectionFilter])
  const filteredBooks = useMemo(() => actions.searchBooks(search, {
    category: categoryFilter || undefined,
    status: statusFilter || undefined,
    rfid: rfidFilter === '' ? undefined : rfidFilter === 'tagged',
  }), [actions, search, categoryFilter, statusFilter, rfidFilter])
  const filteredMembers = useMemo(() => members.filter((member) => !member.archived
    && (!search || `${member.id} ${member.memberId} ${member.name} ${member.studentId} ${member.registrationNumber} ${member.libraryId} ${member.rfidCardId}`.toLowerCase().includes(search.toLowerCase()))
    && (!statusFilter || member.status === statusFilter)
    && (!memberYearFilter || String(member.year) === memberYearFilter)
    && (!memberDepartmentFilter || member.department === memberDepartmentFilter)
    && (!memberSectionFilter || member.section === memberSectionFilter)), [members, search, statusFilter, memberYearFilter, memberDepartmentFilter, memberSectionFilter])
  const displayedBooks = useMemo(() => {
    const start = (pageNumber - 1) * pageSize
    return filteredBooks.slice(start, start + pageSize)
  }, [filteredBooks, pageNumber, pageSize])
  const visibleTitleGroups = titleGroups.filter((group) => group.copies.some((copy) => filteredBooks.some((match) => match.id === copy.id)))
  const recentBooks = liveBooks.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 5)
  const globalResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase()
    if (!query) return []
    const matchingBooks = books.filter((book) => !book.archived && (!studentScope || book.availabilityStatus !== 'Pending Registration') && `${book.title} ${book.author} ${book.isbn} ${book.rfidId} ${book.accessionNumber} ${book.titleGroupId} ${book.category} ${book.categoryId} ${book.subcategoryId}`.toLowerCase().includes(query)).slice(0, 5).map((book) => ({ type: 'Physical copy', label: book.title, hint: `${book.titleGroupId} · ${book.rfidId || book.accessionNumber}`, page: 'catalog', id: book.id }))
    const matchingMembers = members.filter((member) => !member.archived && `${member.id} ${member.name} ${member.studentId} ${member.registrationNumber} ${member.libraryId} ${member.rfidCardId}`.toLowerCase().includes(query)).slice(0, 4).map((member) => ({ type: 'Student', label: member.name, hint: `${member.registrationNumber || member.studentId} · ${member.rfidCardId}`, page: 'members', id: member.id }))
    return [...matchingBooks, ...matchingMembers]
  }, [globalSearch, books, members, studentScope])
  const detailBook = books.find((item) => item.id === (selectedBook?.id || detailId)) || selectedBook
  const detailMember = members.find((member) => member.id === (selectedMember?.id || detailId) && page === 'members') || selectedMember
  const activeAudit = inventoryAudits.find((audit) => audit.status === 'IN_PROGRESS')
  const lastAudit = inventoryAudits.find((audit) => audit.status === 'COMPLETED')
  const reportSource = ({
    Books: liveBooks,
    Members: members.filter((item) => !item.archived),
    Circulation: transactions,
    Overdue: overdueLoans,
    Fines: fines,
    Reservations: reservations,
    Inventory: liveBooks,
    Acquisitions: acquisitions,
  })[reportType] || liveBooks
  const reportRows = reportSource.filter((item) => {
    const book = reportType === 'Books' || reportType === 'Inventory' ? item : books.find((copy) => copy.id === item.bookId)
    const member = reportType === 'Members' ? item : members.find((entry) => entry.id === (item.memberId || item.studentId))
    const eventDate = String(item.acquisitionDate || item.issueDate || item.createdAt || item.orderDate || item.registrationDate || item.requestDate || '').slice(0, 10)
    const status = item.availabilityStatus || item.status
    return (!reportCategory || book?.category === reportCategory || item.category === reportCategory)
      && (!reportDepartment || (member?.department || item.department || book?.department) === reportDepartment)
      && (!reportStatus || status === reportStatus)
      && (!reportStart || eventDate >= reportStart)
      && (!reportEnd || eventDate <= reportEnd)
  })
  const reportDisplayRows = reportRows.map((item) => {
    if (reportType === 'Members') return { Student: item.name, 'Register number': item.registrationNumber || item.studentId, Department: item.department, Year: item.year, Status: item.status, 'Outstanding fine': item.fineAmount || 0 }
    if (reportType === 'Circulation' || reportType === 'Overdue') {
      const book = books.find((copy) => copy.id === item.bookId)
      const member = members.find((entry) => entry.id === item.memberId)
      const isOverdue = item.status === 'Issued' && item.dueDate < new Date().toISOString().slice(0, 10)
      return { Transaction: item.transactionId || item.id, Student: member?.name || item.memberName, 'Register number': member?.registrationNumber || member?.studentId, Book: book?.title || item.bookTitle, Department: member?.department || '', 'Issue date': item.issueDate, 'Due date': item.dueDate, 'Return date': item.returnedDate || '', Status: isOverdue ? 'Overdue' : item.status, Fine: item.fine || 0 }
    }
    if (reportType === 'Fines') return { 'Fine ID': item.fineId || item.id, Student: item.memberName, Book: item.bookTitle, 'Due date': item.dueDate, Amount: item.amount, Paid: item.paidAmount || 0, Remaining: item.remainingAmount ?? item.amount, Status: item.status, Reason: item.reason || '' }
    if (reportType === 'Reservations') return { 'Reservation ID': item.reservationId || item.id, Student: item.memberName, 'Register number': members.find((entry) => entry.id === item.memberId)?.registrationNumber, Book: item.bookTitle, 'Request date': item.requestDate || item.createdAt, 'Queue position': item.queuePosition, Status: item.status, Expires: item.expiresAt || item.pickupDeadline || '' }
    if (reportType === 'Acquisitions') return { 'Acquisition ID': item.acquisitionId || item.id, Supplier: item.vendor, Title: item.title, Quantity: item.quantity, Received: item.receivedQuantity || 0, 'Total cost': item.totalCost ?? item.total, Status: item.status, 'Order date': item.orderDate }
    return { Accession: item.accessionNumber, Title: item.title, Author: item.author, Department: item.department, Category: item.category, Status: item.availabilityStatus, Condition: item.condition, RFID: item.rfidId, Location: item.location }
  })
  const reservationRows = reservations.filter((item) => {
    const member = members.find((entry) => entry.id === item.memberId)
    const book = books.find((entry) => entry.id === item.bookId)
    const query = `${item.memberName} ${member?.registrationNumber} ${member?.studentId} ${item.bookTitle} ${book?.rfidId} ${book?.accessionNumber}`.toLowerCase()
    return (!studentScope || item.memberId === currentUser.memberId)
      && (!reservationSearch || query.includes(reservationSearch.toLowerCase()))
      && (!reservationStatus || item.status === reservationStatus)
      && (!reservationDepartment || member?.department === reservationDepartment)
      && (!reservationYear || member?.year === reservationYear)
      && (!reservationBook || (item.titleGroupId || item.bookId) === reservationBook)
  }).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const inventoryRows = liveBooks.filter((book) => (!inventoryDepartment || book.department === inventoryDepartment)
    && (!inventoryCategory || book.category === inventoryCategory)
    && (!inventoryStatus || book.availabilityStatus === inventoryStatus || book.condition === inventoryStatus)
    && (!inventoryLocation || book.location === inventoryLocation))
  const analyticsAnchor = Math.max(0, ...transactions.map((item) => new Date(item.createdAt).getTime()), ...rfidLogs.map((item) => new Date(item.timestamp).getTime()))
  const analyticsSince = new Date(analyticsAnchor - analyticsRange * 86400000)
  const analyticsTransactions = transactions.filter((item) => new Date(item.createdAt) >= analyticsSince)
  const analyticsRFIDLogs = rfidLogs.filter((item) => new Date(item.timestamp) >= analyticsSince)

  const login = (account) => {
    actions.login(account)
    setProfileDraft({ name: account.name, email: account.email, department: account.department, preferences: account.preferences || { emailNotifications: true, compactTables: false } })
    const target = account.role === 'Student' || account.role === 'Faculty' ? 'catalog' : 'dashboard'
    setPage(target)
    window.history.replaceState({}, '', pathFor(target))
  }

  const openBook = (book) => {
    if (book?.type === 'member') {
      openMember(book.record)
      return
    }
    setSelectedBook(book)
    setSelectedMember(null)
    setModal(null)
    navigate('catalog', book.id)
  }
  const openMember = (member) => {
    setSelectedMember(member)
    navigate('members', member.id)
  }
  const openNotification = (item) => {
    runAction(() => actions.markNotificationRead(item.id))
    if (item.entity === 'book') openBook(books.find((book) => book.id === item.entityId))
    else if (item.entity === 'member') openMember(members.find((member) => member.id === item.entityId))
    else if (item.entity === 'transaction') { setCirculationMode('history'); navigate('circulation') }
    else if (item.entity === 'reservation') navigate('reservations')
    else if (item.entity === 'fine') navigate('fines')
    else if (item.entity === 'acquisition') navigate('acquisitions')
    else if (item.entity === 'inventoryAudit') navigate('inventory')
    else navigate('notifications')
  }

  const submitBook = (event) => {
    event.preventDefault()
    const location = `${form.branch} / ${form.floor} / ${form.section} / ${form.rack} / ${form.shelf}`
    const book = runAction(() => actions.createBook({
      ...form,
      edition: Number(form.edition), publicationYear: Number(form.publicationYear),
      quantity: Number(form.quantity || 1), pages: Number(form.pages || 0), price: Number(form.price || 0),
      location,
      coAuthors: [],
      tags: [form.category.toLowerCase(), form.department.toLowerCase()],
      createdAt: new Date().toISOString(),
    }), 'Book registered successfully.')
    if (book) {
      setSelectedBook(book)
      setModal(null)
      setForm(initialBookForm)
      setRfid('')
      navigate('catalog', book.id)
    }
  }

  const submitEditBook = (event) => {
    event.preventDefault()
    if (!detailBook) return
    const updated = runAction(() => actions.updateBook(detailBook.id, form), 'Book details updated.')
    if (updated) {
      setSelectedBook(updated)
      setModal(null)
    }
  }

  const editBook = (book) => {
    setSelectedBook(book)
    setForm({ ...initialBookForm, ...book, branch: 'Central Library', floor: book.floor || 'Floor 2', section: book.department || '', rack: book.rack || '', shelf: book.shelf || '' })
    setModal('edit-book')
  }

  const simulateBookRFID = (forRegistration = false) => {
    if (forRegistration) {
      const uid = actions.createRFID()
      setForm((current) => ({ ...current, rfidId: uid }))
      notify('Unique RFID UID detected and validated.')
      return
    }
    const candidates = books.filter((book) => book.rfidId && isValidRFID(book.rfidId, 'book') && !book.archived)
    if (!candidates.length) {
      notify('No tagged books are available to simulate.', 'error')
      return
    }
    const book = pickRandomItem(candidates)
    setRfid(book.rfidId)
    processRFID(book.rfidId)
  }
  const checkRegistrationRFID = (uid, exceptId) => {
    const existing = books.find((book) => book.rfidId === uid && book.id !== exceptId)
    if (existing) {
      notify(`RFID already assigned to ${existing.title} (${existing.accessionNumber}).`, 'error')
      return false
    }
    const valid = actions.validateRFID(uid, exceptId)
    notify(valid ? 'RFID available for assignment.' : 'Enter a valid RFID-BOOK-ABC123 UID.', valid ? 'success' : 'error')
    return valid
  }

  const processRFID = (value, eventType = 'LOOKUP') => {
    const uid = formatRFID(value)
    setRfid(uid)
    if (!isValidRFID(uid) || !settings.autoLookup) return
    setRfidBusy(true)
    setRfidResult(null)
    window.setTimeout(() => {
      const isMember = members.some((member) => normalizeRFID(member.rfidCardId) === normalizeRFID(uid))
      const record = runAction(() => isMember
        ? actions.scanMemberRFID(uid, { event: eventType === 'LOOKUP' ? 'MEMBER_LOOKUP' : eventType })
        : actions.scanRFID(uid, { event: eventType }))
      setRfidResult(record ? { type: isMember ? 'member' : 'book', record } : { missing: true, rfidId: uid, type: isMember ? 'member' : 'book' })
      setRfidBusy(false)
    }, 350)
  }

  const scanCirculationMember = (value) => {
    const uid = formatRFID(value)
    setCirculationMemberRFID(uid)
    if (!isValidRFID(uid, 'member')) {
      setMemberScanError('Enter a valid 8-digit member RFID, or search/filter for a student.')
      return
    }
    const member = runAction(() => actions.scanMemberRFID(uid, { event: 'CIRCULATION_MEMBER_LOOKUP' }))
    setMemberScanError(member ? '' : 'Student RFID not found. Please verify the RFID or search the student manually.')
    if (!member) setCirculationMemberRFID('')
    else selectCirculationMember(member)
  }
  const scanCirculationBook = (value, operation = 'CIRCULATION_LOOKUP') => {
    const uid = formatRFID(value)
    setCirculationBookRFID(uid)
    if (!isValidRFID(uid, 'book')) {
      setBookScanError('Enter a valid 8-digit book RFID UID.')
      return
    }
    const book = runAction(() => actions.scanRFID(uid, { event: operation }))
    setCirculationBook(book)
    setBookScanError(book ? '' : 'Book RFID not found. Verify the tag or search by title/accession.')
    if (!book) setCirculationBookRFID('')
  }
  const selectCirculationMember = (member) => {
    const changedMember = circulationMember?.id !== member.id
    setCirculationMember(member)
    setCirculationMemberRFID(member.rfidCardId || '')
    setMemberScanError('')
    setStudentSearch('')
    if (changedMember) {
      setCirculationBook(null)
      setCirculationBookRFID('')
      setBookScanError('')
      setCirculationMode('')
    }
  }
  const simulateCirculationMember = (mode) => {
    const eligibleMembers = members.filter((member) => !member.archived && member.rfidCardId && (mode !== 'return' || transactions.some((loan) => loan.memberId === member.id && loan.status === 'Issued')))
    if (!eligibleMembers.length) return notify('No eligible member cards are available to simulate.', 'error')
    scanCirculationMember(eligibleMembers[0].rfidCardId)
  }
  const simulateCirculationBook = (mode) => {
    if (!circulationMember) return notify('Scan a member card first.', 'error')
    const candidates = mode === 'return'
      ? transactions.filter((loan) => loan.memberId === circulationMember.id && loan.status === 'Issued').map((loan) => books.find((book) => book.id === loan.bookId)).filter((book) => book?.rfidId)
      : availableBooks.filter((book) => book.rfidId)
    if (!candidates.length) return notify(mode === 'return' ? 'This member has no tagged active loans.' : 'No tagged available copies can be issued.', 'error')
    scanCirculationBook(candidates[0].rfidId, mode === 'return' ? 'RETURN_LOOKUP' : 'ISSUE_LOOKUP')
  }
  const scanAuditRFID = (uid) => {
    if (!activeAudit) return notify('Start an inventory audit before scanning tags.', 'error')
    const result = runAction(() => actions.scanInventoryRFID(activeAudit.id, uid))
    if (!result) return
    setAuditRFID(uid)
    notify(`${result.book.title} scanned${result.expected ? ' and matched the expected location' : ' as an unexpected item'}.`)
  }
  const simulateAuditRFID = () => {
    if (!activeAudit) return notify('Start an inventory audit before simulating a scan.', 'error')
    const alreadyScanned = new Set(activeAudit.scannedBookIds || [])
    const candidates = (activeAudit.expectedBookIds || [])
      .filter((id) => !alreadyScanned.has(id))
      .map((id) => books.find((book) => book.id === id))
      .filter((book) => book?.rfidId)
    if (!candidates.length) return notify('No unscanned RFID-tagged expected copies remain in this audit.', 'error')
    scanAuditRFID(pickRandomItem(candidates).rfidId)
  }
  useEffect(() => {
    actions.evaluateReservationDeadlines()
    const timer = window.setInterval(() => {
      actions.evaluateReservationDeadlines()
    }, 60000)
    return () => window.clearInterval(timer)
  }, [actions])
  const issueValidation = circulationMember && circulationBook && circulationMode === 'issue'
    ? actions.validateIssue({ memberId: circulationMember.id, bookId: circulationBook.id })
    : null
  const activeScannedLoan = circulationMember && circulationBook
    ? transactions.find((loan) => loan.memberId === circulationMember.id && loan.bookId === circulationBook.id && loan.status === 'Issued')
    : null
  const returnOverdueDays = activeScannedLoan
    ? Math.max(0, Math.ceil((new Date().getTime() - new Date(`${activeScannedLoan.dueDate}T23:59:59`).getTime()) / 86400000))
    : 0

  const submitMember = (event) => {
    event.preventDefault()
    const member = runAction(() => actions.createMember(memberForm), 'Member registered successfully.')
    if (member) {
      setModal(null)
      setMemberForm(initialMemberForm)
      setSelectedMember(member)
      navigate('members', member.id)
    }
  }
  const submitEditMember = (event) => {
    event.preventDefault()
    if (!selectedMember) return
    const member = runAction(() => actions.updateMember(selectedMember.id, memberForm), 'Member profile updated.')
    if (member) {
      setSelectedMember(member)
      setModal(null)
    }
  }
  const submitAcquisition = (event) => {
    event.preventDefault()
    const supplier = suppliers.find((item) => item.supplierName.trim().toLowerCase() === acquisitionForm.vendor.trim().toLowerCase())
    const primaryItem = { ...acquisitionForm, unitCost: acquisitionForm.unitPrice }
    const result = runAction(() => actions.createAcquisition({ ...acquisitionForm, items: [primaryItem, ...acquisitionItems], supplierId: supplier?.id || null }), 'Acquisition request added.')
    if (result) {
      setModal(null)
      setAcquisitionForm(initialAcquisitionForm)
      setAcquisitionItems([])
    }
  }
  const submitSupplier = (event) => {
    event.preventDefault()
    const result = runAction(() => modal?.id ? actions.updateSupplier(modal.id, supplierForm) : actions.createSupplier(supplierForm), modal?.id ? 'Supplier updated.' : 'Supplier added.')
    if (result) {
      setModal(null)
      setSupplierForm(initialSupplierForm)
    }
  }
  const beginEditMember = (member) => {
    setSelectedMember(member)
    setMemberForm({ ...initialMemberForm, ...member })
    setModal('edit-member')
  }

  const dashboardStats = [
    ['Total titles', titleGroups.length, `${liveBooks.length} physical copies · ${books.filter((book) => book.rfidId && !book.archived).length} RFID tagged`],
    ['Physical copies', liveBooks.length, 'All registered copy records'],
    ['Available', availableBooks.length, 'Ready for circulation'],
    ['Books issued', activeLoans.length, `${transactions.length} total loan records`],
    ['Overdue', overdueLoans.length, 'Requires follow-up'],
    ['Members', members.filter((item) => !item.archived).length, 'Registered patrons'],
    ['Reservations', reservations.filter((item) => ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)).length, 'Active holds'],
    ['Fines outstanding', fines.filter((item) => ['PENDING', 'PARTIALLY_PAID'].includes(item.status)).reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount), 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }), 'Current unpaid balance'],
    ['Lost / damaged', books.filter((item) => ['Lost', 'Damaged', 'Under Repair'].includes(item.condition) && !item.archived).length, 'Inventory exceptions'],
  ]

  const currentPageTitle = allNavigation.find(([key]) => key === page)?.[1] || (page === 'my-books' ? 'My books' : 'Library')

  if (!currentUser) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-panel auth-branding">
            <div className="auth-logo">N</div>
            <div className="brand-row"><span className="mini-label">DEMO MODE</span><span className="demo-tag">RFID Simulation Enabled</span></div>
            <h1>Northbridge University Library</h1>
            <p>Smart library operations for students, faculty, and librarians with secure RFID workflows and modern circulation tools.</p>
            <div className="feature-stack"><span>Catalog & metadata</span><span>RFID tracking</span><span>Self-service circulation</span></div>
          </div>
          <div className="auth-panel auth-form-panel">
            <div className="text-row"><span className="eyebrow">Welcome back</span><h2>Sign in to your library account</h2></div>
            <div className="demo-account-grid">
              {accounts.map((account) => <button key={account.role} type="button" className="demo-account-button" onClick={() => login(account)}><span>{account.role}</span><small>{account.name}</small></button>)}
            </div>
            <div className="auth-form">
              <label>Email or username<input type="text" value="Select a demo account above" readOnly /></label>
              <label>Password<input type="password" value="demo-access" readOnly /></label>
              <div className="auth-meta-row"><span>Demo environment</span><span>Simulation mode</span></div>
              <button type="button" className="primary-button wide" onClick={() => login(accounts[0])}>Login as Administrator</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!canOpen(page)) {
    return <div className="access-denied-shell"><section className="panel access-denied-card"><span className="eyebrow">Permission required</span><h1>Access denied</h1><p>Your {currentUser.role.replaceAll('_', ' ').toLowerCase()} account does not have permission to open this area.</p><div className="button-row"><button type="button" className="primary-button" onClick={() => navigate('dashboard')}>Return to dashboard</button><button type="button" className="ghost-button" onClick={() => actions.logout()}>Log out</button></div></section></div>
  }

  return (
    <div className={`app-shell ${currentUser.preferences?.compactTables ? 'compact-mode' : ''}`}>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="app-logo">N</div>
          {!collapsed && <div><strong>{settings.libraryName}</strong><small>Smart Library · Demo</small></div>}
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {visibleNav.map(([key, label]) => (
            <button key={key} type="button" className={`nav-item ${page === key ? 'active' : ''}`} title={label} onClick={() => navigate(key)}>
              <span className="nav-icon">{label[0]}</span>{!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><button type="button" className="ghost-button" onClick={() => setCollapsed((value) => !value)}>{collapsed ? 'Expand' : 'Collapse'}</button></div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-search-wrap">
            <span className="search-icon">⌕</span>
            <input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search books, members, RFID, ISBN..." aria-label="Global search" />
            {globalSearch && <div className="global-result-panel">{globalResults.length ? globalResults.map((result) => (
              <button key={`${result.type}-${result.id}`} type="button" className="search-result-row" onClick={() => result.type === 'Book' ? openBook(books.find((book) => book.id === result.id)) : openMember(members.find((member) => member.id === result.id))}>
                <span className="search-type">{result.type}</span><span>{result.label}<small className="search-hint">{result.hint}</small></span>
              </button>
            )) : <div className="search-empty">No matching books or members.</div>}</div>}
          </div>
          <div className="topbar-actions">
            <div className="location-pill">{settings.branch}</div>
            <button type="button" className="rfid-status-pill status-control" onClick={() => setMenu(menu === 'rfid-status' ? '' : 'rfid-status')}><span className="dot pulse" /> RFID: Simulation mode</button>
            <button type="button" className="icon-button" aria-label="Notifications" onClick={() => setMenu(menu === 'notifications' ? '' : 'notifications')}>♧<span className="badge">{unreadCount}</span></button>
            <button type="button" className="primary-button" onClick={() => setMenu(menu === 'quick' ? '' : 'quick')}>Quick actions</button>
            <button type="button" className="user-chip profile-trigger" onClick={() => setMenu(menu === 'profile' ? '' : 'profile')}>
              <span className="avatar">{currentUser.name?.charAt(0) || 'U'}</span><span><strong>{currentUser.name}</strong><small>{currentUser.role.replaceAll('_', ' ')}</small></span>
            </button>
          </div>
          {menu === 'rfid-status' && <div className="header-popover rfid-popover"><strong>Reader 01 · Connected</strong><span>Simulation mode · Ready for RFID reader integration</span><span>Last scan: {library.lastRFIDScan?.rfidId || 'No scans yet'}</span><span>Signal: Strong · {rfidDevices[0]?.totalScans || 0} scans</span><button type="button" className="link-button" onClick={() => navigate('devices')}>Manage devices</button></div>}
          {menu === 'notifications' && <div className="header-popover notification-popover"><div className="popover-title"><strong>Notifications</strong><button type="button" className="link-button" onClick={() => runAction(actions.markAllNotificationsRead, 'All notifications marked as read.')}>Mark all read</button></div>{notifications.slice(0, 6).map((item) => <button key={item.id} type="button" className={`notification-row ${item.read ? 'read' : ''}`} onClick={() => openNotification(item)}><strong>{item.title}</strong><small>{item.category} · {new Date(item.createdAt).toLocaleString()}</small></button>)}<button type="button" className="link-button" onClick={() => navigate('notifications')}>View notification center</button></div>}
          {menu === 'quick' && <div className="header-popover quick-popover">{[['Register book', 'register'], ['RFID scan', 'rfid'], ['Issue / return', 'circulation'], ['Add member', 'members'], ['Run shelf audit', 'inventory']].filter(([, key]) => canOpen(key)).map(([label, key]) => <button key={key} type="button" onClick={() => { if (key === 'register') setModal('create-book'); else if (key === 'members') setModal('create-member'); else navigate(key) }}>{label}</button>)}</div>}
          {menu === 'profile' && <div className="header-popover profile-popover"><strong>{currentUser.name}</strong><small>{currentUser.email}</small><button type="button" onClick={() => navigate('profile')}>View / edit profile</button><button type="button" onClick={() => navigate('profile')}>Preferences</button><button type="button" onClick={() => { actions.logout(); setMenu(''); window.history.replaceState({}, '', '/') }}>Log out</button></div>}
        </header>

        <div className="content-wrap">
          <div className="page-header-row">
            <div><div className="eyebrow">{settings.branch} · DEMO MODE</div><h1>{page === 'dashboard' ? `Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${currentUser.name.split(' ')[0]}` : currentPageTitle}</h1></div>
            <div className="demo-banner">Demo environment · RFID simulation enabled</div>
          </div>

          {page === 'dashboard' && (
            studentScope ? <>
              <div className="kpi-grid">{[['My current books', myLoans.length], ['My reservations', reservations.filter((item) => item.memberId === currentUser.memberId && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)).length], ['My overdue books', myLoans.filter((item) => item.dueDate < new Date().toISOString().slice(0, 10)).length], ['Outstanding fines', `₹${fines.filter((item) => item.memberId === currentUser.memberId && ['PENDING', 'PARTIALLY_PAID'].includes(item.status)).reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount), 0)}`]].map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
              <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><h3>My current books</h3><button type="button" className="link-button" onClick={() => navigate('my-books')}>View My Books</button></div><div className="compact-record-list">{myLoans.slice(0, 5).map((loan) => <div key={loan.id}><span><strong>{loan.bookTitle}</strong><small>Due {loan.dueDate}</small></span><Status value={loan.dueDate < new Date().toISOString().slice(0, 10) ? 'Overdue' : 'Issued'} /></div>)}{myLoans.length === 0 && <div className="empty-state">No books are currently checked out to you.</div>}</div></section><section className="panel"><div className="panel-heading"><h3>My reservations</h3><button type="button" className="link-button" onClick={() => navigate('reservations')}>View reservations</button></div><div className="compact-record-list">{reservations.filter((item) => item.memberId === currentUser.memberId && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)).slice(0, 5).map((item) => <div key={item.id}><span><strong>{item.bookTitle}</strong><small>{item.status === 'READY_FOR_PICKUP' ? `Reserved until ${item.expiresAt || item.pickupDeadline}` : `Queue #${item.queuePosition}`}</small></span><Status value={item.status} /></div>)}{!reservations.some((item) => item.memberId === currentUser.memberId && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)) && <div className="empty-state">You have no active reservations.</div>}</div></section><section className="panel"><div className="panel-heading"><h3>Catalog</h3><button type="button" className="primary-button" onClick={() => navigate('catalog')}>Browse books</button></div><p>Search the library collection, check availability, and reserve unavailable titles.</p></section></div>
            </> : <>
              <div className="kpi-grid">{dashboardStats.map(([label, value, note]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}</div>
              <div className="dashboard-grid">
                <section className="panel chart-panel large-panel"><div className="panel-heading"><h3>Current circulation</h3><button type="button" className="link-button" onClick={() => navigate('reports')}>View report</button></div>
                  <div className="bar-chart">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                    const count = transactions.filter((item) => new Date(item.createdAt).getDay() === (index + 1) % 7).length
                    const height = Math.max(8, Math.min(100, count / Math.max(1, transactions.length) * 500))
                    return <div key={day} className="bar-col" title={`${count} transactions`}><span className="bar" style={{ height: `${height}%` }} /><small>{day}</small></div>
                  })}</div><p className="chart-footnote">{transactions.length} circulation records · live from loan history</p>
                </section>
                <section className="panel live-rfid-panel"><div className="panel-heading"><h3>Live RFID panel</h3><Status value="Connected" /></div><div className="scanner-box"><div className="scanner-visual"><div className="scanner-pulse" /></div><span className="tag-label">Last scanned tag</span><strong>{library.lastRFIDScan?.rfidId || 'No scan recorded'}</strong><div className="meta-grid"><span>Book</span><strong>{library.lastRFIDScan?.title || 'Ready for scan'}</strong><span>Scans today</span><strong>{rfidLogs.filter((log) => new Date(log.timestamp).toDateString() === new Date().toDateString()).length}</strong><span>Mode</span><strong>Simulation</strong></div><button type="button" className="primary-button" onClick={() => navigate('rfid')}>Open RFID operations</button></div></section>
                <section className="panel activity-panel"><div className="panel-heading"><h3>Recent activity</h3><button type="button" className="link-button" onClick={() => navigate('audit')}>All activity</button></div><ul className="activity-list">{actions.getRecentActivity().slice(0, 6).map((item) => <li key={item.id}><span>{item.description}</span><small>{new Date(item.timestamp).toLocaleTimeString()}</small></li>)}</ul></section>
                <section className="panel chart-panel"><div className="panel-heading"><h3>Collection by category</h3></div><div className="progress-list">{categories.slice(0, 5).map((category) => { const count = liveBooks.filter((book) => book.category === category).length; return <div className="progress-row" key={category}><span>{category}</span><div className="progress-track"><b style={{ width: `${Math.max(3, count / Math.max(liveBooks.length, 1) * 100)}%` }} /></div><strong>{count}</strong></div> })}</div></section>
                <section className="panel chart-panel"><div className="panel-heading"><h3>Recently added books</h3><button type="button" className="link-button" onClick={() => navigate('catalog')}>Catalog</button></div><ul className="recent-list">{recentBooks.map((book) => <li key={book.id}><button type="button" className="text-row-button" onClick={() => openBook(book)}><strong>{book.title}</strong><small>{book.author} · {book.accessionNumber}</small></button><Status value={book.availabilityStatus} /></li>)}</ul></section>
                <section className="panel"><div className="panel-heading"><h3>Quick actions</h3></div><div className="quick-action-grid">{[['Register book', 'register'], ['RFID scan', 'rfid'], ['Issue / return', 'circulation'], ['Add member', 'members'], ['Reservation', 'reservations'], ['Shelf audit', 'inventory']].filter(([, key]) => canOpen(key)).map(([label, key]) => <button key={key} type="button" className="quick-action-button" onClick={() => key === 'register' ? setModal('create-book') : key === 'members' ? setModal('create-member') : navigate(key)}>{label}</button>)}</div></section>
              </div>
            </>
          )}

          {page === 'catalog' && <section className="panel">
            <div className="panel-heading"><div><h3>Library catalog</h3><small>{filteredBooks.length} matching records · newest additions first</small></div><div className="inline-actions">{can('BOOK_CREATE') && <button type="button" className="primary-button" onClick={() => { setForm(initialBookForm); setModal('create-book') }}>+ Add book</button>}<button type="button" className="ghost-button" onClick={() => runAction(() => exportCSV('library-catalog.csv', filteredBooks), 'Catalog exported.')}>Export CSV</button></div></div>
            <div className="catalog-toolbar"><input value={search} onChange={(event) => { setSearch(event.target.value); setPageNumber(1) }} placeholder="Title, author, ISBN, accession or RFID" aria-label="Search catalog" /><select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPageNumber(1) }}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPageNumber(1) }}><option value="">All availability</option>{['Available', 'Issued', 'Reserved', 'Lost', 'Damaged'].map((item) => <option key={item}>{item}</option>)}</select><select value={rfidFilter} onChange={(event) => setRfidFilter(event.target.value)}><option value="">All RFID status</option><option value="tagged">Tagged</option><option value="untagged">Unassigned</option></select></div>
            {(categoryFilter || statusFilter || rfidFilter) && <div className="filter-chip-row">Active filters: {categoryFilter && <button type="button" onClick={() => setCategoryFilter('')}>{categoryFilter} ×</button>}{statusFilter && <button type="button" onClick={() => setStatusFilter('')}>{statusFilter} ×</button>}{rfidFilter && <button type="button" onClick={() => setRfidFilter('')}>{rfidFilter} ×</button>}<button type="button" className="link-button" onClick={() => { setCategoryFilter(''); setStatusFilter(''); setRfidFilter(''); setSearch('') }}>Clear all</button></div>}
            <h4>Title quantities and current holders</h4><div className="table-wrap"><table><thead><tr><th>Category / department</th><th>Book title</th><th>Author / year / edition</th><th>Total</th><th>Available</th><th>Issued</th><th>Reserved</th><th>Lost</th><th>Damaged</th><th>Borrowed / usage</th><th>Currently held by</th></tr></thead><tbody>{visibleTitleGroups.map((group) => { const usage = titleUsageRows.find((row) => row.id === group.id); const held = activeLoans.filter((loan) => loan.titleGroupId === group.id); return <tr key={group.id}><td>{group.category} · {group.department}</td><td><button type="button" className="table-link" onClick={() => openBook(group.copies[0])}>{group.title}</button><small className="table-subtitle">{group.id} · {(usage?.available || 0) > 0 ? `${usage.available} available` : 'Currently Unavailable'}</small></td><td>{group.author}<small className="table-subtitle">{group.copies[0]?.publicationYear} · {group.copies[0]?.edition}</small></td><td>{group.copies.length}</td><td>{usage?.available || 0}</td><td>{held.length}</td><td>{group.copies.filter((copy) => copy.availabilityStatus === 'Reserved').length}</td><td>{group.copies.filter((copy) => copy.condition === 'Lost' || copy.availabilityStatus === 'Lost').length}</td><td>{group.copies.filter((copy) => copy.condition === 'Damaged' || copy.availabilityStatus === 'Damaged').length}</td><td>{usage?.totalBorrowed || 0} · {usage?.usageShare || '0.0'}%</td><td>{held.length ? held.map((loan) => { const holder = members.find((member) => member.id === loan.memberId); const copy = books.find((item) => item.id === loan.bookId); return <div key={loan.id}><button type="button" className="table-link" onClick={() => openMember(holder)}>{holder?.name || loan.memberName}</button><small className="table-subtitle">{holder?.registrationNumber || holder?.studentId} · {copy?.accessionNumber} · due {loan.dueDate}</small></div> }) : '—'}</td></tr> })}</tbody></table>{!visibleTitleGroups.length && <div className="empty-state">No title groups match this search.</div>}</div>
            <h4>Physical copies and RFID</h4>
            <div className="table-wrap"><table><thead><tr><th>Accession</th><th>Title / author</th><th>Category</th><th>RFID</th><th>Location</th><th>Status</th><th>Current holder / due</th><th>Actions</th></tr></thead><tbody>{displayedBooks.map((book) => { const holder = members.find((member) => member.id === book.currentHolderId); return <tr key={book.id}><td>{book.accessionNumber}</td><td><button type="button" className="table-link" onClick={() => openBook(book)}>{book.title}</button><small className="table-subtitle">{book.author} · {book.isbn}</small></td><td>{book.category}</td><td>{book.rfidId || 'Pending tag'}</td><td>{book.location || 'Uncatalogued'}</td><td><Status value={book.status || book.availabilityStatus} /></td><td>{holder ? <><button type="button" className="table-link" onClick={() => openMember(holder)}>{holder.name}</button><small className="table-subtitle">{holder.registrationNumber || holder.studentId} · due {book.dueDate}</small></> : book.availabilityStatus === 'Available' ? 'Available' : '—'}</td><td><div className="row-actions"><button type="button" className="mini-button" onClick={() => openBook(book)}>View</button>{can('BOOK_EDIT') && <button type="button" className="mini-button" onClick={() => editBook(book)}>Edit</button>}{can('RESERVATION_CREATE') && <button type="button" className="mini-button" onClick={() => reserveBook(book)}>Hold</button>}</div></td></tr> })}</tbody></table>{!displayedBooks.length && <div className="empty-state">No books found. Try changing your search or filters.</div>}</div>
            <div className="pagination-row"><span>Showing {filteredBooks.length ? (pageNumber - 1) * pageSize + 1 : 0}–{Math.min(pageNumber * pageSize, filteredBooks.length)} of {filteredBooks.length}</span><label>Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPageNumber(1) }}>{[10, 25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></label><button type="button" className="ghost-button" disabled={pageNumber <= 1} onClick={() => setPageNumber((number) => number - 1)}>Previous</button><button type="button" className="ghost-button" disabled={pageNumber * pageSize >= filteredBooks.length} onClick={() => setPageNumber((number) => number + 1)}>Next</button></div>
          </section>}

          {page === 'register' && <section className="panel register-panel"><div className="panel-heading"><h3>Register new book</h3><Status value="Ready for RFID reader integration" /></div><div className="register-steps"><div className="step-pill active">Book information</div><div className="step-pill active">RFID assignment</div><div className="step-pill active">Library location</div><div className="step-pill active">Review & submit</div></div><BookForm form={form} setForm={setForm} categories={categories} departments={departments} onSubmit={submitBook} onCancel={() => navigate('catalog')} onSimulate={() => simulateBookRFID(true)} onCheckRFID={(uid) => checkRegistrationRFID(uid)} submitLabel="Register book" /></section>}

          {page === 'rfid' && <section className="panel rfid-page-panel"><div className="panel-heading"><div><h3>RFID operations</h3><small>Simulation Mode · Ready for RFID Reader Integration</small></div><Status value="Connected" /></div><div className="rfid-layout"><div className="scanner-card"><div className="scanner-header"><div><span className="eyebrow">RFID reader</span><h4>Simulation bridge active</h4></div><span className="pulse-dot" /></div><div className="rfid-visual"><div className="rfid-ring" /><div className="rfid-scan-line" /></div><p>Place a book near the reader or type/paste its UID.</p><label className="workspace-field">RFID ID<input ref={rfidInputRef} className="rfid-input" value={rfid} onChange={(event) => processRFID(event.target.value)} placeholder="RFID-IND-2026-000001" aria-label="RFID ID" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); processRFID(rfid) } }} /></label><div className="button-group"><button type="button" className="primary-button" onClick={() => simulateBookRFID(false)}>Simulate RFID scan</button><button type="button" className="ghost-button" onClick={() => { setRfid(''); setRfidResult(null); rfidInputRef.current?.focus() }}>Clear</button></div><small>Keyboard-wedge input is supported. Valid UIDs trigger lookup automatically.</small></div><div className="lookup-card">          {rfidBusy ? <div className="empty-state"><strong>Reading RFID…</strong><p>Searching the library</p></div> : rfidResult?.missing ? <div className="empty-state"><strong>RFID not registered</strong><p>{rfidResult.rfidId} is not assigned to a book or student.</p></div> : rfidResult ? <BookSummary book={rfidResult} transactions={transactions} members={members} onOpen={() => rfidResult.type === 'member' ? openMember(rfidResult.record) : openBook(rfidResult.record)} /> : <div className="empty-state"><strong>Awaiting RFID scan</strong><p>Scan an existing tag to load its book or student record.</p></div>}</div></div><div className="panel-heading section-subheading"><h3>Recent RFID events</h3><button type="button" className="link-button" onClick={() => navigate('devices')}>Devices</button></div><div className="table-wrap"><table><thead><tr><th>Time</th><th>UID</th><th>Book</th><th>Event</th><th>Device</th><th>Result</th></tr></thead><tbody>{rfidLogs.slice(0, 8).map((log) => <tr key={log.id}><td>{new Date(log.timestamp).toLocaleString()}</td><td>{log.rfidId}</td><td>{log.bookTitle}</td><td>{log.event}</td><td>{log.device}</td><td><Status value={log.result} /></td></tr>)}</tbody></table></div></section>}

          {page === 'circulation' && <section className="panel circulation-workstation" data-circulation-step={circulationStep} data-circulation-mode={circulationMode || ''}>
            <div className="panel-heading"><div><h3>Circulation workstation</h3><small>Identify the student, then choose an action and scan a physical copy. RFID reader is simulated.</small></div><div className="inline-actions"><button type="button" className={circulationMode === 'history' ? 'primary-button' : 'ghost-button'} onClick={() => setCirculationMode(circulationMode === 'history' ? '' : 'history')}>Transaction history</button><button type="button" className="ghost-button" onClick={() => document.getElementById('active-loans-table')?.scrollIntoView({ behavior: 'smooth' })}>Active loans</button></div></div>
            {circulationMode === 'history' ? <><div className="register-steps"><div className="step-pill active">Transaction records</div><button type="button" className="ghost-button" onClick={() => { setCirculationMode(''); setCirculationStep(1) }}>Return to workflow</button></div><div className="catalog-toolbar"><input value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} placeholder="Search student, register number, book or RFID" aria-label="Search circulation records" /><select value={transactionStatusFilter} onChange={(event) => setTransactionStatusFilter(event.target.value)} aria-label="Filter circulation status"><option value="">All statuses</option><option value="Issued">Issued</option><option value="Returned">Returned</option><option value="Overdue">Overdue</option></select></div><div className="table-wrap"><table><thead><tr><th>Transaction</th><th>Student</th><th>Register No</th><th>Book / RFID</th><th>Issue date</th><th>Due date</th><th>Return date</th><th>Status</th><th>Fine</th></tr></thead><tbody>{transactions.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).filter((loan) => { const member = members.find((item) => item.id === loan.memberId); const book = books.find((item) => item.id === loan.bookId); const overdue = loan.status === 'Issued' && loan.dueDate < new Date().toISOString().slice(0, 10); const statusMatches = !transactionStatusFilter || transactionStatusFilter === 'Overdue' ? !transactionStatusFilter || overdue : loan.status === transactionStatusFilter; const text = `${member?.name || loan.memberName} ${member?.registrationNumber || member?.studentId || ''} ${book?.title || loan.bookTitle} ${book?.rfidId || loan.rfidId || ''}`.toLowerCase(); return statusMatches && (!transactionSearch || text.includes(transactionSearch.toLowerCase())) }).map((loan) => { const member = members.find((item) => item.id === loan.memberId); const book = books.find((item) => item.id === loan.bookId); const overdue = loan.status === 'Issued' && loan.dueDate < new Date().toISOString().slice(0, 10); return <tr key={loan.id}><td>{loan.id}</td><td>{member?.name || loan.memberName}</td><td>{member?.registrationNumber || member?.studentId || '—'}</td><td>{book?.title || loan.bookTitle}<small className="table-subtitle">{book?.rfidId || loan.rfidId || '—'} · {book?.accessionNumber || loan.bookId}</small></td><td>{loan.issueDate}</td><td>{loan.dueDate}</td><td>{loan.returnedDate || '—'}</td><td><Status value={overdue ? 'Overdue' : loan.status} /></td><td>₹{loan.fine || 0}</td></tr> })}</tbody></table>{!transactions.length && <div className="empty-state">No circulation records yet.</div>}</div></> : <><div className="register-steps"><button type="button" className={`step-pill ${circulationStep === 1 ? 'active' : ''}`} onClick={() => setCirculationStep(1)}>1 · Student</button><button type="button" className={`step-pill ${circulationStep === 2 ? 'active' : ''}`} disabled={!circulationMember} onClick={() => { if (circulationMember) setCirculationStep(2) }}>2 · Book / action</button></div><div className="two-column-grid">
              <section className="panel"><div className="panel-heading"><div><h3>Step 1 · Scan member card</h3><small>Member RFID identifies the borrower, never the physical book.</small></div></div>
                <RFIDScanner label="Scan Student RFID" value={circulationMemberRFID} onChange={(value) => { setCirculationMemberRFID(value); setMemberScanError(''); if (settings.autoLookup && isValidRFID(value, 'member')) scanCirculationMember(value) }} onScan={scanCirculationMember} onSimulate={() => simulateCirculationMember(circulationMode)} placeholder="95 92 4F 06" status={circulationMember ? `${circulationMember.name} · ${circulationMember.registrationNumber || circulationMember.studentId}` : memberScanError || 'Scan, search, or filter to identify a student.'} />
                {memberScanError && <div className="validation-box validation-error">{memberScanError}</div>}
                <div className="field-grid">
                  <Field label="Search Student ID / Registration Number / Name / RFID" value={studentSearch} onChange={setStudentSearch} />
                  <label className="workspace-field">Year<select value={studentYearFilter} onChange={(event) => setStudentYearFilter(event.target.value)}><option value="">All years</option>{[...new Set(members.map((member) => member.year).filter(Boolean))].map((year) => <option key={year}>{year}</option>)}</select></label>
                  <label className="workspace-field">Branch / Department<select value={studentDepartmentFilter} onChange={(event) => setStudentDepartmentFilter(event.target.value)}><option value="">All departments</option>{[...new Set(members.map((member) => member.department).filter(Boolean))].map((department) => <option key={department}>{department}</option>)}</select></label>
                  <label className="workspace-field">Section<select value={studentSectionFilter} onChange={(event) => setStudentSectionFilter(event.target.value)}><option value="">All sections</option>{[...new Set(members.map((member) => member.section).filter(Boolean))].map((section) => <option key={section}>{section}</option>)}</select></label>
                </div>
                {studentSearch && <div className="search-result-list">{studentOptions.slice(0, 6).map((member) => <button type="button" key={member.id} className="search-result-row" onClick={() => selectCirculationMember(member)}><span className="search-type">Student</span><span>{member.name}<small className="search-hint">{member.registrationNumber || member.studentId} · {member.department} · {member.year} · {member.rfidCardId}</small></span></button>)}{!studentOptions.length && <div className="search-empty">No students match the current search and filters.</div>}</div>}
                {circulationMember && (() => { const studentLoans = activeLoans.filter((loan) => loan.memberId === circulationMember.id); const limit = Number(settings.memberTypeRules?.[circulationMember.memberType]?.borrowingLimit || settings.borrowingLimit); const unpaid = fines.filter((fine) => fine.memberId === circulationMember.id && fine.status === 'PENDING').reduce((sum, fine) => sum + fine.amount, 0); const overdueCount = studentLoans.filter((loan) => loan.dueDate < new Date().toISOString().slice(0, 10)).length; const activeReservations = reservations.filter((item) => item.memberId === circulationMember.id && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)).length; return <><div className="lookup-grid circulation-summary"><span>Student / registration</span><strong>{circulationMember.name} · {circulationMember.registrationNumber || circulationMember.studentId}</strong><span>Student RFID</span><strong>{circulationMember.rfidCardId || 'Not assigned'}</strong><span>Department · year · section</span><strong>{circulationMember.department} · {circulationMember.year || '—'} · {circulationMember.section || '—'}</strong><span>Books currently held</span><strong>{studentLoans.length}</strong><span>Maximum / remaining capacity</span><strong>{limit} / {Math.max(0, limit - studentLoans.length)}</strong><span>Overdue books</span><strong>{overdueCount}</strong><span>Outstanding fine</span><strong>₹{unpaid}</strong><span>Active reservations</span><strong>{activeReservations}</strong><span>Membership</span><strong>{circulationMember.status}{circulationMember.membershipExpiry ? ` · expires ${circulationMember.membershipExpiry}` : ''}</strong></div><div className="validation-box validation-success">{circulationMember.status === 'Active' ? '✓ Membership active' : '⚠ Membership inactive'} · {limit > studentLoans.length ? '✓ Loan capacity available' : '⚠ Loan limit reached'} · {overdueCount ? `⚠ ${overdueCount} overdue book(s)` : '✓ No overdue books'} · {unpaid ? `⚠ Outstanding fine ₹${unpaid}` : '✓ No outstanding fine'}</div><div className="button-row"><button type="button" className="ghost-button" onClick={() => setModal({ type: 'student-history', id: circulationMember.id })}>View Student History</button><button type="button" className="ghost-button" onClick={() => openMember(circulationMember)}>Open Student Profile</button></div>{studentLoans.length > 0 && <div className="compact-record-list"><h4>Current books</h4>{studentLoans.map((loan) => <button key={loan.id} type="button" className="search-result-row" onClick={() => openBook(books.find((copy) => copy.id === loan.bookId))}>{loan.bookTitle}<small className="search-hint">{books.find((copy) => copy.id === loan.bookId)?.accessionNumber} · {books.find((copy) => copy.id === loan.bookId)?.rfidId} · due {loan.dueDate}</small></button>)}</div>}</> })()}
                <div className="button-row circulation-step-actions"><button type="button" className="primary-button" disabled={!circulationMember} onClick={() => { setCirculationMode(''); setCirculationBook(null); setCirculationBookRFID(''); setCirculationStep(2) }}>Next →</button></div>
              </section>
              <section className={`panel circulation-book-stage ${circulationMode ? '' : 'awaiting-action'}`} data-action-selected={circulationMode === 'issue' || circulationMode === 'return'}>
                {circulationMember && <div className="circulation-student-summary"><span className="eyebrow">Selected student</span><strong>{circulationMember.name}</strong><span>{circulationMember.registrationNumber || circulationMember.studentId} · {circulationMember.department} · {circulationMember.year}</span><button type="button" className="link-button" onClick={() => setCirculationStep(1)}>Change student</button></div>}
                <div className="circulation-action-choice"><h3>What does the student want to do?</h3><div className="button-row"><button type="button" className={circulationMode === 'issue' ? 'primary-button' : 'ghost-button'} onClick={() => { setCirculationMode('issue'); setCirculationBook(null); setCirculationBookRFID(''); setBookScanError('') }}>Issue book</button><button type="button" className={circulationMode === 'return' ? 'primary-button' : 'ghost-button'} onClick={() => { setCirculationMode('return'); setCirculationBook(null); setCirculationBookRFID(''); setBookScanError('') }}>Return book</button></div></div>
                <div className="panel-heading"><div><h3>Scan physical book copy</h3><small>{circulationMode === 'issue' ? 'Scan any available RFID-tagged copy.' : circulationMode === 'return' ? 'The active loan must belong to the selected student.' : 'Choose an action above to continue.'}</small></div></div>
                <RFIDScanner label="Scan Book RFID" value={circulationBookRFID} disabled={!circulationMember} onChange={(value) => { setCirculationBookRFID(value); setBookScanError(''); if (circulationMember && settings.autoLookup && isValidRFID(value, 'book')) scanCirculationBook(value, circulationMode === 'return' ? 'RETURN_LOOKUP' : 'ISSUE_LOOKUP') }} onScan={(value) => scanCirculationBook(value, circulationMode === 'return' ? 'RETURN_LOOKUP' : 'ISSUE_LOOKUP')} onSimulate={() => simulateCirculationBook(circulationMode)} placeholder="60 C0 3E 3B" status={circulationBook ? `${circulationBook.title} · ${circulationBook.accessionNumber} · ${circulationBook.availabilityStatus}` : bookScanError || 'Waiting for book RFID'} />
                {bookScanError && <div className="validation-box validation-error">{bookScanError}</div>}
                {circulationMember && <><Field label="Search title / ISBN / accession / RFID" value={bookSearch} onChange={setBookSearch} /><div className="search-result-list">{liveBooks.filter((book) => !studentScope || book.availabilityStatus !== 'Pending Registration').filter((book) => !bookSearch || `${book.title} ${book.author} ${book.isbn} ${book.accessionNumber} ${book.rfidId} ${book.titleGroupId}`.toLowerCase().includes(bookSearch.toLowerCase())).slice(0, 6).map((book) => <button type="button" className="search-result-row" key={book.id} onClick={() => { setCirculationBook(book); setCirculationBookRFID(book.rfidId || ''); setBookScanError(''); setBookSearch('') }}><span className="search-type">Physical copy</span><span>{book.title}<small className="search-hint">{book.accessionNumber} · {book.rfidId || 'RFID pending'} · {book.availabilityStatus}</small></span></button>)}</div></>}
                {circulationBook && (() => { const copies = liveBooks.filter((copy) => copy.titleGroupId === circulationBook.titleGroupId); const groupLoans = transactions.filter((loan) => loan.titleGroupId === circulationBook.titleGroupId && loan.status === 'Issued'); const groupReservations = reservations.filter((reservation) => reservation.titleGroupId === circulationBook.titleGroupId && ['PENDING', 'READY_FOR_PICKUP'].includes(reservation.status)); const count = (status) => copies.filter((copy) => status === 'Issued' ? groupLoans.some((loan) => loan.bookId === copy.id) : copy.availabilityStatus === status).length; const heldLoan = transactions.find((loan) => loan.bookId === circulationBook.id && loan.status === 'Issued'); const holder = members.find((member) => member.id === heldLoan?.memberId); const hold = reservations.find((reservation) => reservation.assignedBookId === circulationBook.id || reservation.bookId === circulationBook.id && reservation.status === 'READY_FOR_PICKUP'); return <><div className="lookup-grid circulation-summary"><span>Title / author</span><strong>{circulationBook.title} · {circulationBook.author}</strong><span>Year / edition</span><strong>{circulationBook.publicationYear} · {circulationBook.edition}</strong><span>Department / category</span><strong>{circulationBook.department} / {circulationBook.category}</strong><span>Title group</span><strong>{circulationBook.titleGroupId}</strong><span>Physical copy / accession</span><strong>{circulationBook.copyNumber || '—'} · {circulationBook.accessionNumber}</strong><span>Book RFID</span><strong>{circulationBook.rfidId || 'Not assigned'}</strong><span>Location</span><strong>{circulationBook.location || 'Uncatalogued'}</strong><span>Condition / status</span><strong>{circulationBook.condition} / {circulationBook.availabilityStatus}</strong>{holder && <><span>Currently held by</span><strong><button type="button" className="table-link" onClick={() => openMember(holder)}>{holder.name} · {holder.registrationNumber || holder.studentId}</button> · due {heldLoan.dueDate}</strong></>}{hold && <><span>Reserved for</span><strong>{hold.memberName} · pickup by {hold.pickupDeadline || hold.expiresAt || '—'}</strong></>}</div><div className="kpi-grid small-grid">{[['Title copies', copies.length], ['Available', count('Available')], ['Issued', groupLoans.length], ['Reserved', count('Reserved')], ['Lost', count('Lost')], ['Damaged', count('Damaged')], ['Active reservations', groupReservations.length]].map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></> })()}
              </section>
              {circulationMode === 'issue' ? <section className="panel circulation-validation"><div className="panel-heading"><div><h3>Step 3 · Issue validation</h3><small>Title-group restrictions apply across physical copies.</small></div><Status value={issueValidation?.eligible ? 'Eligible' : 'Validation required'} /></div>
                {!issueValidation ? <div className="empty-state">Scan a member card and book RFID to validate this checkout.</div> : <><div className={`validation-box ${issueValidation.eligible ? 'validation-success' : 'validation-error'}`}>{issueValidation.eligible ? <div>Eligible for issue · due {issueValidation.dueDate} ({issueValidation.loanDays} days)</div> : issueValidation.reasons.map((reason) => <div key={reason}>{reason}</div>)}</div><div className="button-row"><button type="button" className="primary-button" disabled={!issueValidation.eligible} onClick={() => setModal('confirm-issue')}>Review & confirm issue</button><button type="button" className="ghost-button" onClick={() => { setCirculationMemberRFID(''); setCirculationBookRFID(''); setCirculationMember(null); setCirculationBook(null) }}>Clear workflow</button></div></>}
              </section> : <section className="panel circulation-validation"><div className="panel-heading"><div><h3>Step 3 · Return validation</h3><small>Member and physical copy must match an active transaction.</small></div><Status value={activeScannedLoan ? 'Return matched' : 'Validation required'} /></div>
                {!circulationBook || !circulationMember ? <div className="empty-state">Scan the member RFID and the borrowed copy RFID.</div> : !activeScannedLoan ? <div className="validation-box validation-error"><div>This copy is not currently issued to {circulationMember.name}.</div>{transactions.find((loan) => loan.bookId === circulationBook.id && loan.status === 'Issued') && <div>Current borrower: {transactions.find((loan) => loan.bookId === circulationBook.id && loan.status === 'Issued').memberName}</div>}</div> : <><div className="lookup-grid circulation-summary"><span>Issue date</span><strong>{activeScannedLoan.issueDate}</strong><span>Due date</span><strong>{activeScannedLoan.dueDate}</strong><span>Return date</span><strong>{new Date().toISOString().slice(0, 10)}</strong><span>Overdue days</span><strong>{returnOverdueDays}</strong><span>Fine estimate</span><strong>₹{returnOverdueDays * settings.finePerDay}</strong></div><button type="button" className="primary-button" onClick={() => setModal('confirm-return')}>Review & confirm return</button></>}
              </section>}
            </div></>}
          </section>}

          {page === 'circulation' && <section className="panel" id="active-loans-table"><div className="panel-heading"><div><h3>Currently issued books</h3><small>{filteredActiveLoans.length} active loans · book-to-student relationships from circulation transactions</small></div></div><div className="catalog-toolbar"><input value={loanSearch} onChange={(event) => setLoanSearch(event.target.value)} placeholder="Search student, registration number, title, accession or RFID" /><select value={loanDepartmentFilter} onChange={(event) => setLoanDepartmentFilter(event.target.value)}><option value="">All departments</option>{[...new Set(members.map((member) => member.department).filter(Boolean))].map((department) => <option key={department}>{department}</option>)}</select><select value={loanYearFilter} onChange={(event) => setLoanYearFilter(event.target.value)}><option value="">All years</option>{[...new Set(members.map((member) => member.year).filter(Boolean))].map((year) => <option key={year}>{year}</option>)}</select><select value={loanTimingFilter} onChange={(event) => setLoanTimingFilter(event.target.value)}><option value="">All due dates</option><option value="overdue">Overdue</option><option value="due-soon">Due within 3 days</option></select></div><div className="table-wrap"><table><thead><tr><th>Book / accession</th><th>Book RFID</th><th>Student / registration</th><th>Student RFID</th><th>Issue date</th><th>Due date</th><th>Days remaining</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredActiveLoans.map((loan) => { const copy = books.find((item) => item.id === loan.bookId); const member = members.find((item) => item.id === loan.memberId); const days = Math.ceil((new Date(`${loan.dueDate}T00:00:00`) - new Date(new Date().toDateString())) / 86400000); return <tr key={loan.id}><td><button type="button" className="table-link" onClick={() => openBook(copy)}>{loan.bookTitle}</button><small className="table-subtitle">{copy?.accessionNumber || loan.bookId}</small></td><td>{copy?.rfidId || loan.rfidId}</td><td><button type="button" className="table-link" onClick={() => member && openMember(member)}>{member?.name || loan.memberName}</button><small className="table-subtitle">{member?.registrationNumber || member?.studentId}</small></td><td>{member?.rfidCardId || loan.memberRFID}</td><td>{loan.issueDate}</td><td>{loan.dueDate}</td><td>{days < 0 ? `${Math.abs(days)} days overdue` : `${days} days`}</td><td><Status value={days < 0 ? 'Overdue' : 'Issued'} /></td><td><div className="row-actions"><button type="button" className="mini-button" onClick={() => member && openMember(member)}>View student</button><button type="button" className="mini-button" onClick={() => openBook(copy)}>View book</button><button type="button" className="mini-button" onClick={() => { if (!member || !copy) return; setCirculationMode('return'); scanCirculationMember(member.rfidCardId); scanCirculationBook(copy.rfidId, 'RETURN_LOOKUP'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Return</button><button type="button" className="mini-button" onClick={() => runAction(() => actions.renewBook({ bookId: loan.bookId, memberId: loan.memberId }), 'Loan renewed.')}>Renew</button></div></td></tr> })}</tbody></table>{!filteredActiveLoans.length && <div className="empty-state">{activeLoans.length ? 'No active loans match these filters.' : 'No active loans.'}</div>}</div></section>}

          {page === 'my-books' && <section className="panel">
            <div className="panel-heading"><div><h3>My books</h3><small>{ownMember?.name || currentUser.name} · currently checked out</small></div>{ownMember && <button type="button" className="ghost-button" onClick={() => setModal({ type: 'student-history', id: ownMember.id })}>View History</button>}</div>
            {myLoans.length ? <div className="table-wrap"><table><thead><tr><th>Title</th><th>Copy RFID</th><th>Accession</th><th>Issue date</th><th>Due date</th><th>Status</th><th>Action</th></tr></thead><tbody>{myLoans.map((loan) => { const copy = books.find((item) => item.id === loan.bookId); return <tr key={loan.id}><td><button type="button" className="table-link" onClick={() => openBook(copy)}>{loan.bookTitle}</button></td><td>{copy?.rfidId || loan.rfidId}</td><td>{copy?.accessionNumber || loan.bookId}</td><td>{loan.issueDate}</td><td>{loan.dueDate}</td><td><Status value={new Date(`${loan.dueDate}T00:00:00`) < new Date() ? 'Overdue' : 'Issued'} /></td><td><button type="button" className="mini-button" onClick={() => runAction(() => actions.renewBook({ bookId: loan.bookId, memberId: loan.memberId }), 'Loan renewed.')}>Renew</button></td></tr> })}</tbody></table></div> : <div className="empty-state">No books are currently checked out to this account.</div>}
          </section>}

          {page === 'members' && <section className="panel"><div className="panel-heading"><div><h3>Student / member management</h3><small>{filteredMembers.length} matching members · {members.filter((item) => !item.archived).length} total records</small></div>{can('MEMBER_CREATE') && <button type="button" className="primary-button" onClick={() => { setMemberForm(initialMemberForm); setModal('create-member') }}>+ Add student</button>}</div><div className="catalog-toolbar member-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, registration number, member ID, RFID" /><select value={memberYearFilter} onChange={(event) => setMemberYearFilter(event.target.value)}><option value="">All years</option>{[...new Set(members.map((member) => member.year).filter(Boolean))].map((year) => <option key={year}>{year}</option>)}</select><select value={memberDepartmentFilter} onChange={(event) => setMemberDepartmentFilter(event.target.value)}><option value="">All branches / departments</option>{[...new Set(members.map((member) => member.department).filter(Boolean))].map((department) => <option key={department}>{department}</option>)}</select><select value={memberSectionFilter} onChange={(event) => setMemberSectionFilter(event.target.value)}><option value="">All sections</option>{[...new Set(members.map((member) => member.section).filter(Boolean))].map((section) => <option key={section}>{section}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option>Active</option><option>Blocked</option><option>Inactive</option></select></div>{detailMember ? <MemberDetails member={members.find((item) => item.id === detailMember.id) || detailMember} books={books} transactions={transactions} reservations={reservations} fines={fines} onBack={() => { setSelectedMember(null); navigate('members') }} onEdit={beginEditMember} canEdit={can('MEMBER_EDIT')} onOpenBook={openBook} /> : <div className="table-wrap"><table><thead><tr><th>Student</th><th>Registration number</th><th>Department / year / section</th><th>Card RFID</th><th>Current books</th><th>Fine balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredMembers.slice(0, 100).map((member) => <tr key={member.id}><td><button type="button" className="table-link" onClick={() => openMember(member)}>{member.name}</button><small className="table-subtitle">{member.email || 'No email recorded'}</small></td><td>{member.registrationNumber || member.studentId}</td><td>{member.department} · {member.year || '—'} · {member.section || '—'}</td><td>{member.rfidCardId || 'Not assigned'}</td><td>{activeLoans.filter((item) => item.memberId === member.id).length}</td><td>₹{fines.filter((item) => item.memberId === member.id && item.status === 'PENDING').reduce((sum, item) => sum + item.amount, 0)}</td><td><Status value={member.status} /></td><td><div className="row-actions"><button type="button" className="mini-button" onClick={() => openMember(member)}>View</button>{can('MEMBER_EDIT') && <button type="button" className="mini-button" onClick={() => beginEditMember(member)}>Edit</button>}{can('MEMBER_EDIT') && <button type="button" className="mini-button" onClick={() => runAction(() => actions.updateMember(member.id, { status: member.status === 'Active' ? 'Inactive' : 'Active' }), member.status === 'Active' ? 'Member deactivated.' : 'Member reactivated.')}>{member.status === 'Active' ? 'Deactivate' : 'Reactivate'}</button>}{can('MEMBER_DELETE') && <button type="button" className="mini-button" onClick={() => setModal({ type: 'archive-member', id: member.id })}>Archive</button>}</div></td></tr>)}</tbody></table>{!filteredMembers.length && <div className="empty-state">No students match your search and filters.</div>}</div>}</section>}

          {page === 'reservations' && <section className="panel"><div className="panel-heading"><div><h3>{studentScope ? 'My reservations' : 'Reservations & holds'}</h3><small>Queue position and pickup allocation are calculated per title group.</small></div><button type="button" className="ghost-button" onClick={() => navigate('catalog')}>Find a book</button></div><div className="catalog-toolbar"><input value={reservationSearch} onChange={(event) => setReservationSearch(event.target.value)} placeholder="Search student, registration, title or RFID" aria-label="Search reservations" /><select value={reservationStatus} onChange={(event) => setReservationStatus(event.target.value)}><option value="">All statuses</option>{['PENDING', 'READY_FOR_PICKUP', 'FULFILLED', 'CANCELLED', 'EXPIRED'].map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select>{!studentScope && <><select value={reservationDepartment} onChange={(event) => setReservationDepartment(event.target.value)}><option value="">All departments</option>{[...new Set(members.map((item) => item.department).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select><select value={reservationYear} onChange={(event) => setReservationYear(event.target.value)}><option value="">All years</option>{[...new Set(members.map((item) => item.year).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select><select value={reservationBook} onChange={(event) => setReservationBook(event.target.value)}><option value="">All books</option>{titleGroups.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></>}</div><div className="table-wrap"><table><thead><tr><th>Title / copy</th><th>Student / register no.</th><th>Request date</th><th>Queue</th><th>Status</th><th>Reserved until</th><th>Actions</th></tr></thead><tbody>{reservationRows.map((reservation) => { const allocatedCopy = books.find((book) => book.id === (reservation.assignedBookId || reservation.bookId)); const member = members.find((item) => item.id === reservation.memberId); return <tr key={reservation.id}><td><button type="button" className="table-link" onClick={() => openBook(books.find((book) => book.id === reservation.bookId))}>{reservation.bookTitle}</button><small className="table-subtitle">{reservation.titleGroupId || 'Title group pending'}{allocatedCopy ? ` · ${allocatedCopy.accessionNumber} · ${allocatedCopy.rfidId}` : ''}</small></td><td>{reservation.memberName}<small className="table-subtitle">{member?.registrationNumber || member?.studentId || ''} · {member?.department || ''} {member?.year || ''}</small></td><td>{(reservation.requestDate || reservation.createdAt)?.slice(0, 10)}</td><td>#{reservation.queuePosition}</td><td><Status value={reservation.status} /></td><td>{reservation.expiresAt || reservation.pickupDeadline || '—'}</td><td><div className="row-actions">{['PENDING', 'READY_FOR_PICKUP'].includes(reservation.status) && (reservation.memberId === currentUser.memberId || can('RESERVATION_MANAGE')) && <button type="button" className="mini-button" onClick={() => runAction(() => actions.cancelReservation(reservation.id), 'Reservation cancelled.')}>Cancel</button>}{can('RESERVATION_MANAGE') && reservation.status === 'PENDING' && <button type="button" className="mini-button" onClick={() => { const approved = runAction(() => actions.approveReservation(reservation.id)); if (approved) notify('Reservation is ready for pickup.'); else if (approved === false) notify('No available copy to allocate; the hold remains queued.', 'error') }}>Approve / assign</button>}{can('RESERVATION_MANAGE') && reservation.status === 'READY_FOR_PICKUP' && <button type="button" className="mini-button" onClick={() => { setCirculationMode('issue'); setCirculationMemberRFID(''); setCirculationMember(null); setCirculationBookRFID(allocatedCopy?.rfidId || ''); setCirculationBook(allocatedCopy || null); navigate('circulation') }}>Scan pickup</button>}</div></td></tr> })}</tbody></table>{reservationRows.length === 0 && <div className="empty-state">No reservations match your search and filters.</div>}</div></section>}

          {page === 'fines' && <section className="panel"><div className="panel-heading"><div><h3>{studentScope ? 'My fines' : 'Fine management'}</h3><small>Overdue charges are linked to their circulation transaction; payments and waivers retain a complete history.</small></div></div><div className="kpi-grid small-grid"><div className="stat-card"><span>Outstanding</span><strong>₹{fines.filter((item) => ['PENDING', 'PARTIALLY_PAID'].includes(item.status) && (!studentScope || item.memberId === currentUser.memberId)).reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount), 0).toLocaleString('en-IN')}</strong></div><div className="stat-card"><span>Collected</span><strong>₹{fines.reduce((sum, item) => sum + Number(item.paidAmount || (item.status === 'PAID' ? item.amount : 0)), 0).toLocaleString('en-IN')}</strong></div><div className="stat-card"><span>Waived</span><strong>₹{fines.filter((item) => item.status === 'WAIVED').reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-IN')}</strong></div><div className="stat-card"><span>Rule</span><strong>₹{settings.finePerDay}/day</strong></div></div><div className="table-wrap"><table><thead><tr><th>Member</th><th>Book / transaction</th><th>Due / returned</th><th>Days late</th><th>Fine / balance</th><th>Status / settlement</th><th>Actions</th></tr></thead><tbody>{fines.filter((fine) => !studentScope || fine.memberId === currentUser.memberId).map((fine) => <tr key={fine.id}><td><button type="button" className="table-link" onClick={() => { const member = members.find((item) => item.id === fine.memberId); if (member && can('MEMBER_VIEW')) openMember(member) }}>{fine.memberName}</button></td><td><button type="button" className="table-link" onClick={() => openBook(books.find((book) => book.id === fine.bookId))}>{fine.bookTitle}</button><small className="table-subtitle">{fine.transactionId || 'Transaction pending'} · {fine.titleGroupId || ''}</small></td><td>{fine.dueDate} / {fine.returnedDate || '—'}</td><td>{fine.daysLate}</td><td>₹{fine.amount}<small className="table-subtitle">Paid ₹{fine.paidAmount || 0} · Remaining ₹{fine.remainingAmount ?? fine.amount}</small></td><td><Status value={fine.status} />{fine.paymentReference && <small className="table-subtitle">{fine.paymentMethod} · {fine.paymentReference}</small>}{fine.reason && <small className="table-subtitle">{fine.reason}</small>}</td><td>{['PENDING', 'PARTIALLY_PAID'].includes(fine.status) && <div className="row-actions">{(studentScope || can('FINE_PAY')) && <button type="button" className="mini-button" onClick={() => { setFinePaymentMethod(studentScope ? 'UPI' : 'Cash'); setForm({ paymentAmount: String(fine.remainingAmount ?? fine.amount) }); setModal({ type: 'pay-fine', id: fine.id }) }}>Pay</button>}{can('FINE_WAIVE') && <button type="button" className="mini-button" onClick={() => { setModal({ type: 'waive-fine', id: fine.id }); setForm({ reason: '' }) }}>Waive</button>}</div>}</td></tr>)}</tbody></table></div></section>}

          {page === 'inventory' && <section className="panel"><div className="panel-heading"><div><h3>Inventory & RFID shelf audit</h3><small>Scan each physical copy to compare the shelf with the expected catalog.</small></div><button type="button" className="primary-button" disabled={Boolean(activeAudit)} onClick={() => { const audit = runAction(() => actions.startInventoryAudit({ location: auditLocation || undefined }), 'Inventory audit started.'); if (audit) setAuditRFID('') }}>Start RFID audit</button></div><div className="kpi-grid small-grid">{[['Total', liveBooks.length], ['Available', availableBooks.length], ['Issued', activeLoans.length], ['Lost', books.filter((item) => item.condition === 'Lost').length], ['Damaged', books.filter((item) => item.condition === 'Damaged').length]].map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="catalog-toolbar"><select value={auditLocation} onChange={(event) => setAuditLocation(event.target.value)} disabled={Boolean(activeAudit)}><option value="">All locations</option>{[...new Set(books.map((book) => book.location).filter(Boolean))].map((location) => <option key={location}>{location}</option>)}</select></div>{activeAudit && <section className="panel audit-workstation"><div className="panel-heading"><div><h3>Audit in progress</h3><small>{activeAudit.location || 'All locations'} · Started {new Date(activeAudit.startedAt).toLocaleString()}</small></div><Status value={`${activeAudit.scannedBookIds?.length || 0} / ${activeAudit.expected} scanned`} /></div><RFIDScanner label="Scan physical book RFID" value={auditRFID} onChange={setAuditRFID} onScan={scanAuditRFID} onSimulate={simulateAuditRFID} placeholder="RFID-BOOK-000091" status="Use manual entry, a keyboard-wedge reader, or simulation; all scans use the RFID lookup service." /><div className="button-row"><button type="button" className="primary-button" onClick={() => { const result = runAction(() => actions.completeInventoryAudit(activeAudit.id), 'Inventory audit completed.'); if (result) setAuditRFID('') }}>Complete audit</button></div></section>}{lastAudit && <AuditResult audit={lastAudit} books={books} onFound={(id) => runAction(() => actions.markBookFound(id), 'Book marked found.')} onLocation={(book) => { setSelectedBook(book); setForm({ ...initialBookForm, ...book }); setModal({ type: 'location', id: book.id }) }} />}<div className="table-wrap"><table><thead><tr><th>Accession</th><th>Title</th><th>RFID</th><th>Location</th><th>Condition</th><th>Action</th></tr></thead><tbody>{liveBooks.filter((book) => ['Lost', 'Damaged'].includes(book.condition)).slice(0, 30).map((book) => <tr key={book.id}><td>{book.accessionNumber}</td><td><button className="table-link" type="button" onClick={() => openBook(book)}>{book.title}</button></td><td>{book.rfidId || '—'}</td><td>{book.location}</td><td><Status value={book.condition} /></td><td><div className="row-actions"><button type="button" className="mini-button" onClick={() => runAction(() => actions.markBookFound(book.id), 'Book marked found.')}>Mark found</button><button type="button" className="mini-button" onClick={() => { setForm({ ...initialBookForm, ...book }); setModal({ type: 'location', id: book.id }) }}>Change location</button></div></td></tr>)}</tbody></table></div></section>}

          {page === 'inventory' && <section className="panel"><div className="panel-heading"><div><h3>Physical copy inventory</h3><small>Copy-level status and holder data are derived from circulation and condition records.</small></div></div><div className="kpi-grid small-grid">{[['Total titles', titleGroups.length], ['Total copies', liveBooks.length], ['Available', liveBooks.filter((item) => item.availabilityStatus === 'Available').length], ['Issued', activeLoans.length], ['Reserved', liveBooks.filter((item) => item.availabilityStatus === 'Reserved').length], ['Damaged', liveBooks.filter((item) => item.condition === 'Damaged').length], ['Lost', liveBooks.filter((item) => item.condition === 'Lost').length], ['Under repair', liveBooks.filter((item) => item.condition === 'Under Repair').length]].map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="catalog-toolbar"><select value={inventoryDepartment} onChange={(event) => setInventoryDepartment(event.target.value)}><option value="">All departments</option>{[...new Set(liveBooks.map((item) => item.department).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select><select value={inventoryCategory} onChange={(event) => setInventoryCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={inventoryStatus} onChange={(event) => setInventoryStatus(event.target.value)}><option value="">All conditions / statuses</option>{['Available', 'Issued', 'Reserved', 'Damaged', 'Lost', 'Under Repair'].map((item) => <option key={item}>{item}</option>)}</select><select value={inventoryLocation} onChange={(event) => setInventoryLocation(event.target.value)}><option value="">All locations</option>{[...new Set(liveBooks.map((item) => item.location).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select></div><div className="table-wrap"><table><thead><tr><th>Copy / RFID</th><th>Title / category</th><th>Department</th><th>Status</th><th>Condition</th><th>Current holder</th><th>Location</th></tr></thead><tbody>{inventoryRows.map((copy) => { const holder = members.find((item) => item.id === copy.currentHolderId); return <tr key={copy.id}><td>{copy.copyId || copy.id}<small className="table-subtitle">{copy.rfidId || 'No RFID assigned'}</small></td><td><button type="button" className="table-link" onClick={() => openBook(copy)}>{copy.title}</button><small className="table-subtitle">{copy.category} · {copy.accessionNumber}</small></td><td>{copy.department || '—'}</td><td><Status value={copy.availabilityStatus} /></td><td><Status value={copy.condition} /></td><td>{holder ? <button type="button" className="table-link" onClick={() => openMember(holder)}>{holder.name}</button> : '—'}</td><td>{copy.location || '—'}</td></tr> })}</tbody></table>{inventoryRows.length === 0 && <div className="empty-state">No physical copies match these filters.</div>}</div></section>}

          {page === 'acquisitions' && <>
            <section className="panel"><div className="panel-heading"><div><h3>Suppliers</h3><small>Maintain vendors centrally and reuse them for purchase orders.</small></div>{can('ACQUISITION_MANAGE') && <button type="button" className="primary-button" onClick={() => { setSupplierForm(initialSupplierForm); setModal({ type: 'supplier' }) }}>+ Add supplier</button>}</div><div className="table-wrap"><table><thead><tr><th>Supplier</th><th>Contact person</th><th>Email / phone</th><th>Address</th><th>Status</th><th>Actions</th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id}><td>{supplier.supplierName}</td><td>{supplier.contactPerson || '—'}</td><td>{supplier.email || '—'}<small className="table-subtitle">{supplier.phone || ''}</small></td><td>{supplier.address || '—'}</td><td><Status value={supplier.status} /></td><td>{can('ACQUISITION_MANAGE') && <div className="row-actions"><button type="button" className="mini-button" onClick={() => { setSupplierForm({ ...initialSupplierForm, ...supplier }); setModal({ type: 'supplier', id: supplier.id }) }}>Edit</button><button type="button" className="mini-button" onClick={() => runAction(() => actions.deleteSupplier(supplier.id), 'Supplier deleted.')}>Delete</button></div>}</td></tr>)}</tbody></table>{suppliers.length === 0 && <div className="empty-state">No suppliers registered yet.</div>}</div></section>
            <section className="panel"><div className="panel-heading"><div><h3>Acquisitions</h3><small>Purchase orders can contain multiple titles; each received physical copy gets an RFID.</small></div>{can('ACQUISITION_MANAGE') && <button type="button" className="primary-button" onClick={() => { setAcquisitionForm(initialAcquisitionForm); setAcquisitionItems([]); setModal('create-acquisition') }}>+ New purchase order</button>}</div><div className="kpi-grid small-grid"><div className="stat-card"><span>Committed</span><strong>₹{(acquisitions.reduce((sum, item) => sum + item.total, 0) / 100000).toFixed(1)}L</strong></div><div className="stat-card"><span>Open orders</span><strong>{acquisitions.filter((item) => !['RECEIVED', 'CANCELLED'].includes(item.status)).length}</strong></div><div className="stat-card"><span>Copies received</span><strong>{acquisitions.reduce((sum, item) => sum + (item.receivedQuantity || 0), 0)}</strong></div><div className="stat-card"><span>Awaiting registration</span><strong>{books.filter((book) => book.availabilityStatus === 'Pending Registration').length}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Purchase order</th><th>Items</th><th>Vendor</th><th>Received / ordered</th><th>Total cost</th><th>Dates</th><th>Status / actions</th></tr></thead><tbody>{acquisitions.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((order) => <tr key={order.id}><td>{order.purchaseOrderNumber || order.id}<small className="table-subtitle">{order.id}</small></td><td>{(order.items || [{ title: order.title, quantity: order.quantity }]).map((item) => <div key={item.itemId || item.title}>{item.title}<small className="table-subtitle">{item.receivedQuantity || 0} / {item.quantity} received</small></div>)}</td><td>{order.vendor}</td><td>{order.receivedQuantity || 0} / {order.quantityOrdered || order.quantity}</td><td>₹{order.totalCost ?? order.total}</td><td>Ordered {order.orderDate?.slice(0, 10) || '—'}<small className="table-subtitle">Expected {order.expectedDelivery || '—'}</small></td><td><Status value={order.status} />{can('ACQUISITION_MANAGE') && !['RECEIVED', 'CANCELLED'].includes(order.status) && <div className="row-actions"><button type="button" className="mini-button" onClick={() => { const lines = order.items || [{ ...order, receivedQuantity: order.receivedQuantity || 0 }]; const index = lines.findIndex((item) => Number(item.receivedQuantity || 0) < Number(item.quantity)); setReceiveItemIndex(Math.max(0, index)); setReceiveQuantity(Math.max(1, lines[Math.max(0, index)]?.quantity - (lines[Math.max(0, index)]?.receivedQuantity || 0))); setModal({ type: 'receive-acquisition', id: order.id }) }}>Receive books</button><button type="button" className="mini-button" onClick={() => runAction(() => actions.cancelAcquisition(order.id), 'Acquisition cancelled.')}>Cancel</button></div>}</td></tr>)}</tbody></table>{acquisitions.length === 0 && <div className="empty-state">No purchase orders yet. Add suppliers and create an acquisition order.</div>}</div></section>
            <section className="panel"><div className="panel-heading"><div><h3>Recently received copies</h3><small>New acquisitions are already registered with unique RFID tags and immediately included in inventory.</small></div></div><div className="table-wrap"><table><thead><tr><th>Accession / copy</th><th>Title / group</th><th>RFID</th><th>Supplier / order</th><th>Received</th><th>Availability</th></tr></thead><tbody>{books.filter((book) => book.acquisitionId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 30).map((copy) => { const order = acquisitions.find((item) => item.id === copy.acquisitionId); return <tr key={copy.id}><td>{copy.accessionNumber}<small className="table-subtitle">{copy.copyId}</small></td><td>{copy.title}<small className="table-subtitle">{copy.titleGroupId}</small></td><td>{copy.rfidId || 'RFID pending'}</td><td>{order?.vendor || '—'}<small className="table-subtitle">{order?.purchaseOrderNumber || copy.acquisitionId}</small></td><td>{copy.acquisitionDate || copy.createdAt.slice(0, 10)}</td><td><Status value={copy.availabilityStatus} /></td></tr> })}</tbody></table>{!books.some((book) => book.acquisitionId) && <div className="empty-state">No acquisition receipts yet. Received titles will appear here.</div>}</div></section>
          </>}

          {page === 'reports' && <section className="panel"><div className="panel-heading"><div><h3>{reportType} report</h3><small>Live report dataset, filtered from the centralized library records.</small></div><div className="inline-actions"><button type="button" className="ghost-button" onClick={() => runAction(() => exportCSV(`library-${reportType.toLowerCase()}-report.csv`, reportDisplayRows), 'Report exported.')}>Export CSV</button><button type="button" className="ghost-button" onClick={() => window.print()}>Print</button></div></div><div className="catalog-toolbar report-filters"><select aria-label="Report type" value={reportType} onChange={(event) => setReportType(event.target.value)}>{['Books', 'Members', 'Circulation', 'Overdue', 'Fines', 'Reservations', 'Inventory', 'Acquisitions'].map((item) => <option key={item}>{item}</option>)}</select><select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={reportDepartment} onChange={(event) => setReportDepartment(event.target.value)}><option value="">All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select><select value={reportStatus} onChange={(event) => setReportStatus(event.target.value)}><option value="">All statuses</option>{['Available', 'Issued', 'Reserved', 'Lost', 'Damaged', 'Under Repair', 'Active', 'Inactive', 'PENDING', 'READY_FOR_PICKUP', 'FULFILLED', 'CANCELLED', 'EXPIRED', 'PAID', 'PARTIALLY_PAID', 'WAIVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED'].map((item) => <option key={item}>{item}</option>)}</select><label className="workspace-field">From date<input type="date" value={reportStart} onChange={(event) => setReportStart(event.target.value)} /></label><label className="workspace-field">To date<input type="date" value={reportEnd} onChange={(event) => setReportEnd(event.target.value)} /></label></div><div className="kpi-grid small-grid">{[['Records', reportDisplayRows.length], ['Active loans', activeLoans.length], ['Overdue loans', overdueLoans.length], ['Outstanding fines', `₹${fines.filter((item) => ['PENDING', 'PARTIALLY_PAID'].includes(item.status)).reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount), 0)}`]].map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="table-wrap"><table><thead><tr>{Object.keys(reportDisplayRows[0] || {}).map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{reportDisplayRows.slice(0, 200).map((row, index) => <tr key={row['Fine ID'] || row['Reservation ID'] || row['Transaction'] || row['Acquisition ID'] || row.Accession || row.Student || index}>{Object.values(row).map((value, cellIndex) => <td key={cellIndex}>{String(value ?? '—')}</td>)}</tr>)}</tbody></table>{reportDisplayRows.length === 0 && <div className="empty-state">No {reportType.toLowerCase()} records match these filters.</div>}</div></section>}

          {page === 'analytics' && <section className="panel"><div className="panel-heading"><div><h3>Library analytics</h3><small>Metrics respond to circulation, collection, fines, and RFID events.</small></div><select aria-label="Analytics date range" value={analyticsRange} onChange={(event) => setAnalyticsRange(Number(event.target.value))}><option value="7">7 days</option><option value="30">30 days</option><option value="90">3 months</option><option value="180">6 months</option><option value="365">1 year</option></select></div><div className="kpi-grid">{[['Catalog collection', liveBooks.length], ['Available collection', availableBooks.length], ['Circulation in range', analyticsTransactions.length], ['Members', members.filter((item) => !item.archived).length], ['RFID scans in range', analyticsRFIDLogs.length], ['Reservations', reservations.filter((item) => ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)).length], ['Fine collection', `₹${fines.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + item.amount, 0)}`], ['Inventory accuracy', `${liveBooks.length ? Math.round((liveBooks.length - books.filter((item) => item.condition === 'Lost').length) / liveBooks.length * 100) : 100}%`]].map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><h3>Circulation by category</h3></div><div className="progress-list">{categories.slice(0, 8).map((category) => { const count = analyticsTransactions.filter((item) => books.find((book) => book.id === item.bookId)?.category === category).length; return <div className="progress-row" key={category}><span>{category}</span><div className="progress-track"><b style={{ width: `${Math.max(2, count / Math.max(analyticsTransactions.length, 1) * 100)}%` }} /></div><strong>{count}</strong></div> })}</div></section><section className="panel chart-panel"><div className="panel-heading"><h3>RFID events</h3></div><div className="activity-list">{['LOOKUP', 'REGISTER', 'ISSUE', 'RETURN', 'AUDIT'].map((kind) => <div key={kind}><span>{kind}</span><strong>{analyticsRFIDLogs.filter((item) => item.event === kind).length}</strong></div>)}</div></section></div></section>}
          {page === 'analytics' && <section className="panel"><div className="panel-heading"><div><h3>Book demand and usage analysis</h3><small>All-time circulation and reservation history, grouped by title group. Usage share = title loans ÷ total loans.</small></div></div><div className="table-wrap"><table><thead><tr><th>Book</th><th>Department</th><th>Total copies</th><th>Total borrowed</th><th>Current demand</th><th>Reservation count</th><th>Average loan days</th><th>Usage share</th></tr></thead><tbody>{titleUsageRows.slice().sort((a, b) => b.totalBorrowed - a.totalBorrowed || a.title.localeCompare(b.title)).map((item) => <tr key={item.id}><td><button type="button" className="table-link" onClick={() => openBook(item.copies[0])}>{item.title}</button></td><td>{item.department || '—'}</td><td>{item.copies.length}</td><td>{item.totalBorrowed}</td><td>{item.currentDemand}</td><td>{item.reservationCount}</td><td>{item.averageLoanDays}</td><td>{item.usageShare}%</td></tr>)}</tbody></table></div><h4>Most borrowed books</h4><div className="compact-record-list">{titleUsageRows.filter((item) => item.totalBorrowed > 0).slice().sort((a, b) => b.totalBorrowed - a.totalBorrowed || a.title.localeCompare(b.title)).slice(0, 5).map((item, index) => <div key={item.id}><span><strong>{index + 1}. {item.title}</strong><small>{item.department || 'Unassigned'} · {item.totalBorrowed} borrowings · {item.usageShare}% of total usage</small></span><Status value={`${item.totalBorrowed} loans`} /></div>)}{titleUsageRows.every((item) => item.totalBorrowed === 0) && <div className="empty-state">No borrowing history yet. Usage rankings will appear as transactions are recorded.</div>}</div></section>}
          {page === 'analytics' && <section className="dashboard-grid"><section className="panel"><div className="panel-heading"><h3>Most borrowed categories</h3></div><div className="compact-record-list">{borrowStats.categoryCounts.slice(0, 6).map((item) => <div key={item.label}><span>{item.label}</span><Status value={`${item.count} loans`} /></div>)}{borrowStats.categoryCounts.length === 0 && <div className="empty-state">Category rankings appear after circulation activity.</div>}</div></section><section className="panel"><div className="panel-heading"><h3>Most borrowed departments</h3></div><div className="compact-record-list">{borrowStats.departmentCounts.slice(0, 6).map((item) => <div key={item.label}><span>{item.label}</span><Status value={`${item.count} loans`} /></div>)}{borrowStats.departmentCounts.length === 0 && <div className="empty-state">Department rankings appear after circulation activity.</div>}</div></section><section className="panel"><div className="panel-heading"><h3>Most active students</h3></div><div className="compact-record-list">{borrowStats.mostBorrowedStudents.slice(0, 6).map((item) => <div key={item.label}><span>{item.label}</span><Status value={`${item.count} loans`} /></div>)}{borrowStats.mostBorrowedStudents.length === 0 && <div className="empty-state">Student activity rankings appear after circulation activity.</div>}</div></section><section className="panel"><div className="panel-heading"><h3>High demand books</h3><small>Informational only · borrowing history with one or fewer available copies</small></div><div className="table-wrap"><table><thead><tr><th>Book</th><th>Borrow count</th><th>Total copies</th><th>Available</th><th>Demand share</th><th>Signal</th></tr></thead><tbody>{highDemandBooks.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.totalBorrowed}</td><td>{item.copies.length}</td><td>{item.available}</td><td>{item.usageShare}%</td><td><Status value="High Demand" /></td></tr>)}</tbody></table>{highDemandBooks.length === 0 && <div className="empty-state">No title currently meets the high-demand criteria.</div>}</div></section></section>}

          {page === 'devices' && <section className="panel"><div className="panel-heading"><div><h3>RFID devices</h3><small>Hardware communication is simulated in this prototype.</small></div><Status value="Simulation mode" /></div><div className="device-grid">{rfidDevices.map((device) => <article className="device-card" key={device.id}><div className="panel-heading"><h3>{device.name}</h3><Status value={device.status} /></div><dl><dt>Device ID</dt><dd>{device.id}</dd><dt>Location</dt><dd>{device.location}</dd><dt>Signal</dt><dd>{device.signal}</dd><dt>Firmware</dt><dd>{device.firmware}</dd><dt>Total scans</dt><dd>{device.totalScans}</dd></dl></article>)}</div></section>}

          {page === 'notifications' && <section className="panel"><div className="panel-heading"><div><h3>Notification center</h3><small>{unreadCount} unread notifications</small></div><button type="button" className="ghost-button" onClick={() => runAction(actions.markAllNotificationsRead, 'All notifications marked as read.')}>Mark all as read</button></div><div className="notification-list">{notifications.map((item) => <article key={item.id} className={`notification-card ${item.read ? 'read' : ''}`}><span className="notification-mark">{item.read ? '✓' : '•'}</span><button type="button" className="notification-open-button" onClick={() => openNotification(item)}><strong>{item.title}</strong><small>{item.message || item.title}</small><small>{item.type || item.category} · {new Date(item.timestamp || item.createdAt).toLocaleString()}</small></button><div className="row-actions">{!item.read && <button type="button" className="mini-button" onClick={() => runAction(() => actions.markNotificationRead(item.id), 'Notification marked as read.')}>Mark read</button>}<button type="button" className="mini-button" onClick={() => openNotification(item)}>View</button></div></article>)}{notifications.length === 0 && <div className="empty-state">No notifications for this account yet. Library actions will appear here.</div>}</div></section>}

          {page === 'audit' && <section className="panel"><div className="panel-heading"><div><h3>Audit log</h3><small>Recent events are recorded from shared workflow mutations.</small></div><button type="button" className="ghost-button" onClick={() => runAction(() => exportCSV('library-audit.csv', auditLogs), 'Audit log exported.')}>Export CSV</button></div><div className="table-wrap"><table><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Description</th></tr></thead><tbody>{auditLogs.map((item) => <tr key={item.id}><td>{new Date(item.timestamp).toLocaleString()}</td><td>{item.user}</td><td>{item.action}</td><td>{item.entity} · {item.entityId}</td><td>{item.description}</td></tr>)}</tbody></table></div></section>}

          {page === 'profile' && <section className="panel profile-panel">
            <div className="panel-heading"><div><h3>Profile & account</h3><small>Role and account privileges cannot be changed here.</small></div><Status value={currentUser.role} /></div>
            <form className="register-form" onSubmit={(event) => { event.preventDefault(); const updated = runAction(() => actions.updateProfile(profileDraft), 'Profile updated.'); if (updated) setProfileDraft({ name: updated.name, email: updated.email, department: updated.department, preferences: updated.preferences }) }}><div className="field-grid two-col"><Field label="Name" required value={profileDraft.name} onChange={(value) => setProfileDraft({ ...profileDraft, name: value })} /><Field label="Email" required type="email" value={profileDraft.email} onChange={(value) => setProfileDraft({ ...profileDraft, email: value })} /><Field label="Department" value={profileDraft.department} onChange={(value) => setProfileDraft({ ...profileDraft, department: value })} /><Field label="Role" value={currentUser.role} onChange={() => {}} readOnly /></div><button type="submit" className="primary-button">Save profile</button></form>
            <form className="preferences-card" onSubmit={(event) => { event.preventDefault(); const updated = runAction(() => actions.updateProfile({ ...profileDraft, preferences: profileDraft.preferences }), 'Preferences saved.'); if (updated) setProfileDraft({ ...profileDraft, preferences: updated.preferences }) }}><h4>Preferences</h4><label className="checkbox-setting"><input type="checkbox" checked={profileDraft.preferences?.emailNotifications ?? true} onChange={(event) => setProfileDraft({ ...profileDraft, preferences: { ...profileDraft.preferences, emailNotifications: event.target.checked } })} /> Receive library email notifications</label><label className="checkbox-setting"><input type="checkbox" checked={profileDraft.preferences?.compactTables ?? false} onChange={(event) => setProfileDraft({ ...profileDraft, preferences: { ...profileDraft, compactTables: event.target.checked } })} /> Use compact table rows</label><button type="submit" className="ghost-button">Save preferences</button></form>
            {studentScope && ownMember && <div className="student-self-profile"><div className="panel-heading"><div><h3>My student profile</h3><small>{ownMember.registerNumber || ownMember.registrationNumber || ownMember.studentId} · {ownMember.rfidCardId}</small></div><Status value={ownMember.status} /></div><div className="lookup-grid"><span>Department</span><strong>{ownMember.department}</strong><span>Year / section</span><strong>{ownMember.year} · {ownMember.section || '—'}</strong><span>Current books</span><strong>{myLoans.length}</strong><span>Total issued</span><strong>{ownMember.booksIssued}</strong><span>Total returned</span><strong>{ownMember.booksReturned}</strong><span>Overdue books</span><strong>{ownMember.overdueBooks}</strong><span>Active fines</span><strong>₹{fines.filter((fine) => fine.memberId === ownMember.id && fine.status === 'PENDING').reduce((sum, fine) => sum + fine.amount, 0)}</strong></div><div className="button-row"><button type="button" className="ghost-button" onClick={() => navigate('my-books')}>View my current books</button><button type="button" className="ghost-button" onClick={() => setModal({ type: 'student-history', id: ownMember.id })}>View my history</button></div></div>}
          </section>}

          {page === 'settings' && <section className="panel settings-panel"><div className="panel-heading"><div><h3>Library settings</h3><small>These rules are used by checkout, fines, reservations, and RFID workflows.</small></div><button type="button" className="ghost-button" onClick={() => setResetRequested(true)}>Reset demo data</button></div><form className="register-form" onSubmit={(event) => { event.preventDefault(); const result = runAction(() => actions.updateSettings(settingsDraft), 'Settings saved. Future circulation uses the updated rules.'); if (result) setSettingsDraft(result) }}><div className="settings-grid"><div className="setting-block"><h4>Library & circulation</h4><div className="field-stack compact"><Field label="Library name" value={settingsDraft.libraryName} onChange={(value) => setSettingsDraft({ ...settingsDraft, libraryName: value })} /><Field label="Branch" value={settingsDraft.branch} onChange={(value) => setSettingsDraft({ ...settingsDraft, branch: value })} /><Field label="Working hours" value={settingsDraft.workingHours || ''} onChange={(value) => setSettingsDraft({ ...settingsDraft, workingHours: value })} /><Field label="Fine per overdue day (₹)" type="number" min="0" value={settingsDraft.finePerDay} onChange={(value) => setSettingsDraft({ ...settingsDraft, finePerDay: Number(value) })} /><Field label="Borrowing limit" type="number" min="1" value={settingsDraft.borrowingLimit} onChange={(value) => setSettingsDraft({ ...settingsDraft, borrowingLimit: Number(value) })} /><Field label="Renewal limit" type="number" min="0" value={settingsDraft.renewalLimit} onChange={(value) => setSettingsDraft({ ...settingsDraft, renewalLimit: Number(value) })} /><Field label="Pickup window (days)" type="number" min="1" value={settingsDraft.pickupWindowDays} onChange={(value) => setSettingsDraft({ ...settingsDraft, pickupWindowDays: Number(value) })} /><Field label="Maximum active reservations" type="number" min="1" value={settingsDraft.maximumActiveReservations} onChange={(value) => setSettingsDraft({ ...settingsDraft, maximumActiveReservations: Number(value) })} />{['Student', 'Faculty', 'Staff'].map((memberType) => <div className="field-grid two-col" key={memberType}><Field label={`${memberType} loan limit`} type="number" min="1" value={settingsDraft.memberTypeRules?.[memberType]?.borrowingLimit ?? settingsDraft.borrowingLimit} onChange={(value) => setSettingsDraft({ ...settingsDraft, memberTypeRules: { ...settingsDraft.memberTypeRules, [memberType]: { ...settingsDraft.memberTypeRules?.[memberType], borrowingLimit: Number(value) } } })} /><Field label={`${memberType} loan days`} type="number" min="1" value={settingsDraft.memberTypeRules?.[memberType]?.loanPeriodDays ?? settingsDraft.loanPeriodDays} onChange={(value) => setSettingsDraft({ ...settingsDraft, memberTypeRules: { ...settingsDraft.memberTypeRules, [memberType]: { ...settingsDraft.memberTypeRules?.[memberType], loanPeriodDays: Number(value) } } })} /></div>)}<label className="checkbox-setting"><input type="checkbox" checked={settingsDraft.blockBorrowingWithUnpaidFines} onChange={(event) => setSettingsDraft({ ...settingsDraft, blockBorrowingWithUnpaidFines: event.target.checked })} /> Block borrowing with unpaid fines</label><label className="checkbox-setting"><input type="checkbox" checked={settingsDraft.allowRenewalWithReservations} onChange={(event) => setSettingsDraft({ ...settingsDraft, allowRenewalWithReservations: event.target.checked })} /> Allow renewal when another member has reserved the title</label></div></div><div className="setting-block"><h4>RFID simulation</h4><div className="field-stack compact"><label className="checkbox-setting"><input type="checkbox" checked={settingsDraft.autoLookup} onChange={(event) => setSettingsDraft({ ...settingsDraft, autoLookup: event.target.checked })} /> Automatically look up valid RFID tags</label><label className="checkbox-setting"><input type="checkbox" checked={settingsDraft.autoFocus} onChange={(event) => setSettingsDraft({ ...settingsDraft, autoFocus: event.target.checked })} /> Keep scanner input focused</label><label className="checkbox-setting"><input type="checkbox" checked={settingsDraft.duplicateScanPrevention} onChange={(event) => setSettingsDraft({ ...settingsDraft, duplicateScanPrevention: event.target.checked })} /> Prevent duplicate scan handling</label><label className="checkbox-setting"><input type="checkbox" checked={settingsDraft.simulationMode} onChange={(event) => setSettingsDraft({ ...settingsDraft, simulationMode: event.target.checked })} /> Simulation mode (no physical reader connected)</label></div></div></div><button type="submit" className="primary-button">Save settings</button></form></section>}
        </div>
      </main>

      {toast && <div className={`toast-message ${toast.kind}`} role="status">{toast.kind === 'error' ? '!' : '✓'} {toast.text}</div>}
      {modal?.type === 'student-history' && <MemberHistory member={members.find((member) => member.id === modal.id)} books={books} transactions={transactions} reservations={reservations} fines={fines} rfidLogs={rfidLogs} onOpenBook={(book) => { setModal(null); openBook(book) }} onClose={() => setModal(null)} />}
      {detailBook && <Modal title="Book details" wide onClose={() => { setSelectedBook(null); setDetailId(null); navigate('catalog') }}><BookDetails book={books.find((item) => item.id === detailBook.id) || detailBook} books={books} transactions={transactions} members={members} reservations={reservations} can={can} memberId={currentUser.memberId} onEdit={() => editBook(detailBook)} onOpenCopy={openBook} onOpenMember={openMember} onIssue={() => { setSelectedBook(null); setDetailId(null); setCirculationMode('issue'); setCirculationMemberRFID(''); setCirculationMember(null); setCirculationBookRFID(detailBook.rfidId || ''); setCirculationBook(detailBook); navigate('circulation') }} onReserve={() => reserveBook(detailBook)} onCancelReservation={(reservationId) => runAction(() => actions.cancelReservation(reservationId), 'Reservation cancelled.')} onReturn={() => { setSelectedBook(null); setDetailId(null); setCirculationMode('return'); setCirculationMemberRFID(''); setCirculationMember(null); setCirculationBookRFID(detailBook.rfidId || ''); setCirculationBook(detailBook); navigate('circulation') }} onRenew={() => runAction(() => actions.renewBook({ bookId: detailBook.id, memberId: currentUser.memberId }), 'Loan renewed.')} onArchive={() => setModal({ type: 'archive-book', id: detailBook.id })} onLost={() => runAction(() => actions.markBookLost(detailBook.id), 'Book marked lost.')} onDamaged={() => runAction(() => actions.markBookDamaged(detailBook.id), 'Book marked damaged.')} /></Modal>}
      {modal === 'confirm-issue' && issueValidation?.eligible && <Modal title="Confirm book issue" onClose={() => setModal(null)}><div className="lookup-grid"><span>Student</span><strong>{circulationMember.name} · {circulationMember.studentId}</strong><span>Member RFID</span><strong>{circulationMember.rfidCardId}</strong><span>Book</span><strong>{circulationBook.title}</strong><span>Title group</span><strong>{circulationBook.titleGroupId}</strong><span>Copy / accession</span><strong>{circulationBook.copyNumber} · {circulationBook.accessionNumber}</strong><span>Book RFID</span><strong>{circulationBook.rfidId}</strong><span>Issue / due date</span><strong>{new Date().toISOString().slice(0, 10)} → {issueValidation.dueDate}</strong><span>Duration</span><strong>{issueValidation.loanDays} days</strong></div><div className="button-row"><button type="button" className="primary-button" onClick={() => { const result = runAction(() => actions.issueBook({ bookId: circulationBook.id, memberId: circulationMember.id, memberRFID: circulationMemberRFID, bookRFID: circulationBookRFID }), 'Book issued successfully.'); if (result) { setModal(null); setCirculationMode('issue'); setCirculationBookRFID(''); setCirculationBook(null) } }}>Confirm issue</button><button type="button" className="ghost-button" onClick={() => setModal(null)}>Cancel</button></div></Modal>}
      {modal === 'confirm-return' && activeScannedLoan && <Modal title="Confirm book return" onClose={() => setModal(null)}><div className="lookup-grid"><span>Student</span><strong>{circulationMember.name} · {circulationMember.studentId}</strong><span>Book</span><strong>{circulationBook.title}</strong><span>Copy / RFID</span><strong>{circulationBook.accessionNumber} · {circulationBook.rfidId}</strong><span>Issued</span><strong>{activeScannedLoan.issueDate}</strong><span>Due</span><strong>{activeScannedLoan.dueDate}</strong><span>Returned</span><strong>{new Date().toISOString().slice(0, 10)}</strong><span>Overdue days</span><strong>{returnOverdueDays}</strong><span>Fine at ₹{settings.finePerDay}/day</span><strong>₹{returnOverdueDays * settings.finePerDay}</strong></div><label className="workspace-field">Returned condition<select value={form.returnCondition || 'Good'} onChange={(event) => setForm({ ...form, returnCondition: event.target.value })}>{['Good', 'Fair', 'Damaged', 'Lost', 'Under Repair'].map((condition) => <option key={condition}>{condition}</option>)}</select></label><div className="button-row"><button type="button" className="primary-button" onClick={() => { const result = runAction(() => actions.returnBook({ bookId: circulationBook.id, memberId: circulationMember.id, memberRFID: circulationMemberRFID, bookRFID: circulationBookRFID, condition: form.returnCondition || 'Good' }), 'Book returned successfully.'); if (result) { setModal(null); setCirculationMemberRFID(''); setCirculationBookRFID(''); setCirculationMember(null); setCirculationBook(null); setForm((current) => ({ ...current, returnCondition: 'Good' })) } }}>Confirm return</button><button type="button" className="ghost-button" onClick={() => setModal(null)}>Cancel</button></div></Modal>}
      {modal === 'create-book' && <Modal title="Register new book" wide onClose={() => setModal(null)}><BookForm form={form} setForm={setForm} categories={categories} departments={departments} onSubmit={submitBook} onCancel={() => setModal(null)} onSimulate={() => simulateBookRFID(true)} onCheckRFID={(uid) => checkRegistrationRFID(uid)} submitLabel="Save book" /></Modal>}
      {modal === 'edit-book' && <Modal title={form.availabilityStatus === 'Pending Registration' ? 'Register received copy' : 'Edit book record'} wide onClose={() => setModal(null)}><BookForm form={form} setForm={setForm} categories={categories} departments={departments} onSubmit={submitEditBook} onCancel={() => setModal(null)} onSimulate={() => simulateBookRFID(true)} onCheckRFID={(uid) => checkRegistrationRFID(uid, detailBook?.id)} submitLabel={form.availabilityStatus === 'Pending Registration' ? 'Register copy' : 'Save changes'} /></Modal>}
      {modal === 'create-member' && <Modal title="Add library member" onClose={() => setModal(null)}><MemberForm form={memberForm} setForm={setMemberForm} onSubmit={submitMember} onCancel={() => setModal(null)} onGenerateRFID={() => setMemberForm((current) => ({ ...current, rfidCardId: actions.createMemberCard() }))} onCheckRFID={(uid) => { const existing = members.find((member) => member.rfidCardId === uid); notify(existing ? `Member RFID is assigned to ${existing.name}.` : /^RFID-MEMBER-\d{6}$/.test(uid) ? 'Member RFID available.' : 'Enter a valid RFID-MEMBER-000001 UID.', existing ? 'error' : /^RFID-MEMBER-\d{6}$/.test(uid) ? 'success' : 'error') }} /></Modal>}
      {modal === 'edit-member' && <Modal title="Edit member" onClose={() => setModal(null)}><MemberForm form={memberForm} setForm={setMemberForm} onSubmit={submitEditMember} onCancel={() => setModal(null)} onGenerateRFID={() => setMemberForm((current) => ({ ...current, rfidCardId: actions.createMemberCard() }))} onCheckRFID={(uid) => { const existing = members.find((member) => member.rfidCardId === uid && member.id !== selectedMember?.id); notify(existing ? `Member RFID is assigned to ${existing.name}.` : /^RFID-MEMBER-\d{6}$/.test(uid) ? 'Member RFID available.' : 'Enter a valid RFID-MEMBER-000001 UID.', existing ? 'error' : /^RFID-MEMBER-\d{6}$/.test(uid) ? 'success' : 'error') }} /></Modal>}
      {modal === 'create-acquisition' && <Modal title="Create purchase order" onClose={() => setModal(null)}><form className="register-form" onSubmit={submitAcquisition}><div className="field-grid"><Field label="Supplier" required value={acquisitionForm.vendor} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, vendor: value })} list="library-suppliers" /><datalist id="library-suppliers">{suppliers.filter((supplier) => supplier.status === 'Active').map((supplier) => <option key={supplier.id} value={supplier.supplierName} />)}</datalist><Field label="First title" required value={acquisitionForm.title} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, title: value })} /><Field label="Author" value={acquisitionForm.author} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, author: value })} /><Field label="ISBN" value={acquisitionForm.isbn} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, isbn: value })} /><label className="workspace-field">Category<select value={acquisitionForm.category} onChange={(event) => setAcquisitionForm({ ...acquisitionForm, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><Field label="Subcategory" value={acquisitionForm.subcategory} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, subcategory: value })} /><Field label="Quantity ordered" type="number" min="1" required value={acquisitionForm.quantity} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, quantity: Number(value) })} /><Field label="Unit cost (₹)" type="number" min="0" required value={acquisitionForm.unitPrice} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, unitPrice: Number(value) })} /><Field label="Order date" type="date" value={acquisitionForm.orderDate} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, orderDate: value })} /><Field label="Expected delivery" type="date" value={acquisitionForm.expectedDelivery} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, expectedDelivery: value })} /><Field label="Department" value={acquisitionForm.department} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, department: value })} /><Field label="Notes" value={acquisitionForm.notes} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, notes: value })} /></div><h4>Additional titles</h4>{acquisitionItems.map((item, index) => <AcquisitionItemForm key={index} item={item} categories={categories} onChange={(changes) => setAcquisitionItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...changes } : line))} onRemove={() => setAcquisitionItems((current) => current.filter((_, lineIndex) => lineIndex !== index))} />)}<button type="button" className="ghost-button" onClick={() => setAcquisitionItems((current) => [...current, { ...initialAcquisitionItem }])}>+ Add title</button><p className="chart-footnote">Order total: ₹{Number(acquisitionForm.quantity || 0) * Number(acquisitionForm.unitPrice || 0) + acquisitionItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0)}</p><div className="button-row"><button className="primary-button" type="submit">Create purchase order</button><button className="ghost-button" type="button" onClick={() => setModal(null)}>Cancel</button></div></form></Modal>}
      {modal?.type === 'receive-acquisition' && <Modal title="Receive purchase order copies" onClose={() => setModal(null)}><form className="register-form" onSubmit={(event) => { event.preventDefault(); const received = runAction(() => actions.receiveAcquisition(modal.id, receiveQuantity, receiveItemIndex), 'Received physical copies with unique RFID tags.'); if (received) setModal(null) }}><label className="workspace-field">Title<select value={receiveItemIndex} onChange={(event) => { const index = Number(event.target.value); setReceiveItemIndex(index); const order = acquisitions.find((item) => item.id === modal.id); const line = order?.items?.[index]; setReceiveQuantity(Math.max(1, Number(line?.quantity || 1) - Number(line?.receivedQuantity || 0))) }}>{(acquisitions.find((item) => item.id === modal.id)?.items || []).map((item, index) => <option key={item.itemId || index} value={index}>{item.title} ({item.receivedQuantity || 0}/{item.quantity})</option>)}</select></label><p>Remaining for this title: {Math.max(0, Number(acquisitions.find((item) => item.id === modal.id)?.items?.[receiveItemIndex]?.quantity || 0) - Number(acquisitions.find((item) => item.id === modal.id)?.items?.[receiveItemIndex]?.receivedQuantity || 0))}</p><Field label="Quantity received now" type="number" min="1" max={Math.max(1, Number(acquisitions.find((item) => item.id === modal.id)?.items?.[receiveItemIndex]?.quantity || 1) - Number(acquisitions.find((item) => item.id === modal.id)?.items?.[receiveItemIndex]?.receivedQuantity || 0))} required value={receiveQuantity} onChange={(value) => setReceiveQuantity(Number(value))} /><div className="button-row"><button type="submit" className="primary-button">Receive copies</button><button type="button" className="ghost-button" onClick={() => setModal(null)}>Cancel</button></div></form></Modal>}
      {modal?.type === 'waive-fine' && <Modal title="Waive fine" onClose={() => setModal(null)}><form className="register-form" onSubmit={(event) => { event.preventDefault(); const result = runAction(() => actions.waiveFine(modal.id, form.reason), 'Fine waived and recorded.'); if (result !== null) setModal(null) }}><Field label="Reason for waiver" required value={form.reason || ''} onChange={(value) => setForm({ reason: value })} /><div className="button-row"><button className="primary-button" type="submit">Confirm waiver</button><button className="ghost-button" type="button" onClick={() => setModal(null)}>Cancel</button></div></form></Modal>}
      {modal?.type === 'pay-fine' && <Modal title="Pay fine" onClose={() => setModal(null)}><form className="register-form" onSubmit={(event) => { event.preventDefault(); const amount = Number(form.paymentAmount); const result = runAction(() => studentScope ? actions.payOwnFine(modal.id, finePaymentMethod, amount) : actions.payFine(modal.id, finePaymentMethod, amount), 'Fine payment recorded.'); if (result !== null) setModal(null) }}><p>Outstanding balance: ₹{fines.find((fine) => fine.id === modal.id)?.remainingAmount ?? fines.find((fine) => fine.id === modal.id)?.amount ?? 0}. Payments may be partial; a reference is recorded for each payment.</p><Field label="Payment amount (₹)" type="number" min="0.01" max={fines.find((fine) => fine.id === modal.id)?.remainingAmount ?? fines.find((fine) => fine.id === modal.id)?.amount ?? 0} required value={form.paymentAmount ?? ''} onChange={(value) => setForm({ ...form, paymentAmount: value })} /><label className="field"><span>Payment method</span><select value={finePaymentMethod} onChange={(event) => setFinePaymentMethod(event.target.value)}><option>UPI</option><option>Card</option><option>Cash</option></select></label><div className="button-row"><button className="primary-button" type="submit">Record payment</button><button className="ghost-button" type="button" onClick={() => setModal(null)}>Cancel</button></div></form></Modal>}
      {modal?.type === 'archive-book' && <ConfirmModal title="Archive book?" body="This book will be hidden from the active catalog. Circulation history is retained." onCancel={() => setModal(null)} onConfirm={() => { const result = runAction(() => actions.archiveBook(modal.id), 'Book archived.'); if (result) { setSelectedBook(null); setModal(null) } }} />}
      {modal?.type === 'archive-member' && <ConfirmModal title="Archive member?" body="This member will be hidden from active member lists. Member and circulation history are retained. Members with active loans cannot be archived." onCancel={() => setModal(null)} onConfirm={() => { const result = runAction(() => actions.archiveMember(modal.id), 'Member archived.'); if (result) { setSelectedMember(null); setModal(null) } }} />}
      {modal?.type === 'location' && <Modal title="Change shelf location" onClose={() => setModal(null)}><form className="register-form" onSubmit={(event) => { event.preventDefault(); const result = runAction(() => actions.changeBookLocation(modal.id, form.location || `${form.branch} / ${form.floor} / ${form.section} / ${form.rack} / ${form.shelf}`), 'Book location updated.'); if (result) setModal(null) }}><Field label="Location" required value={form.location || ''} onChange={(value) => setForm({ ...form, location: value })} /><div className="button-row"><button type="submit" className="primary-button">Save location</button><button type="button" className="ghost-button" onClick={() => setModal(null)}>Cancel</button></div></form></Modal>}
      {modal?.type === 'supplier' && <Modal title={modal.id ? 'Edit supplier' : 'Add supplier'} onClose={() => setModal(null)}><form className="register-form" onSubmit={submitSupplier}><div className="field-grid"><Field label="Supplier name" required value={supplierForm.supplierName} onChange={(value) => setSupplierForm({ ...supplierForm, supplierName: value })} /><Field label="Contact person" value={supplierForm.contactPerson} onChange={(value) => setSupplierForm({ ...supplierForm, contactPerson: value })} /><Field label="Email" type="email" value={supplierForm.email} onChange={(value) => setSupplierForm({ ...supplierForm, email: value })} /><Field label="Phone" value={supplierForm.phone} onChange={(value) => setSupplierForm({ ...supplierForm, phone: value })} /><Field label="Address" value={supplierForm.address} onChange={(value) => setSupplierForm({ ...supplierForm, address: value })} /><label className="workspace-field">Status<select value={supplierForm.status} onChange={(event) => setSupplierForm({ ...supplierForm, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label></div><div className="button-row"><button className="primary-button" type="submit">{modal.id ? 'Save supplier' : 'Add supplier'}</button><button className="ghost-button" type="button" onClick={() => setModal(null)}>Cancel</button></div></form></Modal>}
      {resetRequested && <ConfirmModal title="Reset demo data?" body="This restores the original mock dataset and removes saved demo changes from this browser." onCancel={() => setResetRequested(false)} onConfirm={() => { const result = runAction(actions.resetDemoData, 'Demo data reset.'); if (result) { setResetRequested(false); setSelectedBook(null); setSelectedMember(null); navigate('dashboard') } }} />}
    </div>
  )

  function reserveBook(book) {
    if (!currentUser.memberId) {
      notify('This demo account is not linked to a member record.', 'error')
      return
    }
    runAction(() => actions.createReservation({ bookId: book.id, memberId: currentUser.memberId }), 'Reservation created.')
  }

}

function BookForm({ form, setForm, categories, departments, onSubmit, onCancel, onSimulate, onCheckRFID, submitLabel }) {
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return (
    <form className="register-form" onSubmit={onSubmit}>
      <div className="field-grid two-col">
        <Field label="Title" required value={form.title} onChange={(value) => set('title', value)} />
        <Field label="Author" required value={form.author} onChange={(value) => set('author', value)} />
        <Field label="ISBN" value={form.isbn} onChange={(value) => set('isbn', value)} />
        <Field label="Publisher" value={form.publisher} onChange={(value) => set('publisher', value)} />
        <Field label="Edition" type="number" min="1" value={form.edition} onChange={(value) => set('edition', value)} />
        <Field label="Publication year" type="number" value={form.publicationYear} onChange={(value) => set('publicationYear', value)} />
        <Field label="Physical copy quantity" type="number" min="1" required disabled={Boolean(form.id)} value={form.quantity ?? 1} onChange={(value) => set('quantity', value)} />
        <label className="workspace-field">Category<select required value={form.category} onChange={(event) => set('category', event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <Field label="Subcategory" value={form.subCategory} onChange={(value) => set('subCategory', value)} />
        <label className="workspace-field">Department<select value={form.department} onChange={(event) => set('department', event.target.value)}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>
        <Field label="Language" value={form.language} onChange={(value) => set('language', value)} />
        <Field label="Pages" type="number" min="0" value={form.pages} onChange={(value) => set('pages', value)} />
        <Field label="Price (₹)" type="number" min="0" value={form.price} onChange={(value) => set('price', value)} />
        <Field label="Branch" value={form.branch} onChange={(value) => set('branch', value)} />
        <Field label="Floor" value={form.floor} onChange={(value) => set('floor', value)} />
        <Field label="Section" value={form.section} onChange={(value) => set('section', value)} />
        <Field label="Rack" value={form.rack} onChange={(value) => set('rack', value)} />
        <Field label="Shelf" value={form.shelf} onChange={(value) => set('shelf', value)} />
        {form.id && <label className="workspace-field">Physical condition<select value={form.condition || 'Good'} onChange={(event) => set('condition', event.target.value)}>{['Good', 'Fair', 'Damaged', 'Lost', 'Under Repair'].map((condition) => <option key={condition}>{condition}</option>)}</select></label>}
        <label className="workspace-field">Condition<select value={form.condition} onChange={(event) => set('condition', event.target.value)}>{['New', 'Good', 'Fair', 'Damaged'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="workspace-field full-width">Description<textarea rows="3" value={form.description} onChange={(event) => set('description', event.target.value)} /></label>
      </div>
      <div className="rfid-registration-card"><h4>RFID tag assignment</h4><RFIDScanner label="Book-copy RFID UID" value={form.rfidId || ''} onChange={(value) => set('rfidId', value)} onScan={(uid) => onCheckRFID?.(uid)} onSimulate={onSimulate} simulateLabel="Generate unique RFID" placeholder="RFID-BOOK-000091" status={form.rfidId ? `Copy RFID: ${form.rfidId}` : 'This is a physical-copy tag. A unique accession is assigned when saved.'} /><small>Enter a UID manually, scan it with a keyboard-wedge reader, or generate a unique simulation UID.</small></div>
      <div className="button-row"><button type="submit" className="primary-button">{submitLabel}</button><button type="button" className="ghost-button" onClick={onCancel}>Cancel</button></div>
    </form>
  )
}

function AcquisitionItemForm({ item, categories, onChange, onRemove }) {
  return <div className="panel acquisition-item-form"><div className="panel-heading"><strong>Additional title</strong><button type="button" className="ghost-button" onClick={onRemove}>Remove</button></div><div className="field-grid"><Field label="Title" required value={item.title} onChange={(value) => onChange({ title: value })} /><Field label="Author" value={item.author} onChange={(value) => onChange({ author: value })} /><Field label="ISBN" value={item.isbn} onChange={(value) => onChange({ isbn: value })} /><label className="workspace-field">Category<select value={item.category} onChange={(event) => onChange({ category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><Field label="Edition" value={item.edition} onChange={(value) => onChange({ edition: value })} /><Field label="Quantity" type="number" min="1" required value={item.quantity} onChange={(value) => onChange({ quantity: Number(value) })} /><Field label="Unit cost (₹)" type="number" min="0" required value={item.unitCost} onChange={(value) => onChange({ unitCost: Number(value) })} /><Field label="Department" value={item.department} onChange={(value) => onChange({ department: value })} /></div></div>
}

function MemberForm({ form, setForm, onSubmit, onCancel, onGenerateRFID, onCheckRFID }) {
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <form className="register-form" onSubmit={onSubmit}><div className="field-grid"><Field label="Full name" required value={form.name} onChange={(value) => set('name', value)} /><Field label="Registration number" required value={form.studentId || form.registrationNumber} onChange={(value) => { set('studentId', value); set('registrationNumber', value) }} /><Field label="Library ID" value={form.libraryId} onChange={(value) => set('libraryId', value)} /><Field label="Email" type="email" value={form.email} onChange={(value) => set('email', value)} /><Field label="Phone" value={form.phone} onChange={(value) => set('phone', value)} /><Field label="Department / branch" value={form.department} onChange={(value) => set('department', value)} /><Field label="Course / program" value={form.program} onChange={(value) => set('program', value)} /><Field label="Year" value={form.year} onChange={(value) => set('year', value)} /><Field label="Section" value={form.section} onChange={(value) => set('section', value)} /><Field label="Address" value={form.address || ''} onChange={(value) => set('address', value)} /><Field label="Membership expiry" type="date" value={form.membershipExpiry || ''} onChange={(value) => set('membershipExpiry', value)} /><Field label="Profile photo URL" value={form.profileImage || ''} onChange={(value) => set('profileImage', value)} /><label className="workspace-field">Member type<select value={form.memberType} onChange={(event) => set('memberType', event.target.value)}><option>Student</option><option>Faculty</option><option>Staff</option></select></label><label className="workspace-field">Status<select value={form.status} onChange={(event) => set('status', event.target.value)}><option>Active</option><option>Blocked</option><option>Inactive</option></select></label></div><RFIDScanner label="Student/member RFID card" value={form.rfidCardId || ''} onChange={(value) => set('rfidCardId', value)} onScan={(uid) => onCheckRFID?.(uid)} onSimulate={onGenerateRFID} simulateLabel="Generate member RFID" placeholder="95 92 4F 06" status={form.rfidCardId ? `Member card: ${form.rfidCardId}` : 'A unique card UID will be generated if left blank.'} /><div className="button-row"><button type="submit" className="primary-button">Save member</button><button type="button" className="ghost-button" onClick={onCancel}>Cancel</button></div></form>
}

function BookSummary({ book, onOpen, transactions = [], members = [] }) {
  if (book.type === 'member') {
    const member = book.record
    const history = transactions.filter((item) => item.memberId === member.id).slice(0, 4)
    return <div className="book-summary"><span className="eyebrow">RFID recognized · Student found</span><h3>{member.name}</h3><p>{member.memberType} · {member.status}</p><div className="lookup-grid"><span>Register number</span><strong>{member.registrationNumber || member.studentId}</strong><span>Member ID</span><strong>{member.id}</strong><span>Department / year</span><strong>{member.department} · {member.year}</strong><span>Member RFID</span><strong>{member.rfidCardId}</strong><span>Current books</span><strong>{transactions.filter((item) => item.memberId === member.id && item.status === 'Issued').length}</strong></div><h4>Recent circulation history</h4><div className="compact-record-list">{history.length ? history.map((item) => <div key={item.id}><span><strong>{item.bookTitle}</strong><small>{item.issueDate} · {item.status}</small></span><Status value={item.status} /></div>) : <div className="empty-state">No circulation history yet.</div>}</div><button type="button" className="primary-button" onClick={onOpen}>Open student profile</button></div>
  }
  const bookRecord = book.record || book
  const loan = transactions.find((item) => item.bookId === bookRecord.id && item.status === 'Issued')
  const holder = members.find((item) => item.id === loan?.memberId)
  const history = transactions.filter((item) => item.bookId === bookRecord.id).slice(0, 4)
  return <div className="book-summary"><span className="eyebrow">RFID recognized · Book found</span><h3>{bookRecord.title}</h3><p>{bookRecord.author}</p><div className="lookup-grid"><span>RFID</span><strong>{bookRecord.rfidId}</strong><span>Copy ID</span><strong>{bookRecord.copyId || bookRecord.id}</strong><span>Category / department</span><strong>{bookRecord.category} · {bookRecord.department}</strong><span>Location</span><strong>{bookRecord.location || 'Uncatalogued'}</strong><span>Status</span><strong><Status value={bookRecord.availabilityStatus} /></strong><span>Current holder</span><strong>{holder ? `${holder.name} · ${holder.registrationNumber || holder.studentId}` : 'Available'}</strong></div><h4>Recent circulation history</h4><div className="compact-record-list">{history.length ? history.map((item) => <div key={item.id}><span><strong>{item.bookTitle}</strong><small>{item.issueDate} · {item.returnedDate || 'Not returned'}</small></span><Status value={item.status} /></div>) : <div className="empty-state">No circulation history yet.</div>}</div><button type="button" className="primary-button" onClick={onOpen}>Open book details</button></div>
}

function BookDetails({ book, books, transactions, members, reservations, can, memberId, onEdit, onIssue, onReserve, onCancelReservation, onReturn, onRenew, onArchive, onLost, onDamaged, onOpenMember, onOpenCopy }) {
  const groupBooks = books.filter((copy) => copy.titleGroupId === book.titleGroupId && !copy.archived)
  const loan = transactions.find((item) => item.bookId === book.id && item.status === 'Issued')
  const borrower = members.find((member) => member.id === loan?.memberId)
  const groupHistory = transactions.filter((item) => item.titleGroupId === book.titleGroupId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const counts = (status) => groupBooks.filter((copy) => copy.availabilityStatus === status).length
  const issuedCount = transactions.filter((item) => item.titleGroupId === book.titleGroupId && item.status === 'Issued').length
  const activeHold = reservations.find((item) => item.memberId === memberId && (item.titleGroupId || item.bookId) === (book.titleGroupId || book.id) && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status))
  const titleUnavailable = !groupBooks.some((copy) => copy.availabilityStatus === 'Available')

  return <div className="book-detail-layout">
    <div className="book-cover-large">{book.title?.slice(0, 1)}</div>
    <div className="book-detail-content">
      <div className="book-detail-top"><div><h2>{book.title}</h2><p>{book.author} · {book.publisher || 'Publisher not recorded'}</p></div><Status value={book.availabilityStatus} /></div>
      <div className="lookup-grid">
        <span>Title group</span><strong>{book.titleGroupId || book.id}</strong>
        <span>Category / department</span><strong>{book.category} · {book.department}</strong>
        <span>Publication / edition</span><strong>{book.publicationYear || '—'} · {book.edition || '—'}</strong>
        <span>ISBN / language</span><strong>{book.isbn || '—'} · {book.language || '—'}</strong>
        <span>Publisher</span><strong>{book.publisher || '—'}</strong>
        <span>Physical copy / accession</span><strong>{book.copyNumber || '—'} · {book.accessionNumber}</strong>
        <span>RFID tag</span><strong>{book.rfidId || 'Not assigned'}</strong>
        <span>Location</span><strong>{book.location || 'Uncatalogued'}</strong>
        <span>Condition</span><strong>{book.condition}</strong>
        <span>Current holder</span><strong>{borrower ? <button type="button" className="table-link" onClick={() => onOpenMember(borrower)}>{borrower.name} · {borrower.registrationNumber || borrower.studentId}</button> : 'Available'}</strong>
        <span>Due date</span><strong>{loan?.dueDate || '—'}</strong>
      </div>
      <p className="book-description">{book.description || 'No description recorded.'}</p>
      <div className="kpi-grid small-grid">{[['Total copies', groupBooks.length], ['Available', counts('Available')], ['Issued', issuedCount], ['Reserved', counts('Reserved')], ['Lost', counts('Lost')], ['Damaged', counts('Damaged')]].map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <h4>Physical copies</h4>
      <div className="table-wrap"><table><thead><tr><th>Accession</th><th>RFID UID</th><th>Status</th><th>Location</th><th>Currently held by / reserved for</th><th>Issue date</th><th>Due date</th><th>Condition</th></tr></thead><tbody>{groupBooks.map((copy) => {
        const active = transactions.find((item) => item.bookId === copy.id && item.status === 'Issued')
        const holder = members.find((member) => member.id === active?.memberId)
        const hold = reservations.find((item) => item.status === 'READY_FOR_PICKUP' && (item.assignedBookId || item.bookId) === copy.id)
        return <tr key={copy.id}><td><button type="button" className="table-link" onClick={() => onOpenCopy(copy)}>{copy.accessionNumber}</button></td><td>{copy.rfidId || '—'}</td><td><Status value={copy.availabilityStatus} /></td><td>{copy.location || '—'}</td><td>{holder ? <button type="button" className="table-link" onClick={() => onOpenMember(holder)}>{holder.name} · {holder.registrationNumber || holder.studentId}</button> : hold ? hold.memberName : 'Available'}</td><td>{active?.issueDate || '—'}</td><td>{active?.dueDate || hold?.pickupDeadline || '—'}</td><td>{copy.condition}</td></tr>
      })}</tbody></table></div>
      <h4>Circulation history</h4>
      <div className="compact-record-list">{groupHistory.length ? groupHistory.map((item) => {
        const pastHolder = members.find((member) => member.id === item.memberId)
        const copy = books.find((record) => record.id === item.bookId)
        return <div key={item.id}><span><strong>{item.bookTitle} · {copy?.accessionNumber || item.bookId}</strong><small>{pastHolder?.name || item.memberName} · {item.issueDate} → {item.returnedDate || 'currently issued'} · {copy?.rfidId || item.rfidId} · Fine ₹{item.fine || 0}</small></span><Status value={item.status} /></div>
      }) : <div className="empty-state">No circulation history for this title.</div>}</div>
      <div className="button-row">
        {can('BOOK_EDIT') && <button type="button" className="primary-button" onClick={onEdit}>Edit copy</button>}
        {can('ISSUE_BOOK') && book.availabilityStatus === 'Available' && <button type="button" className="ghost-button" onClick={onIssue}>Issue</button>}
        {can('RETURN_BOOK') && loan && <button type="button" className="ghost-button" onClick={onReturn}>Return</button>}
        {can('RENEW_BOOK') && loan && <button type="button" className="ghost-button" onClick={onRenew}>Renew</button>}
        {can('RESERVATION_CREATE') && titleUnavailable && !activeHold && <button type="button" className="ghost-button" onClick={onReserve}>Reserve book</button>}
        {activeHold?.status === 'PENDING' && <><Status value="Reservation pending" /><button type="button" className="ghost-button" onClick={() => onCancelReservation(activeHold.id)}>Cancel my reservation</button></>}
        {activeHold?.status === 'READY_FOR_PICKUP' && <Status value={`Ready for pickup until ${activeHold.expiresAt || activeHold.pickupDeadline}`} />}
        {can('INVENTORY_VIEW') && <button type="button" className="ghost-button" onClick={onDamaged}>Mark damaged</button>}
        {can('INVENTORY_VIEW') && <button type="button" className="ghost-button" onClick={onLost}>Mark lost</button>}
        {can('BOOK_DELETE') && <button type="button" className="ghost-button" onClick={onArchive}>Archive</button>}
      </div>
    </div>
  </div>
}

function MemberDetails({ member, books, transactions, reservations, fines, onBack, onEdit, canEdit, onOpenBook }) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const history = transactions.filter((item) => item.memberId === member.id)
  const returned = history.filter((item) => item.status === 'Returned')
  const onTime = returned.filter((item) => (item.returnedDate || item.returnedAt?.slice(0, 10) || '') <= item.dueDate)
  const active = history.filter((item) => item.status === 'Issued')
  const overdue = active.filter((item) => item.dueDate < new Date().toISOString().slice(0, 10))
  const outstanding = fines.filter((item) => item.memberId === member.id && ['PENDING', 'PARTIALLY_PAID'].includes(item.status)).reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount), 0)
  return <div className="member-details">
    <div className="panel-heading"><div><h3>{member.name}</h3><small>{member.registrationNumber || member.studentId} · {member.memberId || member.id} · {member.email || 'No email recorded'}</small></div><div className="row-actions"><Status value={member.status} />{canEdit && <button type="button" className="ghost-button" onClick={() => onEdit(member)}>Edit member</button>}<button type="button" className="ghost-button" onClick={onBack}>Back</button></div></div>
    <div className="lookup-grid"><span>Department / program</span><strong>{member.department} · {member.program || '—'}</strong><span>Year / section</span><strong>{member.year || '—'} · {member.section || '—'}</strong><span>Member type</span><strong>{member.memberType}</strong><span>Phone</span><strong>{member.phone || '—'}</strong><span>Member RFID</span><strong>{member.rfidCardId || 'Not assigned'}</strong><span>Membership expiry</span><strong>{member.membershipExpiry || '—'}</strong><span>Current status</span><strong>{member.status}</strong></div>
    <div className="kpi-grid small-grid"><div className="stat-card"><span>Total books issued</span><strong>{history.length}</strong></div><div className="stat-card"><span>Current books</span><strong>{active.length}</strong></div><div className="stat-card"><span>Total returned</span><strong>{returned.length}</strong></div><div className="stat-card"><span>Overdue books</span><strong>{overdue.length}</strong></div><div className="stat-card"><span>Active fines</span><strong>₹{outstanding}</strong></div><div className="stat-card"><span>On time / late returns</span><strong>{onTime.length} / {returned.length - onTime.length}</strong></div></div>
    <h4>Current books</h4><div className="compact-record-list">{active.length ? active.map((loan) => { const copy = books.find((item) => item.id === loan.bookId); return <div key={loan.id}><span><button type="button" className="table-link" onClick={() => onOpenBook(copy)}>{loan.bookTitle}</button><small>{copy?.rfidId || loan.rfidId} · {copy?.accessionNumber || loan.bookId} · Issued {loan.issueDate} · Due {loan.dueDate}</small></span><Status value={loan.dueDate < new Date().toISOString().slice(0, 10) ? 'Overdue' : 'Issued'} /></div> }) : <div className="empty-state">No active loans.</div>}</div>
    <h4>Reservations</h4><div className="compact-record-list">{reservations.filter((item) => item.memberId === member.id).length ? reservations.filter((item) => item.memberId === member.id).map((item) => <div key={item.id}><span><strong>{item.bookTitle}</strong><small>Queue #{item.queuePosition} · {item.createdAt?.slice(0, 10)} · pickup by {item.pickupDeadline || '—'}</small></span><Status value={item.status} /></div>) : <div className="empty-state">No reservations.</div>}</div>
    <h4>Fines</h4><div className="compact-record-list">{fines.filter((item) => item.memberId === member.id).length ? fines.filter((item) => item.memberId === member.id).map((item) => <div key={item.id}><span><strong>₹{item.amount} · {item.bookTitle}</strong><small>{item.reason || `${item.daysLate} overdue days`} · {item.createdAt?.slice(0, 10)}</small></span><Status value={item.status} /></div>) : <div className="empty-state">No fines.</div>}</div>
    <button type="button" className="ghost-button" onClick={() => setHistoryOpen(true)}>View History</button>
    {historyOpen && <MemberHistory member={member} books={books} transactions={transactions} reservations={reservations} fines={fines} rfidLogs={[]} onOpenBook={(book) => { setHistoryOpen(false); onOpenBook(book) }} onClose={() => setHistoryOpen(false)} />}
  </div>
}

function MemberHistory({ member, books, transactions, reservations, fines, rfidLogs, onOpenBook, onClose }) {
  const history = transactions.filter((item) => item.memberId === member.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const current = history.filter((item) => item.status === 'Issued')
  const previous = history.filter((item) => item.status !== 'Issued')
  const memberFines = fines.filter((item) => item.memberId === member.id)
  const memberReservations = reservations.filter((item) => item.memberId === member.id)
  const memberLogs = rfidLogs.filter((item) => item.memberId === member.id || item.entityId === member.id || normalizeRFID(item.rfidId) === normalizeRFID(member.rfidCardId)).slice(0, 30)
  const loansTable = (loans, title) => <><h4>{title}</h4>{loans.length ? <div className="table-wrap"><table><thead><tr><th>Book</th><th>Copy RFID</th><th>Accession</th><th>Issue</th><th>Due</th><th>Return</th><th>Status / fine</th></tr></thead><tbody>{loans.map((loan) => { const copy = books.find((item) => item.id === loan.bookId); const status = loan.status === 'Issued' && loan.dueDate < new Date().toISOString().slice(0, 10) ? 'Overdue' : loan.status; return <tr key={loan.id}><td><button type="button" className="table-link" onClick={() => onOpenBook(copy)}>{loan.bookTitle}</button></td><td>{copy?.rfidId || loan.rfidId || '—'}</td><td>{copy?.accessionNumber || loan.bookId}</td><td>{loan.issueDate}</td><td>{loan.dueDate}</td><td>{loan.returnedDate || '—'}</td><td>{status} · ₹{loan.fine || 0}</td></tr> })}</tbody></table></div> : <div className="empty-state">{title === 'Current books' ? 'No active loans.' : 'No borrowing history.'}</div>}</>
  return <Modal title={`${member.name} · circulation history`} wide onClose={onClose}><div className="lookup-grid"><span>Registration number</span><strong>{member.registrationNumber || member.studentId}</strong><span>Member RFID</span><strong>{member.rfidCardId || 'Not assigned'}</strong><span>Membership status</span><strong>{member.status}</strong></div>{loansTable(current, 'Current books')}{loansTable(previous, 'Previous books')}<h4>Reservations</h4>{memberReservations.length ? <div className="compact-record-list">{memberReservations.map((item) => <div key={item.id}><span><strong>{item.bookTitle}</strong><small>Reserved {item.createdAt?.slice(0, 10)} · Queue #{item.queuePosition} · pickup deadline {item.pickupDeadline || item.expiresAt || '—'}</small></span><Status value={item.status} /></div>)}</div> : <div className="empty-state">No reservations.</div>}<h4>Fines</h4>{memberFines.length ? <div className="compact-record-list">{memberFines.map((item) => <div key={item.id}><span><strong>₹{item.amount} · {item.bookTitle}</strong><small>{item.reason || `${item.daysLate} overdue days`} · Created {item.createdAt?.slice(0, 10)} · {item.paymentReference || 'Unsettled'}</small></span><Status value={item.status} /></div>)}</div> : <div className="empty-state">No fines.</div>}<h4>RFID activity</h4>{memberLogs.length ? <div className="compact-record-list">{memberLogs.map((item) => <div key={item.id}><span><strong>{item.operation || item.event} · {item.rfidId}</strong><small>{item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}</small></span><Status value={item.result} /></div>)}</div> : <div className="empty-state">No RFID activity.</div>}<div className="button-row"><button type="button" className="ghost-button" onClick={onClose}>Close</button></div></Modal>
}

function AuditResult({ audit, books, onFound, onLocation }) {
  const unresolved = audit.missing || []
  return <div className="audit-result"><div className="panel-heading"><div><h3>Latest shelf audit</h3><small>{audit.location || 'All locations'} · {new Date(audit.completedAt).toLocaleString()}</small></div><Status value="Completed" /></div><div className="kpi-grid small-grid"><div className="stat-card"><span>Expected</span><strong>{audit.expected}</strong></div><div className="stat-card"><span>Scanned / found</span><strong>{audit.found}</strong></div><div className="stat-card"><span>Missing</span><strong>{unresolved.length}</strong></div><div className="stat-card"><span>Misplaced</span><strong>{audit.misplaced?.length || 0}</strong></div><div className="stat-card"><span>Unexpected</span><strong>{audit.unexpected?.length || 0}</strong></div></div>{unresolved.slice(0, 5).map((item) => { const book = books.find((record) => record.id === item.id) || item; return <div className="audit-book-row" key={book.id}><span><strong>{book.title}</strong><small>{book.rfidId} · expected {book.location}</small></span><div className="row-actions"><button type="button" className="mini-button" onClick={() => onFound(book.id)}>Mark found</button><button type="button" className="mini-button" onClick={() => onLocation(book)}>Change location</button></div></div> })}{(audit.misplaced || []).map((book) => <div className="audit-book-row" key={`misplaced-${book.id}`}><span><strong>{book.title} · Misplaced</strong><small>Expected {book.location} · detected {book.detectedLocation}</small></span><button type="button" className="mini-button" onClick={() => onLocation(book)}>Correct location</button></div>)}</div>
}

function ConfirmModal({ title, body, onCancel, onConfirm }) {
  return <Modal title={title} onClose={onCancel}><p>{body}</p><div className="button-row"><button type="button" className="primary-button" onClick={onConfirm}>Confirm</button><button type="button" className="ghost-button" onClick={onCancel}>Cancel</button></div></Modal>
}
