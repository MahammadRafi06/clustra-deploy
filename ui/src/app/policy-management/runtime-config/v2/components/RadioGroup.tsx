import * as React from 'react';
import {useCallback, useRef} from 'react';

/**
 * Accessible radio group primitive following the WAI-ARIA Authoring
 * Practices pattern: roving tabindex + Home/End/Arrow keys.
 *
 * Use this instead of bespoke <button role="radio"> groups so segmented
 * controls, goal chips, bucket selectors, and tri-state toggles all share
 * the same keyboard contract.
 *
 * Children must be <RadioOption> elements. Visual styling is provided by
 * the caller via `className`; this component is layout-agnostic.
 */
export const RadioGroup: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
}> = ({label, value, onChange, children, className, disabled}) => {
    const groupRef = useRef<HTMLDivElement>(null);

    const focusOption = useCallback((option: HTMLElement | null) => {
        if (option instanceof HTMLElement) {
            option.focus();
        }
    }, []);

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (disabled) return;
            const node = groupRef.current;
            if (!node) return;
            const enabledOptions = Array.from(
                node.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([disabled])')
            );
            if (enabledOptions.length === 0) return;
            const currentIndex = enabledOptions.findIndex(option => option === document.activeElement);
            switch (event.key) {
                case 'ArrowRight':
                case 'ArrowDown': {
                    event.preventDefault();
                    const next = enabledOptions[(currentIndex + 1 + enabledOptions.length) % enabledOptions.length] ?? enabledOptions[0];
                    next.click();
                    focusOption(next);
                    return;
                }
                case 'ArrowLeft':
                case 'ArrowUp': {
                    event.preventDefault();
                    const prev = enabledOptions[(currentIndex - 1 + enabledOptions.length) % enabledOptions.length] ?? enabledOptions[enabledOptions.length - 1];
                    prev.click();
                    focusOption(prev);
                    return;
                }
                case 'Home': {
                    event.preventDefault();
                    const first = enabledOptions[0];
                    first.click();
                    focusOption(first);
                    return;
                }
                case 'End': {
                    event.preventDefault();
                    const last = enabledOptions[enabledOptions.length - 1];
                    last.click();
                    focusOption(last);
                    return;
                }
                default:
                    return;
            }
        },
        [disabled, focusOption]
    );

    return (
        <RadioGroupContext.Provider value={{value, onChange, disabled}}>
            <div ref={groupRef} role='radiogroup' aria-label={label} aria-disabled={disabled || undefined} className={className} onKeyDown={handleKeyDown}>
                {children}
            </div>
        </RadioGroupContext.Provider>
    );
};

interface RadioGroupContextValue {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

/**
 * A single option in a `RadioGroup`. Renders as a button with role="radio".
 *
 * Roving tabindex semantics: only the currently-selected option is
 * keyboard-tabbable; arrow keys move focus + selection between options.
 * When no option matches the current value, the first option becomes
 * tabbable so the group is still reachable from a Tab traversal.
 */
export const RadioOption: React.FC<{
    value: string;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    title?: string;
    /**
     * When true, this option is the keyboard entry point even when no
     * option matches the group's value. Callers should mark exactly one
     * option as `defaultTabbable` per group, or omit it entirely (the
     * component itself doesn't enforce; this is a per-group caller hint).
     */
    defaultTabbable?: boolean;
}> = ({value, children, className, disabled, title, defaultTabbable}) => {
    const context = React.useContext(RadioGroupContext);
    if (!context) {
        throw new Error('RadioOption must be rendered inside a RadioGroup');
    }
    const isSelected = context.value === value;
    const tabIndex = isSelected ? 0 : defaultTabbable && context.value === '__none__' ? 0 : -1;
    return (
        <button
            type='button'
            role='radio'
            aria-checked={isSelected}
            disabled={disabled || context.disabled}
            tabIndex={tabIndex}
            className={`${className || ''} ${isSelected ? 'is-active' : ''}`.trim()}
            title={title}
            onClick={() => {
                if (disabled || context.disabled) return;
                context.onChange(value);
            }}>
            {children}
        </button>
    );
};
