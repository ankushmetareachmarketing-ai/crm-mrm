"use client"

import { useMemo, useRef, useState } from "react"
import { CalendarClock, ChevronDown, Download, Phone, PhoneCall, Plus, ThumbsDown, ThumbsUp, Upload } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { formatDate, formatRelativeTime } from "@/lib/format"
import { downloadCsv } from "@/lib/export-csv"
import { cn } from "@/lib/utils"
import type { CallListEntry, CallLog, CallStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const outcomes: CallStatus[] = ["Interested", "Not Interested", "Call Back", "Invalid Number", "Converted"]
const ALL_DATES = "all"

interface HistoryEntry extends CallLog {
  phone: string
}

interface CreatedEntry {
  id: string
  name: string | null
  phone: string
  status: CallStatus
  notes: string | null
  lastCalledAt: string | null
  callCount: number
  callLog: { id: string; outcome: string; notes: string | null; calledAt: string } | null
}

const FOLLOW_UP_BADGE_CLASSES: Record<"overdue" | "today" | "upcoming", string> = {
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
  today: "bg-amber-50 text-amber-700 border-amber-200",
  upcoming: "bg-sky-50 text-sky-700 border-sky-200",
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function followUpTone(dateStr: string | null): "overdue" | "today" | "upcoming" | null {
  if (!dateStr) return null
  const today = todayKey()
  if (dateStr < today) return "overdue"
  if (dateStr === today) return "today"
  return "upcoming"
}

function formatFollowUp(dateStr: string | null, timeStr: string | null) {
  if (!dateStr) return null
  const time = timeStr
    ? new Date(`1970-01-01T${timeStr}`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    : null
  return `${formatDate(dateStr)}${time ? `, ${time}` : ""}`
}

function parseBulkLines(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, phonePart] = line.includes(",") ? line.split(",") : [null, line]
      return { name: phonePart ? namePart?.trim() : null, phone: (phonePart ?? namePart ?? "").trim() }
    })
    .filter((e) => e.phone)
}

export function CallsClient({
  initialEntries,
  history,
}: {
  initialEntries: CallListEntry[]
  history: HistoryEntry[]
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [callHistory, setCallHistory] = useState(history)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState("")
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedDate, setSelectedDate] = useState<string>(todayKey())

  const [singleName, setSingleName] = useState("")
  const [singlePhone, setSinglePhone] = useState("")
  const [singleStatus, setSingleStatus] = useState<CallStatus>("Not Called")
  const [singleNotes, setSingleNotes] = useState("")
  const [singleSubmitting, setSingleSubmitting] = useState(false)
  const [singleError, setSingleError] = useState<string | null>(null)

  const [logEntry, setLogEntry] = useState<CallListEntry | null>(null)
  const [outcome, setOutcome] = useState<CallStatus>("Interested")
  const [notes, setNotes] = useState("")
  const [followUpDate, setFollowUpDate] = useState("")
  const [followUpTime, setFollowUpTime] = useState("")
  const [logSubmitting, setLogSubmitting] = useState(false)

  function openLogDialog(entry: CallListEntry) {
    setLogEntry(entry)
    setOutcome(entry.status === "Not Called" ? "Interested" : entry.status)
    setNotes("")
    setFollowUpDate(entry.nextFollowUpDate ?? "")
    setFollowUpTime(entry.nextFollowUpTime?.slice(0, 5) ?? "")
  }

  const dueFollowUpCount = useMemo(
    () => entries.filter((e) => e.nextFollowUpDate && e.nextFollowUpDate <= todayKey()).length,
    [entries]
  )

  const [detailsEntry, setDetailsEntry] = useState<CallListEntry | null>(null)

  const dateOptions = useMemo(() => {
    const set = new Set(callHistory.map((h) => h.calledAt.slice(0, 10)))
    set.add(todayKey())
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [callHistory])

  const filteredHistory = useMemo(
    () => (selectedDate === ALL_DATES ? callHistory : callHistory.filter((h) => h.calledAt.slice(0, 10) === selectedDate)),
    [callHistory, selectedDate]
  )
  const callsForSelected = filteredHistory.length
  const interestedForSelected = filteredHistory.filter((h) => h.outcome === "Interested").length
  const notInterestedForSelected = filteredHistory.filter((h) => h.outcome === "Not Interested").length
  const isToday = selectedDate === todayKey()

  function handleCsvFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? "")
      // Accept "Name,Phone" or a single phone-number-per-line CSV; skip an
      // obvious header row (first cell isn't a number-ish phone value).
      const lines = text.split(/\r?\n/).filter(Boolean)
      if (lines.length && /[a-zA-Z]/.test(lines[0].split(",").pop() ?? "")) {
        lines.shift()
      }
      setBulkText((prev) => (prev ? `${prev}\n${lines.join("\n")}` : lines.join("\n")))
    }
    reader.readAsText(file)
  }

  function applyCreatedEntries(created: CreatedEntry[]) {
    const now = new Date().toISOString()
    setEntries((prev) => [
      ...created.map((e) => ({
        id: e.id,
        name: e.name,
        phone: e.phone,
        notes: e.notes,
        status: e.status,
        lastCalledAt: e.lastCalledAt,
        callCount: e.callCount,
        createdAt: now,
        nextFollowUpDate: null,
        nextFollowUpTime: null,
      })),
      ...prev,
    ])
    const logs = created
      .filter((e): e is CreatedEntry & { callLog: NonNullable<CreatedEntry["callLog"]> } => e.callLog !== null)
      .map((e) => ({
        id: e.callLog.id,
        outcome: e.callLog.outcome,
        notes: e.callLog.notes,
        calledAt: e.callLog.calledAt,
        employeeName: null,
        phone: e.phone,
      }))
    if (logs.length > 0) {
      setCallHistory((prev) => [...logs, ...prev])
      setSelectedDate(todayKey())
    }
  }

  async function handleBulkAdd() {
    const lines = parseBulkLines(bulkText)

    if (lines.length === 0) {
      setBulkError("Add at least one phone number — one per line, optionally \"Name, Phone\".")
      return
    }
    setBulkSubmitting(true)
    setBulkError(null)
    try {
      const res = await fetch("/api/call-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: lines }),
      })
      const body = await res.json()
      if (!res.ok) {
        setBulkError(body.error ?? "Could not add these numbers.")
        return
      }
      applyCreatedEntries(body.entries)
      setBulkText("")
      setBulkOpen(false)
    } finally {
      setBulkSubmitting(false)
    }
  }

  async function handleSingleAdd() {
    if (!singlePhone.trim()) {
      setSingleError("Enter a phone number.")
      return
    }
    setSingleSubmitting(true)
    setSingleError(null)
    try {
      const res = await fetch("/api/call-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [{ name: singleName, phone: singlePhone, notes: singleNotes, status: singleStatus }],
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setSingleError(body.error ?? "Could not add this number.")
        return
      }
      applyCreatedEntries(body.entries)
      setSingleName("")
      setSinglePhone("")
      setSingleNotes("")
      setSingleStatus("Not Called")
      setBulkOpen(false)
    } finally {
      setSingleSubmitting(false)
    }
  }

  async function handleLogCall() {
    if (!logEntry) return
    setLogSubmitting(true)
    try {
      const res = await fetch(`/api/call-list/${logEntry.id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          notes,
          nextFollowUpDate: followUpDate || null,
          nextFollowUpTime: followUpDate && followUpTime ? followUpTime : null,
        }),
      })
      if (!res.ok) return
      const now = new Date().toISOString()
      setEntries((prev) =>
        prev.map((e) =>
          e.id === logEntry.id
            ? {
                ...e,
                status: outcome,
                notes: notes || e.notes,
                lastCalledAt: now,
                callCount: e.callCount + 1,
                nextFollowUpDate: followUpDate || null,
                nextFollowUpTime: followUpDate && followUpTime ? followUpTime : null,
              }
            : e
        )
      )
      setCallHistory((prev) => [
        { id: `${logEntry.id}-${now}`, outcome, notes: notes || null, calledAt: now, phone: logEntry.phone, employeeName: null },
        ...prev,
      ])
      setSelectedDate(todayKey())
      setLogEntry(null)
      setNotes("")
      setOutcome("Interested")
      setFollowUpDate("")
      setFollowUpTime("")
    } finally {
      setLogSubmitting(false)
    }
  }

  function exportHistory() {
    downloadCsv(
      `call-history-${selectedDate === ALL_DATES ? "all" : selectedDate}.csv`,
      filteredHistory.map((h) => ({
        "Date/time": h.calledAt,
        Phone: h.phone,
        Outcome: h.outcome,
        Notes: h.notes ?? "",
      }))
    )
  }

  const detailsHistory = detailsEntry ? callHistory.filter((h) => h.phone === detailsEntry.phone) : []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calls"
        description="Your own calling list — build it yourself, work through it daily."
        actions={
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus /> Add numbers
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg">Add numbers to your call list</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="single">
                <TabsList>
                  <TabsTrigger value="single">Single number</TabsTrigger>
                  <TabsTrigger value="bulk">Bulk / paste</TabsTrigger>
                </TabsList>

                <TabsContent value="single" className="flex flex-col gap-4 py-1">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="single-name">Name</Label>
                      <Input
                        id="single-name"
                        className="h-10 text-base"
                        value={singleName}
                        onChange={(e) => setSingleName(e.target.value)}
                        placeholder="e.g. Vikram Anand"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="single-phone">Phone</Label>
                      <Input
                        id="single-phone"
                        className="h-10 text-base"
                        value={singlePhone}
                        onChange={(e) => setSinglePhone(e.target.value)}
                        placeholder="e.g. +91 90000 00001"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="single-status">Status</Label>
                    <Select value={singleStatus} onValueChange={(v) => setSingleStatus((v as CallStatus) ?? "Not Called")}>
                      <SelectTrigger id="single-status" className="h-10 w-full text-base">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Not Called">Not Called</SelectItem>
                        {outcomes.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Already called this number? Pick the outcome here — it&apos;ll be saved straight into your call history.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="single-notes">Notes</Label>
                    <Textarea
                      id="single-notes"
                      value={singleNotes}
                      onChange={(e) => setSingleNotes(e.target.value)}
                      placeholder="What did they say? Anything to remember for next time…"
                      rows={3}
                    />
                  </div>
                  {singleError ? <p className="text-sm text-destructive">{singleError}</p> : null}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setBulkOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSingleAdd} disabled={singleSubmitting}>
                      {singleSubmitting ? "Adding…" : "Add number"}
                    </Button>
                  </DialogFooter>
                </TabsContent>

                <TabsContent value="bulk" className="flex flex-col gap-3 py-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      One per line. Optionally add a name first: <span className="font-mono text-xs">Name, Phone</span>
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload /> Upload CSV
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleCsvFile(file)
                        e.target.value = ""
                      }}
                    />
                  </div>
                  <Textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={"Vikram Anand, +91 90000 00001\n+91 90000 00002"}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Bulk-added numbers start as &quot;Not Called&quot; — use Action → Log call on each once you&apos;ve dialed it.
                  </p>
                  {bulkError ? <p className="text-sm text-destructive">{bulkError}</p> : null}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setBulkOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleBulkAdd} disabled={bulkSubmitting}>
                      {bulkSubmitting ? "Adding…" : "Add to my list"}
                    </Button>
                  </DialogFooter>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Numbers in my list" value={String(entries.length)} icon={Phone} />
        <StatCard label={isToday ? "Calls today" : "Calls"} value={String(callsForSelected)} icon={PhoneCall} />
        <StatCard label={isToday ? "Interested today" : "Interested"} value={String(interestedForSelected)} icon={ThumbsUp} />
        <StatCard
          label={isToday ? "Not interested today" : "Not interested"}
          value={String(notInterestedForSelected)}
          icon={ThumbsDown}
        />
        <StatCard label="Follow-ups due" value={String(dueFollowUpCount)} icon={CalendarClock} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My list</CardTitle>
          <CardDescription>
            Log the outcome right after each call. Sorted by next follow-up due.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead>Last called</TableHead>
                <TableHead>Next follow-up</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => {
                const tone = followUpTone(e.nextFollowUpDate)
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{e.phone}</TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                      {e.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.callCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.lastCalledAt ? formatRelativeTime(e.lastCalledAt) : "—"}
                    </TableCell>
                    <TableCell>
                      {tone ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                            FOLLOW_UP_BADGE_CLASSES[tone]
                          )}
                        >
                          {tone === "overdue" ? "Overdue · " : tone === "today" ? "Today · " : ""}
                          {formatFollowUp(e.nextFollowUpDate, e.nextFollowUpTime)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
                          Action <ChevronDown />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openLogDialog(e)}>Log call</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDetailsEntry(e)}>View details</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No numbers yet — add some to start calling.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Call history</CardTitle>
            <CardDescription>
              {selectedDate === ALL_DATES
                ? "Every call you've logged, most recent first."
                : `Calls on ${isToday ? "today" : formatDate(selectedDate)}.`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedDate} onValueChange={(v) => setSelectedDate(v ?? todayKey())}>
              <SelectTrigger className="h-9 w-44 text-sm">
                <SelectValue placeholder="Date">
                  {(value: string) => (value === ALL_DATES ? "All time" : formatDate(value))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DATES}>All time</SelectItem>
                {dateOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {formatDate(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportHistory} disabled={filteredHistory.length === 0}>
              <Download /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(h.calledAt)}</TableCell>
                  <TableCell className="font-mono text-sm">{h.phone}</TableCell>
                  <TableCell>
                    <StatusBadge status={h.outcome} />
                  </TableCell>
                  <TableCell className="max-w-72 text-sm text-muted-foreground">{h.notes ?? "—"}</TableCell>
                </TableRow>
              ))}
              {filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No calls logged for this date.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!logEntry} onOpenChange={(v) => !v && setLogEntry(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Log call — {logEntry?.name ?? logEntry?.phone}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-1.5">
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome((v as CallStatus) ?? "Interested")}>
                <SelectTrigger className="h-10 w-full text-base">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  {outcomes.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did they say? Anything to remember for next time…"
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Next follow-up (optional)</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  className="h-10 text-base"
                  value={followUpDate}
                  min={todayKey()}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
                <Input
                  type="time"
                  className="h-10 text-base"
                  value={followUpTime}
                  disabled={!followUpDate}
                  onChange={(e) => setFollowUpTime(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Set this to remind yourself to call back — it shows up in your list until you log the next call.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogEntry(null)}>
              Cancel
            </Button>
            <Button onClick={handleLogCall} disabled={logSubmitting}>
              {logSubmitting ? "Saving…" : "Save outcome"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsEntry} onOpenChange={(v) => !v && setDetailsEntry(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{detailsEntry?.name ?? detailsEntry?.phone}</DialogTitle>
            <DialogDescription>
              {detailsEntry?.phone} · {detailsEntry?.callCount ?? 0} call{detailsEntry?.callCount === 1 ? "" : "s"} logged
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailsHistory.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(h.calledAt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={h.outcome} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{h.notes ?? "—"}</TableCell>
                </TableRow>
              ))}
              {detailsHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    No calls logged for this number yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsEntry(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
