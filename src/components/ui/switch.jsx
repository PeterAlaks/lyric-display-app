"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const switchSizes = {
  compact: {
    properties: {
      "--switch-track-width": "2.5rem",
      "--switch-track-height": "1.25rem",
      "--switch-thumb-width": "1.75rem",
    },
  },
  small: {
    properties: {
      "--switch-track-width": "3.25rem",
      "--switch-track-height": "1.5rem",
      "--switch-thumb-width": "2rem",
    },
  },
  medium: {
    properties: {
      "--switch-track-width": "3.75rem",
      "--switch-track-height": "1.75rem",
      "--switch-thumb-width": "2.25rem",
    },
  },
  large: {
    properties: {
      "--switch-track-width": "4.5rem",
      "--switch-track-height": "2rem",
      "--switch-thumb-width": "2.5rem",
    },
  },
}

const switchVariants = {
  default: "data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-input dark:data-[state=checked]:bg-green-400",
  control: "data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 dark:data-[state=checked]:bg-green-400 dark:data-[state=unchecked]:bg-gray-600",
  success: "data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-200 dark:data-[state=checked]:bg-green-400 dark:data-[state=unchecked]:bg-gray-700",
  warning: "data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 dark:data-[state=checked]:bg-green-400 dark:data-[state=unchecked]:bg-gray-600",
  blue: "data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-input dark:data-[state=checked]:bg-green-400",
}

// Motion (press stretch, spring slide, track fade) lives in the .switch-track and
// .switch-thumb styles in index.css and follows data-state, so every state change animates.
const Switch = React.forwardRef(({
  className,
  size = "compact",
  style,
  variant = "default",
  ...props
}, ref) => {
  const sizeConfig = switchSizes[size] ?? switchSizes.compact
  const variantClassName = switchVariants[variant] ?? switchVariants.default

  return (
    <SwitchPrimitives.Root
      className={cn(
        "switch-track peer inline-flex shrink-0 cursor-pointer items-center overflow-hidden border-0 shadow-sm contain-[paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        variantClassName,
        className
      )}
      data-size={size}
      data-variant={variant}
      style={{ ...sizeConfig.properties, ...style }}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb className="switch-thumb pointer-events-none block ring-0" />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
