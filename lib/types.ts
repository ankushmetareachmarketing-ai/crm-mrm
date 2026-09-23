export type Role =
  | "Owner"
  | "Sales"
  | "Campaign Manager"
  | "HR"
  | "Support"

export type LeadStage =
  | "New"
  | "Contacted"
  | "Meeting Scheduled"
  | "Won"
  | "Lost"

export type LeadPriority = "Low" | "Medium" | "High"

export interface Lead {
  id: string
  company: string
  contact: string
  designation: string
  source: string
  industry: string
  stage: LeadStage
  owner: string
  ownerEmployeeId: string | null
  nextAction: string
  nextActionDue: string
  createdAt: string
  website: string | null
  companySize: string | null
  budget: number | null
  priority: LeadPriority
  expectedCloseDate: string | null
  convertedClientId: string | null
}

export type ClientStatus = "Active" | "On Hold" | "Inactive"

export interface Client {
  id: string
  company: string
  industry: string
  owner: string
  ownerEmployeeId: string | null
  status: ClientStatus
  contacts: number
  balance: number
  lastReceiptDate: string | null
  since: string
  renewalDate: string | null
  website: string | null
  logoUrl: string | null
  gstin: string | null
  companySize: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  country: string
  description: string | null
}

export interface ActivityEntry {
  id: string
  action: string
  detail: string | null
  actor: string | null
  createdAt: string
}

export interface ClientContact {
  id: string
  name: string
  designation: string | null
  phone: string | null
  email: string | null
}

export interface ClientNote {
  id: string
  body: string
  author: string | null
  createdAt: string
}

export type PaymentStatus = "Pending" | "Received" | "Failed" | "Refunded"
export type PaymentApprovalStatus = "Pending" | "Approved" | "Rejected"

export interface Payment {
  id: string
  clientId: string
  clientCompany: string
  amount: number
  paymentDate: string
  method: string | null
  reference: string | null
  status: PaymentStatus
  notes: string | null
  recordedBy: string | null
  createdAt: string
  approvalStatus: PaymentApprovalStatus
  approvedBy: string | null
  approvedAt: string | null
}

export type ReminderStatus = "Pending" | "Done" | "Overdue" | "Cancelled"

export interface PaymentReminder {
  id: string
  clientId: string
  clientCompany: string
  dueDate: string
  expectedAmount: number | null
  status: ReminderStatus
  notes: string | null
  createdAt: string
}

export type CallStatus =
  | "Not Called"
  | "Interested"
  | "Not Interested"
  | "Call Back"
  | "Invalid Number"
  | "Converted"

export interface CallListEntry {
  id: string
  name: string | null
  phone: string
  notes: string | null
  status: CallStatus
  lastCalledAt: string | null
  callCount: number
  createdAt: string
  nextFollowUpDate: string | null
  nextFollowUpTime: string | null
}

export interface CallLog {
  id: string
  outcome: string
  notes: string | null
  calledAt: string
  employeeName: string | null
}

export type LedgerEntryType =
  | "Opening Balance"
  | "Charge"
  | "Receipt"
  | "Credit Note"
  | "Refund"
  | "Adjustment"

export interface LedgerEntry {
  id: string
  clientId: string
  date: string
  type: LedgerEntryType
  reference: string
  description: string
  debit: number | null
  credit: number | null
  runningBalance: number
  status: "Posted" | "Pending"
}

export type CampaignStatus =
  | "Draft"
  | "Submitted"
  | "Returned"
  | "Rejected"
  | "Approved"
  | "Queued"
  | "Running"
  | "Completed"
  | "Partially Completed"
  | "Failed"
  | "Cancelled"

export type CampaignService = "SMS" | "Voice/OBD" | "RCS" | "WhatsApp API" | "IVR"

export interface Campaign {
  id: string
  requestId: string
  client: string
  service: CampaignService
  vendor: string
  panel: string
  quantity: number
  unit: string
  sellingRate: number
  agreedAmount: number
  salesperson: string
  status: CampaignStatus
  scheduledFor: string
  submittedDelivered?: string
  costStatus: "Configured" | "Incomplete Costing"
}

export interface Vendor {
  id: string
  name: string
  services: CampaignService[]
  panels: string[]
  activeStatus: "Active" | "Inactive"
  balance: number
  balanceType: "Advance" | "Payable"
  lastTransaction: string | null
}

export interface VendorRate {
  id: string
  vendorId: string
  service: CampaignService
  panel: string
  component: "Submission" | "Delivery" | "Setup" | "Monthly Rental"
  rate: number | null
  currency: string
  effectiveFrom: string
  status: "Configured" | "Not configured"
}

export type TicketStatus = "Open" | "In Progress" | "Awaiting Client" | "Resolved" | "Closed"
export type TicketPriority = "Low" | "Medium" | "High" | "Urgent"

export interface Ticket {
  id: string
  client: string
  service: string
  issueType: string
  priority: TicketPriority
  status: TicketStatus
  assignee: string
  dueDate: string
  updatedAt: string
}

export interface Employee {
  id: string
  name: string
  contact: string
  joiningDate: string
  employmentType: "Full-time" | "Part-time" | "Contract"
  profile: string
  active: boolean
  loginId: string
  photoUrl: string | null
  dateOfBirth: string | null
  address: string | null
  department: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  salary: number | null
}

export interface EmployeeCredential {
  id: string
  label: string
  value: string
  updatedBy: string | null
  updatedAt: string
}

export interface CredentialHistoryEntry {
  id: string
  label: string
  action: "Created" | "Updated" | "Deleted"
  changedBy: string | null
  changedAt: string
}

export type AttendanceStatus = "Present" | "Half Day" | "Absent" | "On Leave"

export interface AttendanceEntry {
  id: string
  employeeId: string
  employeeName: string
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  status: AttendanceStatus
  penaltyAmount: number
  penaltyReason: string | null
  notes: string | null
}

export interface Profile {
  id: string
  name: string
  description: string
  employeeCount: number
  dataScope: string
}

export interface ServiceCatalogueItem {
  id: string
  name: string
  code: string
  billingUnit: string
  active: boolean
}
