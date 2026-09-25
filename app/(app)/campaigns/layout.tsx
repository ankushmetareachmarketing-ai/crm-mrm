import { disabledModule } from "@/lib/disabled-module"

// Switched off for go-live — this module still shows mock data.
export default function DisabledModuleLayout(): never {
  disabledModule()
}
