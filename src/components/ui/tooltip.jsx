import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import useLyricsStore from '@/context/LyricsStore';
import { getTooltipPosition } from '@/utils/tooltipPosition';

let globalActiveTooltip = null;

export function Tooltip({
    children,
    content,
    delay = 1000,
    side = 'top',
    sideOffset = 8,
    className,
    disabled = false,
}) {
    const showTooltips = useLyricsStore((state) => state.showTooltips);
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState(null);
    const timeoutRef = useRef(null);
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);
    const pointerRef = useRef(null);
    const instanceId = useRef(Math.random().toString(36));

    const calculatePosition = useCallback(() => {
        const wrapper = triggerRef.current;
        const tooltip = tooltipRef.current;
        if (!wrapper || !tooltip) return;

        const anchor = pointerRef.current;
        const anchorRect = anchor
            ? undefined
            : (wrapper.firstElementChild || wrapper).getBoundingClientRect();
        const nextPosition = getTooltipPosition({
            anchor: anchor || undefined,
            anchorRect,
            tooltipWidth: tooltip.offsetWidth,
            tooltipHeight: tooltip.offsetHeight,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            preferred: side,
            gap: sideOffset,
        });

        setPosition((current) => {
            if (
                current
                && current.x === nextPosition.left
                && current.y === nextPosition.top
                && current.placement === nextPosition.placement
            ) {
                return current;
            }
            return {
                x: nextPosition.left,
                y: nextPosition.top,
                placement: nextPosition.placement,
            };
        });
    }, [side, sideOffset]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (triggerRef.current && !triggerRef.current.contains(event.target)) {
                setVisible(false);
                if (globalActiveTooltip === instanceId.current) {
                    globalActiveTooltip = null;
                }
            }
        };

        const hideTooltip = () => {
            if (visible) {
                setVisible(false);
                if (globalActiveTooltip === instanceId.current) {
                    globalActiveTooltip = null;
                }
            }
        };

        document.addEventListener('click', handleClickOutside);
        window.addEventListener('scroll', hideTooltip, true);
        window.addEventListener('resize', calculatePosition);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            window.removeEventListener('scroll', hideTooltip, true);
            window.removeEventListener('resize', calculatePosition);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (globalActiveTooltip === instanceId.current) {
                globalActiveTooltip = null;
            }
        };
    }, [calculatePosition, visible]);

    useEffect(() => {
        if (visible) {
            globalActiveTooltip = instanceId.current;
        } else if (globalActiveTooltip === instanceId.current) {
            globalActiveTooltip = null;
        }
    }, [visible]);

    const childElement = React.Children.only(children);
    const childTitle = childElement.props.title;

    useEffect(() => {
        if (!triggerRef.current) return;

        const element = triggerRef.current.firstElementChild || triggerRef.current;
        if (!element) return;

        if (childTitle) {
            element.removeAttribute('title');

            return () => {
                if (element) {
                    element.setAttribute('title', childTitle);
                }
            };
        }
    }, [childTitle]);

    const suppressed = !showTooltips || disabled;

    // Keep the trigger wrapper mounted while suppressed so interactive children retain
    // their state and CSS transitions when a tooltip is disabled dynamically.
    useEffect(() => {
        if (suppressed) {
            setVisible(false);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            if (globalActiveTooltip === instanceId.current) {
                globalActiveTooltip = null;
            }
            setPosition(null);
        }
    }, [suppressed]);

    useLayoutEffect(() => {
        if (!visible || !tooltipRef.current) return undefined;

        calculatePosition();

        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(calculatePosition);
        observer.observe(tooltipRef.current);
        return () => observer.disconnect();
    }, [calculatePosition, content, visible]);

    const showTooltip = () => {
        timeoutRef.current = null;
        if (suppressed) return;
        if (!globalActiveTooltip || globalActiveTooltip === instanceId.current) {
            setPosition(null);
            setVisible(true);
        }
    };

    const updatePointer = (event) => {
        if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
            pointerRef.current = { x: event.clientX, y: event.clientY };
        }
    };

    const handleMouseEnter = (event) => {
        if (suppressed) return;
        if (globalActiveTooltip && globalActiveTooltip !== instanceId.current) {
            return;
        }

        updatePointer(event);
        timeoutRef.current = setTimeout(showTooltip, delay);
    };

    const handleMouseMove = (event) => {
        if (!visible) updatePointer(event);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        pointerRef.current = null;
        setPosition(null);
        setVisible(false);
    };

    const tooltipContent = !suppressed && visible && typeof document !== 'undefined' ? (
        createPortal(
            <div
                ref={tooltipRef}
                role="tooltip"
                data-side={position?.placement || side}
                className={cn(
                    'fixed z-[9999] flex items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg',
                    'bg-gray-900 border-gray-700 text-gray-100',
                    'dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200',
                    position && 'tooltip-opacity-fade',
                    className
                )}
                style={{
                    left: `${position?.x || 0}px`,
                    top: `${position?.y || 0}px`,
                    maxWidth: 'min(280px, calc(100vw - 16px))',
                    maxHeight: 'calc(100vh - 16px)',
                    overflowY: 'auto',
                    pointerEvents: 'none',
                    visibility: position ? 'visible' : 'hidden',
                }}
            >
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{content}</span>
            </div>,
            document.body
        )
    ) : null;

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="contents"
            >
                {children}
            </div>
            {tooltipContent}
        </>
    );
}
