import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const inputBaseClassName = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

const layoutClassPattern = /^(?:w-|min-w-|max-w-|h-|min-h-|max-h-|flex-|flex$|grow|grow-|shrink|shrink-|basis-|-?m[trblxy]?[-\[]|self-|place-self-|justify-self-|items-self-|col-|row-)/

const splitLayoutClasses = (className) => {
  const tokens = cn(className).split(/\s+/).filter(Boolean)
  const layout = []
  const visual = []

  tokens.forEach((token) => {
    if (layoutClassPattern.test(token)) {
      layout.push(token)
      return
    }
    visual.push(token)
  })

  return {
    layoutClassName: layout.join(" "),
    visualClassName: visual.join(" "),
  }
}

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  const inputRef = React.useRef(null)

  React.useImperativeHandle(ref, () => inputRef.current)

  const stepNumberInput = React.useCallback((direction) => {
    const input = inputRef.current
    if (!input || input.disabled || input.readOnly) return

    try {
      if (direction > 0) {
        input.stepUp()
      } else {
        input.stepDown()
      }
      input.dispatchEvent(new Event("input", { bubbles: true }))
    } catch {
      input.focus()
    }
  }, [])

  if (type === "number") {
    const { layoutClassName, visualClassName } = splitLayoutClasses(className)
    const disabled = props.disabled || props["aria-disabled"] === "true"
    const readOnly = props.readOnly

    return (
      <span className={cn("relative flex", layoutClassName || "w-full")}>
        <input
          type={type}
          className={cn(
            inputBaseClassName,
            visualClassName,
            layoutClassName.includes("h-") ? "h-full" : "",
            "w-full pr-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          )}
          ref={inputRef}
          {...props} />
        <span className="pointer-events-none absolute bottom-1 right-1 top-1 flex w-5 flex-col text-gray-500 dark:text-gray-300">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Increase value"
            disabled={disabled || readOnly}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => stepNumberInput(1)}
            className="pointer-events-auto flex min-h-0 flex-1 items-center justify-center rounded-sm leading-none transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-white"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Decrease value"
            disabled={disabled || readOnly}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => stepNumberInput(-1)}
            className="pointer-events-auto flex min-h-0 flex-1 items-center justify-center rounded-sm leading-none transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-white"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </span>
      </span>
    )
  }

  return (
    <input
      type={type}
      className={cn(
        inputBaseClassName,
        className
      )}
      ref={inputRef}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
