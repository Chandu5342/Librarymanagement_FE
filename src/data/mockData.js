const categories = [
  'Computer Science', 'Artificial Intelligence', 'Machine Learning', 'Data Science',
  'Programming', 'Web Development', 'Databases', 'Networks', 'Operating Systems',
  'Computer Architecture', 'Cyber Security', 'Cloud Computing', 'Software Engineering',
  'Mathematics', 'Physics', 'Electronics', 'Mechanical', 'Civil', 'Electrical',
  'Management', 'Aptitude', 'Competitive Exams', 'General Knowledge', 'Literature',
]
const authors = [
  'Robert C. Martin', 'Andrew Ng', 'Jane Austen', 'Katherine Johnson', 'Eric Ries',
  'Peter Norvig', 'David Flanagan', 'Aditya Bhargava', 'Amitav Ghosh', 'C. J. Date',
  'William Stallings', 'A. S. Tanenbaum', 'Bjarne Stroustrup', 'Michael Goodrich',
  'H. G. Wells', 'Martin Kleppmann', 'Ian Goodfellow', 'S. K. Sinha', 'R. K. Jain',
  'N. K. Singh',
]
const titles = [
  'Clean Code', 'Deep Learning with Python', 'Introduction to Algorithms',
  'The Design of Everyday Things', 'Computer Networking: A Top-Down Approach',
  'Database System Concepts', 'Operating System Concepts', 'Artificial Intelligence: A Modern Approach',
  'The Pragmatic Programmer', 'Learning Python', 'Design Patterns', 'Refactoring',
  'The C Programming Language', 'Structure and Interpretation of Computer Programs',
  'Data Science from Scratch', 'Hands-On Machine Learning', 'Computer Architecture',
  'Engineering Mathematics', 'Principles of Management', 'The Great Gatsby',
  'Physics for Scientists and Engineers', 'Fundamentals of Electric Circuits',
  'Introduction to Information Security', 'Cloud Native Patterns', 'Web Development with React',
  'Discrete Mathematics and Its Applications', 'The Lean Startup', 'Mechanical Engineering Design',
  'Surveying and Levelling', 'Indian Economy', 'Quantitative Aptitude',
]
const publishers = ['Pearson', 'McGraw Hill', 'Oxford University Press', 'Prentice Hall', 'Wiley', 'MIT Press', 'Springer', 'O’Reilly']
const departments = ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Electrical', 'Management', 'Mathematics', 'Physics']
const names = ['Ananya Sharma', 'Kabir Patel', 'Meera Reddy', 'Aarav Nair', 'Ishita Iyer', 'Rohan Singh', 'Saanvi Khan', 'Vikram Banerjee', 'Neha Gupta', 'Aditya Malhotra', 'Tanya Verma', 'Arjun Kapoor', 'Disha Das', 'Rajat Mishra', 'Pooja Joshi', 'Varun Rao', 'Riya Bhatt', 'Karan Kulkarni', 'Sneha Chawla', 'Yash Srinivasan']
const locations = ['CS / Software Engineering / A-12', 'CS / Networks / B-08', 'AI / Machine Learning / C-03', 'DB / Databases / D-15', 'Networks / Security / E-02', 'Maths / Reference / H-09']
const dateOffset = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

export const createInitialBooks = () => Array.from({ length: 120 }, (_, index) => {
  const id = index + 1
  const title = titles[index % titles.length]
  const status = index % 11 === 0 ? 'Issued' : index % 29 === 0 ? 'Lost' : index % 23 === 0 ? 'Damaged' : 'Available'
  const category = categories[index % categories.length]
  return {
    id: `BK-${String(id).padStart(4, '0')}`,
    accessionNumber: `ACC-${String(id + 900).padStart(6, '0')}`,
    bookCode: `B${String(id).padStart(5, '0')}`,
    title: index < titles.length ? title : `${['Modern', 'Applied', 'Practical', 'Advanced', 'Fundamentals of'][index % 5]} ${titles[(index * 7) % titles.length]}`,
    subtitle: 'Academic reference and guided practice',
    author: authors[index % authors.length],
    coAuthors: [authors[index % authors.length]],
    isbn: `978${String(1000000000 + index).slice(0, 10)}`,
    publisher: publishers[index % publishers.length],
    publicationYear: 2018 + (index % 8),
    edition: 1 + (index % 5),
    language: 'English',
    category,
    subCategory: category,
    department: departments[index % departments.length],
    pages: 240 + (index * 13 % 320),
    format: index % 2 ? 'Paperback' : 'Hardcover',
    description: 'A well-regarded academic title for classroom study, practical work, and independent learning.',
    coverImage: '',
    rfidId: `RFID-IND-2026-${String(index + 1).padStart(6, '0')}`,
    rfidStatus: 'Active',
    availabilityStatus: status,
    condition: status === 'Damaged' ? 'Damaged' : status === 'Lost' ? 'Lost' : 'Good',
    shelf: `A-${String(index % 18 + 1).padStart(2, '0')}`,
    rack: `Rack ${String.fromCharCode(65 + index % 6)}`,
    floor: `Floor ${2 + index % 3}`,
    location: locations[index % locations.length],
    totalCopies: 1,
    availableCopies: status === 'Available' ? 1 : 0,
    issuedCopies: status === 'Issued' ? 1 : 0,
    reservedCopies: 0,
    price: 350 + index * 27,
    acquisitionDate: '2024-01-15',
    borrowerId: status === 'Issued' ? `M-${1000 + index % 60}` : null,
    dueDate: status === 'Issued' ? dateOffset(index % 9 - 3) : null,
    tags: [category.toLowerCase(), 'rfid'],
    createdAt: dateOffset(-((120 - id) % 180)),
    archived: false,
  }
})

export const createInitialMembers = () => Array.from({ length: 60 }, (_, index) => {
  const name = names[index % names.length]
  const [first, last] = name.toLowerCase().split(' ')
  return {
    id: `M-${1000 + index}`,
    studentId: `2024${departments[index % departments.length].slice(0, 2).toUpperCase()}${String(index + 1).padStart(3, '0')}`,
    libraryId: `LIB-${String(index + 1001).padStart(4, '0')}`,
    name,
    email: `${first}.${last}@northbridge.edu`,
    phone: `+91 98${String(1000000 + index).slice(0, 7)}`,
    department: departments[index % departments.length],
    program: index % 2 ? 'M.Tech' : 'B.Tech',
    year: 1 + index % 4,
    section: `A-${index % 5 + 1}`,
    memberType: index % 5 === 0 ? 'Faculty' : 'Student',
    joinDate: '2024-08-10',
    status: index % 17 === 0 ? 'Blocked' : 'Active',
    borrowedBooks: 0,
    overdueBooks: 0,
    fineAmount: 0,
    rfidCardId: `CARD-${String(2000 + index).padStart(6, '0')}`,
    profileImage: '',
    createdAt: dateOffset(-((60 - index) % 100)),
    archived: false,
  }
})

export const createInitialState = () => {
  const books = createInitialBooks()
  const members = createInitialMembers()
  const transactions = books.filter((book) => book.availabilityStatus === 'Issued').map((book, index) => ({
    id: `TR-${String(index + 1).padStart(4, '0')}`,
    bookId: book.id,
    bookTitle: book.title,
    memberId: book.borrowerId,
    memberName: members.find((member) => member.id === book.borrowerId)?.name || members[0].name,
    rfidId: book.rfidId,
    issueDate: dateOffset(-14),
    dueDate: book.dueDate,
    returnedDate: null,
    status: 'Issued',
    fine: 0,
    renewalCount: 0,
    createdAt: dateOffset(-14),
  }))
  books.filter((book) => book.availabilityStatus === 'Issued').forEach((book) => {
    const member = members.find((item) => item.id === book.borrowerId)
    if (member) member.borrowedBooks += 1
  })
  for (let index = 0; index < 42; index += 1) {
    const book = books[(index * 7) % books.length]
    const member = members[(index * 11) % members.length]
    transactions.push({
      id: `TR-${String(transactions.length + 1).padStart(4, '0')}`,
      bookId: book.id,
      bookTitle: book.title,
      memberId: member.id,
      memberName: member.name,
      rfidId: book.rfidId,
      issueDate: dateOffset(-30 - index),
      dueDate: dateOffset(-16 - index),
      returnedDate: dateOffset(-12 - index),
      status: 'Returned',
      fine: index % 5 === 0 ? 50 : 0,
      renewalCount: index % 3,
      createdAt: dateOffset(-30 - index),
    })
  }
  const holdableBooks = books.filter((item) => item.availabilityStatus === 'Available')
  const reservations = Array.from({ length: 25 }, (_, index) => {
    const book = holdableBooks[(index * 3 + 2) % holdableBooks.length]
    const member = members[(index * 7 + 1) % members.length]
    return {
      id: `RES-${String(index + 1).padStart(4, '0')}`,
      bookId: book.id,
      bookTitle: book.title,
      memberId: member.id,
      memberName: member.name,
      createdAt: dateOffset(-index - 1),
      queuePosition: 1,
      status: ['PENDING', 'READY_FOR_PICKUP', 'FULFILLED', 'EXPIRED', 'CANCELLED'][index % 5],
      expiresAt: dateOffset(5),
    }
  })
  reservations.filter((item) => ['PENDING', 'READY_FOR_PICKUP'].includes(item.status)).forEach((reservation) => {
    const book = books.find((item) => item.id === reservation.bookId)
    if (!book) return
    book.reservedCopies += 1
    if (reservation.status === 'READY_FOR_PICKUP') {
      book.availabilityStatus = 'Reserved'
      book.availableCopies = 0
    }
  })
  const returnedTransactions = transactions.filter((item) => item.status === 'Returned')
  const fines = Array.from({ length: 30 }, (_, index) => {
    const transaction = returnedTransactions[index % returnedTransactions.length]
    const amount = 30 + index % 10 * 10
    transaction.fine = amount
    return {
      id: `FINE-${String(index + 1).padStart(4, '0')}`,
      transactionId: transaction.id,
      memberId: transaction.memberId,
      memberName: transaction.memberName,
      bookId: transaction.bookId,
      bookTitle: transaction.bookTitle,
      dueDate: transaction.dueDate,
      returnedDate: transaction.returnedDate,
      daysLate: 3 + index % 10,
      amount,
      status: index % 2 ? 'PAID' : 'PENDING',
      createdAt: transaction.createdAt,
    }
  })
  members.forEach((member) => {
    member.fineAmount = fines.filter((fine) => fine.memberId === member.id && fine.status === 'PENDING').reduce((total, fine) => total + fine.amount, 0)
  })
  const now = new Date().toISOString()
  return {
    books, members, transactions, reservations, fines,
    users: [
      { id: 'U-001', name: 'Aditi Verma', role: 'ADMIN', email: 'admin@northbridge.edu', department: 'Administration' },
      { id: 'U-002', name: 'Nisha Rao', role: 'LIBRARIAN', email: 'librarian@northbridge.edu', department: 'Library Services' },
      { id: 'U-003', name: 'Sanjay Das', role: 'ASSISTANT_LIBRARIAN', email: 'assistant@northbridge.edu', department: 'Library Services' },
      { id: 'U-004', name: 'Dr. Kavita Menon', role: 'FACULTY', email: 'faculty@northbridge.edu', department: 'Computer Science' },
      { id: 'U-005', name: 'Rahul Mehta', role: 'STUDENT', email: 'student@northbridge.edu', department: 'Computer Science', memberId: 'M-1001' },
    ],
    rfidLogs: Array.from({ length: 20 }, (_, index) => ({
      id: `RFLOG-${index + 1}`, rfidId: books[index].rfidId, bookId: books[index].id,
      bookTitle: books[index].title, event: 'LOOKUP', result: 'SUCCESS',
      device: 'Reader 01', user: 'Nisha Rao', location: 'Main Desk',
      timestamp: dateOffset(-index),
    })),
    rfidDevices: Array.from({ length: 10 }, (_, index) => ({
      id: `RDR-${String(index + 1).padStart(2, '0')}`,
      name: ['Reader 01', 'Reader 02', 'Self Checkout 01', 'Shelf Scanner 01', 'Return Station 01', 'Reader 06', 'Shelf Scanner 02', 'Security Gate 01', 'Self Checkout 02', 'Mobile Scanner'][index],
      status: ['CONNECTED', 'IDLE', 'CONNECTED', 'SCANNING', 'OFFLINE'][index % 5],
      signal: index % 3 === 0 ? 'Strong' : 'Moderate', location: ['Main Desk', 'Self Service', 'Ground Floor', 'CS Stack', 'Front Desk'][index % 5],
      firmware: 'v3.4.1', totalScans: 120 + index * 53, lastHeartbeat: now,
    })),
    notifications: Array.from({ length: 20 }, (_, index) => ({
      id: `NOT-${index + 1}`, title: [
        '3 books are overdue.', `${books[index].rfidId} was scanned.`,
        'Reservation ready for pickup.', 'New acquisition received.',
        'RFID Reader 02 is offline.', 'Book successfully returned.',
      ][index % 6],
      category: ['Overdue', 'RFID', 'Reservation', 'Acquisition', 'Device', 'Circulation'][index % 6],
      entityId: books[index].id, read: index > 5, createdAt: dateOffset(-index),
    })),
    acquisitions: Array.from({ length: 20 }, (_, index) => ({
      id: `PO-${String(index + 1).padStart(4, '0')}`,
      vendor: ['Academic House', 'Scholars Supply Co.', 'Campus Books Ltd.'][index % 3],
      title: titles[index % titles.length], isbn: `978${String(1000000000 + index).slice(0, 10)}`,
      quantity: 2 + index % 9, receivedQuantity: 0,
      unitPrice: 450 + index * 15, total: (2 + index % 9) * (450 + index * 15),
      orderDate: dateOffset(-index * 2), expectedDate: dateOffset(14 + index),
      status: index % 2 ? 'ORDERED' : 'REQUESTED',
      createdAt: dateOffset(-index * 2),
    })),
    auditLogs: Array.from({ length: 20 }, (_, index) => ({
      id: `AUD-SEED-${index + 1}`,
      action: ['BOOK_CREATED', 'RFID_SCANNED', 'BOOK_ISSUED', 'BOOK_RETURNED', 'MEMBER_CREATED'][index % 5],
      description: [
        `Catalog record verified: ${books[index].title}.`,
        `RFID scan recorded for ${books[index].rfidId}.`,
        `Circulation activity recorded for ${books[index].title}.`,
        `Return history reconciled for ${books[index].title}.`,
        `Member record reviewed: ${members[index].name}.`,
      ][index % 5],
      entity: index % 5 === 4 ? 'member' : 'book',
      entityId: index % 5 === 4 ? members[index].id : books[index].id,
      user: ['Nisha Rao', 'Sanjay Das', 'Aditi Verma'][index % 3],
      timestamp: dateOffset(-index),
    })),
    inventoryAudits: [],
    settings: {
      libraryName: 'Northbridge University Library',
      branch: 'Central Library',
      loanPeriodDays: 14,
      finePerDay: 10,
      borrowingLimit: 5,
      blockingFineAmount: 500,
      renewalLimit: 2,
      autoLookup: true,
      autoFocus: true,
      duplicateScanPrevention: true,
      simulationMode: true,
    },
    lastRFIDScan: null,
  }
}

export { categories, departments }
