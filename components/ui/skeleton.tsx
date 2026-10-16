import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-xl bg-sand/70", className)}
      {...props}
    />
  )
}

export { Skeleton }
