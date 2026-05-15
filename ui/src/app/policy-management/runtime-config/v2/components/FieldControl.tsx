import * as React from 'react';

import {editableDefaultValue, formatRuntimeValue, hasDefaultValue, isFlagArg, itemChoices, itemDefault, itemLabel, itemType} from '../../runtimeConfigUtils';
import {hasFiniteChoices, isBooleanItem, isNumericItem, itemHint, itemImpacts, readNumericRange, valuesEqual} from '../utils';
import type {RuntimeConfigCatalogItemRecord, RuntimeConfigKind} from '../types';
import {RadioGroup, RadioOption} from './RadioGroup';

type FieldControlProps = {
    item: RuntimeConfigCatalogItemRecord;
    role: string;
    kind: RuntimeConfigKind;
    value: unknown;
    defaultValue: unknown;
    isOverridden: boolean;
    onChange: (value: unknown) => void;
    onReset: () => void;
    onRemove?: () => void;
    /** Render mode. 'rows' = compact one-line; 'cards' = full card with docs. */
    density?: 'rows' | 'cards';
    /** When true, the field is locked by a parent policy. Editing is disabled. */
    locked?: boolean;
    /** When locked, the display name of the parent policy enforcing the lock. */
    lockedByLabel?: string;
    /** Inherited value from the parent policy (only when locked or no override). */
    inheritedValue?: unknown;
    /** Live validation error message. Undefined means valid. */
    error?: string;
};

/**
 * Type-aware control for a single catalog item.
 *
 * Strategy:
 *   - enum / choices       → dropdown (&lt;select&gt;)
 *   - boolean / flag      → toggle switch (with 3-way for tri-state flags)
 *   - numeric w/ bounds   → slider + numeric input
 *   - long-form JSON      → textarea
 *   - everything else     → text input
 *
 * Falls back gracefully when the catalog metadata is sparse.
 */
export const FieldControl: React.FC<FieldControlProps> = ({
    item,
    role,
    kind,
    value,
    defaultValue,
    isOverridden,
    onChange,
    onReset,
    onRemove,
    density = 'rows',
    locked,
    lockedByLabel,
    inheritedValue,
    error
}) => {
    const label = `${role}.${kind}.${item.name}`;
    const aic = item.aic;
    const disabled = aic || locked;
    const impacts = itemImpacts(item);
    const hint = itemHint(item, value);
    const errorId = error ? `field-error-${role}-${kind}-${item.name.replace(/[^a-zA-Z0-9_-]/g, '_')}` : undefined;
    const description = typeof item.record?.description === 'string' ? item.record.description : '';
    const inheritedDisplay = inheritedValue !== undefined ? formatInheritedValue(inheritedValue) : null;
    const showInheritedHint = !isOverridden && inheritedDisplay && !aic;
    // In row density the description is hidden — ⓘ toggles a docs panel
    // beneath the row so power users on compact rows can still read docs
    // without switching layouts.
    const [docsOpen, setDocsOpen] = React.useState(false);
    const hasDocs = !!description || impacts.length > 0;
    // Inline before→after diff for modified rows.
    const diffPreview = isOverridden ? renderRowDiff(itemDefault(item), value) : null;

    // Tri-state segmented controls embed "Use default" as a segment, so they
    // don't need the row's icon-button reset / remove actions.
    const showsTriState = isFlagArg(item) || isBooleanItem(item);

    const control = renderControl({item, value, defaultValue, label, disabled: !!disabled, onChange});

    if (density === 'rows') {
        return (
            <div
                className={`rcfg-v2-field rcfg-v2-field--row ${isOverridden ? 'rcfg-v2-field--overridden' : ''} ${disabled ? 'rcfg-v2-field--disabled' : ''} ${locked ? 'rcfg-v2-field--locked' : ''} ${error ? 'rcfg-v2-field--invalid' : ''}`}
                data-field={item.name}
                aria-invalid={error ? true : undefined}
                aria-describedby={errorId}>
                <div className='rcfg-v2-field__row-name' title={description}>
                    <span className='rcfg-v2-field__name'>
                        {itemLabel(item)}
                        {hasDocs && (
                            <button
                                type='button'
                                className='rcfg-v2-field__doc-btn'
                                aria-expanded={docsOpen}
                                aria-label={`Show docs for ${itemLabel(item)}`}
                                onClick={() => setDocsOpen(open => !open)}>
                                <i className='fa fa-info-circle' aria-hidden='true' />
                            </button>
                        )}
                    </span>
                    {/* Raw catalog key (`item.name`) intentionally not rendered:
                        once a display name like "Router Mode" is shown, the
                        secondary `router_mode` code line is just visual noise.
                        The raw name still lives on the row's `data-field` attr
                        for search + structured-error scroll-to-field. */}
                    {locked && (
                        <span
                            className='rcfg-v2-field__chip rcfg-v2-field__chip--locked'
                            aria-label={lockedByLabel ? `Locked by ${lockedByLabel}` : 'Locked by parent policy'}
                            title={lockedByLabel ? `Locked by ${lockedByLabel}` : 'Locked by parent policy'}>
                            <i className='fa fa-lock' aria-hidden='true' /> Locked
                        </span>
                    )}
                    {aic && !locked && (
                        <span
                            className='rcfg-v2-field__chip rcfg-v2-field__chip--warning'
                            aria-label='Managed by AI Configurator — read-only here'
                            title='Managed by AI Configurator — read-only here'>
                            AIC
                        </span>
                    )}
                </div>
                <div className='rcfg-v2-field__row-default' aria-label='Current value'>
                    {/* Diff transition (`default → new`) removed: the control to the
                        right already shows the current value, the arrow added
                        visual chatter without conveying new information. */}
                    <code>{diffPreview ? diffPreview.to : itemDefault(item)}</code>
                </div>
                <div className='rcfg-v2-field__row-control'>{control}</div>
                <div className='rcfg-v2-field__row-actions'>
                    {/* Boolean fields clear via the tri-state segmented control ("Use default"). */}
                    {isOverridden && !disabled && !showsTriState && (
                        <button
                            type='button'
                            className='rcfg-v2-field__icon-btn'
                            onClick={onReset}
                            aria-label={`Reset ${itemLabel(item)} to default`}
                            title='Reset to default'>
                            <i className='fa fa-undo' aria-hidden='true' />
                        </button>
                    )}
                    {onRemove && !disabled && !showsTriState && (
                        <button
                            type='button'
                            className='rcfg-v2-field__icon-btn rcfg-v2-field__icon-btn--danger'
                            onClick={onRemove}
                            aria-label={`Remove ${itemLabel(item)} override`}
                            title='Remove this override'>
                            <i className='fa fa-times' aria-hidden='true' />
                        </button>
                    )}
                </div>
                {(hint || locked || showInheritedHint || error) && (
                    <div className='rcfg-v2-field__row-footer'>
                        {error && (
                            <div className='rcfg-v2-field__error' role='alert' id={errorId}>
                                <i className='fa fa-times-circle' aria-hidden='true' /> {error}
                            </div>
                        )}
                        {showInheritedHint && (
                            <div className='rcfg-v2-field__inherited' role='note'>
                                <i className='fa fa-link' aria-hidden='true' /> Inherits <code>{inheritedDisplay}</code> from <strong>{lockedByLabel || 'parent'}</strong>
                            </div>
                        )}
                        {locked && (
                            <div className='rcfg-v2-field__locked-note' role='note'>
                                <i className='fa fa-lock' aria-hidden='true' /> Locked by <strong>{lockedByLabel || 'parent policy'}</strong>. Child policies cannot override this
                                field.
                            </div>
                        )}
                        {hint && !error && (
                            <div className='rcfg-v2-field__hint' role='note'>
                                <i className='fa fa-exclamation-triangle' aria-hidden='true' /> {hint}
                            </div>
                        )}
                    </div>
                )}
                {docsOpen && hasDocs && (
                    <div className='rcfg-v2-field__doc-panel'>
                        {description && <p className='rcfg-v2-field__doc-desc'>{description}</p>}
                        {impacts.length > 0 && (
                            <div className='rcfg-v2-field__doc-impacts'>
                                <strong>Impact:</strong>
                                {impacts.map(tag => (
                                    <span key={tag} className={`rcfg-v2-impact rcfg-v2-impact--${tag}`}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                        {Array.isArray((item.record as Record<string, unknown>)?.choices) && (
                            <div className='rcfg-v2-field__doc-choices'>
                                <strong>Allowed values:</strong>
                                {((item.record as Record<string, unknown>).choices as unknown[]).map((choice, idx) => (
                                    <code key={idx}>{typeof choice === 'string' ? choice : JSON.stringify(choice)}</code>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Cards mode
    return (
        <div
            className={`rcfg-v2-field ${isOverridden ? 'rcfg-v2-field--overridden' : ''} ${disabled ? 'rcfg-v2-field--disabled' : ''} ${locked ? 'rcfg-v2-field--locked' : ''} ${error ? 'rcfg-v2-field--invalid' : ''}`}
            data-field={item.name}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}>
            <div className='rcfg-v2-field__head'>
                <div className='rcfg-v2-field__title'>
                    <span className='rcfg-v2-field__name'>{itemLabel(item)}</span>
                    {locked && (
                        <span
                            className='rcfg-v2-field__chip rcfg-v2-field__chip--locked'
                            aria-label={lockedByLabel ? `Locked by ${lockedByLabel}` : 'Locked by parent policy'}
                            title={lockedByLabel ? `Locked by ${lockedByLabel}` : 'Locked by parent policy'}>
                            <i className='fa fa-lock' aria-hidden='true' /> Locked
                        </span>
                    )}
                    {aic && !locked && (
                        <span
                            className='rcfg-v2-field__chip rcfg-v2-field__chip--warning'
                            aria-label='Managed by AI Configurator — read-only here'
                            title='Managed by AI Configurator — read-only here'>
                            AIC controlled
                        </span>
                    )}
                    {!disabled && isOverridden && <span className='rcfg-v2-field__chip rcfg-v2-field__chip--accent'>Modified</span>}
                </div>
                <div className='rcfg-v2-field__actions'>
                    {isOverridden && !disabled && !showsTriState && (
                        <button
                            type='button'
                            className='rcfg-v2-field__icon-btn'
                            onClick={onReset}
                            aria-label={`Reset ${itemLabel(item)} to default`}
                            title='Reset to default'>
                            <i className='fa fa-undo' aria-hidden='true' />
                        </button>
                    )}
                    {onRemove && !disabled && !showsTriState && (
                        <button
                            type='button'
                            className='rcfg-v2-field__icon-btn rcfg-v2-field__icon-btn--danger'
                            onClick={onRemove}
                            aria-label={`Remove ${itemLabel(item)} override`}
                            title='Remove this override'>
                            <i className='fa fa-times' aria-hidden='true' />
                        </button>
                    )}
                </div>
            </div>
            {description ? <div className='rcfg-v2-field__desc'>{description}</div> : null}
            <div className='rcfg-v2-field__row'>
                <div className='rcfg-v2-field__default'>
                    <span className='rcfg-v2-field__meta-label'>Default</span>
                    <code>{itemDefault(item)}</code>
                </div>
                <div className='rcfg-v2-field__control'>{control}</div>
            </div>
            {showInheritedHint && (
                <div className='rcfg-v2-field__inherited' role='note'>
                    <i className='fa fa-link' aria-hidden='true' /> Inherits <code>{inheritedDisplay}</code> from <strong>{lockedByLabel || 'parent'}</strong>
                </div>
            )}
            {locked && (
                <div className='rcfg-v2-field__locked-note' role='note'>
                    <i className='fa fa-lock' aria-hidden='true' /> Locked by <strong>{lockedByLabel || 'parent policy'}</strong>. Child policies cannot override this field.
                </div>
            )}
            {(hint || error) && (
                <div className='rcfg-v2-field__footer'>
                    {error && (
                        <div className='rcfg-v2-field__error' role='alert' id={errorId}>
                            <i className='fa fa-times-circle' aria-hidden='true' /> {error}
                        </div>
                    )}
                    {hint && !error && (
                        <div className='rcfg-v2-field__hint' role='note'>
                            <i className='fa fa-exclamation-triangle' aria-hidden='true' /> {hint}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

function formatInheritedValue(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'string') return value || '""';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

type ControlProps = {
    item: RuntimeConfigCatalogItemRecord;
    value: unknown;
    defaultValue: unknown;
    label: string;
    disabled: boolean;
    onChange: (value: unknown) => void;
};

function renderControl(props: ControlProps): React.ReactNode {
    const {item} = props;
    if (isFlagArg(item)) {
        return <FlagControl {...props} />;
    }
    if (isBooleanItem(item)) {
        return <ToggleControl {...props} />;
    }
    if (hasFiniteChoices(item)) {
        return <SegmentedControl {...props} />;
    }
    if (isNumericItem(item)) {
        return <NumericControl {...props} />;
    }
    const type = itemType(item);
    if (type.includes('dict') || type.includes('object') || type.includes('list') || type.includes('array')) {
        return <JsonControl {...props} />;
    }
    return <TextControl {...props} />;
}

/**
 * Tri-state control for booleans and flag-style args.
 *
 * The legacy switch + external X button confused users: "Disabled" and
 * "not emitted" looked identical, and the only way to clear an override
 * was a tooltip pointing at a row-level icon. The tri-state segmented
 * control makes the three states first-class and self-explanatory:
 *
 *   [ Use default ]   [ Enabled ]   [ Disabled ]
 *
 * "Use default" maps to onChange(undefined), which clears the override.
 * Flags whose record carries no false_arg drop the "Disabled" segment.
 */
const FlagControl: React.FC<ControlProps> = ({item, value, label, disabled, onChange}) => {
    const supportsFalse = typeof item.record?.false_arg === 'string';
    return <BooleanTriSegment label={label} value={value} disabled={disabled} allowFalse={supportsFalse} onChange={onChange} />;
};

const ToggleControl: React.FC<ControlProps> = ({value, label, disabled, onChange}) => {
    return <BooleanTriSegment label={label} value={value} disabled={disabled} allowFalse onChange={onChange} />;
};

const BooleanTriSegment: React.FC<{
    label: string;
    value: unknown;
    disabled: boolean;
    allowFalse: boolean;
    onChange: (value: unknown) => void;
}> = ({label, value, disabled, allowFalse, onChange}) => {
    const isSet = value === true || value === false || value === null;
    const truthy = value === true || value === null;
    const current: 'unset' | 'true' | 'false' = !isSet ? 'unset' : truthy ? 'true' : 'false';
    const handleChange = React.useCallback(
        (event: React.ChangeEvent<HTMLSelectElement>) => {
            const next = event.target.value;
            if (next === 'unset') onChange(undefined);
            else if (next === 'true') onChange(true);
            else if (next === 'false') onChange(false);
        },
        [onChange]
    );
    return (
        <select
            className='argo-field rcfg-v2-choice-select'
            value={current}
            onChange={handleChange}
            disabled={disabled}
            aria-label={label}>
            <option value='unset'>Use default</option>
            <option value='true'>Enabled</option>
            {allowFalse && <option value='false'>Disabled</option>}
        </select>
    );
};

/**
 * Constrained-choice (catalog `choices` / `enum`) renders as a native dropdown
 * regardless of choice count. Segmented buttons read as repetitive form noise
 * once you have 4+ options and obscure that the field accepts only a fixed
 * vocabulary. A `<select>` makes the vocabulary explicit and scales gracefully
 * to long enum lists. "Use default" stays as the first option so users can
 * still clear an override.
 */
const SegmentedControl: React.FC<ControlProps> = ({item, value, label, disabled, onChange}) => {
    const choices = itemChoices(item) || [];
    const currentSerialized = value === undefined || value === '' ? '__unset__' : safeStringify(value);
    const handleChange = React.useCallback(
        (event: React.ChangeEvent<HTMLSelectElement>) => {
            const next = event.target.value;
            if (next === '__unset__') onChange(undefined);
            else onChange(parseChoice(next));
        },
        [onChange]
    );
    return (
        <select
            className='argo-field rcfg-v2-choice-select'
            value={currentSerialized}
            onChange={handleChange}
            disabled={disabled}
            aria-label={label}>
            <option value='__unset__'>Use default</option>
            {choices.map(choice => {
                const serialized = safeStringify(choice);
                return (
                    <option key={serialized} value={serialized}>
                        {String(choice)}
                    </option>
                );
            })}
        </select>
    );
};

const NumericControl: React.FC<ControlProps> = ({item, value, label, disabled, onChange}) => {
    const {min, max, step} = readNumericRange(item);
    const numeric = typeof value === 'number' ? value : Number(value);
    const showSlider = typeof min === 'number' && typeof max === 'number' && max - min <= 100000;
    return (
        <div className='rcfg-v2-numeric'>
            {showSlider && (
                <input
                    type='range'
                    aria-label={`${label} slider`}
                    className='rcfg-v2-numeric__slider'
                    disabled={disabled}
                    min={min}
                    max={max}
                    step={step ?? deriveStep(min as number, max as number)}
                    value={Number.isFinite(numeric) ? numeric : (min as number)}
                    onChange={event => onChange(Number(event.target.value))}
                />
            )}
            <input
                type='number'
                aria-label={label}
                className='argo-field rcfg-v2-numeric__input'
                disabled={disabled}
                min={min}
                max={max}
                step={step}
                placeholder='Not emitted'
                value={value === undefined ? '' : String(value)}
                onChange={event => {
                    const raw = event.target.value;
                    if (raw === '') {
                        onChange(undefined);
                        return;
                    }
                    const parsed = Number(raw);
                    onChange(Number.isFinite(parsed) ? parsed : raw);
                }}
            />
            {(min !== undefined || max !== undefined) && (
                <small className='rcfg-v2-numeric__range'>
                    {min ?? '−∞'} … {max ?? '+∞'}
                </small>
            )}
        </div>
    );
};

const JsonControl: React.FC<ControlProps> = ({item, value, label, disabled, onChange}) => {
    const raw = formatRuntimeValue(value);
    const trimmed = raw.trim();
    const parse = React.useMemo(() => parseJsonForUi(trimmed), [trimmed]);
    const exampleAvailable = !trimmed && hasDefaultValue(item);

    const handleFormat = React.useCallback(() => {
        if (parse.ok) {
            onChange(JSON.stringify(parse.value, null, 2));
        }
    }, [parse, onChange]);

    const handleInsertExample = React.useCallback(() => {
        const defaultValue = editableDefaultValue(item);
        try {
            onChange(JSON.stringify(defaultValue, null, 2));
        } catch {
            // ignore — fall back to plain serialization
            onChange(String(defaultValue));
        }
    }, [item, onChange]);

    return (
        <div className='rcfg-v2-json'>
            <div className='rcfg-v2-json__status' aria-live='polite'>
                {renderJsonStatusPill(trimmed, parse)}
                <div className='rcfg-v2-json__tools'>
                    {exampleAvailable && (
                        <button type='button' className='rcfg-v2-json__tool' onClick={handleInsertExample} disabled={disabled} title='Insert the engine default as a starting point'>
                            <i className='fa fa-magic' aria-hidden='true' /> Insert example
                        </button>
                    )}
                    {trimmed && parse.ok && (
                        <button type='button' className='rcfg-v2-json__tool' onClick={handleFormat} disabled={disabled} title='Re-indent with 2-space JSON formatting'>
                            <i className='fa fa-align-left' aria-hidden='true' /> Format
                        </button>
                    )}
                </div>
            </div>
            <textarea
                className='argo-field rcfg-v2-textarea rcfg-v2-json__textarea'
                aria-label={label}
                aria-invalid={trimmed && !parse.ok ? true : undefined}
                disabled={disabled}
                value={raw}
                placeholder='JSON value · empty = engine default. Object or array — see allowed type in the docs.'
                onChange={event => onChange(event.target.value)}
                spellCheck={false}
            />
        </div>
    );
};

type JsonParseResult =
    | {ok: true; value: unknown}
    | {ok: false; message: string; line?: number; column?: number};

function renderJsonStatusPill(trimmed: string, parse: JsonParseResult): React.ReactNode {
    if (!trimmed) {
        return <span className='rcfg-v2-json__pill rcfg-v2-json__pill--muted'>Empty · uses default</span>;
    }
    if (parse.ok) {
        return (
            <span className='rcfg-v2-json__pill rcfg-v2-json__pill--ok'>
                <i className='fa fa-check-circle' aria-hidden='true' /> Valid JSON
            </span>
        );
    }
    const errorResult = parse as Extract<JsonParseResult, {ok: false}>;
    const location = errorResult.line ? ` Line ${errorResult.line}${errorResult.column ? `, col ${errorResult.column}` : ''}: ` : ' ';
    return (
        <span className='rcfg-v2-json__pill rcfg-v2-json__pill--error'>
            <i className='fa fa-times-circle' aria-hidden='true' />
            {location}
            {errorResult.message}
        </span>
    );
}

function parseJsonForUi(text: string): JsonParseResult {
    if (!text) {
        return {ok: false, message: 'Empty input'};
    }
    try {
        return {ok: true, value: JSON.parse(text)};
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // V8/Node error messages include "position N"; some include " line M column N".
        const positionMatch = /position\s+(\d+)/i.exec(message);
        if (positionMatch) {
            const position = Number(positionMatch[1]);
            if (Number.isFinite(position)) {
                const before = text.slice(0, position);
                const line = before.split('\n').length;
                const lastNewline = before.lastIndexOf('\n');
                const column = lastNewline === -1 ? before.length + 1 : before.length - lastNewline;
                return {ok: false, message: cleanJsonError(message), line, column};
            }
        }
        const lineMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
        if (lineMatch) {
            return {ok: false, message: cleanJsonError(message), line: Number(lineMatch[1]), column: Number(lineMatch[2])};
        }
        return {ok: false, message: cleanJsonError(message)};
    }
}

function cleanJsonError(message: string): string {
    // Strip the "in JSON at position N" / "line M column N" suffixes that
    // would otherwise duplicate the line/col we render explicitly.
    return message
        .replace(/\s+in JSON.*$/i, '')
        .replace(/\s+at position\s+\d+/i, '')
        .replace(/\s+at line\s+\d+\s+column\s+\d+/i, '')
        .trim();
}

const TextControl: React.FC<ControlProps> = ({value, label, disabled, onChange}) => {
    return (
        <input
            className='argo-field rcfg-v2-input'
            aria-label={label}
            disabled={disabled}
            value={formatRuntimeValue(value)}
            placeholder='Not emitted'
            onChange={event => onChange(event.target.value)}
        />
    );
};

function safeStringify(value: unknown): string {
    if (value === undefined || value === null) {
        return '';
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function parseChoice(serialized: string): unknown {
    if (!serialized) {
        return undefined;
    }
    try {
        return JSON.parse(serialized);
    } catch {
        return serialized;
    }
}

function deriveStep(min: number, max: number): number {
    const span = max - min;
    if (span <= 1) {
        return 0.01;
    }
    if (span <= 10) {
        return 0.1;
    }
    if (span <= 1000) {
        return 1;
    }
    return Math.max(1, Math.round(span / 1000));
}

/** Exported for the catalog browser to know when to show "Reset to default" inline. */
export function fieldIsAtDefault(item: RuntimeConfigCatalogItemRecord, value: unknown): boolean {
    if (value === undefined) {
        return true;
    }
    const defaultValue = hasDefaultValue(item) ? editableDefaultValue(item) : undefined;
    return valuesEqual(value, defaultValue);
}

/**
 * Compact "default → new value" preview shown on modified rows so the diff
 * is the visual focus rather than the change being inferred from a small
 * "Modified" chip.
 */
function renderRowDiff(defaultDisplay: string, value: unknown): {from: string; to: string} {
    const fromStr = String(defaultDisplay ?? '—');
    let toStr: string;
    if (value === undefined || value === null) {
        toStr = '—';
    } else if (typeof value === 'string') {
        toStr = value || '""';
    } else if (typeof value === 'number' || typeof value === 'boolean') {
        toStr = String(value);
    } else {
        try {
            toStr = JSON.stringify(value);
        } catch {
            toStr = String(value);
        }
    }
    // Clip very long values so the column doesn't blow out
    if (toStr.length > 24) toStr = toStr.slice(0, 22) + '…';
    return {from: fromStr, to: toStr};
}
