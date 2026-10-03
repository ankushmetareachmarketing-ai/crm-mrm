import { notFound } from "next/navigation"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { getEmployeeAssets, getEmployeeDocuments, getEmployeeProfile, getOnboardingTasks, getPolicies } from "@/lib/data/hr"
import { MyProfileClient } from "./my-profile-client"

export default async function MyProfilePage() {
  const me = await getCurrentEmployee()
  const isOwner = me.role === "Owner"
  // The Owner only edits their own details here, so the rest isn't loaded.
  const [profile, documents, tasks, policies, assets] = await Promise.all([
    getEmployeeProfile(me.id),
    isOwner ? [] : getEmployeeDocuments(me.id),
    isOwner ? [] : getOnboardingTasks(me.id),
    isOwner ? [] : getPolicies(me.id),
    isOwner ? [] : getEmployeeAssets(me.id),
  ])
  if (!profile) notFound()
  return (
    <MyProfileClient
      profile={profile}
      documents={documents}
      tasks={tasks}
      policies={policies}
      assets={assets}
      isOwner={isOwner}
    />
  )
}
