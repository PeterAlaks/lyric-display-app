import * as React from 'react'

import { cn } from '@/lib/utils'

const ACTIVE_TAB_SELECTOR = '[role="tab"][aria-selected="true"], [role="tab"][data-state="active"]'

const SlidingTabIndicator = ({ className }) => {
  const indicatorRef = React.useRef(null)
  const [geometry, setGeometry] = React.useState(null)
  const [canAnimate, setCanAnimate] = React.useState(false)

  React.useLayoutEffect(() => {
    const indicator = indicatorRef.current
    const tabList = indicator?.parentElement
    if (!tabList || typeof window === 'undefined') return undefined

    let measureFrame = 0
    let readyFrame = 0
    let hasMeasured = false

    const measure = () => {
      window.cancelAnimationFrame(measureFrame)
      measureFrame = window.requestAnimationFrame(() => {
        const activeTab = tabList.querySelector(ACTIVE_TAB_SELECTOR)
        if (!activeTab) {
          setGeometry(null)
          return
        }

        const listRect = tabList.getBoundingClientRect()
        const tabRect = activeTab.getBoundingClientRect()
        const nextGeometry = {
          x: tabRect.left - listRect.left + tabList.scrollLeft,
          y: tabRect.top - listRect.top + tabList.scrollTop,
          width: tabRect.width,
          height: tabRect.height,
        }

        setGeometry((current) => (
          current
          && current.x === nextGeometry.x
          && current.y === nextGeometry.y
          && current.width === nextGeometry.width
          && current.height === nextGeometry.height
            ? current
            : nextGeometry
        ))

        if (!hasMeasured) {
          hasMeasured = true
          readyFrame = window.requestAnimationFrame(() => setCanAnimate(true))
        }
      })
    }

    const mutationObserver = new MutationObserver(measure)
    mutationObserver.observe(tabList, {
      attributes: true,
      attributeFilter: ['aria-selected', 'data-state'],
      childList: true,
      subtree: true,
    })

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(measure)
    resizeObserver?.observe(tabList)
    tabList.querySelectorAll('[role="tab"]').forEach((tab) => resizeObserver?.observe(tab))

    window.addEventListener('resize', measure)
    measure()

    return () => {
      window.cancelAnimationFrame(measureFrame)
      window.cancelAnimationFrame(readyFrame)
      mutationObserver.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <span
      ref={indicatorRef}
      aria-hidden="true"
      data-animated={canAnimate ? 'true' : 'false'}
      className={cn(
        'tab-switcher-indicator tab-switcher-item-squircle pointer-events-none absolute left-0 top-0 z-0',
        className
      )}
      style={{
        width: geometry?.width ?? 0,
        height: geometry?.height ?? 0,
        opacity: geometry ? 1 : 0,
        transform: `translate3d(${geometry?.x ?? 0}px, ${geometry?.y ?? 0}px, 0)`,
      }}
    />
  )
}

export { SlidingTabIndicator }
