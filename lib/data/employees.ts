import "server-only"
import { unstable_cache } from "next/cache"
import { pool } from "@/lib/db"

export interface EmployeeOption {
  id: string
  name: string
}

// Employee names/active-status change rarely compared to how often Leads,
// Clients, and Payments pages need this list just to populate an "owner"
// dropdown — caching it avoids a DB round trip on every one of those page
// loads. Invalidated via revalidateTag("employees-list") whenever an
// employee is created or edited (app/api/employees/**).
export const getActiveEmployeeOptions = unstable_cache(
  async (): Promise<EmployeeOption[]> => {
    const { rows } = await pool.query<EmployeeOption>(
      `select id, name from public.employees where active order by name`
    )
    return rows
  },
  ["employees-active-dropdown"],
  { tags: ["employees-list"], revalidate: 300 }
)

export const getAllEmployeeOptions = unstable_cache(
  async (): Promise<EmployeeOption[]> => {
    const { rows } = await pool.query<EmployeeOption>(
      `select id, name from public.employees order by name`
    )
    return rows
  },
  ["employees-all-dropdown"],
  { tags: ["employees-list"], revalidate: 300 }
)
