// Shapes the HR pages pass from the server to the browser.

import type { AttendanceRecord } from "@/lib/hr/attendance"
import type { EmployeeStatus } from "@/lib/hr/constants"
import type { LeaveStatus } from "@/lib/hr/leave"

export interface NamedOption {
  id: string
  name: string
}

export interface DesignationOption extends NamedOption {
  departmentId: string | null
}

export interface TeamOption extends NamedOption {
  departmentId: string | null
  leadEmployeeId: string | null
}

export interface OrgOptions {
  departments: (NamedOption & { description: string | null; headEmployeeId: string | null })[]
  designations: DesignationOption[]
  teams: TeamOption[]
  roles: NamedOption[]
  /** Active employees, for manager / team-lead / assignee pickers. */
  people: NamedOption[]
}

export interface EmployeeSummary {
  id: string
  code: string
  name: string
  photoUrl: string | null
  role: string
  status: EmployeeStatus
  active: boolean
  contact: string
  workEmail: string | null
  joiningDate: string
  employmentType: string
  departmentId: string | null
  department: string | null
  designationId: string | null
  designation: string | null
  teamId: string | null
  team: string | null
  managerId: string | null
  manager: string | null
}

export interface EmployeeProfile extends EmployeeSummary {
  loginId: string
  roleId: string
  alternatePhone: string | null
  personalEmail: string | null
  address: string | null
  dateOfBirth: string | null
  gender: string | null
  maritalStatus: string | null
  bloodGroup: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  exitDate: string | null
  salary: number | null
}

export interface EmployeeDocument {
  id: string
  category: string
  title: string
  fileName: string
  sizeBytes: number | null
  uploadedBy: string | null
  createdAt: string
}

export interface EmployeeNote {
  id: string
  body: string
  author: string | null
  createdAt: string
}

export interface EmployeeHistoryEntry {
  id: string
  action: string
  field: string | null
  before: string | null
  after: string | null
  actor: string | null
  createdAt: string
}

export interface OnboardingTask {
  id: string
  title: string
  category: string
  doneAt: string | null
  doneBy: string | null
}

export interface AssetRow {
  id: string
  assetTag: string
  name: string
  category: string
  serialNumber: string | null
  status: string
  notes: string | null
  holderId: string | null
  holder: string | null
  assignedAt: string | null
}

export interface EmployeeAsset {
  assignmentId: string
  assetId: string
  assetTag: string
  name: string
  category: string
  assignedAt: string
  returnedAt: string | null
}

export interface LeaveRequestRow {
  id: string
  employeeId: string
  employee: string
  employeeCode: string
  leaveType: string
  startDate: string
  endDate: string
  halfDay: boolean
  days: number
  reason: string | null
  status: LeaveStatus
  decidedBy: string | null
  decidedAt: string | null
  decisionNote: string | null
  createdAt: string
}

export interface PolicyRow {
  id: string
  title: string
  body: string
  active: boolean
  updatedAt: string
  acknowledgedAt: string | null
  acknowledgedCount: number
}

export interface AttendanceRow extends AttendanceRecord {
  id: string
  penaltyAmount: number
  penaltyReason: string | null
  notes: string | null
}
