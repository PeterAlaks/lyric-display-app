"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-[18px] w-full touch-none select-none items-center data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55",
      className
    )}
    {...props}>
    <SliderPrimitive.Track
      className="relative h-1.5 w-full grow cursor-pointer overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
      <SliderPrimitive.Range className="absolute h-full bg-black dark:bg-blue-400" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-3.5 w-6 cursor-pointer rounded-full border-0 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.24)] transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/20 disabled:pointer-events-none disabled:opacity-50 dark:bg-slate-50 dark:shadow-[0_2px_10px_rgba(0,0,0,0.45)]" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
