import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center font-caps rounded-md border border-transparent bg-clip-padding text-[0.82rem] leading-none font-semibold tracking-[0.12em] whitespace-nowrap uppercase transition-[background-color,color,border-color,transform,box-shadow] duration-300 ease-(--ease-out-expo) outline-none select-none active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-(--ease-out-expo) hover:[&_svg:last-child:not(:first-child)]:translate-x-0.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-royal-deep dark:hover:bg-cream",
        outline:
          "border-primary/40 bg-transparent text-primary hover:border-primary hover:bg-primary hover:text-primary-foreground aria-expanded:bg-primary aria-expanded:text-primary-foreground",
        secondary:
          "bg-accent text-accent-foreground hover:bg-[color-mix(in_oklch,var(--accent),var(--primary)_12%)] aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        ghost:
          "text-foreground/80 hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive hover:text-cream",
        link: "rounded-none px-0 text-primary link-draw",
      },
      size: {
        default:
          "h-10 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-7 gap-1 px-3 text-[0.72rem] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-4 text-[0.76rem] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-7 text-[0.9rem] has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10",
        "icon-xs":
          "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      // render={<Link/>} etc. produces a non-<button>; Base UI warns unless told. Caller can override.
      nativeButton={props.render ? false : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
