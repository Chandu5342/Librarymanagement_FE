import { useEffect, useMemo, useRef, useState } from 'react'
import { categories, departments } from '../data/mockData.js'
import { useLibrary } from '../hooks/useLibrary.js'
import { getRoleForAccount } from '../utils/permissions.js'

const accounts = [
  { name: 'Aditi Verma', role: 'Administrator', email: 'admin@northbridge.edu', department: 'Administration' },
  { name: 'Nisha Rao', role: 'Librarian', email: 'librarian@northbridge.edu', department: 'Library Services' },
  { name: 'Sanjay Das', role: 'Assistant Librarian', email: 'assistant@northbridge.edu', department: 'Library Services' },
  { name: 'Dr. Kavita Menon', role: 'Faculty', email: 'faculty@northbridge.edu', department: 'Computer Science' },
  { name: 'Rahul Mehta', role: 'Student', email: 'student@northbridge.edu', department: 'Computer Science' },
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
  pages: '', price: '', description: '', branch: 'Central Library', floor: 'Floor 2',
  section: 'Computer Science', rack: 'Rack A', shelf: 'A-12', condition: 'Good', rfidId: '',
}

const initialMemberForm = {
  name: '', studentId: '', libraryId: '', email: '', phone: '', department: 'Computer Science',
  program: 'B.Tech', year: '1', section: 'A-1', memberType: 'Student', rfidCardId: '', status: 'Active',
}
const initialAcquisitionForm = { vendor: '', title: '', isbn: '', quantity: 1, unitPrice: 0, category: 'Computer Science', department: 'Computer Science' }

function routeFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (parts[0] === 'books' && parts[1]) return { page: 'catalog', detailId: parts[1] }
  if (parts[0] === 'members' && parts[1]) return { page: 'members', detailId: parts[1] }
  const routes = {
    books: 'catalog', rfid: 'rfid', circulation: 'circulation', reservations: 'reservations',
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
    books, members, transactions = [], reservations = [], fines = [], notifications = [],
    acquisitions = [], rfidLogs = [], rfidDevices = [], auditLogs = [], inventoryAudits = [],
    settings, currentUser, actions, can,
  } = library
  const [page, setPage] = useState(() => routeFromPath().page)
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
  const [toast, setToast] = useState(null)
  const [globalSearch, setGlobalSearch] = useState('')
  const [menu, setMenu] = useState('')
  const [selectedBook, setSelectedBook] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [rfid, setRfid] = useState('')
  const [rfidBusy, setRfidBusy] = useState(false)
  const [rfidResult, setRfidResult] = useState(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [issueBookId, setIssueBookId] = useState('')
  const [issueMemberId, setIssueMemberId] = useState('')
  const [returnRFID, setReturnRFID] = useState('')
  const [auditLocation, setAuditLocation] = useState('')
  const [settingsDraft, setSettingsDraft] = useState(settings)
  const [profileDraft, setProfileDraft] = useState({ name: currentUser?.name || '', email: currentUser?.email || '', department: currentUser?.department || '', preferences: currentUser?.preferences || { emailNotifications: true, compactTables: false } })
  const [reportCategory, setReportCategory] = useState('')
  const [reportStatus, setReportStatus] = useState('')
  const [reportDepartment, setReportDepartment] = useState('')
  const [reportStart, setReportStart] = useState('')
  const [reportEnd, setReportEnd] = useState('')
  const [analyticsRange, setAnalyticsRange] = useState(30)
  const [resetRequested, setResetRequested] = useState(false)
  const rfidInputRef = useRef(null)

  const role = getRoleForAccount(currentUser?.role)
  const ownMember = members.find((member) => member.id === currentUser?.memberId)
  const unreadCount = notifications.filter((item) => !item.read).length
  const visibleNav = allNavigation.filter(([key, , permission]) => {
    if (key === 'my-books') return role === 'STUDENT' || role === 'FACULTY'
    if (key === 'dashboard' || key === 'notifications' || key === 'profile') return true
    return permission && can(permission)
  }).concat((role === 'STUDENT' || role === 'FACULTY') ? [['my-books', 'My books', 'BOOK_VIEW']] : [])

  useEffect(() => {
    const onPopState = () => {
      const route = routeFromPath()
      setPage(route.page)
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
  const canOpen = (key) => {
    const item = allNavigation.find(([navKey]) => navKey === key)
    if (!item) return key === 'my-books' && ['STUDENT', 'FACULTY'].includes(role)
    return !item[2] || can(item[2])
  }
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
  const liveBooks = books.filter((book) => !book.archived)
  const availableBooks = liveBooks.filter((book) => book.availabilityStatus === 'Available')
  const studentScope = ['STUDENT', 'FACULTY'].includes(role)
  const myLoans = activeLoans.filter((item) => item.memberId === currentUser?.memberId)
  const filteredBooks = useMemo(() => actions.searchBooks(search, {
    category: categoryFilter || undefined,
    status: statusFilter || undefined,
    rfid: rfidFilter === '' ? undefined : rfidFilter === 'tagged',
  }), [actions, search, categoryFilter, statusFilter, rfidFilter])
  const displayedBooks = useMemo(() => {
    const start = (pageNumber - 1) * pageSize
    return filteredBooks.slice(start, start + pageSize)
  }, [filteredBooks, pageNumber, pageSize])
  const recentBooks = liveBooks.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 5)
  const globalResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase()
    if (!query) return []
    const matchingBooks = books.filter((book) => !book.archived && `${book.title} ${book.author} ${book.isbn} ${book.rfidId} ${book.accessionNumber} ${book.category}`.toLowerCase().includes(query)).slice(0, 5).map((book) => ({ type: 'Book', label: book.title, hint: book.rfidId, page: 'catalog', id: book.id }))
    const matchingMembers = can('MEMBER_VIEW') ? members.filter((member) => !member.archived && `${member.id} ${member.name} ${member.studentId} ${member.libraryId} ${member.rfidCardId}`.toLowerCase().includes(query)).slice(0, 4).map((member) => ({ type: 'Member', label: member.name, hint: member.studentId, page: 'members', id: member.id })) : []
    return [...matchingBooks, ...matchingMembers]
  }, [globalSearch, books, members, can])
  const detailBook = selectedBook || books.find((item) => item.id === detailId)
  const detailMember = selectedMember || members.find((member) => member.id === detailId && page === 'members')
  const lastAudit = inventoryAudits?.[0]
  const reportRows = liveBooks.filter((book) => (!reportCategory || book.category === reportCategory) && (!reportStatus || book.availabilityStatus === reportStatus) && (!reportDepartment || book.department === reportDepartment) && (!reportStart || (book.acquisitionDate || '') >= reportStart) && (!reportEnd || (book.acquisitionDate || '') <= reportEnd))
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
    setSelectedBook(book)
    setSelectedMember(null)
    setModal(null)
    navigate('catalog', book.id)
  }
  const openMember = (member) => {
    setSelectedMember(member)
    navigate('members', member.id)
  }

  const submitBook = (event) => {
    event.preventDefault()
    const location = `${form.branch} / ${form.floor} / ${form.section} / ${form.rack} / ${form.shelf}`
    const book = runAction(() => actions.createBook({
      ...form,
      edition: Number(form.edition), publicationYear: Number(form.publicationYear),
      pages: Number(form.pages || 0), price: Number(form.price || 0),
      location,
      coAuthors: [],
      totalCopies: 1,
      availableCopies: 1,
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
    const candidates = books.filter((book) => book.rfidId && !book.archived)
    if (!candidates.length) {
      notify('No tagged books are available to simulate.', 'error')
      return
    }
    const book = pickRandomItem(candidates)
    setRfid(book.rfidId)
    processRFID(book.rfidId)
  }

  const processRFID = (value, eventType = 'LOOKUP') => {
    const uid = value.trim().toUpperCase()
    setRfid(uid)
    if (!/^RFID-[A-Z]{3}-\d{4}-\d{6}$/.test(uid) || !settings.autoLookup) return
    setRfidBusy(true)
    setRfidResult(null)
    window.setTimeout(() => {
      const result = runAction(() => actions.scanRFID(uid, { event: eventType }))
      setRfidResult(result || { missing: true, rfidId: uid })
      setRfidBusy(false)
    }, 350)
  }

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
    const result = runAction(() => actions.createAcquisition(acquisitionForm), 'Acquisition request added.')
    if (result) {
      setModal(null)
      setAcquisitionForm(initialAcquisitionForm)
    }
  }
  const beginEditMember = (member) => {
    setSelectedMember(member)
    setMemberForm({ ...initialMemberForm, ...member })
    setModal('edit-member')
  }

  const dashboardStats = [
    ['Total books', liveBooks.length, `${books.filter((book) => book.rfidId && !book.archived).length} RFID tagged`],
    ['Available', availableBooks.length, 'Ready for circulation'],
    ['Books issued', activeLoans.length, `${transactions.length} total loan records`],
    ['Overdue', overdueLoans.length, 'Requires follow-up'],
    ['Members', members.filter((item) => !item.archived).length, 'Registered patrons'],
    ['Reservations', reservations.filter((item) => ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)).length, 'Active holds'],
    ['Fines outstanding', fines.filter((item) => item.status === 'PENDING').reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }), 'Current pending amount'],
    ['Lost / damaged', books.filter((item) => ['Lost', 'Damaged'].includes(item.condition) && !item.archived).length, 'Inventory exceptions'],
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
          {menu === 'notifications' && <div className="header-popover notification-popover"><div className="popover-title"><strong>Notifications</strong><button type="button" className="link-button" onClick={() => runAction(actions.markAllNotificationsRead, 'All notifications marked as read.')}>Mark all read</button></div>{notifications.slice(0, 6).map((item) => <button key={item.id} type="button" className={`notification-row ${item.read ? 'read' : ''}`} onClick={() => { runAction(() => actions.markNotificationRead(item.id)); item.entity === 'book' ? openBook(books.find((book) => book.id === item.entityId)) : navigate('notifications') }}><strong>{item.title}</strong><small>{item.category} · {new Date(item.createdAt).toLocaleString()}</small></button>)}<button type="button" className="link-button" onClick={() => navigate('notifications')}>View notification center</button></div>}
          {menu === 'quick' && <div className="header-popover quick-popover">{[['Register book', 'register'], ['RFID scan', 'rfid'], ['Issue / return', 'circulation'], ['Add member', 'members'], ['Run shelf audit', 'inventory']].filter(([, key]) => canOpen(key)).map(([label, key]) => <button key={key} type="button" onClick={() => { if (key === 'register') setModal('create-book'); else if (key === 'members') setModal('create-member'); else navigate(key) }}>{label}</button>)}</div>}
          {menu === 'profile' && <div className="header-popover profile-popover"><strong>{currentUser.name}</strong><small>{currentUser.email}</small><button type="button" onClick={() => navigate('profile')}>View / edit profile</button><button type="button" onClick={() => navigate('profile')}>Preferences</button><button type="button" onClick={() => { actions.logout(); setMenu(''); window.history.replaceState({}, '', '/') }}>Log out</button></div>}
        </header>

        <div className="content-wrap">
          <div className="page-header-row">
            <div><div className="eyebrow">{settings.branch} · DEMO MODE</div><h1>{page === 'dashboard' ? `Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${currentUser.name.split(' ')[0]}` : currentPageTitle}</h1></div>
            <div className="demo-banner">Demo environment · RFID simulation enabled</div>
          </div>

          {page === 'dashboard' && (
            <>
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
            <div className="table-wrap"><table><thead><tr><th>Accession</th><th>Title / author</th><th>Category</th><th>RFID</th><th>Location</th><th>Status</th><th>Borrower / due</th><th>Actions</th></tr></thead><tbody>{displayedBooks.map((book) => <tr key={book.id}><td>{book.accessionNumber}</td><td><button type="button" className="table-link" onClick={() => openBook(book)}>{book.title}</button><small className="table-subtitle">{book.author} · {book.isbn}</small></td><td>{book.category}</td><td>{book.rfidId || 'Pending tag'}</td><td>{book.location || 'Uncatalogued'}</td><td><Status value={book.availabilityStatus} /></td><td>{members.find((member) => member.id === book.borrowerId)?.name || '—'}{book.dueDate && <small className="table-subtitle">{book.dueDate}</small>}</td><td><div className="row-actions"><button type="button" className="mini-button" onClick={() => openBook(book)}>View</button>{can('BOOK_EDIT') && <button type="button" className="mini-button" onClick={() => editBook(book)}>Edit</button>}{can('RESERVATION_CREATE') && <button type="button" className="mini-button" onClick={() => reserveBook(book)}>Hold</button>}</div></td></tr>)}</tbody></table>{!displayedBooks.length && <div className="empty-state">No books found. Try changing your search or filters.</div>}</div>
            <div className="pagination-row"><span>Showing {filteredBooks.length ? (pageNumber - 1) * pageSize + 1 : 0}–{Math.min(pageNumber * pageSize, filteredBooks.length)} of {filteredBooks.length}</span><label>Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPageNumber(1) }}>{[10, 25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></label><button type="button" className="ghost-button" disabled={pageNumber <= 1} onClick={() => setPageNumber((number) => number - 1)}>Previous</button><button type="button" className="ghost-button" disabled={pageNumber * pageSize >= filteredBooks.length} onClick={() => setPageNumber((number) => number + 1)}>Next</button></div>
          </section>}

          {page === 'register' && <section className="panel register-panel"><div className="panel-heading"><h3>Register new book</h3><Status value="Ready for RFID reader integration" /></div><div className="register-steps"><div className="step-pill active">Book information</div><div className="step-pill active">RFID assignment</div><div className="step-pill active">Library location</div><div className="step-pill active">Review & submit</div></div><BookForm form={form} setForm={setForm} categories={categories} departments={departments} onSubmit={submitBook} onCancel={() => navigate('catalog')} onSimulate={() => simulateBookRFID(true)} submitLabel="Register book" /></section>}

          {page === 'rfid' && <section className="panel rfid-page-panel"><div className="panel-heading"><div><h3>RFID operations</h3><small>Simulation Mode · Ready for RFID Reader Integration</small></div><Status value="Connected" /></div><div className="rfid-layout"><div className="scanner-card"><div className="scanner-header"><div><span className="eyebrow">RFID reader</span><h4>Simulation bridge active</h4></div><span className="pulse-dot" /></div><div className="rfid-visual"><div className="rfid-ring" /><div className="rfid-scan-line" /></div><p>Place a book near the reader or type/paste its UID.</p><label className="workspace-field">RFID ID<input ref={rfidInputRef} className="rfid-input" value={rfid} onChange={(event) => processRFID(event.target.value)} placeholder="RFID-IND-2026-000001" aria-label="RFID ID" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); processRFID(rfid) } }} /></label><div className="button-group"><button type="button" className="primary-button" onClick={() => simulateBookRFID(false)}>Simulate RFID scan</button><button type="button" className="ghost-button" onClick={() => { setRfid(''); setRfidResult(null); rfidInputRef.current?.focus() }}>Clear</button></div><small>Keyboard-wedge input is supported. Valid UIDs trigger lookup automatically.</small></div><div className="lookup-card">{rfidBusy ? <div className="empty-state"><strong>Reading RFID…</strong><p>Searching the library catalog</p></div> : rfidResult?.missing ? <div className="empty-state"><strong>RFID not found</strong><p>{rfidResult.rfidId} is not assigned to a catalog item.</p></div> : rfidResult ? <BookSummary book={rfidResult} onOpen={() => openBook(rfidResult)} /> : <div className="empty-state"><strong>Awaiting RFID scan</strong><p>Scan an existing tag to load its book record.</p></div>}</div></div><div className="panel-heading section-subheading"><h3>Recent RFID events</h3><button type="button" className="link-button" onClick={() => navigate('devices')}>Devices</button></div><div className="table-wrap"><table><thead><tr><th>Time</th><th>UID</th><th>Book</th><th>Event</th><th>Device</th><th>Result</th></tr></thead><tbody>{rfidLogs.slice(0, 8).map((log) => <tr key={log.id}><td>{new Date(log.timestamp).toLocaleString()}</td><td>{log.rfidId}</td><td>{log.bookTitle}</td><td>{log.event}</td><td>{log.device}</td><td><Status value={log.result} /></td></tr>)}</tbody></table></div></section>}

          {page === 'circulation' && <div className="two-column-grid"><section className="panel"><div className="panel-heading"><div><h3>Issue / check-out</h3><small>Loan period: {settings.loanPeriodDays} days · limit: {settings.borrowingLimit}</small></div></div><div className="field-stack"><Field label="Search member" value={memberQuery} onChange={setMemberQuery} placeholder="Name, student ID, library ID, or card RFID" /><select value={issueMemberId} onChange={(event) => setIssueMemberId(event.target.value)}><option value="">Choose member</option>{actions.searchMembers(memberQuery).slice(0, 20).map((member) => <option key={member.id} value={member.id}>{member.name} · {member.studentId} · {member.status}</option>)}</select><label className="workspace-field">Book<select value={issueBookId} onChange={(event) => setIssueBookId(event.target.value)}><option value="">Choose available book</option>{availableBooks.map((book) => <option key={book.id} value={book.id}>{book.title} · {book.rfidId}</option>)}</select></label><div className="validation-box"><div>{issueMemberId ? `✓ ${members.find((item) => item.id === issueMemberId)?.status || 'Member selected'}` : '• Identify an active member'}</div><div>{issueBookId ? '✓ Available book selected' : '• Select a book or scan its RFID'}</div><div>✓ Due date uses current circulation settings</div></div><button type="button" className="primary-button" disabled={!issueBookId || !issueMemberId} onClick={() => { const transaction = runAction(() => actions.issueBook({ bookId: issueBookId, memberId: issueMemberId }), 'Book issued successfully.'); if (transaction) { setIssueBookId(''); setIssueMemberId('') } }}>Confirm issue</button></div></section><section className="panel"><div className="panel-heading"><div><h3>Return / check-in</h3><small>Scan the book tag to retrieve its active loan.</small></div></div><div className="field-stack"><Field label="Book RFID" value={returnRFID} onChange={setReturnRFID} placeholder="RFID-IND-2026-000001" /><button type="button" className="primary-button" disabled={!returnRFID} onClick={() => { const result = runAction(() => actions.returnBook({ rfidId: returnRFID }), 'Book returned successfully.'); if (result) setReturnRFID('') }}>Complete return</button><h4>Active loans</h4><div className="compact-record-list">{activeLoans.slice(0, 8).map((loan) => <div key={loan.id}><span><strong>{loan.bookTitle}</strong><small>{loan.memberName} · due {loan.dueDate}</small></span><button type="button" className="mini-button" onClick={() => setReturnRFID(loan.rfidId)}>Select</button></div>)}</div></div></section></div>}

          {page === 'my-books' && <section className="panel"><div className="panel-heading"><div><h3>My books</h3><small>{ownMember?.name || currentUser.name} · currently checked out</small></div></div>{myLoans.length ? <div className="table-wrap"><table><thead><tr><th>Title</th><th>Issue date</th><th>Due date</th><th>Status</th><th>Action</th></tr></thead><tbody>{myLoans.map((loan) => <tr key={loan.id}><td><button type="button" className="table-link" onClick={() => openBook(books.find((book) => book.id === loan.bookId))}>{loan.bookTitle}</button></td><td>{loan.issueDate}</td><td>{loan.dueDate}</td><td><Status value={new Date(`${loan.dueDate}T00:00:00`) < new Date() ? 'Overdue' : 'Issued'} /></td><td><button type="button" className="mini-button" onClick={() => runAction(() => actions.renewBook({ bookId: loan.bookId, memberId: loan.memberId }), 'Loan renewed.')}>Renew</button></td></tr>)}</tbody></table></div> : <div className="empty-state">No books are currently checked out to this account.</div>}</section>}

          {page === 'members' && <section className="panel"><div className="panel-heading"><div><h3>Member management</h3><small>{members.filter((item) => !item.archived).length} active records</small></div>{can('MEMBER_CREATE') && <button type="button" className="primary-button" onClick={() => { setMemberForm(initialMemberForm); setModal('create-member') }}>+ Add member</button>}</div><div className="catalog-toolbar member-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, student ID, email, card RFID" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option>Active</option><option>Blocked</option><option>Inactive</option></select></div>{detailMember ? <MemberDetails member={members.find((item) => item.id === detailMember.id) || detailMember} transactions={transactions} reservations={reservations} fines={fines} onBack={() => { setSelectedMember(null); navigate('members') }} onEdit={beginEditMember} canEdit={can('MEMBER_EDIT')} /> : <div className="table-wrap"><table><thead><tr><th>Member</th><th>Student ID</th><th>Department / program</th><th>Card RFID</th><th>Loans</th><th>Fine balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>{members.filter((member) => !member.archived && (!search || `${member.id} ${member.name} ${member.studentId} ${member.libraryId} ${member.email} ${member.rfidCardId}`.toLowerCase().includes(search.toLowerCase())) && (!statusFilter || member.status === statusFilter)).slice(0, 40).map((member) => <tr key={member.id}><td><button type="button" className="table-link" onClick={() => openMember(member)}>{member.name}</button><small className="table-subtitle">{member.email}</small></td><td>{member.studentId}</td><td>{member.department} · {member.program}</td><td>{member.rfidCardId}</td><td>{transactions.filter((item) => item.memberId === member.id && item.status === 'Issued').length}</td><td>₹{fines.filter((item) => item.memberId === member.id && item.status === 'PENDING').reduce((sum, item) => sum + item.amount, 0)}</td><td><Status value={member.status} /></td><td><div className="row-actions"><button type="button" className="mini-button" onClick={() => openMember(member)}>View</button>{can('MEMBER_EDIT') && <button type="button" className="mini-button" onClick={() => beginEditMember(member)}>Edit</button>}{can('MEMBER_EDIT') && <button type="button" className="mini-button" onClick={() => runAction(() => actions.updateMember(member.id, { status: member.status === 'Active' ? 'Inactive' : 'Active' }), member.status === 'Active' ? 'Member deactivated.' : 'Member reactivated.')}>{member.status === 'Active' ? 'Deactivate' : 'Reactivate'}</button>}{can('MEMBER_DELETE') && <button type="button" className="mini-button" onClick={() => setModal({ type: 'archive-member', id: member.id })}>Archive</button>}</div></td></tr>)}</tbody></table></div>}</section>}

          {page === 'reservations' && <section className="panel"><div className="panel-heading"><div><h3>{studentScope ? 'My reservations' : 'Reservations & holds'}</h3><small>Queue position is calculated per title.</small></div><button type="button" className="ghost-button" onClick={() => navigate('catalog')}>Find a book</button></div><div className="table-wrap"><table><thead><tr><th>Book</th><th>Member</th><th>Reserved on</th><th>Queue</th><th>Status</th><th>Expires</th><th>Action</th></tr></thead><tbody>{reservations.filter((item) => !studentScope || item.memberId === currentUser.memberId).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((reservation) => <tr key={reservation.id}><td><button type="button" className="table-link" onClick={() => openBook(books.find((book) => book.id === reservation.bookId))}>{reservation.bookTitle}</button></td><td>{reservation.memberName}</td><td>{reservation.createdAt?.slice(0, 10)}</td><td>#{reservation.queuePosition}</td><td><Status value={reservation.status} /></td><td>{reservation.expiresAt || '—'}</td><td>{['PENDING', 'READY_FOR_PICKUP'].includes(reservation.status) && <button type="button" className="mini-button" onClick={() => runAction(() => actions.cancelReservation(reservation.id), 'Reservation cancelled.')}>Cancel</button>}{can('RESERVATION_MANAGE') && reservation.status === 'READY_FOR_PICKUP' && <button type="button" className="mini-button" onClick={() => runAction(() => actions.fulfillReservation(reservation.id), 'Reservation fulfilled.')}>Fulfill</button>}</td></tr>)}</tbody></table></div></section>}

          {page === 'fines' && <section className="panel"><div className="panel-heading"><div><h3>{studentScope ? 'My fines' : 'Fine management'}</h3><small>Overdue charges are calculated from circulation settings at check-in.</small></div></div><div className="kpi-grid small-grid"><div className="stat-card"><span>Outstanding</span><strong>₹{fines.filter((item) => item.status === 'PENDING' && (!studentScope || item.memberId === currentUser.memberId)).reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-IN')}</strong></div><div className="stat-card"><span>Collected</span><strong>₹{fines.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-IN')}</strong></div><div className="stat-card"><span>Waived</span><strong>₹{fines.filter((item) => item.status === 'WAIVED').reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-IN')}</strong></div><div className="stat-card"><span>Rule</span><strong>₹{settings.finePerDay}/day</strong></div></div><div className="table-wrap"><table><thead><tr><th>Member</th><th>Book</th><th>Due / returned</th><th>Days late</th><th>Fine</th><th>Status</th><th>Actions</th></tr></thead><tbody>{fines.filter((fine) => !studentScope || fine.memberId === currentUser.memberId).map((fine) => <tr key={fine.id}><td>{fine.memberName}</td><td>{fine.bookTitle}</td><td>{fine.dueDate} / {fine.returnedDate || '—'}</td><td>{fine.daysLate}</td><td>₹{fine.amount}</td><td><Status value={fine.status} /></td><td>{fine.status === 'PENDING' && <div className="row-actions">{can('FINE_PAY') && <button type="button" className="mini-button" onClick={() => runAction(() => actions.payFine(fine.id), 'Fine payment recorded.')}>Pay</button>}{can('FINE_WAIVE') && <button type="button" className="mini-button" onClick={() => { setModal({ type: 'waive-fine', id: fine.id }); setForm({ reason: '' }) }}>Waive</button>}{studentScope && can('FINE_PAY') && <button type="button" className="mini-button" onClick={() => runAction(() => actions.payFine(fine.id), 'Fine payment recorded.')}>Pay</button>}</div>}</td></tr>)}</tbody></table></div></section>}

          {page === 'inventory' && <section className="panel"><div className="panel-heading"><div><h3>Inventory & RFID shelf audit</h3><small>Expected counts and condition are derived from the live catalog.</small></div><button type="button" className="primary-button" onClick={() => runAction(() => actions.startInventoryAudit({ location: auditLocation || undefined }), 'Shelf audit completed.')}>Start RFID audit</button></div><div className="kpi-grid small-grid">{[['Total', liveBooks.length], ['Available', availableBooks.length], ['Issued', activeLoans.length], ['Lost', books.filter((item) => item.condition === 'Lost').length], ['Damaged', books.filter((item) => item.condition === 'Damaged').length]].map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="catalog-toolbar"><select value={auditLocation} onChange={(event) => setAuditLocation(event.target.value)}><option value="">All locations</option>{[...new Set(books.map((book) => book.location).filter(Boolean))].map((location) => <option key={location}>{location}</option>)}</select></div>{lastAudit && <AuditResult audit={lastAudit} books={books} onFound={(id) => runAction(() => actions.markBookFound(id), 'Book marked found.')} onLocation={(book) => { setSelectedBook(book); setForm({ ...initialBookForm, ...book }); setModal({ type: 'location', id: book.id }) }} />}<div className="table-wrap"><table><thead><tr><th>Accession</th><th>Title</th><th>RFID</th><th>Location</th><th>Condition</th><th>Action</th></tr></thead><tbody>{liveBooks.filter((book) => ['Lost', 'Damaged'].includes(book.condition)).slice(0, 30).map((book) => <tr key={book.id}><td>{book.accessionNumber}</td><td><button className="table-link" type="button" onClick={() => openBook(book)}>{book.title}</button></td><td>{book.rfidId || '—'}</td><td>{book.location}</td><td><Status value={book.condition} /></td><td><div className="row-actions"><button type="button" className="mini-button" onClick={() => runAction(() => actions.markBookFound(book.id), 'Book marked found.')}>Mark found</button><button type="button" className="mini-button" onClick={() => { setForm({ ...initialBookForm, ...book }); setModal({ type: 'location', id: book.id }) }}>Change location</button></div></td></tr>)}</tbody></table></div></section>}

          {page === 'acquisitions' && <section className="panel"><div className="panel-heading"><div><h3>Acquisitions</h3><small>Receiving creates uncatalogued copies in the shared catalog.</small></div>{can('ACQUISITION_MANAGE') && <button type="button" className="primary-button" onClick={() => setModal('create-acquisition')}>+ New request</button>}</div><div className="kpi-grid small-grid"><div className="stat-card"><span>Annual budget</span><strong>₹45L</strong></div><div className="stat-card"><span>Committed</span><strong>₹{(acquisitions.reduce((sum, item) => sum + item.total, 0) / 100000).toFixed(1)}L</strong></div><div className="stat-card"><span>Open orders</span><strong>{acquisitions.filter((item) => !['RECEIVED', 'CANCELLED'].includes(item.status)).length}</strong></div><div className="stat-card"><span>Copies received</span><strong>{acquisitions.reduce((sum, item) => sum + (item.receivedQuantity || 0), 0)}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Order</th><th>Title</th><th>Vendor</th><th>Quantity</th><th>Unit price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{acquisitions.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((order) => <tr key={order.id}><td>{order.id}</td><td>{order.title}</td><td>{order.vendor}</td><td>{order.receivedQuantity || 0} / {order.quantity}</td><td>₹{order.unitPrice}</td><td><Status value={order.status} /></td><td>{can('ACQUISITION_MANAGE') && !['RECEIVED', 'CANCELLED'].includes(order.status) && <div className="row-actions"><button type="button" className="mini-button" onClick={() => runAction(() => actions.receiveAcquisition(order.id), 'Received copies added to catalog.')}>Receive remaining</button><button type="button" className="mini-button" onClick={() => runAction(() => actions.cancelAcquisition(order.id), 'Acquisition cancelled.')}>Cancel</button></div>}</td></tr>)}</tbody></table></div></section>}

          {page === 'reports' && <section className="panel"><div className="panel-heading"><div><h3>Live reports</h3><small>Reports are calculated from the current application records.</small></div><div className="inline-actions"><button type="button" className="ghost-button" onClick={() => runAction(() => exportCSV('library-report.csv', reportRows), 'Report exported.')}>Export CSV</button><button type="button" className="ghost-button" onClick={() => window.print()}>Print</button></div></div><div className="catalog-toolbar report-filters"><select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={reportDepartment} onChange={(event) => setReportDepartment(event.target.value)}><option value="">All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select><select value={reportStatus} onChange={(event) => setReportStatus(event.target.value)}><option value="">All statuses</option>{['Available', 'Issued', 'Reserved', 'Lost', 'Damaged'].map((item) => <option key={item}>{item}</option>)}</select><label className="workspace-field">Acquired from<input type="date" value={reportStart} onChange={(event) => setReportStart(event.target.value)} /></label><label className="workspace-field">Acquired to<input type="date" value={reportEnd} onChange={(event) => setReportEnd(event.target.value)} /></label></div><div className="kpi-grid small-grid">{[['Books', reportRows.length], ['Active loans', activeLoans.length], ['Overdue', overdueLoans.length], ['Outstanding fines', `₹${fines.filter((item) => item.status === 'PENDING').reduce((sum, item) => sum + item.amount, 0)}`]].map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="table-wrap"><table><thead><tr><th>Accession</th><th>Title</th><th>Author</th><th>Department</th><th>Category</th><th>Status</th><th>RFID</th></tr></thead><tbody>{reportRows.slice(0, 50).map((book) => <tr key={book.id}><td>{book.accessionNumber}</td><td>{book.title}</td><td>{book.author}</td><td>{book.department}</td><td>{book.category}</td><td>{book.availabilityStatus}</td><td>{book.rfidId}</td></tr>)}</tbody></table></div></section>}

          {page === 'analytics' && <section className="panel"><div className="panel-heading"><div><h3>Library analytics</h3><small>Metrics respond to circulation, collection, fines, and RFID events.</small></div><select aria-label="Analytics date range" value={analyticsRange} onChange={(event) => setAnalyticsRange(Number(event.target.value))}><option value="7">7 days</option><option value="30">30 days</option><option value="90">3 months</option><option value="180">6 months</option><option value="365">1 year</option></select></div><div className="kpi-grid">{[['Catalog collection', liveBooks.length], ['Available collection', availableBooks.length], ['Circulation in range', analyticsTransactions.length], ['Members', members.filter((item) => !item.archived).length], ['RFID scans in range', analyticsRFIDLogs.length], ['Reservations', reservations.filter((item) => ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)).length], ['Fine collection', `₹${fines.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + item.amount, 0)}`], ['Inventory accuracy', `${liveBooks.length ? Math.round((liveBooks.length - books.filter((item) => item.condition === 'Lost').length) / liveBooks.length * 100) : 100}%`]].map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><h3>Circulation by category</h3></div><div className="progress-list">{categories.slice(0, 8).map((category) => { const count = analyticsTransactions.filter((item) => books.find((book) => book.id === item.bookId)?.category === category).length; return <div className="progress-row" key={category}><span>{category}</span><div className="progress-track"><b style={{ width: `${Math.max(2, count / Math.max(analyticsTransactions.length, 1) * 100)}%` }} /></div><strong>{count}</strong></div> })}</div></section><section className="panel chart-panel"><div className="panel-heading"><h3>RFID events</h3></div><div className="activity-list">{['LOOKUP', 'REGISTER', 'ISSUE', 'RETURN', 'AUDIT'].map((kind) => <div key={kind}><span>{kind}</span><strong>{analyticsRFIDLogs.filter((item) => item.event === kind).length}</strong></div>)}</div></section></div></section>}

          {page === 'devices' && <section className="panel"><div className="panel-heading"><div><h3>RFID devices</h3><small>Hardware communication is simulated in this prototype.</small></div><Status value="Simulation mode" /></div><div className="device-grid">{rfidDevices.map((device) => <article className="device-card" key={device.id}><div className="panel-heading"><h3>{device.name}</h3><Status value={device.status} /></div><dl><dt>Device ID</dt><dd>{device.id}</dd><dt>Location</dt><dd>{device.location}</dd><dt>Signal</dt><dd>{device.signal}</dd><dt>Firmware</dt><dd>{device.firmware}</dd><dt>Total scans</dt><dd>{device.totalScans}</dd></dl></article>)}</div></section>}

          {page === 'notifications' && <section className="panel"><div className="panel-heading"><div><h3>Notification center</h3><small>{unreadCount} unread notifications</small></div><button type="button" className="ghost-button" onClick={() => runAction(actions.markAllNotificationsRead, 'All notifications marked as read.')}>Mark all as read</button></div><div className="notification-list">{notifications.map((item) => <article key={item.id} className={`notification-card ${item.read ? 'read' : ''}`}><span className="notification-mark">{item.read ? '✓' : '•'}</span><div><strong>{item.title}</strong><small>{item.category} · {new Date(item.createdAt).toLocaleString()}</small></div><div className="row-actions">{!item.read && <button type="button" className="mini-button" onClick={() => runAction(() => actions.markNotificationRead(item.id), 'Notification marked as read.')}>Mark read</button>}{item.entity === 'book' && <button type="button" className="mini-button" onClick={() => openBook(books.find((book) => book.id === item.entityId))}>View</button>}</div></article>)}</div></section>}

          {page === 'audit' && <section className="panel"><div className="panel-heading"><div><h3>Audit log</h3><small>Recent events are recorded from shared workflow mutations.</small></div><button type="button" className="ghost-button" onClick={() => runAction(() => exportCSV('library-audit.csv', auditLogs), 'Audit log exported.')}>Export CSV</button></div><div className="table-wrap"><table><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Description</th></tr></thead><tbody>{auditLogs.map((item) => <tr key={item.id}><td>{new Date(item.timestamp).toLocaleString()}</td><td>{item.user}</td><td>{item.action}</td><td>{item.entity} · {item.entityId}</td><td>{item.description}</td></tr>)}</tbody></table></div></section>}

          {page === 'profile' && <section className="panel profile-panel"><div className="panel-heading"><div><h3>Profile & account</h3><small>Role and account privileges cannot be changed here.</small></div><Status value={currentUser.role} /></div><form className="register-form" onSubmit={(event) => { event.preventDefault(); const updated = runAction(() => actions.updateProfile(profileDraft), 'Profile updated.'); if (updated) setProfileDraft({ name: updated.name, email: updated.email, department: updated.department, preferences: updated.preferences }) }}><div className="field-grid two-col"><Field label="Name" required value={profileDraft.name} onChange={(value) => setProfileDraft({ ...profileDraft, name: value })} /><Field label="Email" required type="email" value={profileDraft.email} onChange={(value) => setProfileDraft({ ...profileDraft, email: value })} /><Field label="Department" value={profileDraft.department} onChange={(value) => setProfileDraft({ ...profileDraft, department: value })} /><Field label="Role" value={currentUser.role} onChange={() => {}} readOnly /></div><button type="submit" className="primary-button">Save profile</button></form><form className="preferences-card" onSubmit={(event) => { event.preventDefault(); const updated = runAction(() => actions.updateProfile({ ...profileDraft, preferences: profileDraft.preferences }), 'Preferences saved.'); if (updated) setProfileDraft({ ...profileDraft, preferences: updated.preferences }) }}><h4>Preferences</h4><label className="checkbox-setting"><input type="checkbox" checked={profileDraft.preferences?.emailNotifications ?? true} onChange={(event) => setProfileDraft({ ...profileDraft, preferences: { ...profileDraft.preferences, emailNotifications: event.target.checked } })} /> Receive library email notifications</label><label className="checkbox-setting"><input type="checkbox" checked={profileDraft.preferences?.compactTables ?? false} onChange={(event) => setProfileDraft({ ...profileDraft, preferences: { ...profileDraft.preferences, compactTables: event.target.checked } })} /> Use compact table rows</label><button type="submit" className="ghost-button">Save preferences</button></form></section>}

          {page === 'settings' && <section className="panel settings-panel"><div className="panel-heading"><div><h3>Library settings</h3><small>These rules are used by checkout, fines, and RFID workflows.</small></div><button type="button" className="ghost-button" onClick={() => setResetRequested(true)}>Reset demo data</button></div><form className="register-form" onSubmit={(event) => { event.preventDefault(); const result = runAction(() => actions.updateSettings(settingsDraft), 'Settings saved. Future circulation uses the updated rules.'); if (result) setSettingsDraft(result) }}><div className="settings-grid"><div className="setting-block"><h4>Library & circulation</h4><div className="field-stack compact"><Field label="Library name" value={settingsDraft.libraryName} onChange={(value) => setSettingsDraft({ ...settingsDraft, libraryName: value })} /><Field label="Branch" value={settingsDraft.branch} onChange={(value) => setSettingsDraft({ ...settingsDraft, branch: value })} /><Field label="Loan period (days)" type="number" min="1" value={settingsDraft.loanPeriodDays} onChange={(value) => setSettingsDraft({ ...settingsDraft, loanPeriodDays: Number(value) })} /><Field label="Fine per overdue day (₹)" type="number" min="0" value={settingsDraft.finePerDay} onChange={(value) => setSettingsDraft({ ...settingsDraft, finePerDay: Number(value) })} /><Field label="Borrowing limit" type="number" min="1" value={settingsDraft.borrowingLimit} onChange={(value) => setSettingsDraft({ ...settingsDraft, borrowingLimit: Number(value) })} /><Field label="Renewal limit" type="number" min="0" value={settingsDraft.renewalLimit} onChange={(value) => setSettingsDraft({ ...settingsDraft, renewalLimit: Number(value) })} /></div></div><div className="setting-block"><h4>RFID simulation</h4><div className="field-stack compact"><label className="checkbox-setting"><input type="checkbox" checked={settingsDraft.autoLookup} onChange={(event) => setSettingsDraft({ ...settingsDraft, autoLookup: event.target.checked })} /> Automatically look up valid RFID tags</label><label className="checkbox-setting"><input type="checkbox" checked={settingsDraft.autoFocus} onChange={(event) => setSettingsDraft({ ...settingsDraft, autoFocus: event.target.checked })} /> Keep scanner input focused</label><label className="checkbox-setting"><input type="checkbox" checked={settingsDraft.duplicateScanPrevention} onChange={(event) => setSettingsDraft({ ...settingsDraft, duplicateScanPrevention: event.target.checked })} /> Prevent duplicate scan handling</label><label className="checkbox-setting"><input type="checkbox" checked={settingsDraft.simulationMode} onChange={(event) => setSettingsDraft({ ...settingsDraft, simulationMode: event.target.checked })} /> Simulation mode (no physical reader connected)</label></div></div></div><button type="submit" className="primary-button">Save settings</button></form></section>}
        </div>
      </main>

      {toast && <div className={`toast-message ${toast.kind}`} role="status">{toast.kind === 'error' ? '!' : '✓'} {toast.text}</div>}
      {detailBook && <Modal title="Book details" wide onClose={() => { setSelectedBook(null); setDetailId(null); navigate('catalog') }}><BookDetails book={books.find((item) => item.id === detailBook.id) || detailBook} transactions={transactions} members={members} can={can} onEdit={() => editBook(detailBook)} onIssue={() => { setIssueBookId(detailBook.id); setModal('issue-book') }} onReserve={() => reserveBook(detailBook)} onReturn={() => runAction(() => actions.returnBook({ bookId: detailBook.id }), 'Book returned successfully.')} onRenew={() => runAction(() => actions.renewBook({ bookId: detailBook.id, memberId: currentUser.memberId }), 'Loan renewed.')} onArchive={() => setModal({ type: 'archive-book', id: detailBook.id })} onLost={() => runAction(() => actions.markBookLost(detailBook.id), 'Book marked lost.')} onDamaged={() => runAction(() => actions.markBookDamaged(detailBook.id), 'Book marked damaged.')} /></Modal>}
      {modal === 'create-book' && <Modal title="Register new book" wide onClose={() => setModal(null)}><BookForm form={form} setForm={setForm} categories={categories} departments={departments} onSubmit={submitBook} onCancel={() => setModal(null)} onSimulate={() => simulateBookRFID(true)} submitLabel="Save book" /></Modal>}
      {modal === 'edit-book' && <Modal title="Edit book record" wide onClose={() => setModal(null)}><BookForm form={form} setForm={setForm} categories={categories} departments={departments} onSubmit={submitEditBook} onCancel={() => setModal(null)} submitLabel="Save changes" /></Modal>}
      {modal === 'create-member' && <Modal title="Add library member" onClose={() => setModal(null)}><MemberForm form={memberForm} setForm={setMemberForm} onSubmit={submitMember} onCancel={() => setModal(null)} /></Modal>}
      {modal === 'edit-member' && <Modal title="Edit member" onClose={() => setModal(null)}><MemberForm form={memberForm} setForm={setMemberForm} onSubmit={submitEditMember} onCancel={() => setModal(null)} /></Modal>}
      {modal === 'create-acquisition' && <Modal title="Create acquisition request" onClose={() => setModal(null)}><form className="register-form" onSubmit={submitAcquisition}><div className="field-grid"><Field label="Vendor" required value={acquisitionForm.vendor} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, vendor: value })} /><Field label="Title" required value={acquisitionForm.title} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, title: value })} /><Field label="ISBN" value={acquisitionForm.isbn} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, isbn: value })} /><Field label="Quantity" type="number" min="1" required value={acquisitionForm.quantity} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, quantity: value })} /><Field label="Unit price (₹)" type="number" min="0" required value={acquisitionForm.unitPrice} onChange={(value) => setAcquisitionForm({ ...acquisitionForm, unitPrice: value })} /></div><div className="button-row"><button className="primary-button" type="submit">Create request</button><button className="ghost-button" type="button" onClick={() => setModal(null)}>Cancel</button></div></form></Modal>}
      {modal?.type === 'waive-fine' && <Modal title="Waive fine" onClose={() => setModal(null)}><form className="register-form" onSubmit={(event) => { event.preventDefault(); const result = runAction(() => actions.waiveFine(modal.id, form.reason), 'Fine waived and recorded.'); if (result !== null) setModal(null) }}><Field label="Reason for waiver" required value={form.reason || ''} onChange={(value) => setForm({ reason: value })} /><div className="button-row"><button className="primary-button" type="submit">Confirm waiver</button><button className="ghost-button" type="button" onClick={() => setModal(null)}>Cancel</button></div></form></Modal>}
      {modal?.type === 'archive-book' && <ConfirmModal title="Archive book?" body="This book will be hidden from the active catalog. Circulation history is retained." onCancel={() => setModal(null)} onConfirm={() => { const result = runAction(() => actions.archiveBook(modal.id), 'Book archived.'); if (result) { setSelectedBook(null); setModal(null) } }} />}
      {modal?.type === 'archive-member' && <ConfirmModal title="Archive member?" body="This member will be hidden from active member lists. Member and circulation history are retained. Members with active loans cannot be archived." onCancel={() => setModal(null)} onConfirm={() => { const result = runAction(() => actions.archiveMember(modal.id), 'Member archived.'); if (result) { setSelectedMember(null); setModal(null) } }} />}
      {modal?.type === 'location' && <Modal title="Change shelf location" onClose={() => setModal(null)}><form className="register-form" onSubmit={(event) => { event.preventDefault(); const result = runAction(() => actions.changeBookLocation(modal.id, form.location || `${form.branch} / ${form.floor} / ${form.section} / ${form.rack} / ${form.shelf}`), 'Book location updated.'); if (result) setModal(null) }}><Field label="Location" required value={form.location || ''} onChange={(value) => setForm({ ...form, location: value })} /><div className="button-row"><button type="submit" className="primary-button">Save location</button><button type="button" className="ghost-button" onClick={() => setModal(null)}>Cancel</button></div></form></Modal>}
      {modal === 'issue-book' && <Modal title="Issue book" onClose={() => setModal(null)}><div className="field-stack"><label className="workspace-field">Member<select value={issueMemberId} onChange={(event) => setIssueMemberId(event.target.value)}><option value="">Choose member</option>{members.filter((member) => member.status === 'Active').map((member) => <option key={member.id} value={member.id}>{member.name} · {member.studentId}</option>)}</select></label><p>{books.find((book) => book.id === issueBookId)?.title}</p><button type="button" className="primary-button" disabled={!issueMemberId} onClick={() => { const result = runAction(() => actions.issueBook({ bookId: issueBookId, memberId: issueMemberId }), 'Book issued successfully.'); if (result) { setModal(null); setSelectedBook(null) } }}>Confirm issue</button></div></Modal>}
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

function BookForm({ form, setForm, categories, departments, onSubmit, onCancel, onSimulate, submitLabel }) {
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
        <label className="workspace-field">Condition<select value={form.condition} onChange={(event) => set('condition', event.target.value)}>{['New', 'Good', 'Fair', 'Damaged'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="workspace-field full-width">Description<textarea rows="3" value={form.description} onChange={(event) => set('description', event.target.value)} /></label>
      </div>
      <div className="rfid-registration-card"><h4>RFID tag assignment</h4><Field label="RFID UID (optional)" value={form.rfidId} onChange={(value) => set('rfidId', value.toUpperCase())} placeholder="RFID-IND-2026-000001" /><div className="button-group">{onSimulate && <button type="button" className="primary-button" onClick={onSimulate}>Simulate RFID scan</button>}<small>{form.rfidId ? 'UID will be validated for uniqueness before saving.' : 'Without a tag, this copy is saved as pending RFID assignment.'}</small></div></div>
      <div className="button-row"><button type="submit" className="primary-button">{submitLabel}</button><button type="button" className="ghost-button" onClick={onCancel}>Cancel</button></div>
    </form>
  )
}

function MemberForm({ form, setForm, onSubmit, onCancel }) {
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <form className="register-form" onSubmit={onSubmit}><div className="field-grid"><Field label="Full name" required value={form.name} onChange={(value) => set('name', value)} /><Field label="Student ID" required value={form.studentId} onChange={(value) => set('studentId', value)} /><Field label="Library ID" value={form.libraryId} onChange={(value) => set('libraryId', value)} /><Field label="Email" required type="email" value={form.email} onChange={(value) => set('email', value)} /><Field label="Phone" value={form.phone} onChange={(value) => set('phone', value)} /><Field label="Department" value={form.department} onChange={(value) => set('department', value)} /><Field label="Program" value={form.program} onChange={(value) => set('program', value)} /><Field label="Year" type="number" min="1" max="8" value={form.year} onChange={(value) => set('year', value)} /><Field label="Section" value={form.section} onChange={(value) => set('section', value)} /><Field label="Member RFID card ID" value={form.rfidCardId} onChange={(value) => set('rfidCardId', value)} /><label className="workspace-field">Member type<select value={form.memberType} onChange={(event) => set('memberType', event.target.value)}><option>Student</option><option>Faculty</option><option>Staff</option></select></label><label className="workspace-field">Status<select value={form.status} onChange={(event) => set('status', event.target.value)}><option>Active</option><option>Blocked</option><option>Inactive</option></select></label></div><div className="button-row"><button type="submit" className="primary-button">Save member</button><button type="button" className="ghost-button" onClick={onCancel}>Cancel</button></div></form>
}

function BookSummary({ book, onOpen }) {
  return <div className="book-summary"><span className="eyebrow">RFID recognized · Book found</span><h3>{book.title}</h3><p>{book.author}</p><div className="lookup-grid"><span>ISBN</span><strong>{book.isbn || '—'}</strong><span>Category</span><strong>{book.category}</strong><span>RFID</span><strong>{book.rfidId}</strong><span>Location</span><strong>{book.location || 'Uncatalogued'}</strong><span>Status</span><strong><Status value={book.availabilityStatus} /></strong><span>Condition</span><strong>{book.condition}</strong></div><button type="button" className="primary-button" onClick={onOpen}>Open book details</button></div>
}

function BookDetails({ book, transactions, members, can, onEdit, onIssue, onReserve, onReturn, onRenew, onArchive, onLost, onDamaged }) {
  const loan = transactions.find((item) => item.bookId === book.id && item.status === 'Issued')
  const borrower = members.find((member) => member.id === loan?.memberId)
  return <div className="book-detail-layout"><div className="book-cover-large">{book.title?.slice(0, 1)}</div><div className="book-detail-content"><div className="book-detail-top"><div><h2>{book.title}</h2><p>{book.author} · {book.publisher}</p></div><Status value={book.availabilityStatus} /></div><div className="lookup-grid"><span>Accession</span><strong>{book.accessionNumber}</strong><span>ISBN</span><strong>{book.isbn || '—'}</strong><span>Category</span><strong>{book.category}</strong><span>RFID tag</span><strong>{book.rfidId || 'Not assigned'}</strong><span>Location</span><strong>{book.location || 'Uncatalogued'}</strong><span>Condition</span><strong>{book.condition}</strong><span>Borrower</span><strong>{borrower?.name || '—'}</strong><span>Due date</span><strong>{loan?.dueDate || '—'}</strong></div><p className="book-description">{book.description}</p><div className="button-row">{can('BOOK_EDIT') && <button type="button" className="primary-button" onClick={onEdit}>Edit</button>}{can('ISSUE_BOOK') && book.availabilityStatus === 'Available' && <button type="button" className="ghost-button" onClick={onIssue}>Issue</button>}{can('RETURN_BOOK') && loan && <button type="button" className="ghost-button" onClick={onReturn}>Return</button>}{can('RENEW_BOOK') && loan && <button type="button" className="ghost-button" onClick={onRenew}>Renew</button>}{can('RESERVATION_CREATE') && <button type="button" className="ghost-button" onClick={onReserve}>Reserve</button>}{can('INVENTORY_VIEW') && <button type="button" className="ghost-button" onClick={onDamaged}>Mark damaged</button>}{can('INVENTORY_VIEW') && <button type="button" className="ghost-button" onClick={onLost}>Mark lost</button>}{can('BOOK_DELETE') && <button type="button" className="ghost-button" onClick={onArchive}>Archive</button>}</div></div></div>
}

function MemberDetails({ member, transactions, reservations, fines, onBack, onEdit, canEdit }) {
  return <div className="member-details"><div className="panel-heading"><div><h3>{member.name}</h3><small>{member.studentId} · {member.email}</small></div><div className="row-actions"><Status value={member.status} />{canEdit && <button type="button" className="ghost-button" onClick={() => onEdit(member)}>Edit member</button>}<button type="button" className="ghost-button" onClick={onBack}>Back</button></div></div><div className="kpi-grid small-grid"><div className="stat-card"><span>Active loans</span><strong>{transactions.filter((item) => item.memberId === member.id && item.status === 'Issued').length}</strong></div><div className="stat-card"><span>Reservations</span><strong>{reservations.filter((item) => item.memberId === member.id && ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)).length}</strong></div><div className="stat-card"><span>Outstanding fines</span><strong>₹{fines.filter((item) => item.memberId === member.id && item.status === 'PENDING').reduce((sum, item) => sum + item.amount, 0)}</strong></div></div><h4>Loan history</h4><div className="compact-record-list">{transactions.filter((item) => item.memberId === member.id).slice(0, 12).map((loan) => <div key={loan.id}><span><strong>{loan.bookTitle}</strong><small>{loan.issueDate} · {loan.status}</small></span><Status value={loan.status} /></div>)}</div></div>
}

function AuditResult({ audit, books, onFound, onLocation }) {
  const unresolved = audit.missing || []
  return <div className="audit-result"><div className="panel-heading"><div><h3>Latest shelf audit</h3><small>{audit.location || 'All locations'} · {new Date(audit.completedAt).toLocaleString()}</small></div><Status value="Completed" /></div><div className="kpi-grid small-grid"><div className="stat-card"><span>Expected</span><strong>{audit.expected}</strong></div><div className="stat-card"><span>Scanned / found</span><strong>{audit.found}</strong></div><div className="stat-card"><span>Missing</span><strong>{unresolved.length}</strong></div><div className="stat-card"><span>Misplaced</span><strong>{audit.misplaced?.length || 0}</strong></div><div className="stat-card"><span>Unexpected</span><strong>{audit.unexpected?.length || 0}</strong></div></div>{unresolved.slice(0, 5).map((item) => { const book = books.find((record) => record.id === item.id) || item; return <div className="audit-book-row" key={book.id}><span><strong>{book.title}</strong><small>{book.rfidId} · expected {book.location}</small></span><div className="row-actions"><button type="button" className="mini-button" onClick={() => onFound(book.id)}>Mark found</button><button type="button" className="mini-button" onClick={() => onLocation(book)}>Change location</button></div></div> })}{(audit.misplaced || []).map((book) => <div className="audit-book-row" key={`misplaced-${book.id}`}><span><strong>{book.title} · Misplaced</strong><small>Expected {book.location} · detected {book.detectedLocation}</small></span><button type="button" className="mini-button" onClick={() => onLocation(book)}>Correct location</button></div>)}</div>
}

function ConfirmModal({ title, body, onCancel, onConfirm }) {
  return <Modal title={title} onClose={onCancel}><p>{body}</p><div className="button-row"><button type="button" className="primary-button" onClick={onConfirm}>Confirm</button><button type="button" className="ghost-button" onClick={onCancel}>Cancel</button></div></Modal>
}
