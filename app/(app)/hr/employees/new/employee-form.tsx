"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ImageUpload } from "@/components/image-upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const employmentTypes = ["Full-time", "Part-time", "Contract"]

export function EmployeeForm({ profiles }: { profiles: { id: string; name: string }[] }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: "",
    contact: "",
    employmentType: "Full-time",
    accessProfileId: "",
    loginId: "",
    password: "",
    salary: "",
    photoUrl: null as string | null,
    dateOfBirth: "",
    address: "",
    department: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!form.name.trim() || !form.contact.trim() || !form.accessProfileId || !form.loginId.trim() || !form.password.trim()) {
      setError("Name, contact, role, login ID and password are required.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Could not create the employee.")
        return
      }
      router.push(`/hr/employees/${body.employee.id}`)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="w-fit" nativeButton={false} render={<Link href="/hr/employees" />}>
          <ArrowLeft /> Back to employees
        </Button>
        <PageHeader
          title="Add employee"
          description="Create their login, then set salary and credentials from their profile page."
        />
      </div>

      <Card className="max-w-3xl">
        <CardContent className="flex flex-col gap-5 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-name">Full name</Label>
              <Input
                id="emp-name"
                className="h-10 text-base"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kavya Iyer"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-contact">Contact number</Label>
              <Input
                id="emp-contact"
                className="h-10 text-base"
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                placeholder="e.g. +91 90000 00000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-type">Employment type</Label>
              <Select value={form.employmentType} onValueChange={(v) => setForm((f) => ({ ...f, employmentType: v ?? "" }))}>
                <SelectTrigger id="emp-type" className="h-10 w-full text-base">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {employmentTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-profile">Access profile / role</Label>
              <Select
                value={form.accessProfileId}
                onValueChange={(v) => setForm((f) => ({ ...f, accessProfileId: v ?? "" }))}
              >
                <SelectTrigger id="emp-profile" className="h-10 w-full text-base">
                  <SelectValue placeholder="Select role">
                    {(v: string) => profiles.find((p) => p.id === v)?.name ?? "Select role"}
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
              <Label htmlFor="emp-login">Login ID</Label>
              <Input
                id="emp-login"
                className="h-10 text-base"
                value={form.loginId}
                onChange={(e) => setForm((f) => ({ ...f, loginId: e.target.value }))}
                placeholder="e.g. kavya.iyer"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-password">Password</Label>
              <Input
                id="emp-password"
                type="text"
                className="h-10 text-base"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Temporary login password"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-salary">Monthly salary (₹)</Label>
              <Input
                id="emp-salary"
                type="number"
                className="h-10 text-base"
                value={form.salary}
                onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
                placeholder="e.g. 35000"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-department">Department</Label>
              <Input
                id="emp-department"
                className="h-10 text-base"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="e.g. Sales, Campaigns, Support"
              />
            </div>
          </div>

          <ImageUpload
            kind="employee-photos"
            label="Photo"
            htmlId="emp-photo"
            value={form.photoUrl}
            onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-dob">Date of birth</Label>
              <Input
                id="emp-dob"
                type="date"
                className="h-10 text-base"
                value={form.dateOfBirth}
                onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-address">Address</Label>
              <Input
                id="emp-address"
                className="h-10 text-base"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-emg-name">Emergency contact name</Label>
              <Input
                id="emp-emg-name"
                className="h-10 text-base"
                value={form.emergencyContactName}
                onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-emg-phone">Emergency contact phone</Label>
              <Input
                id="emp-emg-phone"
                className="h-10 text-base"
                value={form.emergencyContactPhone}
                onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))}
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/hr/employees" />}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating…" : "Create employee"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
