"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Laptop } from "@/components/icons"
import { DetailItem, EmployeeAvatar, EmployeeStatusBadge } from "@/components/hr/employee-bits"
import { DocumentsPanel } from "@/components/hr/documents-panel"
import { Field, FormSection, TextSelect } from "@/components/hr/form-bits"
import { PasswordDialog } from "@/components/hr/password-dialog"
import { ImageUpload } from "@/components/image-upload"
import { OnboardingChecklist, PoliciesToAccept } from "@/components/hr/onboarding-parts"
import { BLOOD_GROUPS, MARITAL_STATUSES } from "@/lib/hr/constants"
import type { EmployeeAsset, EmployeeDocument, EmployeeProfile, OnboardingTask, PolicyRow } from "@/lib/hr/types"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

export function MyProfileClient({
  profile: p,
  documents,
  tasks,
  policies,
  assets,
}: {
  profile: EmployeeProfile
  documents: EmployeeDocument[]
  tasks: OnboardingTask[]
  policies: PolicyRow[]
  assets: EmployeeAsset[]
}) {
  const router = useRouter()
  const start = {
    photoUrl: p.photoUrl,
    personalEmail: p.personalEmail ?? "",
    address: p.address ?? "",
    maritalStatus: p.maritalStatus ?? "",
    bloodGroup: p.bloodGroup ?? "",
    emergencyContactName: p.emergencyContactName ?? "",
    emergencyContactPhone: p.emergencyContactPhone ?? "",
  }
  const [form, setForm] = useState(start)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const changed = (Object.keys(form) as (keyof typeof form)[]).filter((k) => form[k] !== start[k])
  const pendingPolicies = policies.filter((x) => !x.acknowledgedAt).length

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/employees/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(changed.map((k) => [k, form[k]]))),
      })
      const data = await res.json().catch(() => ({}))
      setMessage(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: data.error ?? "Could not save." })
      if (res.ok) router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex items-center gap-4">
          <EmployeeAvatar name={p.name} photoUrl={p.photoUrl} className="size-16 text-lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{p.name}</h2>
              <EmployeeStatusBadge status={p.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono font-semibold text-foreground">{p.code}</span> · {p.designation ?? p.role}
              {p.department ? ` · ${p.department}` : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      {pendingPolicies > 0 ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          You have {pendingPolicies} company {pendingPolicies === 1 ? "policy" : "policies"} to read and accept — see the Policies tab.
        </p>
      ) : null}

      <Tabs defaultValue={pendingPolicies > 0 ? "policies" : "profile"}>
        <TabsList className="h-11 flex-wrap p-1">
          <TabsTrigger value="profile" className="cursor-pointer px-4">My details</TabsTrigger>
          <TabsTrigger value="documents" className="cursor-pointer px-4">Documents</TabsTrigger>
          <TabsTrigger value="policies" className="cursor-pointer px-4">
            Policies{pendingPolicies > 0 ? ` (${pendingPolicies})` : ""}
          </TabsTrigger>
          {tasks.length > 0 ? <TabsTrigger value="onboarding" className="cursor-pointer px-4">Onboarding</TabsTrigger> : null}
          <TabsTrigger value="assets" className="cursor-pointer px-4">My assets</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Job &amp; login</CardTitle>
              <PasswordDialog employeeId={p.id} mode="self" />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Employee ID" value={p.code} />
              <DetailItem label="Department" value={p.department} />
              <DetailItem label="Designation" value={p.designation} />
              <DetailItem label="Team" value={p.team} />
              <DetailItem label="Reports to" value={p.manager} />
              <DetailItem label="Joined" value={formatDate(p.joiningDate)} />
              <DetailItem label="Employment type" value={p.employmentType} />
              <DetailItem label="Work email" value={p.workEmail} />
              <DetailItem label="Phone" value={p.contact} />
              <DetailItem label="Alternate phone" value={p.alternatePhone} />
              <DetailItem label="Date of birth" value={p.dateOfBirth ? formatDate(p.dateOfBirth) : null} />
              <DetailItem label="Username (login ID)" value={p.loginId} />
              <DetailItem label="Role" value={p.role} />
            </CardContent>
          </Card>
          <FormSection
            title="Things you can update"
            description="Your name, phone numbers, username, department and role can only be changed by HR or the Owner."
          >
            <ImageUpload kind="employee-photos" label="Profile photo" value={form.photoUrl} onChange={(url) => setForm({ ...form, photoUrl: url })} htmlId="me-photo" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Personal email" htmlFor="me-email">
                <Input id="me-email" type="email" className="h-10 text-base" value={form.personalEmail} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} />
              </Field>
              <Field label="Marital status" htmlFor="me-marital">
                <TextSelect id="me-marital" value={form.maritalStatus} onChange={(v) => setForm({ ...form, maritalStatus: v })} options={MARITAL_STATUSES} placeholder="Select" />
              </Field>
              <Field label="Blood group" htmlFor="me-blood">
                <TextSelect id="me-blood" value={form.bloodGroup} onChange={(v) => setForm({ ...form, bloodGroup: v })} options={BLOOD_GROUPS} placeholder="Select" />
              </Field>
              <Field label="Emergency contact name" htmlFor="me-ename">
                <Input id="me-ename" className="h-10 text-base" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
              </Field>
              <Field label="Emergency contact phone" htmlFor="me-ephone">
                <Input id="me-ephone" className="h-10 text-base" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} />
              </Field>
            </div>
            <Field label="Address" htmlFor="me-address">
              <Textarea id="me-address" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <div className="flex items-center justify-end gap-3">
              {message ? <span className={message.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{message.text}</span> : null}
              <Button className="cursor-pointer" disabled={changed.length === 0 || saving} onClick={save}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </FormSection>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsPanel employeeId={p.id} documents={documents} canDelete={false} />
        </TabsContent>
        <TabsContent value="policies">
          <PoliciesToAccept policies={policies} />
        </TabsContent>
        <TabsContent value="onboarding">
          <OnboardingChecklist employeeId={p.id} tasks={tasks} status={p.status} canEdit={false} />
        </TabsContent>
        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle>My assets</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {assets.filter((a) => !a.returnedAt).map((a) => (
                <div key={a.assignmentId} className="flex items-center gap-3 rounded-lg border p-3">
                  <Laptop className="size-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {a.name} · <span className="font-mono">{a.assetTag}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.category} · given {formatDate(a.assignedAt)}
                    </p>
                  </div>
                </div>
              ))}
              {assets.filter((a) => !a.returnedAt).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No company assets with you.</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
