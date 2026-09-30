"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Field, FormSection, OptionSelect, TextSelect } from "@/components/hr/form-bits"
import { ImageUpload } from "@/components/image-upload"
import { PasswordDialog } from "@/components/hr/password-dialog"
import { OwnerPasswordView } from "@/components/hr/owner-password-view"
import { DeleteEmployee } from "@/components/hr/delete-employee"
import { BLOOD_GROUPS, EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, GENDERS, MARITAL_STATUSES } from "@/lib/hr/constants"
import type { EmployeeProfile, OrgOptions } from "@/lib/hr/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

function initial(p: EmployeeProfile) {
  return {
    name: p.name,
    contact: p.contact,
    loginId: p.loginId,
    alternatePhone: p.alternatePhone ?? "",
    personalEmail: p.personalEmail ?? "",
    workEmail: p.workEmail ?? "",
    address: p.address ?? "",
    dateOfBirth: p.dateOfBirth ?? "",
    gender: p.gender ?? "",
    maritalStatus: p.maritalStatus ?? "",
    bloodGroup: p.bloodGroup ?? "",
    emergencyContactName: p.emergencyContactName ?? "",
    emergencyContactPhone: p.emergencyContactPhone ?? "",
    photoUrl: p.photoUrl,
    departmentId: p.departmentId ?? "",
    designationId: p.designationId ?? "",
    teamId: p.teamId ?? "",
    reportingManagerId: p.managerId ?? "",
    joiningDate: p.joiningDate,
    exitDate: p.exitDate ?? "",
    employmentType: p.employmentType,
    accessProfileId: p.roleId,
    status: p.status as string,
    salary: p.salary === null ? "" : String(p.salary),
    active: p.active,
  }
}

/** Personal, contact and job details — all editable by HR. Saves only what changed. */
export function DetailsPanel({
  profile,
  org,
  canEditRole,
  isSelf,
  viewerIsOwner,
}: {
  profile: EmployeeProfile
  org: OrgOptions
  canEditRole: boolean
  isSelf: boolean
  viewerIsOwner: boolean
}) {
  const router = useRouter()
  const start = initial(profile)
  const [form, setForm] = useState(start)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const designations = org.designations.filter((d) => !form.departmentId || !d.departmentId || d.departmentId === form.departmentId)
  const teams = org.teams.filter((t) => !form.departmentId || !t.departmentId || t.departmentId === form.departmentId)
  const changed = (Object.keys(form) as (keyof typeof form)[]).filter((k) => form[k] !== start[k])

  async function save() {
    if (changed.length === 0) return
    setSaving(true)
    setMessage(null)
    try {
      const body = Object.fromEntries(changed.map((k) => [k, form[k]]))
      const res = await fetch(`/api/employees/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Could not save." })
        return
      }
      setMessage({ ok: true, text: "Saved." })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormSection title="Personal details">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full name" htmlFor="pf-name">
            <Input id="pf-name" className="h-10 text-base" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Date of birth" htmlFor="pf-dob">
            <Input id="pf-dob" type="date" className="h-10 text-base" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </Field>
          <Field label="Gender" htmlFor="pf-gender">
            <TextSelect id="pf-gender" value={form.gender} onChange={(v) => set("gender", v)} options={GENDERS} placeholder="Select" />
          </Field>
          <Field label="Marital status" htmlFor="pf-marital">
            <TextSelect id="pf-marital" value={form.maritalStatus} onChange={(v) => set("maritalStatus", v)} options={MARITAL_STATUSES} placeholder="Select" />
          </Field>
          <Field label="Blood group" htmlFor="pf-blood">
            <TextSelect id="pf-blood" value={form.bloodGroup} onChange={(v) => set("bloodGroup", v)} options={BLOOD_GROUPS} placeholder="Select" />
          </Field>
        </div>
        <ImageUpload kind="employee-photos" label="Photo" value={form.photoUrl} onChange={(url) => set("photoUrl", url)} htmlId="pf-photo" />
      </FormSection>

      <FormSection title="Contact information">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Phone" htmlFor="pf-phone">
            <Input id="pf-phone" className="h-10 text-base" value={form.contact} onChange={(e) => set("contact", e.target.value)} />
          </Field>
          <Field label="Alternate phone" htmlFor="pf-alt">
            <Input id="pf-alt" className="h-10 text-base" value={form.alternatePhone} onChange={(e) => set("alternatePhone", e.target.value)} />
          </Field>
          <Field label="Personal email" htmlFor="pf-pemail">
            <Input id="pf-pemail" type="email" className="h-10 text-base" value={form.personalEmail} onChange={(e) => set("personalEmail", e.target.value)} />
          </Field>
          <Field label="Work email" htmlFor="pf-wemail">
            <Input id="pf-wemail" type="email" className="h-10 text-base" value={form.workEmail} onChange={(e) => set("workEmail", e.target.value)} />
          </Field>
          <Field label="Emergency contact name" htmlFor="pf-ename">
            <Input id="pf-ename" className="h-10 text-base" value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} />
          </Field>
          <Field label="Emergency contact phone" htmlFor="pf-ephone">
            <Input id="pf-ephone" className="h-10 text-base" value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} />
          </Field>
        </div>
        <Field label="Address" htmlFor="pf-address">
          <Textarea id="pf-address" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
      </FormSection>

      <FormSection title="Job" description="Department, designation, team, manager and employment details.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Department" htmlFor="pf-dept">
            <OptionSelect
              id="pf-dept"
              value={form.departmentId}
              onChange={(v) => setForm((f) => ({ ...f, departmentId: v, designationId: "", teamId: "" }))}
              options={org.departments}
              placeholder="Select"
              noneLabel="No department"
            />
          </Field>
          <Field label="Designation" htmlFor="pf-desig">
            <OptionSelect id="pf-desig" value={form.designationId} onChange={(v) => set("designationId", v)} options={designations} placeholder="Select" noneLabel="No designation" />
          </Field>
          <Field label="Team" htmlFor="pf-team">
            <OptionSelect id="pf-team" value={form.teamId} onChange={(v) => set("teamId", v)} options={teams} placeholder="Select" noneLabel="No team" />
          </Field>
          <Field label="Reporting manager" htmlFor="pf-mgr">
            <OptionSelect id="pf-mgr" value={form.reportingManagerId} onChange={(v) => set("reportingManagerId", v)} options={org.people} placeholder="Select" noneLabel="No manager" />
          </Field>
          <Field label="Joining date" htmlFor="pf-join">
            <Input id="pf-join" type="date" className="h-10 text-base" value={form.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} />
          </Field>
          <Field label="Employment type" htmlFor="pf-type">
            <TextSelect id="pf-type" value={form.employmentType} onChange={(v) => set("employmentType", v || form.employmentType)} options={EMPLOYMENT_TYPES} placeholder="Select" />
          </Field>
          <Field label="Employee status" htmlFor="pf-status" hint="Resigned / Terminated / Inactive also switch off login.">
            <TextSelect id="pf-status" value={form.status} onChange={(v) => set("status", v || form.status)} options={EMPLOYEE_STATUSES} placeholder="Select" />
          </Field>
          <Field label="Exit date" htmlFor="pf-exit">
            <Input id="pf-exit" type="date" className="h-10 text-base" value={form.exitDate} onChange={(e) => set("exitDate", e.target.value)} />
          </Field>
          <Field label="Monthly salary (₹)" htmlFor="pf-salary" hint="Only HR and the Owner see this.">
            <Input id="pf-salary" type="number" min="0" className="h-10 text-base" value={form.salary} onChange={(e) => set("salary", e.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Login & role" description="Username, password and the role that decides which pages they can see.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username (login ID)" htmlFor="pf-login" hint="What they type on the login page.">
            <Input id="pf-login" className="h-10 text-base" autoComplete="off" value={form.loginId} onChange={(e) => set("loginId", e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="pf-pw" hint={isSelf ? "Asks for your current password." : "Sets a new password for them."}>
            <div className="flex flex-wrap gap-2">
              <PasswordDialog employeeId={profile.id} mode={isSelf ? "self" : "reset"} name={profile.name} />
              {viewerIsOwner ? <OwnerPasswordView employeeId={profile.id} name={profile.name} /> : null}
            </div>
          </Field>
          <Field label="Role" htmlFor="pf-role" hint={canEditRole ? undefined : "Only the Owner can change this."}>
            <OptionSelect id="pf-role" value={form.accessProfileId} onChange={(v) => set("accessProfileId", v || form.accessProfileId)} options={org.roles} placeholder="Select role" disabled={!canEditRole} />
          </Field>
          <Field label="Login access" htmlFor="pf-active" hint={isSelf ? "You can't switch off your own login." : "Switch off to block their login."}>
            <label className="flex h-10 cursor-pointer items-center gap-3 text-sm">
              <Switch id="pf-active" checked={form.active} disabled={isSelf} onCheckedChange={(v) => set("active", Boolean(v))} />
              {form.active ? "Can log in" : "Login switched off"}
            </label>
          </Field>
        </div>
      </FormSection>

      {viewerIsOwner && !isSelf && profile.role !== "Owner" ? <DeleteEmployee employeeId={profile.id} name={profile.name} /> : null}

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
        {message ? <span className={message.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{message.text}</span> : null}
        <span className="text-sm text-muted-foreground">{changed.length > 0 ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}` : "No changes"}</span>
        <Button variant="outline" className="cursor-pointer" disabled={changed.length === 0 || saving} onClick={() => { setForm(start); setMessage(null) }}>
          Undo
        </Button>
        <Button className="cursor-pointer" disabled={changed.length === 0 || saving} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  )
}
