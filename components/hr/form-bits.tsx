"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** A numbered form section card, used by the HR forms. */
export function FormSection({
  step,
  title,
  description,
  children,
}: {
  step?: number
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        {step !== undefined ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {step}
          </span>
        ) : null}
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

const NONE = "__none__"

/** A dropdown over { id, name } options with an optional "None" choice; value "" means none. */
export function OptionSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  noneLabel,
  disabled,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  options: { id: string; name: string }[]
  placeholder: string
  /** When given, adds a choice that clears the value. */
  noneLabel?: string
  disabled?: boolean
}) {
  return (
    <Select value={value || (noneLabel ? NONE : "")} onValueChange={(v) => onChange(!v || v === NONE ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id} className="h-10 w-full cursor-pointer text-base">
        <SelectValue placeholder={placeholder}>
          {(v: string) => (!v || v === NONE ? (noneLabel ?? placeholder) : options.find((o) => o.id === v)?.name ?? placeholder)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {noneLabel ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** A dropdown over a plain list of strings; value "" means none chosen. */
export function TextSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger id={id} className="h-10 w-full cursor-pointer text-base">
        <SelectValue placeholder={placeholder}>{(v: string) => v || placeholder}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
