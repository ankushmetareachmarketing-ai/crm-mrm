"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Clock } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { ImageUpload } from "@/components/image-upload"
import { Field, FormSection, OptionSelect, TextSelect } from "@/components/hr/form-bits"
import { EMPLOYMENT_TYPES, GENDERS } from "@/lib/hr/constants"
import type { OrgOptions } from "@/lib/hr/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function EmployeeForm({ org }: { org: OrgOptions }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: "",
    contact: "",
    personalEmail: "",
    dateOfBirth: "",
    gender: "",
    address: "",
    photoUrl: null as string | null,
    emergencyContactName: "",
    emergencyContactPhone: "",
    departmentId: "",
    designationId: "",
    teamId: "",
    reportingManagerId: "",
    joiningDate: new Date().toISOString().slice(0, 10),
    employmentType: "Full-time",
    workEmail: "",
    salary: "",
    accessProfileId: "",
    loginId: "",
    password: "",
    startOnboarding: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Designations and teams narrow down to the chosen department.
  const designations = org.designations.filter((d) => !form.departmentId || !d.departmentId || d.departmentId === form.departmentId)
  const teams = org.teams.filter((t) => !form.departmentId || !t.departmentId || t.departmentId === form.departmentId)

  async function handleSubmit() {
    if (!form.name.trim() || !form.contact.trim() || !form.accessProfileId || !form.loginId.trim() || !form.password) {
      setError("Name, phone, role, login ID and password are required.")
      return
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.")
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
        setError(body.error ?? "Could not add the employee.")
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
        <Button variant="ghost" size="sm" className="w-fit cursor-pointer" nativeButton={false} render={<Link href="/hr/employees" />}>
          <ArrowLeft /> Back to employees
        </Button>
        <PageHeader
          title="Add employee"
          description="An employee ID (EMP-0001…) is given automatically. Fields marked * are required."
        />
      </div>

      <div className="grid max-w-5xl gap-4">
        <FormSection step={1} title="Personal details" description="Who they are and how to reach them.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="ne-name" required>
              <Input id="ne-name" className="h-10 text-base" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="ne-phone" required>
              <Input id="ne-phone" className="h-10 text-base" value={form.contact} onChange={(e) => set("contact", e.target.value)} />
            </Field>
            <Field label="Personal email" htmlFor="ne-pemail">
              <Input id="ne-pemail" type="email" className="h-10 text-base" value={form.personalEmail} onChange={(e) => set("personalEmail", e.target.value)} />
            </Field>
            <Field label="Date of birth" htmlFor="ne-dob">
              <Input id="ne-dob" type="date" className="h-10 text-base" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
            </Field>
            <Field label="Gender" htmlFor="ne-gender">
              <TextSelect id="ne-gender" value={form.gender} onChange={(v) => set("gender", v)} options={GENDERS} placeholder="Select" />
            </Field>
            <Field label="Emergency contact" htmlFor="ne-emg">
              <div className="grid grid-cols-2 gap-2">
                <Input id="ne-emg" className="h-10 text-base" placeholder="Name" value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} />
                <Input className="h-10 text-base" placeholder="Phone" value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} />
              </div>
            </Field>
          </div>
          <Field label="Address" htmlFor="ne-address">
            <Textarea id="ne-address" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <ImageUpload kind="employee-photos" label="Photo" value={form.photoUrl} onChange={(url) => set("photoUrl", url)} htmlId="ne-photo" />
        </FormSection>

        <FormSection step={2} title="Job details" description="Where they sit in the company.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department" htmlFor="ne-dept" hint={org.departments.length === 0 ? "Add departments on the Organization page." : undefined}>
              <OptionSelect
                id="ne-dept"
                value={form.departmentId}
                onChange={(v) => setForm((f) => ({ ...f, departmentId: v, designationId: "", teamId: "" }))}
                options={org.departments}
                placeholder="Select department"
                noneLabel="No department"
              />
            </Field>
            <Field label="Designation" htmlFor="ne-desig">
              <OptionSelect id="ne-desig" value={form.designationId} onChange={(v) => set("designationId", v)} options={designations} placeholder="Select designation" noneLabel="No designation" />
            </Field>
            <Field label="Team" htmlFor="ne-team">
              <OptionSelect id="ne-team" value={form.teamId} onChange={(v) => set("teamId", v)} options={teams} placeholder="Select team" noneLabel="No team" />
            </Field>
            <Field label="Reporting manager" htmlFor="ne-mgr">
              <OptionSelect id="ne-mgr" value={form.reportingManagerId} onChange={(v) => set("reportingManagerId", v)} options={org.people} placeholder="Select manager" noneLabel="No manager" />
            </Field>
            <Field label="Joining date" htmlFor="ne-join">
              <Input id="ne-join" type="date" className="h-10 text-base" value={form.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} />
            </Field>
            <Field label="Employment type" htmlFor="ne-type">
              <TextSelect id="ne-type" value={form.employmentType} onChange={(v) => set("employmentType", v || "Full-time")} options={EMPLOYMENT_TYPES} placeholder="Select" />
            </Field>
            <Field label="Work email" htmlFor="ne-wemail">
              <Input id="ne-wemail" type="email" className="h-10 text-base" value={form.workEmail} onChange={(e) => set("workEmail", e.target.value)} />
            </Field>
            <Field label="Monthly salary (₹)" htmlFor="ne-salary" hint="Visible only to HR and the Owner.">
              <Input id="ne-salary" type="number" min="0" className="h-10 text-base" value={form.salary} onChange={(e) => set("salary", e.target.value)} />
            </Field>
          </div>
        </FormSection>

        <FormSection step={3} title="Login & role" description="The role decides what they can see in the app.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Role" htmlFor="ne-role" required>
              <OptionSelect id="ne-role" value={form.accessProfileId} onChange={(v) => set("accessProfileId", v)} options={org.roles} placeholder="Select role" />
            </Field>
            <Field label="Login ID" htmlFor="ne-login" required hint="e.g. firstname.lastname">
              <Input id="ne-login" className="h-10 text-base" autoComplete="off" value={form.loginId} onChange={(e) => set("loginId", e.target.value)} />
            </Field>
            <Field label="Password" htmlFor="ne-pass" required hint="At least 6 characters.">
              <Input id="ne-pass" type="password" autoComplete="new-password" className="h-10 text-base" value={form.password} onChange={(e) => set("password", e.target.value)} />
            </Field>
          </div>
        </FormSection>

        <FormSection step={4} title="Joining process">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Joining process">
            {[
              {
                value: true,
                icon: Clock,
                title: "Start onboarding (recommended)",
                text: "Login stays off. Work through documents, policies and assets, then activate them.",
              },
              {
                value: false,
                icon: CheckCircle2,
                title: "Activate now",
                text: "Login works straight away. Use this for someone already working here.",
              },
            ].map((o) => {
              const active = form.startOnboarding === o.value
              const Icon = o.icon
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set("startOnboarding", o.value)}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
                    active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent/50"
                  )}
                >
                  <Icon className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm font-semibold">{o.title}</span>
                  <span className="text-xs text-muted-foreground">{o.text}</span>
                </button>
              )
            })}
          </div>
        </FormSection>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="cursor-pointer" nativeButton={false} render={<Link href="/hr/employees" />}>
            Cancel
          </Button>
          <Button className="h-11 cursor-pointer px-6 text-base font-semibold" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : "Add employee"}
          </Button>
        </div>
      </div>
    </div>
  )
}
