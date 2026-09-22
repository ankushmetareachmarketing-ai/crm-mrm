// One-off seeding script: creates the illustrative preview employees with
// real bcrypt-hashed passwords in public.employees. Run after
// `supabase db reset` (or `supabase start` on a fresh DB) has applied the
// access_profiles seed:
//
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node scripts/seed-employees.mjs
//
// Safe to re-run: employees already present (by login_id) are skipped. 

import { Client } from "pg"
import bcrypt from "bcryptjs"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("Set DATABASE_URL first.")
  process.exit(1)
}

const client = new Client({ connectionString })
await client.connect()

const seedEmployees = [
  {
    name: "Ravi Kant (Owner)",
    contact: "+91 90000 00001",
    joiningDate: "2024-01-01",
    employmentType: "Full-time",
    profile: "Owner",
    active: true,
    loginId: "ravi.owner",
    password: "Owner@123",
  },
  {
    name: "Neha Kulkarni",
    contact: "+91 90000 00014",
    joiningDate: "2025-03-10",
    employmentType: "Full-time",
    profile: "Sales",
    active: true,
    loginId: "neha.kulkarni",
    password: "Sales@123",
  },
  {
    name: "Rohit Malhotra",
    contact: "+91 90000 00017",
    joiningDate: "2025-05-22",
    employmentType: "Full-time",
    profile: "Sales",
    active: true,
    loginId: "rohit.malhotra",
    password: "Sales@123",
  },
  {
    name: "Priya Sethi",
    contact: "+91 90000 00022",
    joiningDate: "2025-11-04",
    employmentType: "Full-time",
    profile: "Campaign Manager",
    active: true,
    loginId: "priya.sethi",
    password: "Campaign@123",
  },
  {
    name: "Devansh Patil",
    contact: "+91 90000 00025",
    joiningDate: "2026-01-19",
    employmentType: "Full-time",
    profile: "Support/DLT",
    active: true,
    loginId: "devansh.patil",
    password: "Support@123",
  },
  {
    name: "Ishita Rao",
    contact: "+91 90000 00028",
    joiningDate: "2026-04-02",
    employmentType: "Part-time",
    profile: "HR",
    active: false,
    loginId: "ishita.rao",
    password: "Hr@123",
  },
]

const { rows: profiles } = await client.query("select id, name from public.access_profiles")
const profileIdByName = new Map(profiles.map((p) => [p.name, p.id]))

for (const employee of seedEmployees) {
  const { rows: existing } = await client.query(
    "select id from public.employees where login_id = $1",
    [employee.loginId]
  )
  if (existing.length > 0) {
    console.log(`Skipping ${employee.loginId} — already exists.`)
    continue
  }

  const accessProfileId = profileIdByName.get(employee.profile)
  if (!accessProfileId) {
    console.error(`No access profile named "${employee.profile}" — run the seed migration first.`)
    continue
  }

  const passwordHash = await bcrypt.hash(employee.password, 12)

  await client.query(
    `insert into public.employees
       (name, contact, login_id, password_hash, employment_type, access_profile_id, joining_date, active)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      employee.name,
      employee.contact,
      employee.loginId,
      passwordHash,
      employee.employmentType,
      accessProfileId,
      employee.joiningDate,
      employee.active,
    ]
  )

  console.log(`Created ${employee.loginId} (${employee.profile})`)
}

console.log("Done.")
await client.end()
