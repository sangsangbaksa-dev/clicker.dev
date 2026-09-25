"use client"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "cn"
import Link from "next/link"
import type { ComponentProps } from "react"
import type { VariantProps } from "class-variance-authority"

type ButtonLinkProps = ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants>

function ButtonLink({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      data-slot="button-link"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { ButtonLink }
