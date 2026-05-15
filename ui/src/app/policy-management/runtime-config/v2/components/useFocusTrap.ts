import {useEffect, useRef} from 'react';

/**
 * Focus-trap hook for modal-style overlays.
 *
 * - When `active` becomes true: focuses the first focusable element inside
 *   the container, and intercepts Tab / Shift+Tab so focus wraps within it.
 * - When `active` becomes false: restores focus to the element that had
 *   focus at the moment the trap activated.
 *
 * Caller is responsible for visibility (the trap doesn't render anything).
 *
 * Returns a ref to attach to the container element.
 *
 * Notes:
 *   - We re-query focusable elements on each Tab keydown so dynamically
 *     added buttons (e.g. inside conditionally-rendered footers) are
 *     included automatically.
 *   - The trap deliberately does NOT intercept Escape; callers usually
 *     want their own Escape handler (with dirty-confirm, etc.).
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
    const containerRef = useRef<T | null>(null);
    const restoreRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!active) return;
        restoreRef.current = (document.activeElement as HTMLElement) || null;
        const container = containerRef.current;
        if (!container) return;
        // Defer initial focus so the container has rendered its children.
        const initial = window.requestAnimationFrame(() => {
            const focusable = readFocusable(container);
            const first = focusable[0];
            if (first) first.focus();
            else container.focus();
        });

        const handleKey = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return;
            const focusable = readFocusable(container);
            if (focusable.length === 0) {
                event.preventDefault();
                container.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const activeElement = document.activeElement as HTMLElement | null;
            if (event.shiftKey) {
                if (activeElement === first || !container.contains(activeElement)) {
                    event.preventDefault();
                    last.focus();
                }
            } else {
                if (activeElement === last || !container.contains(activeElement)) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', handleKey, true);
        return () => {
            window.cancelAnimationFrame(initial);
            document.removeEventListener('keydown', handleKey, true);
            const target = restoreRef.current;
            // Only restore focus when the previously-focused element is
            // still in the document — avoids re-focusing nothing on unmount.
            if (target && document.contains(target)) {
                target.focus();
            }
            restoreRef.current = null;
        };
    }, [active]);

    return containerRef;
}

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    'iframe',
    'object',
    'embed',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

function readFocusable(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(node => {
        if (node.hasAttribute('disabled')) return false;
        if (node.getAttribute('aria-hidden') === 'true') return false;
        // Filter elements that are visually hidden (display:none / hidden attr).
        if (node.hidden) return false;
        return true;
    });
}
