import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

let globalActiveTooltip = null;

export function Tooltip({ children, content, delay = 1000, side = 'top', className }) {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const timeoutRef = useRef(null);
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);
    const instanceId = useRef(Math.random().toString(36));

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (triggerRef.current && !triggerRef.current.contains(event.target)) {
                setVisible(false);
                if (globalActiveTooltip === instanceId.current) {
                    globalActiveTooltip = null;
                }
            }
        };

        const handleScroll = () => {
            if (visible) {
                setVisible(false);
                if (globalActiveTooltip === instanceId.current) {
                    globalActiveTooltip = null;
                }
            }
        };

        document.addEventListener('click', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (globalActiveTooltip === instanceId.current) {
                globalActiveTooltip = null;
            }
        };
    }, [visible]);

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

    const calculatePosition = () => {
        if (!triggerRef.current) return;

        const element = triggerRef.current.firstElementChild || triggerRef.current;
        if (!element) return;

        const rect = element.getBoundingClientRect();

        const tooltipWidth = tooltipRef.current?.offsetWidth || 280;
        const tooltipHeight = tooltipRef.current?.offsetHeight || 60;
        const gap = 8;

        let x, y;

        switch (side) {
            case 'top':
                x = rect.left + rect.width / 2 - tooltipWidth / 2;
                y = rect.top - tooltipHeight - gap;
                break;
            case 'bottom':
                x = rect.left + rect.width / 2 - tooltipWidth / 2;
                y = rect.bottom + gap;
                break;
            case 'left':
                x = rect.left - tooltipWidth - gap;
                y = rect.top + rect.height / 2 - tooltipHeight / 2;
                break;
            case 'right':
                x = rect.right + gap;
                y = rect.top + rect.height / 2 - tooltipHeight / 2;
                break;
            default:
                x = rect.left + rect.width / 2 - tooltipWidth / 2;
                y = rect.top - tooltipHeight - gap;
        }

        const padding = 8;
        x = Math.max(padding, Math.min(x, window.innerWidth - tooltipWidth - padding));
        y = Math.max(padding, Math.min(y, window.innerHeight - tooltipHeight - padding));

        setPosition({ x, y });
    };

    const showTooltip = () => {
        if (!globalActiveTooltip || globalActiveTooltip === instanceId.current) {
            calculatePosition();
            setVisible(true);
        }
    };

    const handleMouseEnter = () => {
        if (globalActiveTooltip && globalActiveTooltip !== instanceId.current) {
            return;
        }

        timeoutRef.current = setTimeout(showTooltip, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setVisible(false);
    };

    useEffect(() => {
        if (visible && tooltipRef.current) {
            calculatePosition();
        }
    }, [visible]);

    const tooltipContent = visible && typeof document !== 'undefined' ? (
        createPortal(
            <div
                ref={tooltipRef}
                className={cn(
                    'fixed z-[9999] flex items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg animate-in fade-in-0 zoom-in-95 duration-200',
                    'bg-gray-900 border-gray-700 text-gray-100',
                    'dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200',
                    className
                )}
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    maxWidth: '280px',
                    pointerEvents: 'none',
                }}
            >
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
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
                onMouseLeave={handleMouseLeave}
                className="contents"
            >
                {children}
            </div>
            {tooltipContent}
        </>
    );
}