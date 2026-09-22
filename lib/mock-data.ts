import type {
  Campaign,
  LedgerEntry,
  ServiceCatalogueItem,
  Ticket,
  Vendor,
  VendorRate,
} from "@/lib/types"

export const ledgerEntries: LedgerEntry[] = [
  {
    id: "LE-9001",
    clientId: "CL-2003",
    date: "2026-08-01",
    type: "Opening Balance",
    reference: "OPEN-2003",
    description: "Opening balance carried forward",
    debit: 65000,
    credit: null,
    runningBalance: 65000,
    status: "Posted",
  },
  {
    id: "LE-9002",
    clientId: "CL-2003",
    date: "2026-08-06",
    type: "Charge",
    reference: "CMP-5510",
    description: "SMS campaign — Festive Promo Blast",
    debit: 38500,
    credit: null,
    runningBalance: 103500,
    status: "Posted",
  },
  {
    id: "LE-9003",
    clientId: "CL-2003",
    date: "2026-08-12",
    type: "Receipt",
    reference: "RCT-7712",
    description: "NEFT — HDFC Bank",
    debit: null,
    credit: 40000,
    runningBalance: 63500,
    status: "Posted",
  },
  {
    id: "LE-9004",
    clientId: "CL-2003",
    date: "2026-08-20",
    type: "Charge",
    reference: "CMP-5522",
    description: "WhatsApp API — Appointment Reminders",
    debit: 52400,
    credit: null,
    runningBalance: 115900,
    status: "Posted",
  },
  {
    id: "LE-9005",
    clientId: "CL-2003",
    date: "2026-08-29",
    type: "Receipt",
    reference: "RCT-7745",
    description: "UPI — GPay",
    debit: null,
    credit: 22500,
    runningBalance: 93400,
    status: "Posted",
  },
  {
    id: "LE-9006",
    clientId: "CL-2003",
    date: "2026-09-02",
    type: "Charge",
    reference: "RENT-CL2003-0902",
    description: "IVR monthly rental — September",
    debit: 25000,
    credit: null,
    runningBalance: 118400,
    status: "Posted",
  },
  {
    id: "LE-9007",
    clientId: "CL-2003",
    date: "2026-09-11",
    type: "Receipt",
    reference: "RCT-PEND-08",
    description: "Cheque submitted — pending owner acceptance",
    debit: null,
    credit: 30000,
    runningBalance: 118400,
    status: "Pending",
  },
]

export const campaigns: Campaign[] = [
  {
    id: "CMP-5510",
    requestId: "REQ-3301",
    client: "Orchid Clinics",
    service: "SMS",
    vendor: "Kridha Communications",
    panel: "Trans-Panel-A",
    quantity: 50000,
    unit: "SMS",
    sellingRate: 0.18,
    agreedAmount: 9000,
    salesperson: "Neha Kulkarni",
    status: "Completed",
    scheduledFor: "2026-08-06",
    submittedDelivered: "49,820 / 48,110",
    costStatus: "Configured",
  },
  {
    id: "CMP-5522",
    requestId: "REQ-3318",
    client: "Orchid Clinics",
    service: "WhatsApp API",
    vendor: "NimbusReach",
    panel: "WA-Business-02",
    quantity: 12000,
    unit: "Messages",
    sellingRate: 0.55,
    agreedAmount: 6600,
    salesperson: "Neha Kulkarni",
    status: "Running",
    scheduledFor: "2026-08-20",
    submittedDelivered: "8,240 / 7,910",
    costStatus: "Configured",
  },
  {
    id: "CMP-5531",
    requestId: "REQ-3327",
    client: "Coastal Hospitality",
    service: "Voice/OBD",
    vendor: "Kridha Communications",
    panel: "Voice-Panel-C",
    quantity: 20000,
    unit: "Calls",
    sellingRate: 0.32,
    agreedAmount: 6400,
    salesperson: "Rohit Malhotra",
    status: "Queued",
    scheduledFor: "2026-09-14",
    costStatus: "Configured",
  },
  {
    id: "CMP-5536",
    requestId: "REQ-3332",
    client: "Harbor Freight Co.",
    service: "SMS",
    vendor: "Unassigned",
    panel: "—",
    quantity: 15000,
    unit: "SMS",
    sellingRate: 0.2,
    agreedAmount: 3000,
    salesperson: "Rohit Malhotra",
    status: "Submitted",
    scheduledFor: "2026-09-16",
    costStatus: "Incomplete Costing",
  },
  {
    id: "CMP-5538",
    requestId: "REQ-3334",
    client: "Meridian Autoparts",
    service: "RCS",
    vendor: "NimbusReach",
    panel: "RCS-Agent-01",
    quantity: 8000,
    unit: "Messages",
    sellingRate: 0.4,
    agreedAmount: 3200,
    salesperson: "Neha Kulkarni",
    status: "Draft",
    scheduledFor: "2026-09-20",
    costStatus: "Incomplete Costing",
  },
  {
    id: "CMP-5490",
    requestId: "REQ-3280",
    client: "Zenith Edu Services",
    service: "IVR",
    vendor: "Kridha Communications",
    panel: "IVR-Flow-7",
    quantity: 1,
    unit: "Setup",
    sellingRate: 4000,
    agreedAmount: 4000,
    salesperson: "Rohit Malhotra",
    status: "Failed",
    scheduledFor: "2026-07-28",
    submittedDelivered: "Provider error — retry required",
    costStatus: "Configured",
  },
]

export const vendors: Vendor[] = [
  {
    id: "VN-101",
    name: "Kridha Communications",
    services: ["SMS", "Voice/OBD", "IVR"],
    panels: ["Trans-Panel-A", "Voice-Panel-C", "IVR-Flow-7"],
    activeStatus: "Active",
    balance: 128400,
    balanceType: "Advance",
    lastTransaction: "2026-09-09",
  },
  {
    id: "VN-102",
    name: "NimbusReach",
    services: ["WhatsApp API", "RCS"],
    panels: ["WA-Business-02", "RCS-Agent-01"],
    activeStatus: "Active",
    balance: 34200,
    balanceType: "Payable",
    lastTransaction: "2026-09-05",
  },
  {
    id: "VN-103",
    name: "Skyline Telecoms",
    services: ["SMS"],
    panels: ["Promo-Panel-B"],
    activeStatus: "Active",
    balance: 6100,
    balanceType: "Advance",
    lastTransaction: "2026-08-30",
  },
  {
    id: "VN-104",
    name: "Vertex Messaging",
    services: ["RCS"],
    panels: [],
    activeStatus: "Inactive",
    balance: 0,
    balanceType: "Payable",
    lastTransaction: null,
  },
]

export const vendorRates: VendorRate[] = [
  {
    id: "RT-01",
    vendorId: "VN-101",
    service: "SMS",
    panel: "Trans-Panel-A",
    component: "Submission",
    rate: 0.11,
    currency: "INR",
    effectiveFrom: "2026-07-01",
    status: "Configured",
  },
  {
    id: "RT-02",
    vendorId: "VN-101",
    service: "SMS",
    panel: "Trans-Panel-A",
    component: "Delivery",
    rate: 0.03,
    currency: "INR",
    effectiveFrom: "2026-07-01",
    status: "Configured",
  },
  {
    id: "RT-03",
    vendorId: "VN-102",
    service: "WhatsApp API",
    panel: "WA-Business-02",
    component: "Delivery",
    rate: 0.32,
    currency: "INR",
    effectiveFrom: "2026-06-15",
    status: "Configured",
  },
  {
    id: "RT-04",
    vendorId: "VN-102",
    service: "RCS",
    panel: "RCS-Agent-01",
    component: "Delivery",
    rate: null,
    currency: "INR",
    effectiveFrom: "2026-09-01",
    status: "Not configured",
  },
  {
    id: "RT-05",
    vendorId: "VN-103",
    service: "SMS",
    panel: "Promo-Panel-B",
    component: "Submission",
    rate: 0.1,
    currency: "INR",
    effectiveFrom: "2026-05-01",
    status: "Configured",
  },
]

export const tickets: Ticket[] = [
  {
    id: "TCK-441",
    client: "Orchid Clinics",
    service: "WhatsApp API",
    issueType: "Template rejected",
    priority: "High",
    status: "In Progress",
    assignee: "Devansh Patil",
    dueDate: "2026-09-13",
    updatedAt: "2026-09-11",
  },
  {
    id: "TCK-439",
    client: "Coastal Hospitality",
    service: "Voice/OBD",
    issueType: "DLT header pending",
    priority: "Medium",
    status: "Awaiting Client",
    assignee: "Devansh Patil",
    dueDate: "2026-09-15",
    updatedAt: "2026-09-10",
  },
  {
    id: "TCK-436",
    client: "Meridian Autoparts",
    service: "RCS",
    issueType: "Brand approval",
    priority: "Low",
    status: "Open",
    assignee: "Unassigned",
    dueDate: "2026-09-18",
    updatedAt: "2026-09-09",
  },
  {
    id: "TCK-430",
    client: "Harbor Freight Co.",
    service: "SMS",
    issueType: "Sender ID mismatch",
    priority: "Urgent",
    status: "Resolved",
    assignee: "Devansh Patil",
    dueDate: "2026-09-08",
    updatedAt: "2026-09-08",
  },
]

export const serviceCatalogue: ServiceCatalogueItem[] = [
  { id: "SVC-1", name: "SMS — Transactional", code: "SMS-TXN", billingUnit: "Per SMS", active: true },
  { id: "SVC-2", name: "SMS — Promotional", code: "SMS-PROMO", billingUnit: "Per SMS", active: true },
  { id: "SVC-3", name: "Voice / OBD", code: "VOICE-OBD", billingUnit: "Per Call", active: true },
  { id: "SVC-4", name: "RCS Messaging", code: "RCS-MSG", billingUnit: "Per Event", active: true },
  { id: "SVC-5", name: "WhatsApp Business API", code: "WA-API", billingUnit: "Per Message", active: true },
  { id: "SVC-6", name: "IVR Solutions", code: "IVR-SOL", billingUnit: "Per Line / Month", active: false },
]

export interface ApprovalItem {
  id: string
  type: "Payment" | "Campaign" | "Credit Campaign" | "Reimbursement"
  reference: string
  client: string
  amount: number
  submittedBy: string
  submittedOn: string
}

export const approvalInbox: ApprovalItem[] = [
  { id: "AP-1", type: "Payment", reference: "RCT-PEND-08", client: "Orchid Clinics", amount: 30000, submittedBy: "Neha Kulkarni", submittedOn: "2026-09-11" },
  { id: "AP-2", type: "Campaign", reference: "REQ-3332", client: "Harbor Freight Co.", amount: 3000, submittedBy: "Rohit Malhotra", submittedOn: "2026-09-10" },
  { id: "AP-3", type: "Reimbursement", reference: "TC-208", client: "—", amount: 2450, submittedBy: "Rohit Malhotra", submittedOn: "2026-09-09" },
  { id: "AP-4", type: "Credit Campaign", reference: "REQ-3334", client: "Meridian Autoparts", amount: 3200, submittedBy: "Neha Kulkarni", submittedOn: "2026-09-10" },
]

export interface OverdueTask {
  id: string
  label: string
  context: string
  owner: string
  dueDate: string
}

export const overdueTasks: OverdueTask[] = [
  { id: "OT-1", label: "Follow-up overdue", context: "Sundar Finserv — qualify budget", owner: "Neha Kulkarni", dueDate: "2026-09-11" },
  { id: "OT-2", label: "Evening cost report missing", context: "CMP-5522 — WhatsApp API", owner: "Priya Sethi", dueDate: "2026-09-11" },
  { id: "OT-3", label: "Rental payment unverified", context: "Orchid Clinics — IVR September rental", owner: "Ravi (Owner)", dueDate: "2026-09-12" },
]

export interface Meeting {
  id: string
  client: string
  responsible: string
  plannedAt: string
  personMet: string
  designation: string
  requirement: string
  outcome: string
  status: "Planned" | "Departed" | "Arrived" | "Completed" | "Cancelled" | "Rescheduled"
}

export const meetings: Meeting[] = [
  {
    id: "MTG-301",
    client: "Orchid Clinics",
    responsible: "Neha Kulkarni",
    plannedAt: "2026-09-15 11:00",
    personMet: "Dr. Kavya Reddy",
    designation: "Clinic Director",
    requirement: "Expand WhatsApp reminders to 3 more branches",
    outcome: "Pending",
    status: "Planned",
  },
  {
    id: "MTG-288",
    client: "Orchid Clinics",
    responsible: "Neha Kulkarni",
    plannedAt: "2026-08-18 15:30",
    personMet: "Dr. Kavya Reddy",
    designation: "Clinic Director",
    requirement: "Review SMS delivery performance",
    outcome: "Approved additional 20k SMS pack",
    status: "Completed",
  },
  {
    id: "MTG-295",
    client: "Coastal Hospitality",
    responsible: "Rohit Malhotra",
    plannedAt: "2026-09-13 10:30",
    personMet: "Imran Qureshi",
    designation: "GM",
    requirement: "Discuss OBD campaign for festive season",
    outcome: "Pending",
    status: "Planned",
  },
]

export interface AuditEvent {
  id: string
  actor: string
  action: string
  entity: string
  timestamp: string
}

export const auditLog: AuditEvent[] = [
  { id: "AUD-8801", actor: "Ravi (Owner)", action: "Accepted receipt", entity: "RCT-7745 — Orchid Clinics", timestamp: "2026-09-11 09:42" },
  { id: "AUD-8797", actor: "Ravi (Owner)", action: "Approved campaign", entity: "CMP-5522 — WhatsApp API", timestamp: "2026-09-10 17:05" },
  { id: "AUD-8790", actor: "Priya Sethi", action: "Submitted actual cost", entity: "CMP-5510 — SMS", timestamp: "2026-09-10 20:14" },
  { id: "AUD-8783", actor: "Neha Kulkarni", action: "Created lead", entity: "LD-1044 — Vertex Realty", timestamp: "2026-09-10 11:30" },
  { id: "AUD-8775", actor: "Ravi (Owner)", action: "Deactivated service", entity: "SVC-6 — IVR Solutions", timestamp: "2026-09-09 14:02" },
  { id: "AUD-8760", actor: "Devansh Patil", action: "Resolved ticket", entity: "TCK-430 — Harbor Freight Co.", timestamp: "2026-09-08 16:47" },
]

export interface MonthlyPerformance {
  month: string
  collections: number
  outstandingDues: number
  campaignRevenue: number
}

export const monthlyPerformance: MonthlyPerformance[] = [
  { month: "Apr", collections: 142000, outstandingDues: 96000, campaignRevenue: 118500 },
  { month: "May", collections: 158200, outstandingDues: 104500, campaignRevenue: 131200 },
  { month: "Jun", collections: 149800, outstandingDues: 121300, campaignRevenue: 126400 },
  { month: "Jul", collections: 171500, outstandingDues: 112800, campaignRevenue: 148900 },
  { month: "Aug", collections: 176900, outstandingDues: 132700, campaignRevenue: 155300 },
  { month: "Sep", collections: 186400, outstandingDues: 158500, campaignRevenue: 32200 },
]
