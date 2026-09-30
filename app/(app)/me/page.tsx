import { notFound } from "next/navigation"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { getEmployeeAssets, getEmployeeDocuments, getEmployeeProfile, getOnboardingTasks, getPolicies } from "@/lib/data/hr"
import { MyProfileClient } from "./my-profile-client"

export default async function MyProfilePage() {
  const me = await getCurrentEmployee()
  const [profile, documents, tasks, policies, assets] = await Promise.all([
    getEmployeeProfile(me.id),
    getEmployeeDocuments(me.id),
    getOnboardingTasks(me.id),
    getPolicies(me.id),
    getEmployeeAssets(me.id),
  ])
  if (!profile) notFound()
  return <MyProfileClient profile={profile} documents={documents} tasks={tasks} policies={policies} assets={assets} />
}
