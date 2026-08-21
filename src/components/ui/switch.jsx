"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const MOTION_DURATION_MS = 240

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

const Switch = React.forwardRef(({
  className,
  onCheckedChange,
  size = "compact",
  style,
  variant = "default",
  ...props
}, ref) => {
  const [motion, setMotion] = React.useState(null)
  const motionTimeoutRef = React.useRef(null)
  const sizeConfig = switchSizes[size] ?? switchSizes.compact
  const variantClassName = switchVariants[variant] ?? switchVariants.default

  React.useEffect(() => () => {
    if (motionTimeoutRef.current !== null) {
      clearTimeout(motionTimeoutRef.current)
    }
  }, [])

  const handleCheckedChange = React.useCallback((nextChecked) => {
    if (motionTimeoutRef.current !== null) {
      clearTimeout(motionTimeoutRef.current)
    }

    setMotion(nextChecked ? "to-checked" : "to-unchecked")
    motionTimeoutRef.current = setTimeout(() => {
      setMotion(null)
      motionTimeoutRef.current = null
    }, MOTION_DURATION_MS)

    onCheckedChange?.(nextChecked)
  }, [onCheckedChange])

  return (
    <SwitchPrimitives.Root
      className={cn(
        "switch-track peer inline-flex shrink-0 cursor-pointer items-center overflow-hidden border-0 shadow-sm transition-colors contain-[paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        variantClassName,
        className
      )}
      data-size={size}
      data-variant={variant}
      onCheckedChange={handleCheckedChange}
      style={{ ...sizeConfig.properties, ...style }}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className="switch-thumb pointer-events-none block bg-background shadow-lg ring-0"
        data-motion={motion ?? undefined}
      />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
