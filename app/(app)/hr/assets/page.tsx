import { getAssets, getOrgOptions } from "@/lib/data/hr"
import { requireHrManager } from "@/lib/hr/server"
import { AssetsClient } from "./assets-client"

export default async function AssetsPage() {
  await requireHrManager()
  const [assets, org] = await Promise.all([getAssets(), getOrgOptions()])
  return <AssetsClient assets={assets} people={org.people} />
}
