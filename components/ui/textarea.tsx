import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-base transition-[border-color,box-shadow] duration-200 outline-none placeholder:text-muted-foreground/70 hover:border-foreground/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-saffron/70 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
