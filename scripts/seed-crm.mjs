// One-off seeding script: loads the illustrative leads/clients (same data
// that used to live in lib/mock-data.ts) into the real leads/clients tables.
//
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node scripts/seed-crm.mjs
//
// Safe to re-run: rows already present (by id) are skipped.

import { Client } from "pg"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("Set DATABASE_URL first.")
  process.exit(1)
}

const client = new Client({ connectionString })
await client.connect()

const { rows: employees } = await client.query("select id, login_id, name from public.employees")
const employeeIdByName = new Map(employees.map((e) => [e.name, e.id]))

const leads = [
  { id: "LD-1042", company: "Anand Retail Group", contact: "Vikram Anand", designation: "Marketing Head", source: "Referral", industry: "Retail", stage: "Meeting Scheduled", owner: "Neha Kulkarni", nextAction: "Discovery call", nextActionDue: "2026-09-15", createdAt: "2026-09-02" },
  { id: "LD-1041", company: "Bluewave Logistics", contact: "Farah Sheikh", designation: "Operations Director", source: "Website", industry: "Logistics", stage: "Contacted", owner: "Rohit Malhotra", nextAction: "Send SMS pricing deck", nextActionDue: "2026-09-13", createdAt: "2026-09-05" },
  { id: "LD-1039", company: "Sundar Finserv", contact: "Kavya Reddy", designation: "Founder", source: "Cold Outreach", industry: "Finance", stage: "New", owner: "Neha Kulkarni", nextAction: "Qualify budget", nextActionDue: "2026-09-16", createdAt: "2026-09-09" },
  { id: "LD-1035", company: "Coastal Hospitality", contact: "Imran Qureshi", designation: "GM", source: "Trade Show", industry: "Hospitality", stage: "Won", owner: "Rohit Malhotra", nextAction: "Kick off onboarding", nextActionDue: "2026-09-14", createdAt: "2026-08-21" },
  { id: "LD-1030", company: "Northgate Pharma", contact: "Sana Iyer", designation: "Brand Manager", source: "Referral", industry: "Healthcare", stage: "Lost", owner: "Neha Kulkarni", nextAction: null, nextActionDue: null, createdAt: "2026-08-12" },
  { id: "LD-1044", company: "Vertex Realty", contact: "Aditya Bose", designation: "CMO", source: "Website", industry: "Real Estate", stage: "Meeting Scheduled", owner: "Rohit Malhotra", nextAction: "Confirm WhatsApp use case", nextActionDue: "2026-09-17", createdAt: "2026-09-10" },
]

const clients = [
  { id: "CL-2001", company: "Coastal Hospitality", industry: "Hospitality", owner: "Rohit Malhotra", status: "Active", balance: 42500, lastReceiptDate: "2026-09-04", since: "2026-08-25" },
  { id: "CL-2002", company: "Meridian Autoparts", industry: "Automotive", owner: "Neha Kulkarni", status: "Active", balance: -8600, lastReceiptDate: "2026-09-08", since: "2026-05-11" },
  { id: "CL-2003", company: "Orchid Clinics", industry: "Healthcare", owner: "Neha Kulkarni", status: "Active", balance: 118400, lastReceiptDate: "2026-08-29", since: "2026-03-02" },
  { id: "CL-2004", company: "Zenith Edu Services", industry: "Education", owner: "Rohit Malhotra", status: "On Hold", balance: 0, lastReceiptDate: "2026-07-19", since: "2026-02-14" },
  { id: "CL-2005", company: "Harbor Freight Co.", industry: "Logistics", owner: "Rohit Malhotra", status: "Active", balance: 6200, lastReceiptDate: "2026-09-10", since: "2026-06-30" },
  { id: "CL-2006", company: "Pinecrest Realty", industry: "Real Estate", owner: "Neha Kulkarni", status: "Inactive", balance: 0, lastReceiptDate: "2026-04-02", since: "2025-12-01" },
]

const clientContacts = {
  "CL-2001": [{ name: "Imran Qureshi", designation: "GM", phone: "+91 90000 11001", email: "imran@coastalhospitality.example" }],
  "CL-2003": [{ name: "Dr. Meera Nair", designation: "Admin Head", phone: "+91 90000 11003", email: "meera@orchidclinics.example" }],
}

for (const lead of leads) {
  const { rows: existing } = await client.query("select id from public.leads where id = $1", [lead.id])
  if (existing.length > 0) {
    console.log(`Skipping lead ${lead.id} — already exists.`)
    continue
  }
  await client.query(
    `insert into public.leads
       (id, company, contact, designation, source, industry, stage, owner_employee_id, next_action, next_action_due, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      lead.id, lead.company, lead.contact, lead.designation, lead.source, lead.industry, lead.stage,
      employeeIdByName.get(lead.owner) ?? null, lead.nextAction, lead.nextActionDue, lead.createdAt,
    ]
  )
  await client.query(
    `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail, created_at)
     values ('lead', $1, $2, 'Created', $3, $4)`,
    [lead.id, employeeIdByName.get(lead.owner) ?? null, `Lead created via ${lead.source}`, lead.createdAt]
  )
  console.log(`Created lead ${lead.id}`)
}

for (const c of clients) {
  const { rows: existing } = await client.query("select id from public.clients where id = $1", [c.id])
  if (existing.length > 0) {
    console.log(`Skipping client ${c.id} — already exists.`)
    continue
  }
  await client.query(
    `insert into public.clients
       (id, company, industry, owner_employee_id, status, balance, last_receipt_date, since)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [c.id, c.company, c.industry, employeeIdByName.get(c.owner) ?? null, c.status, c.balance, c.lastReceiptDate, c.since]
  )
  for (const contact of clientContacts[c.id] ?? []) {
    await client.query(
      `insert into public.client_contacts (client_id, name, designation, phone, email)
       values ($1, $2, $3, $4, $5)`,
      [c.id, contact.name, contact.designation, contact.phone, contact.email]
    )
  }
  await client.query(
    `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail, created_at)
     values ('client', $1, $2, 'Onboarded', 'Client record created', $3)`,
    [c.id, employeeIdByName.get(c.owner) ?? null, c.since]
  )
  console.log(`Created client ${c.id}`)
}

console.log("Done.")
await client.end()
