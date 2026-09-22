"use client"

import { useState } from "react"
import { Info, Plus } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { useRole } from "@/components/role-context"
import { ImageUpload } from "@/components/image-upload"
import type { Employee, Profile, ServiceCatalogueItem } from "@/lib/types"
import { formatDate } from "@/lib/format"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const emptyEmployeeForm = {
  name: "",
  contact: "",
  employmentType: "Full-time" as Employee["employmentType"],
  accessProfileId: "",
  loginId: "",
  password: "",
  photoUrl: null as string | null,
  dateOfBirth: "",
  address: "",
  department: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
}

const emptyProfileForm = {
  name: "",
  description: "",
  dataScope: "",
}

const emptyServiceForm = {
  name: "",
  code: "",
  billingUnit: "",
}

interface EmployeeApiRow {
  id: string
  name: string
  contact: string
  login_id: string
  employment_type: Employee["employmentType"]
  joining_date: string
  active: boolean
  access_profiles: { name: string } | null
}

export function SettingsClient({
  initialProfiles,
  initialEmployees,
  initialServices,
}: {
  initialProfiles: Profile[]
  initialEmployees: Employee[]
  initialServices: ServiceCatalogueItem[]
}) {
  const { role } = useRole()
  const isOwner = role === "Owner"

  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState(emptyProfileForm)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSubmitting, setProfileSubmitting] = useState(false)

  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [employeeOpen, setEmployeeOpen] = useState(false)
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm)
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const [employeeSubmitting, setEmployeeSubmitting] = useState(false)

  const [serviceCatalogue, setServiceCatalogue] = useState<ServiceCatalogueItem[]>(initialServices)
  const [serviceOpen, setServiceOpen] = useState(false)
  const [serviceForm, setServiceForm] = useState(emptyServiceForm)

  async function handleCreateProfile() {
    if (!profileForm.name.trim() || !profileForm.description.trim() || !profileForm.dataScope.trim()) {
      return
    }
    setProfileSubmitting(true)
    setProfileError(null)
    try {
      const res = await fetch("/api/access-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileForm.name,
          description: profileForm.description,
          dataScope: profileForm.dataScope,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setProfileError(body.error ?? "Could not create the profile.")
        return
      }
      const p = body.profile as { id: string; name: string; description: string; data_scope: string }
      setProfiles((prev) => [
        { id: p.id, name: p.name, description: p.description, dataScope: p.data_scope, employeeCount: 0 },
        ...prev,
      ])
      setProfileForm(emptyProfileForm)
      setProfileOpen(false)
    } finally {
      setProfileSubmitting(false)
    }
  }

  async function handleCreateEmployee() {
    if (
      !employeeForm.name.trim() ||
      !employeeForm.contact.trim() ||
      !employeeForm.accessProfileId ||
      !employeeForm.loginId.trim() ||
      !employeeForm.password.trim()
    ) {
      return
    }
    setEmployeeSubmitting(true)
    setEmployeeError(null)
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: employeeForm.name,
          contact: employeeForm.contact,
          employmentType: employeeForm.employmentType,
          accessProfileId: employeeForm.accessProfileId,
          loginId: employeeForm.loginId,
          password: employeeForm.password,
          photoUrl: employeeForm.photoUrl,
          dateOfBirth: employeeForm.dateOfBirth || null,
          address: employeeForm.address || null,
          department: employeeForm.department || null,
          emergencyContactName: employeeForm.emergencyContactName || null,
          emergencyContactPhone: employeeForm.emergencyContactPhone || null,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setEmployeeError(body.error ?? "Could not create the employee.")
        return
      }
      const e = body.employee as EmployeeApiRow
      const profileName = e.access_profiles?.name ?? "—"
      setEmployees((prev) => [
        {
          id: e.id,
          name: e.name,
          contact: e.contact,
          joiningDate: e.joining_date,
          employmentType: e.employment_type,
          profile: profileName,
          active: e.active,
          loginId: e.login_id,
          photoUrl: employeeForm.photoUrl,
          dateOfBirth: employeeForm.dateOfBirth || null,
          address: employeeForm.address || null,
          department: employeeForm.department || null,
          emergencyContactName: employeeForm.emergencyContactName || null,
          emergencyContactPhone: employeeForm.emergencyContactPhone || null,
          salary: null,
        },
        ...prev,
      ])
      setProfiles((prev) =>
        prev.map((p) => (p.name === profileName ? { ...p, employeeCount: p.employeeCount + 1 } : p))
      )
      setEmployeeForm(emptyEmployeeForm)
      setEmployeeOpen(false)
    } finally {
      setEmployeeSubmitting(false)
    }
  }

  function handleCreateService() {
    if (!serviceForm.name.trim() || !serviceForm.code.trim() || !serviceForm.billingUnit.trim()) {
      return
    }
    const newService: ServiceCatalogueItem = {
      id: `SVC-${100 + serviceCatalogue.length}`,
      name: serviceForm.name,
      code: serviceForm.code,
      billingUnit: serviceForm.billingUnit,
      active: true,
    }
    setServiceCatalogue((prev) => [newService, ...prev])
    setServiceForm(emptyServiceForm)
    setServiceOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Owner Configuration"
        description="Profiles, employees, services and vendors — the masters everything else depends on."
      />

      <Alert>
        <Info className="size-5" />
        <AlertTitle>Access profiles and employees are live</AlertTitle>
        <AlertDescription>
          Records below are read from the database. Creating an employee also creates their login —
          they can sign in immediately with the login ID and password you set.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="profiles">
        <TabsList className="h-11 p-1">
          <TabsTrigger value="profiles" className="px-4 py-2 text-base">
            Access profiles
          </TabsTrigger>
          <TabsTrigger value="employees" className="px-4 py-2 text-base">
            Employees
          </TabsTrigger>
          <TabsTrigger value="services" className="px-4 py-2 text-base">
            Service catalogue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profiles">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Access profiles</CardTitle>
                <CardDescription>Created before employees; configure screens, actions and data scope.</CardDescription>
              </div>
              {isOwner ? (
                <Dialog
                  open={profileOpen}
                  onOpenChange={(v) => {
                    setProfileOpen(v)
                    if (!v) setProfileError(null)
                  }}
                >
                  <DialogTrigger render={<Button size="sm" variant="outline" />}>
                    <Plus /> New profile
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-lg">Create access profile</DialogTitle>
                      <DialogDescription>
                        Define the profile before assigning it to employees.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-5 py-1">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="prf-name">Profile name</Label>
                        <Input
                          id="prf-name"
                          className="h-10 text-base"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="e.g. Finance"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="prf-description">Description</Label>
                        <Input
                          id="prf-description"
                          className="h-10 text-base"
                          value={profileForm.description}
                          onChange={(e) => setProfileForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="e.g. Invoices, receipts, ledgers"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="prf-scope">Data scope</Label>
                        <Input
                          id="prf-scope"
                          className="h-10 text-base"
                          value={profileForm.dataScope}
                          onChange={(e) => setProfileForm((f) => ({ ...f, dataScope: e.target.value }))}
                          placeholder="e.g. Finance module only"
                        />
                      </div>
                      {profileError ? <p className="text-sm text-destructive">{profileError}</p> : null}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setProfileOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateProfile} disabled={profileSubmitting}>
                        {profileSubmitting ? "Creating…" : "Create profile"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : null}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Data scope</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.dataScope}</TableCell>
                      <TableCell className="text-right">{p.employeeCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Employee master</CardTitle>
                <CardDescription>Renaming changes display name only; historical actor records remain unchanged.</CardDescription>
              </div>
              {isOwner ? (
                <Dialog
                  open={employeeOpen}
                  onOpenChange={(v) => {
                    setEmployeeOpen(v)
                    if (!v) setEmployeeError(null)
                  }}
                >
                  <DialogTrigger render={<Button size="sm" variant="outline" />}>
                    <Plus /> New employee
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-lg">Add employee</DialogTitle>
                      <DialogDescription>
                        Set the employee&apos;s login ID and password — they&apos;ll use these to sign in.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-5 py-1">
                      <ImageUpload
                        htmlId="emp-photo"
                        kind="employee-photos"
                        label="Photo"
                        value={employeeForm.photoUrl}
                        onChange={(url) => setEmployeeForm((f) => ({ ...f, photoUrl: url }))}
                      />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="emp-name">Full name</Label>
                          <Input
                            id="emp-name"
                            className="h-10 text-base"
                            value={employeeForm.name}
                            onChange={(e) => setEmployeeForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Ananya Verma"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="emp-contact">Contact number</Label>
                          <Input
                            id="emp-contact"
                            className="h-10 text-base"
                            value={employeeForm.contact}
                            onChange={(e) => setEmployeeForm((f) => ({ ...f, contact: e.target.value }))}
                            placeholder="e.g. +91 90000 00099"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="emp-type">Employment type</Label>
                          <Select
                            value={employeeForm.employmentType}
                            onValueChange={(v) =>
                              setEmployeeForm((f) => ({ ...f, employmentType: v as Employee["employmentType"] }))
                            }
                          >
                            <SelectTrigger id="emp-type" className="h-10 w-full text-base">
                              <SelectValue placeholder="Employment type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Full-time">Full-time</SelectItem>
                              <SelectItem value="Part-time">Part-time</SelectItem>
                              <SelectItem value="Contract">Contract</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="emp-profile">Access profile</Label>
                          <Select
                            value={employeeForm.accessProfileId}
                            onValueChange={(v) => setEmployeeForm((f) => ({ ...f, accessProfileId: v ?? "" }))}
                          >
                            <SelectTrigger id="emp-profile" className="h-10 w-full text-base">
                              <SelectValue placeholder="Select profile">
                                {(v: string) => profiles.find((p) => p.id === v)?.name ?? "Select profile"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {profiles.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="emp-department">Department</Label>
                          <Input
                            id="emp-department"
                            className="h-10 text-base"
                            value={employeeForm.department}
                            onChange={(e) => setEmployeeForm((f) => ({ ...f, department: e.target.value }))}
                            placeholder="e.g. Sales & Marketing"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="emp-dob">Date of birth</Label>
                          <Input
                            id="emp-dob"
                            type="date"
                            className="h-10 text-base"
                            value={employeeForm.dateOfBirth}
                            onChange={(e) => setEmployeeForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="emp-address">Address</Label>
                        <Input
                          id="emp-address"
                          className="h-10 text-base"
                          value={employeeForm.address}
                          onChange={(e) => setEmployeeForm((f) => ({ ...f, address: e.target.value }))}
                          placeholder="e.g. 12 MG Road, Pune"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="emp-emergency-name">Emergency contact name</Label>
                          <Input
                            id="emp-emergency-name"
                            className="h-10 text-base"
                            value={employeeForm.emergencyContactName}
                            onChange={(e) => setEmployeeForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="emp-emergency-phone">Emergency contact phone</Label>
                          <Input
                            id="emp-emergency-phone"
                            className="h-10 text-base"
                            value={employeeForm.emergencyContactPhone}
                            onChange={(e) => setEmployeeForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="emp-login-id">Login ID</Label>
                          <Input
                            id="emp-login-id"
                            className="h-10 text-base"
                            value={employeeForm.loginId}
                            onChange={(e) => setEmployeeForm((f) => ({ ...f, loginId: e.target.value }))}
                            placeholder="e.g. ananya.verma"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="emp-password">Password</Label>
                          <Input
                            id="emp-password"
                            type="password"
                            className="h-10 text-base"
                            value={employeeForm.password}
                            onChange={(e) => setEmployeeForm((f) => ({ ...f, password: e.target.value }))}
                            placeholder="Set a temporary password"
                          />
                        </div>
                      </div>
                      {employeeError ? <p className="text-sm text-destructive">{employeeError}</p> : null}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEmployeeOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateEmployee} disabled={employeeSubmitting}>
                        {employeeSubmitting ? "Creating…" : "Create employee"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : null}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Login ID</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.contact}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{e.loginId}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(e.joiningDate)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.employmentType}</TableCell>
                      <TableCell>{e.profile}</TableCell>
                      <TableCell>
                        <StatusBadge status={e.active ? "Active" : "Inactive"} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No employees yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Service catalogue</CardTitle>
                <CardDescription>Deactivated services disappear from new selections but remain in history.</CardDescription>
              </div>
              {isOwner ? (
                <Dialog open={serviceOpen} onOpenChange={setServiceOpen}>
                  <DialogTrigger render={<Button size="sm" variant="outline" />}>
                    <Plus /> New service
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-lg">Add service</DialogTitle>
                      <DialogDescription>
                        New services become selectable in campaign requests immediately.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-5 py-1">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="svc-name">Service name</Label>
                        <Input
                          id="svc-name"
                          className="h-10 text-base"
                          value={serviceForm.name}
                          onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="e.g. Email — Transactional"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="svc-code">Code</Label>
                          <Input
                            id="svc-code"
                            className="h-10 text-base"
                            value={serviceForm.code}
                            onChange={(e) => setServiceForm((f) => ({ ...f, code: e.target.value }))}
                            placeholder="e.g. EMAIL-TXN"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="svc-unit">Billing unit</Label>
                          <Input
                            id="svc-unit"
                            className="h-10 text-base"
                            value={serviceForm.billingUnit}
                            onChange={(e) => setServiceForm((f) => ({ ...f, billingUnit: e.target.value }))}
                            placeholder="e.g. Per Email"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setServiceOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateService}>Create service</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : null}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Billing unit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceCatalogue.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.code}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.billingUnit}</TableCell>
                      <TableCell>
                        <StatusBadge status={s.active ? "Active" : "Inactive"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
