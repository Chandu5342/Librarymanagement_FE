import { useEffect, useMemo, useState } from 'react'
import './App.css'

const libraryName = 'Northbridge University Library'
const navItems = [
  'dashboard',
  'catalog',
  'register',
  'rfid',
  'circulation',
  'members',
  'reservations',
  'fines',
  'inventory',
  'acquisitions',
  'reports',
  'analytics',
  'settings',
]

const demoAccounts = [
  { name: 'Aditi Verma', role: 'Administrator', email: 'admin@northbridge.edu', password: 'admin123' },
  { name: 'Nisha Rao', role: 'Librarian', email: 'librarian@northbridge.edu', password: 'lib123' },
  { name: 'Rahul Mehta', role: 'Student', email: 'student@northbridge.edu', password: 'student123' },
]

const categories = [
  'Computer Science',
  'Artificial Intelligence',
  'Machine Learning',
  'Data Science',
  'Programming',
  'Web Development',
  'Databases',
  'Networks',
  'Operating Systems',
  'Computer Architecture',
  'Cyber Security',
  'Cloud Computing',
  'Software Engineering',
  'Mathematics',
  'Physics',
  'Electronics',
  'Mechanical',
  'Civil',
  'Electrical',
  'Management',
  'Aptitude',
  'Competitive Exams',
  'General Knowledge',
  'Literature',
]

const authors = [
  'Robert C. Martin',
  'Andrew Ng',
  'Jane Austen',
  'Katherine Johnson',
  'Eric Ries',
  'M. T. Anderson',
  'Srinivasan',
  'N. K. Singh',
  'Peter Norvig',
  'Bradford Tuckfield',
  'David Flanagan',
  'Aditya Bhargava',
  'Amitav Ghosh',
  'C. J. Date',
  'William Stallings',
  'Jordan Peterson',
  'A. S. Tanenbaum',
  'Bjarne Stroustrup',
  'Micheal Goodrich',
  'H. G. Wells',
]

const publishers = ['Pearson', 'McGraw Hill', 'Oxford', 'Prentice Hall', 'Wiley', 'MIT Press', 'Springer', 'TechNova']
const departments = ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Electrical', 'Management', 'Mathematics', 'Physics']
const locations = ['CS / Rack A / Shelf 12', 'CS / Rack B / Shelf 08', 'AI / Rack C / Shelf 03', 'DB / Rack D / Shelf 15', 'Networks / Rack E / Shelf 02']
const shelves = ['A-12', 'B-08', 'C-03', 'D-15', 'H-02', 'K-09']
const titlePrefixes = [
  'Digital',
  'Modern',
  'Applied',
  'Practical',
  'Beginning',
  'Advanced',
  'Fundamentals of',
  'Data',
  'Design',
  'Machine',
  'Systems',
  'Core',
  'Smart',
  'Network',
  'Secure',
]
const titleSubjects = [
  'Algorithms',
  'Architecture',
  'Programming',
  'Learning',
  'Security',
  'Cloud Systems',
  'Database Design',
  'Distributed Systems',
  'Embedded Systems',
  'Computer Vision',
  'Cyber Defense',
  'Signal Processing',
  'Data Modeling',
  'Engineering',
  'Automation',
]
const firstNames = ['Ananya', 'Kabir', 'Meera', 'Aarav', 'Ishita', 'Rohan', 'Saanvi', 'Vikram', 'Neha', 'Aditya', 'Tanya', 'Arjun', 'Disha', 'Rajat', 'Pooja', 'Varun', 'Riya', 'Karan', 'Sneha', 'Yash']
const lastNames = ['Sharma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Singh', 'Khan', 'Banerjee', 'Gupta', 'Malhotra', 'Verma', 'Kapoor', 'Das', 'Mishra', 'Joshi', 'Srinivasan', 'Rao', 'Bhatt', 'Kulkarni', 'Chawla']
const statuses = ['Available', 'Issued', 'Reserved', 'Damaged', 'Lost', 'Available']

function pad(num) {
  return String(num).padStart(5, '0')
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function generateBooks() {
  return Array.from({ length: 120 }, (_, index) => {
    const id = index + 1
    const category = categories[index % categories.length]
    const department = departments[(index * 2) % departments.length]
    const author = authors[index % authors.length]
    const title = `${titlePrefixes[index % titlePrefixes.length]} ${titleSubjects[(index + 2) % titleSubjects.length]}`
    const publisher = publishers[index % publishers.length]
    const rfidId = `RFID-IND-2026-${String(index + 1).padStart(6, '0')}`
    const status = statuses[index % statuses.length]
    const availabilityStatus = status === 'Issued' ? 'Issued' : status === 'Reserved' ? 'Reserved' : 'Available'
    const dueDate = new Date(Date.now() + ((index % 12) + 5) * 86400000).toISOString().slice(0, 10)
    const borrowerId = availabilityStatus === 'Issued' ? `M-${1000 + ((index * 7) % 60)}` : null

    return {
      id: `BK-${String(id).padStart(4, '0')}`,
      accessionNumber: `ACC-${String(id + 900).padStart(6, '0')}`,
      bookCode: `B${String(id).padStart(5, '0')}`,
      title,
      subtitle: 'Academic reference and guided practice',
      author,
      coAuthors: [author, authors[(index + 1) % authors.length]],
      isbn: `978-${String(1234567890 + index).slice(0, 10)}`,
      publisher,
      publicationYear: 2018 + (index % 8),
      edition: 1 + (index % 5),
      language: 'English',
      category,
      subCategory: category,
      department,
      pages: 240 + (id % 320),
      format: index % 2 === 0 ? 'Hardcover' : 'Paperback',
      description: 'A widely used academic text supporting classroom instruction, self-study, and practical lab work for modern higher education.',
      coverImage: `https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=500&q=80`,
      rfidId,
      rfidStatus: 'Active',
      availabilityStatus,
      condition: status === 'Damaged' ? 'Damaged' : 'Good',
      shelf: shelves[index % shelves.length],
      rack: `Rack ${String.fromCharCode(65 + (index % 5))}`,
      floor: `Floor ${2 + (index % 3)}`,
      location: locations[index % locations.length],
      totalCopies: 5 + (index % 3),
      availableCopies: availabilityStatus === 'Available' ? 3 + (index % 4) : 1,
      issuedCopies: availabilityStatus === 'Issued' ? 2 : 1,
      reservedCopies: index % 5 === 0 ? 1 : 0,
      price: 350 + (index * 27),
      acquisitionDate: '2024-01-15',
      borrowerId,
      dueDate,
      tags: [category.toLowerCase(), department.toLowerCase(), 'rfid'],
    }
  })
}

function generateMembers() {
  return Array.from({ length: 60 }, (_, index) => {
    const first = firstNames[index % firstNames.length]
    const last = lastNames[(index + 3) % lastNames.length]
    const dept = departments[index % departments.length]
    const status = index % 6 === 0 ? 'Blocked' : 'Active'
    const borrowCount = index % 4
    const overdue = index % 5 === 0 ? 1 : 0
    const fine = overdue ? 180 + (index % 5) * 35 : 40 + (index % 3) * 20

    return {
      id: `M-${1000 + index}`,
      studentId: `2024${dept.slice(0, 2).toUpperCase()}${String(index + 1).padStart(3, '0')}`,
      libraryId: `LIB-${String(index + 1001).padStart(4, '0')}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@northbridge.edu`,
      phone: `+91 98${String(1000000 + index).slice(0, 7)}`,
      department: dept,
      program: index % 2 === 0 ? 'B.Tech' : 'M.Tech',
      year: 1 + (index % 4),
      section: `A-${(index % 5) + 1}`,
      memberType: index % 3 === 0 ? 'Faculty' : 'Student',
      joinDate: '2024-08-10',
      status,
      borrowedBooks: borrowCount,
      overdueBooks: overdue,
      fineAmount: fine,
      rfidCardId: `CARD-${String(2000 + index).padStart(6, '0')}`,
      profileImage: `https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80`,
    }
  })
}

function generateTransactions() {
  return Array.from({ length: 50 }, (_, index) => {
    const book = { title: `Book ${index + 1}` }
    return {
      id: `TR-${index + 1}`,
      memberId: `M-${1000 + ((index * 7) % 60)}`,
      memberName: firstNames[index % firstNames.length],
      rfidId: `RFID-IND-2026-${String(index + 1).padStart(6, '0')}`,
      bookTitle: book.title,
      issueDate: new Date(Date.now() - (index + 1) * 86400000).toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + ((index % 10) + 4) * 86400000).toISOString().slice(0, 10),
      status: index % 2 === 0 ? 'Issued' : 'Returned',
      fine: index % 3 === 0 ? 120 : 0,
    }
  })
}

function generateReservations() {
  return Array.from({ length: 25 }, (_, index) => ({
    id: `RES-${index + 1}`,
    book: `Book ${index + 1}`,
    member: `${firstNames[index % firstNames.length]} ${lastNames[(index + 2) % lastNames.length]}`,
    reservedOn: new Date(Date.now() - (index + 2) * 86400000).toISOString().slice(0, 10),
    queue: index + 1,
    status: ['Pending', 'Ready for Pickup', 'Collected', 'Expired', 'Cancelled'][index % 5],
    expiry: new Date(Date.now() + (index % 7 + 2) * 86400000).toISOString().slice(0, 10),
  }))
}

function generateFines() {
  return Array.from({ length: 30 }, (_, index) => ({
    member: `${firstNames[index % firstNames.length]} ${lastNames[(index + 1) % lastNames.length]}`,
    book: `Book ${index + 1}`,
    dueDate: new Date(Date.now() - (index % 7 + 2) * 86400000).toISOString().slice(0, 10),
    returnedDate: new Date(Date.now() - (index % 4 + 1) * 86400000).toISOString().slice(0, 10),
    daysLate: 5 + (index % 12),
    fine: 90 + (index % 7) * 50,
    status: index % 2 === 0 ? 'Pending' : 'Paid',
  }))
}

function generateNotifications() {
  return [
    { id: 1, category: 'Overdue', priority: 'High', title: '3 books are overdue.', time: '12 minutes ago' },
    { id: 2, category: 'RFID', priority: 'Normal', title: 'RFID-IND-2026-004872 was scanned.', time: '18 minutes ago' },
    { id: 3, category: 'Reservation', priority: 'Normal', title: 'Reservation ready for pickup.', time: '41 minutes ago' },
    { id: 4, category: 'Acquisition', priority: 'Normal', title: 'New acquisition received.', time: '1 hour ago' },
    { id: 5, category: 'Device', priority: 'High', title: 'RFID Reader 02 is offline.', time: '2 hours ago' },
    { id: 6, category: 'Circulation', priority: 'Normal', title: 'Book successfully returned.', time: 'Today' },
  ]
}

function generateDevices() {
  return [
    { id: 'RDR-01', name: 'Reader 01', status: 'Connected', signal: 'Strong', location: 'Main Desk', firmware: 'v3.4.1', lastScan: '01:12 PM', scans: 643 },
    { id: 'RDR-02', name: 'Reader 02', status: 'Scanning', signal: 'Moderate', location: 'Self Service Desk', firmware: 'v3.4.1', lastScan: 'Now', scans: 482 },
    { id: 'SELF-01', name: 'Self Checkout 01', status: 'Connected', signal: 'Strong', location: 'Ground Floor', firmware: 'v2.7.0', lastScan: '08:42 AM', scans: 220 },
    { id: 'SHELF-01', name: 'Shelf Scanner 01', status: 'Idle', signal: 'Strong', location: 'CS Stack', firmware: 'v2.9.4', lastScan: '09:35 AM', scans: 610 },
    { id: 'RET-01', name: 'Return Station 01', status: 'Offline', signal: 'Weak', location: 'Front Desk', firmware: 'v2.8.1', lastScan: 'Yesterday', scans: 145 },
  ]
}

const defaultBooks = generateBooks()
const defaultMembers = generateMembers()
const defaultTransactions = generateTransactions()
const defaultReservations = generateReservations()
const defaultFines = generateFines()
const defaultNotifications = generateNotifications()
const defaultDevices = generateDevices()

function App() {
  const [books, setBooks] = useState(() => {
    const stored = localStorage.getItem('library-demo-books')
    return stored ? JSON.parse(stored) : defaultBooks
  })
  const [members, setMembers] = useState(() => {
    const stored = localStorage.getItem('library-demo-members')
    return stored ? JSON.parse(stored) : defaultMembers
  })
  const [selectedSection, setSelectedSection] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [demoPanelOpen, setDemoPanelOpen] = useState(true)
  const [globalSearch, setGlobalSearch] = useState('')
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('library-demo-user')
    return stored ? JSON.parse(stored) : null
  })
  const [rfidInput, setRfidInput] = useState('RFID-IND-2026-004872')
  const [rfidLookup, setRfidLookup] = useState(() => defaultBooks.find((b) => b.rfidId === 'RFID-IND-2026-004872'))
  const [rfidLoading, setRfidLoading] = useState(false)
  const [newBookForm, setNewBookForm] = useState({
    title: 'Building Large Scale Systems',
    subtitle: 'Architecting resilient applications',
    author: 'Amit Sinha',
    coAuthor: 'Priya Kumar',
    isbn: '978-0132350884',
    publisher: 'Pearson',
    edition: '3',
    publicationYear: '2025',
    language: 'English',
    pages: '420',
    category: 'Software Engineering',
    subCategory: 'System Design',
    department: 'Computer Science',
    description: 'A practical guide to building modern, scalable, maintainable systems.',
    price: '760',
    acquisitionDate: '2025-01-12',
    supplier: 'Academic House',
    branch: 'Central Library',
    building: 'Main Building',
    floor: '2',
    section: 'Computer Science',
    rack: 'Rack A',
    shelf: 'Shelf 12',
  })
  const [rfidAssignment, setRfidAssignment] = useState('Waiting for RFID scan...')
  const [rfidStatusMessage, setRfidStatusMessage] = useState('')
  const [newBookSuccess, setNewBookSuccess] = useState(null)
  const [issueForm, setIssueForm] = useState({
    memberId: 'M-1001',
    rfid: 'RFID-IND-2026-004872',
  })
  const [returnForm, setReturnForm] = useState({ rfid: 'RFID-IND-2026-000005' })
  const [returnResult, setReturnResult] = useState(null)

  useEffect(() => {
    localStorage.setItem('library-demo-books', JSON.stringify(books))
  }, [books])

  useEffect(() => {
    localStorage.setItem('library-demo-members', JSON.stringify(members))
  }, [members])

  useEffect(() => {
    if (user) {
      localStorage.setItem('library-demo-user', JSON.stringify(user))
    } else {
      localStorage.removeItem('library-demo-user')
    }
  }, [user])

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60000)

  const globalSearchResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase()
    if (!query) return []

    const bookResults = books
      .filter((book) => {
        const haystack = `${book.title} ${book.author} ${book.isbn} ${book.rfidId} ${book.accessionNumber} ${book.category}`.toLowerCase()
        return haystack.includes(query)
      })
      .slice(0, 5)
      .map((book) => ({ type: 'Books', item: book, label: book.title }))

    const memberResults = members
      .filter((member) => {
        const haystack = `${member.name} ${member.studentId} ${member.libraryId} ${member.department}`.toLowerCase()
        return haystack.includes(query)
      })
      .slice(0, 4)
      .map((member) => ({ type: 'Members', item: member, label: member.name }))

    return [...bookResults, ...memberResults]
  }, [books, members, globalSearch])

  const kpis = useMemo(() => [
    { label: 'Total Books', value: '12,486', delta: '+4.2%' },
    { label: 'Available Books', value: '8,742', delta: '+1.7%' },
    { label: 'Books Issued', value: '3,218', delta: '+7.1%' },
    { label: 'Overdue Books', value: '526', delta: '-2.4%' },
    { label: 'Registered Members', value: '4,826', delta: '+3.8%' },
    { label: 'Books Reserved', value: '328', delta: '+9.1%' },
    { label: 'RFID-Tagged Books', value: '11,934', delta: '+5.9%' },
    { label: 'Lost/Damaged', value: '192', delta: '-1.2%' },
  ], [])

  const trendBars = [58, 72, 48, 81, 66, 94, 86]
  const issueTrend = [48, 62, 58, 76, 88, 81, 95]
  const monthlyCirculation = [22, 31, 28, 39, 42, 45, 36]
  const categoryUsage = [32, 24, 17, 16, 11, 9]

  const activeBookCount = books.filter((book) => book.availabilityStatus === 'Available').length
  const overdueCount = books.filter((book) => book.dueDate && new Date(book.dueDate) < new Date()).length
  const membersWithFines = members.filter((member) => member.fineAmount > 0).length
  const reservationsCount = defaultReservations.length

  const login = (selected) => {
    const account = demoAccounts.find((item) => item.role === selected)
    setUser({ ...account, branch: 'Central Library' })
  }

  const handleThemeAction = (section) => setSelectedSection(section)

  const simulateRFIDScan = (overrideValue) => {
    const scanned = overrideValue || books[Math.floor(Math.random() * books.length)]?.rfidId
    setRfidLoading(true)
    setTimeout(() => {
      setRfidInput(scanned)
      const record = books.find((book) => book.rfidId === scanned)
      setRfidLookup(record || null)
      setRfidLoading(false)
    }, 800)
  }

  const handleRegisterBook = (event) => {
    event.preventDefault()
    const duplicate = books.some((book) => book.rfidId === rfidAssignment)
    if (duplicate || rfidAssignment === 'Waiting for RFID scan...') {
      setRfidStatusMessage('RFID already assigned or not available.')
      return
    }

    const newId = `BK-${String(books.length + 1).padStart(4, '0')}`
    const newAcc = `ACC-${String(books.length + 2000).padStart(6, '0')}`
    const newBook = {
      id: newId,
      accessionNumber: newAcc,
      bookCode: `B${String(books.length + 1).padStart(5, '0')}`,
      title: newBookForm.title,
      subtitle: newBookForm.subtitle,
      author: newBookForm.author,
      coAuthors: [newBookForm.author, newBookForm.coAuthor],
      isbn: newBookForm.isbn,
      publisher: newBookForm.publisher,
      publicationYear: Number(newBookForm.publicationYear),
      edition: Number(newBookForm.edition),
      language: newBookForm.language,
      category: newBookForm.category,
      subCategory: newBookForm.subCategory,
      department: newBookForm.department,
      pages: Number(newBookForm.pages),
      format: 'Hardcover',
      description: newBookForm.description,
      coverImage: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=500&q=80',
      rfidId: rfidAssignment,
      rfidStatus: 'Active',
      availabilityStatus: 'Available',
      condition: 'Good',
      shelf: newBookForm.shelf,
      rack: newBookForm.rack,
      floor: newBookForm.floor,
      location: `${newBookForm.branch} / ${newBookForm.building} / Floor ${newBookForm.floor} / ${newBookForm.section} / ${newBookForm.rack} / ${newBookForm.shelf}`,
      totalCopies: 1,
      availableCopies: 1,
      issuedCopies: 0,
      reservedCopies: 0,
      price: Number(newBookForm.price),
      acquisitionDate: newBookForm.acquisitionDate,
      borrowerId: null,
      dueDate: null,
      tags: [newBookForm.category.toLowerCase(), newBookForm.department.toLowerCase()],
    }

    setBooks((current) => [newBook, ...current])
    setNewBookSuccess({
      id: newId,
      accessionNumber: newAcc,
      title: newBookForm.title,
      rfid: rfidAssignment,
      shelf: `${newBookForm.rack} / ${newBookForm.shelf}`,
    })
    setRfidStatusMessage('RFID available and assigned.')
    setSelectedSection('catalog')
  }

  const handleSimulateRfidAssignment = () => {
    const candidate = `RFID-IND-2026-${String(Math.floor(Math.random() * 900000) + 100000)}`
    const duplicate = books.some((book) => book.rfidId === candidate)
    if (duplicate) {
      setRfidAssignment('RFID already assigned')
      setRfidStatusMessage('RFID already assigned. Choose another code.')
      return
    }
    setRfidAssignment(candidate)
    setRfidStatusMessage('RFID available')
  }

  const handleIssueBook = () => {
    const member = members.find((item) => item.id === issueForm.memberId)
    const book = books.find((item) => item.rfidId === issueForm.rfid)
    if (!member || !book) return
    if (book.availabilityStatus !== 'Available') {
      alert('Book is currently unavailable.')
      return
    }

    const updatedBooks = books.map((item) => {
      if (item.rfidId === issueForm.rfid) {
        return {
          ...item,
          availabilityStatus: 'Issued',
          borrowerId: member.id,
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        }
      }
      return item
    })
    setBooks(updatedBooks)
    alert('Book issued successfully')
  }

  const handleQuickReturn = () => {
    const book = books.find((item) => item.rfidId === returnForm.rfid)
    const fine = book && book.dueDate && new Date(book.dueDate) < new Date() ? 120 : 0
    setReturnResult({
      bookTitle: book?.title || 'Unknown title',
      borrower: book?.borrowerId || 'No borrower',
      issueDate: book?.dueDate || 'N/A',
      fine,
      overdue: fine > 0,
    })
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-panel auth-branding">
            <div className="auth-logo">N</div>
            <div className="brand-row">
              <div className="mini-label">DEMO MODE</div>
              <div className="demo-tag">RFID Simulation Enabled</div>
            </div>
            <h1>{libraryName}</h1>
            <p>
              Smart library operations for students, faculty, and librarians with secure RFID workflows and modern circulation tools.
            </p>
            <div className="feature-stack">
              <span>Catalog & metadata</span>
              <span>RFID tracking</span>
              <span>Self-service circulation</span>
            </div>
          </div>

          <div className="auth-panel auth-form-panel">
            <div className="text-row">
              <span className="eyebrow">Welcome back</span>
              <h2>Sign in to your library account</h2>
            </div>

            <div className="demo-account-grid">
              {demoAccounts.slice(0, 3).map((account) => (
                <button
                  type="button"
                  key={account.role}
                  className="demo-account-button"
                  onClick={() => login(account.role)}
                >
                  <span>{account.role}</span>
                  <small>{account.name}</small>
                </button>
              ))}
            </div>

            <form className="auth-form">
              <label>
                Email or username
                <input type="text" defaultValue="admin@northbridge.edu" />
              </label>
              <label>
                Password
                <input type="password" defaultValue="admin123" />
              </label>
              <div className="auth-meta-row">
                <label className="checkbox-row"><input type="checkbox" defaultChecked /> Remember me</label>
                <button type="button" className="link-button">Forgot password?</button>
              </div>
              <button type="button" className="primary-button wide" onClick={() => login('Administrator')}>
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="app-logo">N</div>
          {!sidebarCollapsed && (
            <div>
              <strong>{libraryName}</strong>
              <small>Smart Library</small>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              type="button"
              key={item}
              className={`nav-item ${selectedSection === item ? 'active' : ''}`}
              onClick={() => handleThemeAction(item)}
              title={item}
            >
              <span className="nav-icon">{item[0].toUpperCase()}</span>
              {!sidebarCollapsed && <span>{item}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="ghost-button" onClick={() => setSidebarCollapsed((state) => !state)}>
            {sidebarCollapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-search-wrap">
            <span className="search-icon">⌕</span>
            <input
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Search books, members, RFID, ISBN..."
              aria-label="Global search"
            />
            {globalSearch && (
              <div className="global-result-panel">
                {globalSearchResults.length ? globalSearchResults.map((result) => (
                  <button type="button" key={`${result.type}-${result.label}`} className="search-result-row">
                    <span className="search-type">{result.type}</span>
                    <span>{result.label}</span>
                  </button>
                )) : <div className="search-empty">No matching records found.</div>}
              </div>
            )}
          </div>

          <div className="topbar-actions">
            <div className="location-pill">Central Library</div>
            <div className="rfid-status-pill">
              <span className="dot pulse" /> RFID Reader: Connected
            </div>
            <button type="button" className="icon-button">🔔 <span className="badge">4</span></button>
            <button type="button" className="primary-button">Quick Actions</button>
            <div className="user-chip">
              <div className="avatar">{user.name.charAt(0)}</div>
              <div>
                <strong>{user.name}</strong>
                <small>{user.role}</small>
              </div>
            </div>
          </div>
        </header>

        <div className="content-wrap">
          <div className="page-header-row">
            <div>
              <div className="eyebrow">Good morning, {user.name.split(' ')[0]}</div>
              <h1>Here&apos;s what&apos;s happening in your library today.</h1>
            </div>
            <div className="demo-banner">DEMO MODE</div>
          </div>

          {selectedSection === 'dashboard' && (
            <>
              <div className="kpi-grid">
                {kpis.map((item) => (
                  <div key={item.label} className="stat-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.delta}</small>
                  </div>
                ))}
              </div>

              <div className="dashboard-grid">
                <section className="panel chart-panel large-panel">
                  <div className="panel-heading">
                    <h3>Daily circulation</h3>
                    <button type="button" className="link-button">This week</button>
                  </div>
                  <div className="bar-chart">
                    {trendBars.map((value, idx) => (
                      <div key={idx} className="bar-col">
                        <span className="bar" style={{ height: `${value}%` }} />
                        <small>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx]}</small>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel live-rfid-panel">
                  <div className="panel-heading">
                    <h3>Live RFID Panel</h3>
                    <span className="status-pill ok">Reader Connected</span>
                  </div>
                  <div className="scanner-box">
                    <div className="scanner-visual">
                      <div className="scanner-pulse" />
                    </div>
                    <div className="tag-label">Last scanned tag</div>
                    <strong>{rfidInput}</strong>
                    <div className="meta-grid">
                      <span>Detected</span>
                      <strong>{rfidLookup?.title || 'Clean Code'}</strong>
                      <span>Status</span>
                      <strong>{rfidLookup?.availabilityStatus || 'Available'}</strong>
                      <span>Time</span>
                      <strong>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong>
                    </div>
                  </div>
                </section>

                <section className="panel activity-panel">
                  <div className="panel-heading">
                    <h3>Today&apos;s activity</h3>
                  </div>
                  <ul className="activity-list">
                    {[
                      ['Book issued', '18 Books'],
                      ['Book returned', '13 Books'],
                      ['New member', '7 Members'],
                      ['Reservation', '9 Active'],
                      ['RFID scan', '126 Scans'],
                      ['Fine payment', '₹4,300'],
                    ].map(([label, value]) => (
                      <li key={label}><span>{label}</span><strong>{value}</strong></li>
                    ))}
                  </ul>
                </section>

                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <h3>Most borrowed categories</h3>
                    <button type="button" className="link-button">Monthly</button>
                  </div>
                  <div className="progress-list">
                    {['Computer Science', 'AI', 'Programming', 'Databases', 'Cyber Security'].map((label, idx) => (
                      <div key={label} className="progress-row">
                        <span>{label}</span>
                        <div className="progress-track"><b style={{ width: `${categoryUsage[idx] * 2}%` }} /></div>
                        <strong>{categoryUsage[idx]}%</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <h3>Weekly issue/return trend</h3>
                  </div>
                  <div className="line-chart">
                    {issueTrend.map((value, idx) => (
                      <div key={idx} className="line-dot" style={{ left: `${(idx / (issueTrend.length - 1)) * 100}%`, bottom: `${value}%` }} />
                    ))}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <h3>Quick actions</h3>
                  </div>
                  <div className="quick-action-grid">
                    {['Register Book', 'RFID Scan', 'Issue Book', 'Return Book', 'Add Member', 'Reservation'].map((action) => (
                      <button type="button" key={action} className="quick-action-button" onClick={() => setSelectedSection(action === 'Register Book' ? 'register' : action === 'RFID Scan' ? 'rfid' : action === 'Issue Book' ? 'circulation' : action === 'Return Book' ? 'circulation' : action === 'Add Member' ? 'members' : 'reservations')}>
                        {action}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}

          {selectedSection === 'register' && (
            <section className="panel register-panel">
              <div className="panel-heading">
                <h3>Register New Book</h3>
                <div className="inline-actions">
                  <span className="status-pill ok">Step 1 of 4</span>
                </div>
              </div>

              <div className="register-steps">
                <div className="step-pill active">Book Information</div>
                <div className="step-pill">RFID Assignment</div>
                <div className="step-pill">Library Location</div>
                <div className="step-pill">Review & Submit</div>
              </div>

              <form className="register-form" onSubmit={handleRegisterBook}>
                <div className="field-grid two-col">
                  <label>Title<input value={newBookForm.title} onChange={(event) => setNewBookForm({ ...newBookForm, title: event.target.value })} /></label>
                  <label>Subtitle<input value={newBookForm.subtitle} onChange={(event) => setNewBookForm({ ...newBookForm, subtitle: event.target.value })} /></label>
                  <label>Author<input value={newBookForm.author} onChange={(event) => setNewBookForm({ ...newBookForm, author: event.target.value })} /></label>
                  <label>Co-author<input value={newBookForm.coAuthor} onChange={(event) => setNewBookForm({ ...newBookForm, coAuthor: event.target.value })} /></label>
                  <label>ISBN<input value={newBookForm.isbn} onChange={(event) => setNewBookForm({ ...newBookForm, isbn: event.target.value })} /></label>
                  <label>Publisher<input value={newBookForm.publisher} onChange={(event) => setNewBookForm({ ...newBookForm, publisher: event.target.value })} /></label>
                  <label>Edition<input value={newBookForm.edition} onChange={(event) => setNewBookForm({ ...newBookForm, edition: event.target.value })} /></label>
                  <label>Publication year<input value={newBookForm.publicationYear} onChange={(event) => setNewBookForm({ ...newBookForm, publicationYear: event.target.value })} /></label>
                  <label>Language<input value={newBookForm.language} onChange={(event) => setNewBookForm({ ...newBookForm, language: event.target.value })} /></label>
                  <label>Pages<input value={newBookForm.pages} onChange={(event) => setNewBookForm({ ...newBookForm, pages: event.target.value })} /></label>
                  <label>Category<select value={newBookForm.category} onChange={(event) => setNewBookForm({ ...newBookForm, category: event.target.value })}><option>Software Engineering</option><option>Programming</option><option>Computer Science</option><option>Artificial Intelligence</option></select></label>
                  <label>Subcategory<input value={newBookForm.subCategory} onChange={(event) => setNewBookForm({ ...newBookForm, subCategory: event.target.value })} /></label>
                  <label>Department<select value={newBookForm.department} onChange={(event) => setNewBookForm({ ...newBookForm, department: event.target.value })}><option>Computer Science</option><option>Electronics</option><option>Mechanical</option><option>Civil</option></select></label>
                  <label>Price<input value={newBookForm.price} onChange={(event) => setNewBookForm({ ...newBookForm, price: event.target.value })} /></label>
                  <label>Acquisition date<input type="date" value={newBookForm.acquisitionDate} onChange={(event) => setNewBookForm({ ...newBookForm, acquisitionDate: event.target.value })} /></label>
                  <label>Supplier<input value={newBookForm.supplier} onChange={(event) => setNewBookForm({ ...newBookForm, supplier: event.target.value })} /></label>
                </div>

                <div className="rfid-registration-card">
                  <h4>RFID Assignment</h4>
                  <div className="rfid-readout">
                    <span>RFID ID</span>
                    <strong>{rfidAssignment}</strong>
                  </div>
                  <div className="button-group">
                    <button type="button" className="primary-button" onClick={handleSimulateRfidAssignment}>Simulate RFID Scan</button>
                    <button type="button" className="ghost-button" onClick={() => setRfidAssignment('Waiting for RFID scan...')}>Reset</button>
                  </div>
                  {rfidStatusMessage && <div className="rfid-message">{rfidStatusMessage}</div>}
                </div>

                <div className="field-grid two-col">
                  <label>Branch<input value={newBookForm.branch} onChange={(event) => setNewBookForm({ ...newBookForm, branch: event.target.value })} /></label>
                  <label>Building<input value={newBookForm.building} onChange={(event) => setNewBookForm({ ...newBookForm, building: event.target.value })} /></label>
                  <label>Floor<input value={newBookForm.floor} onChange={(event) => setNewBookForm({ ...newBookForm, floor: event.target.value })} /></label>
                  <label>Section<input value={newBookForm.section} onChange={(event) => setNewBookForm({ ...newBookForm, section: event.target.value })} /></label>
                  <label>Rack<input value={newBookForm.rack} onChange={(event) => setNewBookForm({ ...newBookForm, rack: event.target.value })} /></label>
                  <label>Shelf<input value={newBookForm.shelf} onChange={(event) => setNewBookForm({ ...newBookForm, shelf: event.target.value })} /></label>
                  <label className="full-width">Description<textarea value={newBookForm.description} onChange={(event) => setNewBookForm({ ...newBookForm, description: event.target.value })} rows="4" /></label>
                </div>

                <div className="button-row">
                  <button type="submit" className="primary-button">Submit Book</button>
                  <button type="button" className="ghost-button" onClick={() => setSelectedSection('catalog')}>Back to Catalog</button>
                </div>
              </form>
            </section>
          )}

          {selectedSection === 'catalog' && (
            <section className="panel">
              <div className="panel-heading">
                <h3>Library Catalog</h3>
                <div className="inline-actions">
                  <button type="button" className="ghost-button" onClick={() => setSelectedSection('rfid')}>RFID Scan</button>
                  <button type="button" className="primary-button" onClick={() => setSelectedSection('register')}>Add Book</button>
                </div>
              </div>

              <div className="catalog-toolbar">
                <input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search catalog..." />
                <select defaultValue="All Categories"><option>All Categories</option></select>
                <select defaultValue="All Authors"><option>All Authors</option></select>
                <select defaultValue="All Availability"><option>All Availability</option></select>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cover</th>
                      <th>Accession</th>
                      <th>Title</th>
                      <th>Author</th>
                      <th>ISBN</th>
                      <th>Category</th>
                      <th>RFID</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Due Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.slice(0, 10).map((book) => (
                      <tr key={book.id}>
                        <td><div className="mini-cover">{book.title.slice(0, 1)}</div></td>
                        <td>{book.accessionNumber}</td>
                        <td>{book.title}</td>
                        <td>{book.author}</td>
                        <td>{book.isbn}</td>
                        <td>{book.category}</td>
                        <td>{book.rfidId}</td>
                        <td>{book.location}</td>
                        <td><span className={`status-pill ${book.availabilityStatus === 'Available' ? 'ok' : 'warn'}`}>{book.availabilityStatus}</span></td>
                        <td>{book.dueDate || '—'}</td>
                        <td><button type="button" className="mini-button">View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {selectedSection === 'rfid' && (
            <section className="panel rfid-page-panel">
              <div className="panel-heading">
                <h3>RFID Operations</h3>
                <span className="status-pill ok">Simulation Mode</span>
              </div>

              <div className="rfid-layout">
                <div className="scanner-card">
                  <div className="scanner-header">
                    <div>
                      <span className="eyebrow">RFID Reader</span>
                      <h4>Connected</h4>
                    </div>
                    <div className="pulse-dot" />
                  </div>
                  <div className="rfid-visual">
                    <div className="rfid-ring" />
                    <div className="rfid-scan-line" />
                  </div>
                  <p>Place book near reader</p>
                  <label className="field-label">RFID ID</label>
                  <input
                    value={rfidInput}
                    onChange={(event) => {
                      const value = event.target.value
                      setRfidInput(value)
                      if (value.length > 8) {
                        const match = books.find((book) => book.rfidId.toLowerCase() === value.toLowerCase())
                        setRfidLookup(match || null)
                      }
                    }}
                    placeholder="RFID-IND-2026-004872"
                  />
                  <div className="button-group">
                    <button type="button" className="primary-button" onClick={() => simulateRFIDScan()}>
                      {rfidLoading ? 'Scanning...' : 'Simulate RFID Scan'}
                    </button>
                    <button type="button" className="ghost-button" onClick={() => setRfidInput('')}>Clear</button>
                  </div>
                </div>

                <div className="lookup-card">
                  <h4>Book Found ✓</h4>
                  {rfidLookup ? (
                    <>
                      <div className="lookup-grid">
                        <span>Title</span>
                        <strong>{rfidLookup.title}</strong>
                        <span>Author</span>
                        <strong>{rfidLookup.author}</strong>
                        <span>ISBN</span>
                        <strong>{rfidLookup.isbn}</strong>
                        <span>Category</span>
                        <strong>{rfidLookup.category}</strong>
                        <span>Location</span>
                        <strong>{rfidLookup.location}</strong>
                        <span>Status</span>
                        <strong>{rfidLookup.availabilityStatus}</strong>
                        <span>RFID status</span>
                        <strong>{rfidLookup.rfidStatus}</strong>
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">No matching RFID found.</div>
                  )}
                </div>
              </div>
            </section>
          )}

          {selectedSection === 'circulation' && (
            <div className="two-column-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h3>Issue / Check-out</h3>
                </div>
                <div className="field-stack">
                  <label>
                    Member
                    <select value={issueForm.memberId} onChange={(event) => setIssueForm({ ...issueForm, memberId: event.target.value })}>
                      {members.slice(0, 12).map((member) => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Book RFID
                    <input value={issueForm.rfid} onChange={(event) => setIssueForm({ ...issueForm, rfid: event.target.value })} />
                  </label>
                  <div className="validation-box">
                    <div>✓ Member active</div>
                    <div>✓ Book available</div>
                    <div>✓ No conflicting reservation</div>
                  </div>
                  <button type="button" className="primary-button" onClick={handleIssueBook}>Confirm Issue</button>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h3>Return / Check-in</h3>
                </div>
                <div className="field-stack">
                  <label>
                    Scan RFID
                    <input value={returnForm.rfid} onChange={(event) => setReturnForm({ ...returnForm, rfid: event.target.value })} />
                  </label>
                  <button type="button" className="ghost-button" onClick={handleQuickReturn}>Validate Return</button>
                  {returnResult && (
                    <div className="return-result">
                      <strong>{returnResult.bookTitle}</strong>
                      <span>Borrower: {returnResult.borrower}</span>
                      <span>Fine: {formatCurrency(returnResult.fine)}</span>
                      <span className={returnResult.overdue ? 'warning-text' : 'success-text'}>
                        {returnResult.overdue ? '⚠ Overdue' : '✓ Returned successfully'}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {selectedSection === 'members' && (
            <section className="panel">
              <div className="panel-heading">
                <h3>Member Management</h3>
              </div>
              <div className="member-grid">
                {members.slice(0, 12).map((member) => (
                  <div key={member.id} className="member-card">
                    <div className="member-avatar">{member.name.split(' ')[0][0]}</div>
                    <strong>{member.name}</strong>
                    <small>{member.department}</small>
                    <div className="small-info">
                      <span>{member.studentId}</span>
                      <span>{member.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {selectedSection === 'reservations' && (
            <section className="panel">
              <div className="panel-heading"><h3>Reservations</h3></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Book</th><th>Member</th><th>Date</th><th>Queue</th><th>Status</th></tr></thead>
                  <tbody>
                    {defaultReservations.slice(0, 10).map((item) => (
                      <tr key={item.id}><td>{item.book}</td><td>{item.member}</td><td>{item.reservedOn}</td><td>{item.queue}</td><td><span className={`status-pill ${item.status === 'Ready for Pickup' ? 'ok' : 'warn'}`}>{item.status}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {selectedSection === 'fines' && (
            <section className="panel">
              <div className="panel-heading"><h3>Fine Management</h3></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Member</th><th>Book</th><th>Due Date</th><th>Days Late</th><th>Fine</th><th>Status</th></tr></thead>
                  <tbody>
                    {defaultFines.slice(0, 10).map((item, idx) => (
                      <tr key={`${item.member}-${idx}`}>
                        <td>{item.member}</td>
                        <td>{item.book}</td>
                        <td>{item.dueDate}</td>
                        <td>{item.daysLate}</td>
                        <td>{formatCurrency(item.fine)}</td>
                        <td><span className={`status-pill ${item.status === 'Paid' ? 'ok' : 'warn'}`}>{item.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {selectedSection === 'inventory' && (
            <section className="panel">
              <div className="panel-heading"><h3>Inventory & RFID Shelf Audit</h3></div>
              <div className="kpi-grid small-grid">
                <div className="stat-card"><span>Total inventory</span><strong>12,486</strong></div>
                <div className="stat-card"><span>Available</span><strong>8,742</strong></div>
                <div className="stat-card"><span>Issued</span><strong>3,218</strong></div>
                <div className="stat-card"><span>Missing</span><strong>92</strong></div>
              </div>
            </section>
          )}

          {selectedSection === 'acquisitions' && (
            <section className="panel">
              <div className="panel-heading"><h3>Acquisitions</h3></div>
              <div className="kpi-grid small-grid">
                <div className="stat-card"><span>Annual budget</span><strong>₹45L</strong></div>
                <div className="stat-card"><span>Spent</span><strong>₹27L</strong></div>
                <div className="stat-card"><span>Remaining</span><strong>₹18L</strong></div>
                <div className="stat-card"><span>Pending orders</span><strong>31</strong></div>
              </div>
            </section>
          )}

          {selectedSection === 'reports' && (
            <section className="panel">
              <div className="panel-heading"><h3>Reports</h3></div>
              <div className="report-grid">
                {['Collection report', 'Circulation report', 'Issue report', 'Return report', 'Overdue report', 'Fine report', 'Member activity', 'Popular books'].map((report) => (
                  <div key={report} className="report-tile">{report}</div>
                ))}
              </div>
            </section>
          )}

          {selectedSection === 'analytics' && (
            <section className="panel">
              <div className="panel-heading"><h3>Analytics</h3></div>
              <div className="report-grid">
                {['Books issued per day', 'Monthly circulation', 'Department usage', 'Fine collection', 'RFID scans'].map((metric) => (
                  <div key={metric} className="report-tile">{metric}</div>
                ))}
              </div>
            </section>
          )}

          {selectedSection === 'settings' && (
            <section className="panel settings-panel">
              <div className="panel-heading"><h3>Settings</h3></div>
              <div className="settings-grid">
                <div className="setting-block">
                  <h4>Library Information</h4>
                  <div className="field-stack compact">
                    <label>Library name<input defaultValue={libraryName} /></label>
                    <label>Branch name<input defaultValue="Central Library" /></label>
                  </div>
                </div>
                <div className="setting-block">
                  <h4>RFID Configuration</h4>
                  <div className="field-stack compact">
                    <label>Reader name<input defaultValue="Reader 01" /></label>
                    <label>Connection status<select defaultValue="Connected"><option>Connected</option><option>Idle</option><option>Offline</option></select></label>
                    <label>Simulation mode<input defaultValue="Enabled" /></label>
                  </div>
                </div>
              </div>
            </section>
          )}

          {newBookSuccess && (
            <div className="success-modal">
              <div className="modal-card">
                <h3>Book Registered Successfully</h3>
                <ul>
                  <li>Book ID: {newBookSuccess.id}</li>
                  <li>Accession Number: {newBookSuccess.accessionNumber}</li>
                  <li>RFID ID: {newBookSuccess.rfid}</li>
                  <li>Title: {newBookSuccess.title}</li>
                  <li>Shelf: {newBookSuccess.shelf}</li>
                </ul>
                <div className="button-group">
                  <button type="button" className="primary-button" onClick={() => setSelectedSection('catalog')}>Go to Catalog</button>
                  <button type="button" className="ghost-button" onClick={() => setNewBookSuccess(null)}>Register Another</button>
                </div>
              </div>
            </div>
          )}

          {demoPanelOpen && (
            <div className="bottom-demo-panel">
              <div className="mini-panel">
                <span className="eyebrow">RFID Device Status</span>
                <strong>{defaultDevices[0].name}</strong>
                <small>Connected · Strong signal</small>
              </div>
              <div className="mini-panel">
                <span className="eyebrow">Pending Alerts</span>
                <strong>{overdueCount} overdue</strong>
                <small>{membersWithFines} members with fines</small>
              </div>
              <div className="mini-panel">
                <span className="eyebrow">Circulation</span>
                <strong>{activeBookCount} available</strong>
                <small>{reservationsCount} reservations active</small>
              </div>
              <button type="button" className="ghost-button" onClick={() => setDemoPanelOpen(false)}>Hide</button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
