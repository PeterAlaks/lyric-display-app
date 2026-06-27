import * as React from "react"
import { createPortal } from "react-dom"
import { HexColorPicker } from "react-colorful"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : { r: 0, g: 0, b: 0 }
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? "0" + hex : hex
  }).join("")
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex)
  const r1 = r / 255
  const g1 = g / 255
  const b1 = b / 255

  const max = Math.max(r1, g1, b1)
  const min = Math.min(r1, g1, b1)
  let h, s, l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r1: h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6; break
      case g1: h = ((b1 - r1) / d + 2) / 6; break
      case b1: h = ((r1 - g1) / d + 4) / 6; break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function hslToHex(h, s, l) {
  s /= 100
  l /= 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x
  }

  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  )
}

const ColorPicker = React.forwardRef(({
  value,
  onChange,
  className,
  disabled,
  showHex = false,
  darkMode = false,
  presentation = "default",
  ...props
}, ref) => {
  const [open, setOpen] = React.useState(false)
  const [color, setColor] = React.useState(value || "#000000")
  const [format, setFormat] = React.useState("hex")
  const contentRef = React.useRef(null)
  const sheetMode = presentation === 'sheet'

  React.useEffect(() => {
    if (value) {
      setColor(value)
    }
  }, [value])

  React.useEffect(() => {
    if (!open) return undefined

    const blockOutsideScroll = (event) => {
      const target = event.target
      if (contentRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-popover-scroll-lock-allow="true"]')) return
      event.preventDefault()
      event.stopPropagation()
    }

    const opts = { passive: false, capture: true }
    window.addEventListener('wheel', blockOutsideScroll, opts)
    window.addEventListener('touchmove', blockOutsideScroll, opts)

    return () => {
      window.removeEventListener('wheel', blockOutsideScroll, opts)
      window.removeEventListener('touchmove', blockOutsideScroll, opts)
    }
  }, [open])

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen)
    if (nextOpen || sheetMode) {
      setColor(value || "#000000")
    }
  }

  const handleColorChange = (newColor) => {
    setColor(newColor)
    if (!sheetMode) {
      onChange?.(newColor)
    }
  }

  const handleApply = () => {
    onChange?.(color)
    setOpen(false)
  }

  const rgb = hexToRgb(color)
  const hsl = hexToHsl(color)

  const handleInputChange = (newValue, type) => {
    if (format === "hex") {
      const hex = newValue.startsWith("#") ? newValue : `#${newValue}`
      if (/^#[0-9A-F]{6}$/i.test(hex)) {
        handleColorChange(hex)
      }
    } else if (format === "rgb") {
      const newRgb = { ...rgb, [type]: parseInt(newValue) || 0 }
      handleColorChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b))
    } else if (format === "hsl") {
      const newHsl = { ...hsl, [type]: parseInt(newValue) || 0 }
      handleColorChange(hslToHex(newHsl.h, newHsl.s, newHsl.l))
    }
  }

  const pickerPanel = (
    <div className={`${presentation === 'sheet' ? 'mx-auto max-w-sm' : ''} space-y-3`}>
      <HexColorPicker color={color} onChange={handleColorChange} />

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFormat("hex")}
          className={cn(
            "flex-1",
            format === "hex"
              ? darkMode
                ? "bg-white! text-gray-900! hover:bg-white! border-gray-300!"
                : "bg-black! text-white! hover:bg-black! border-gray-300!"
              : darkMode
                ? "bg-transparent! border-gray-600! text-gray-200! hover:bg-gray-700!"
                : "bg-transparent! border-gray-300! text-gray-700! hover:bg-gray-100!"
          )}
        >
          HEX
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFormat("rgb")}
          className={cn(
            "flex-1",
            format === "rgb"
              ? darkMode
                ? "bg-white! text-gray-900! hover:bg-white! border-gray-300!"
                : "bg-black! text-white! hover:bg-black! border-gray-300!"
              : darkMode
                ? "bg-transparent! border-gray-600! text-gray-200! hover:bg-gray-700!"
                : "bg-transparent! border-gray-300! text-gray-700! hover:bg-gray-100!"
          )}
        >
          RGB
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFormat("hsl")}
          className={cn(
            "flex-1",
            format === "hsl"
              ? darkMode
                ? "bg-white! text-gray-900! hover:bg-white! border-gray-300!"
                : "bg-black! text-white! hover:bg-black! border-gray-300!"
              : darkMode
                ? "bg-transparent! border-gray-600! text-gray-200! hover:bg-gray-700!"
                : "bg-transparent! border-gray-300! text-gray-700! hover:bg-gray-100!"
          )}
        >
          HSL
        </Button>
      </div>

      {format === "hex" && (
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium w-8 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>#</span>
          <Input
            value={color.replace("#", "")}
            onChange={(e) => handleInputChange(e.target.value, "hex")}
            className={`flex-1 uppercase ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
            maxLength={6}
          />
        </div>
      )}

      {format === "rgb" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium w-8 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>R</span>
            <Input
              type="number"
              value={rgb.r}
              onChange={(e) => handleInputChange(e.target.value, "r")}
              min={0}
              max={255}
              className={`flex-1 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium w-8 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>G</span>
            <Input
              type="number"
              value={rgb.g}
              onChange={(e) => handleInputChange(e.target.value, "g")}
              min={0}
              max={255}
              className={`flex-1 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium w-8 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>B</span>
            <Input
              type="number"
              value={rgb.b}
              onChange={(e) => handleInputChange(e.target.value, "b")}
              min={0}
              max={255}
              className={`flex-1 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
            />
          </div>
        </div>
      )}

      {format === "hsl" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium w-8 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>H</span>
            <Input
              type="number"
              value={hsl.h}
              onChange={(e) => handleInputChange(e.target.value, "h")}
              min={0}
              max={360}
              className={`flex-1 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium w-8 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>S</span>
            <Input
              type="number"
              value={hsl.s}
              onChange={(e) => handleInputChange(e.target.value, "s")}
              min={0}
              max={100}
              className={`flex-1 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium w-8 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>L</span>
            <Input
              type="number"
              value={hsl.l}
              onChange={(e) => handleInputChange(e.target.value, "l")}
              min={0}
              max={100}
              className={`flex-1 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
            />
          </div>
        </div>
      )}
    </div>
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 items-center gap-2 rounded-md border border-input bg-transparent text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            showHex ? "w-full px-3 py-2" : "w-12 justify-center p-1.5",
            className
          )}
          {...props}
        >
          <div
            className={cn(
              "rounded border border-border shrink-0",
              showHex ? "h-5 w-5" : "h-6 w-full"
            )}
            style={{ backgroundColor: color }}
          />
          {showHex && <span className="flex-1 text-left font-mono text-xs">{color.toUpperCase()}</span>}
        </button>
      </PopoverTrigger>
      {sheetMode && open && typeof document !== 'undefined' ? createPortal(
        <div
          className="fixed inset-0 z-2400 bg-black/35 p-2"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleOpenChange(false)
          }}
        >
          <div
            ref={contentRef}
            data-popover-scroll-lock-allow="true"
            className={`flex h-full flex-col overflow-hidden rounded-lg border shadow-2xl ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
          >
            <div className={`flex items-center justify-between border-b px-4 py-3 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Choose Colour</div>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${darkMode ? 'border-gray-700 text-gray-200 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {pickerPanel}
            </div>
            <div className={`border-t p-3 ${darkMode ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-gray-50'}`}>
              <Button
                type="button"
                onClick={handleApply}
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>,
        document.body
      ) : (
        <PopoverContent
          ref={contentRef}
          data-popover-scroll-lock-allow="true"
          className={`w-56 p-3 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
          align="start"
        >
          {pickerPanel}
        </PopoverContent>
      )}
    </Popover>
  )
})

ColorPicker.displayName = "ColorPicker"

export { ColorPicker }
