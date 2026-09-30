import type { ChangeEventHandler } from "react"
import { Search } from "@/components/icons"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: ChangeEventHandler<HTMLInputElement>
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        className="pl-8"
        value={value}
        onChange={onChange}
      />
    </div>
  )
}