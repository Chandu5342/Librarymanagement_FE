export const categories = [
  'Network Analysis', 'Digital Electronics', 'Analog Electronics', 'C Programming',
  'Microprocessors & Microcontrollers', 'Computer Science', 'Artificial Intelligence',
  'Machine Learning', 'Data Science', 'Programming', 'Web Development', 'Databases',
  'Networks', 'Operating Systems', 'Computer Architecture', 'Cyber Security',
  'Cloud Computing', 'Software Engineering', 'Mathematics', 'Physics', 'Electronics',
  'Mechanical', 'Civil', 'Electrical', 'Management', 'Aptitude', 'Competitive Exams',
  'General Knowledge', 'Literature',
]

export const departments = ['ECE', 'CSE', 'Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Electrical', 'Management', 'Mathematics', 'Physics']

const now = () => new Date().toISOString()

const initialBookRecords = [
  ['Network Analysis', 'ECE', 'Engineering Circuit Analysis', 'William H. Hayt Jr., Jack E. Kemmerly & Steven M. Durbin', 2012, '8th Edition', '60 C0 3E 3B'],
  ['Network Analysis', 'ECE', 'Network Analysis', 'M. E. Van Valkenburg', 1974, '3rd Edition', '4D A1 DE 6B'],
  ['Digital Electronics', 'ECE', 'Digital Electronics: Principles and Applications', 'Roger L. Tokheim', 2013, '8th Edition', 'C3 FA 00 1D'],
  ['Digital Electronics', 'ECE', 'Digital Logic and Computer Design', 'M. Morris Mano', 1979, '1st Edition', '14 D4 71 A9'],
  ['Analog Electronics', 'ECE', 'Electronic Devices and Circuit Theory', 'Robert L. Boylestad & Louis Nashelsky', 2013, '11th Edition', 'A3 17 01 1D'],
  ['Analog Electronics', 'ECE', 'Fundamentals of Microelectronics', 'Behzad Razavi', 2014, '2nd Edition', '32 D3 EF 06'],
  ['C Programming', 'CSE', 'Programming in ANSI C', 'E. Balagurusamy', 2019, '8th Edition', 'FB 08 CC 19'],
  ['C Programming', 'CSE', 'Let Us C: Authentic Guide to C Programming Language', 'Yashavant Kanetkar', 2020, '17th Edition', 'F0 D4 44 3B'],
  ['Microprocessors & Microcontrollers', 'CSE', 'Microprocessor Architecture, Programming, and Applications with the 8085', 'Ramesh S. Gaonkar', 2002, '5th Edition', '33 D0 00 1D'],
  ['Microprocessors & Microcontrollers', 'CSE', 'The 8051 Microcontroller and Embedded Systems', 'Muhammad Ali Mazidi, Janice G. Mazidi & Rolin D. McKinlay', 2014, '2nd Edition', 'E4 63 13 A9'],
]

const initialMemberRecords = [
  ['Ganireddy Pujeetha', '23L31A0414', '95 92 4F 06'],
  ['Gogireddy Haswanth', '23L31A0450', '8D E1 66 06'],
  ['Desavath Abhishek', '24L35A0403', '94 0C A5 A9'],
  ['Geddavalasa Vivek', '23L31A0449', '64 D9 5B A9'],
]

export const createInitialBooks = () => initialBookRecords.map(([category, department, title, author, publicationYear, edition, rfidUid], index) => {
  const bookId = `COPY-${String(index + 1).padStart(5, '0')}`
  const categoryIndex = initialBookRecords.findIndex((record) => record[0] === category)
  const timestamp = now()
  return {
    id: bookId,
    bookId,
    copyId: bookId,
    titleGroupId: `TITLE-${String(index + 1).padStart(5, '0')}`,
    copyNumber: 1,
    accessionNumber: `ACC-${String(index + 1).padStart(5, '0')}`,
    bookCode: `B${String(index + 1).padStart(5, '0')}`,
    category,
    categoryId: `CAT-${String(categoryIndex + 1).padStart(3, '0')}`,
    department,
    title,
    author,
    authors: author,
    coAuthors: [],
    isbn: '',
    publisher: '',
    publicationYear,
    edition,
    language: '',
    pages: 0,
    description: '',
    rfidId: rfidUid,
    rfidUid,
    rfidStatus: 'Active',
    availabilityStatus: 'Available',
    status: 'Available',
    condition: 'Good',
    branch: 'Central Library',
    workingHours: '08:00-20:00',
    floor: '',
    section: '',
    rack: '',
    shelf: '',
    location: 'Central Library',
    quantity: 1,
    totalCopies: 1,
    availableQuantity: 1,
    availableCopies: 1,
    issuedCopies: 0,
    reservedCopies: 0,
    lostCopies: 0,
    damagedCopies: 0,
    borrowerId: null,
    currentHolderId: null,
    dueDate: null,
    tags: [category.toLowerCase(), department.toLowerCase()],
    createdAt: timestamp,
    updatedAt: timestamp,
    archived: false,
  }
})

export const createInitialMembers = () => initialMemberRecords.map(([name, studentId, rfidCardId], index) => {
  const id = `MEM-${String(index + 1).padStart(5, '0')}`
  const timestamp = now()
  return {
    id,
    memberId: id,
    studentId,
    registrationNumber: studentId,
    registerNumber: studentId,
    libraryId: `LIB-${String(index + 1).padStart(5, '0')}`,
    name,
    email: `${studentId.toLowerCase()}@library.edu`,
    phone: `900000${String(index + 1).padStart(4, '0')}`,
    rfidCardId,
    rfidUid: rfidCardId,
    department: 'ECE',
    program: 'B.Tech Electronics and Communication Engineering',
    year: '4th Year',
    section: 'A',
    memberType: 'Student',
    status: 'Active',
    address: '',
    profileImage: '',
    joinDate: '',
    registrationDate: timestamp.slice(0, 10),
    membershipExpiry: '',
    booksIssued: 0,
    booksReturned: 0,
    borrowedBooks: 0,
    currentBooks: [],
    overdueBooks: 0,
    history: [],
    fineAmount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    archived: false,
  }
})

export const createInitialState = () => {
  const books = createInitialBooks()
  const members = createInitialMembers()
  return {
    books,
    members,
    transactions: [],
    reservations: [],
    fines: [],
    users: [
      { id: 'U-001', name: 'Aditi Verma', role: 'ADMIN', email: 'admin@northbridge.edu', department: 'Administration' },
      { id: 'U-002', name: 'Nisha Rao', role: 'LIBRARIAN', email: 'librarian@northbridge.edu', department: 'Library Services' },
      { id: 'U-003', name: 'Sanjay Das', role: 'ASSISTANT_LIBRARIAN', email: 'assistant@northbridge.edu', department: 'Library Services' },
      { id: 'U-004', name: 'Faculty Demo', role: 'FACULTY', email: 'faculty@northbridge.edu', department: 'ECE' },
      { id: 'U-005', name: members[0].name, role: 'STUDENT', email: '', memberId: members[0].id },
    ],
    rfidLogs: [],
    rfidDevices: [{
      id: 'RDR-01', name: 'Simulation Reader', status: 'SIMULATION',
      signal: '—', location: 'Central Library', firmware: '—', totalScans: 0, lastHeartbeat: now(),
    }],
    notifications: [],
    acquisitions: [],
    suppliers: [],
    auditLogs: [],
    inventoryAudits: [],
    settings: {
      libraryName: 'Library Management System',
      branch: 'Central Library',
      loanPeriodDays: 14,
      finePerDay: 5,
      borrowingLimit: 5,
      memberTypeRules: {
        Student: { borrowingLimit: 5, loanPeriodDays: 14 },
        Faculty: { borrowingLimit: 10, loanPeriodDays: 30 },
        Staff: { borrowingLimit: 5, loanPeriodDays: 21 },
      },
      blockingFineAmount: 500,
      blockBorrowingWithUnpaidFines: true,
      blockBorrowingWithOverdueBooks: false,
      renewalLimit: 2,
      pickupWindowDays: 2,
      maximumActiveReservations: 5,
      allowRenewalWithReservations: false,
      autoLookup: true,
      autoFocus: true,
      duplicateScanPrevention: true,
      simulationMode: true,
    },
    currentUser: null,
    lastRFIDScan: null,
  }
}
