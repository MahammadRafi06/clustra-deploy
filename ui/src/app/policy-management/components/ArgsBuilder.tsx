import * as React from 'react';

import {parseFeatureArgs, serializeFeatureArgs} from '../validation';

type RolePath = ['agg' | 'disagg', string];

const ROLE_GROUPS: Array<{title: string; roles: Array<{label: string; path: RolePath}>}> = [
    {
        title: 'agg',
        roles: [
            {label: 'frontend', path: ['agg', 'frontend']},
            {label: 'worker', path: ['agg', 'worker']}
        ]
    },
    {
        title: 'disagg',
        roles: [
            {label: 'frontend', path: ['disagg', 'frontend']},
            {label: 'prefill', path: ['disagg', 'prefill']},
            {label: 'decode', path: ['disagg', 'decode']}
        ]
    }
];

function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clone(document: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(document)) as Record<string, unknown>;
}

function rawArgsFor(document: Record<string, unknown>, [mode, role]: RolePath): unknown {
    const effects = isObject(document.effects) ? document.effects : {};
    const modeValue = isObject(effects[mode]) ? (effects[mode] as Record<string, unknown>) : {};
    if (Array.isArray(modeValue[role])) {
        return modeValue[role];
    }
    const roleValue = isObject(modeValue[role]) ? (modeValue[role] as Record<string, unknown>) : {};
    return roleValue.args;
}

function argsFor(document: Record<string, unknown>, path: RolePath) {
    return parseFeatureArgs(rawArgsFor(document, path));
}

function setArgs(document: Record<string, unknown>, path: RolePath, entries: ReturnType<typeof parseFeatureArgs>): Record<string, unknown> {
    const next = clone(document);
    const [mode, role] = path;
    const preferArray = Array.isArray(rawArgsFor(document, path));
    next.effects = isObject(next.effects) ? next.effects : {};
    const effects = next.effects as Record<string, unknown>;
    effects[mode] = isObject(effects[mode]) ? effects[mode] : {};
    const modeValue = effects[mode] as Record<string, unknown>;
    if (Array.isArray(modeValue[role])) {
        modeValue[role] = serializeFeatureArgs(entries, true);
        return next;
    }
    modeValue[role] = isObject(modeValue[role]) ? modeValue[role] : {};
    const roleValue = modeValue[role] as Record<string, unknown>;
    roleValue.args = serializeFeatureArgs(entries, preferArray);
    return next;
}

function normalizeValue(value: string): string | null {
    return value === '' ? null : value;
}

interface ArgsBuilderProps {
    document: Record<string, unknown>;
    onChange: (document: Record<string, unknown>) => void;
    readOnly?: boolean;
}

export const ArgsBuilder: React.FC<ArgsBuilderProps> = ({document, onChange, readOnly}) => {
    function updateRow(path: RolePath, index: number, nextKey: string, nextValue: string) {
        const entries = argsFor(document, path);
        entries[index] = {flag: nextKey, value: normalizeValue(nextValue)};
        onChange(setArgs(document, path, entries));
    }

    function removeRow(path: RolePath, index: number) {
        const entries = argsFor(document, path);
        entries.splice(index, 1);
        onChange(setArgs(document, path, entries));
    }

    function moveRow(path: RolePath, index: number, direction: -1 | 1) {
        const entries = argsFor(document, path);
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= entries.length) {
            return;
        }
        const [item] = entries.splice(index, 1);
        entries.splice(nextIndex, 0, item);
        onChange(setArgs(document, path, entries));
    }

    function addRow(path: RolePath) {
        const current = argsFor(document, path);
        let index = current.length + 1;
        let key = `--flag-${index}`;
        while (current.some(entry => entry.flag === key)) {
            index += 1;
            key = `--flag-${index}`;
        }
        onChange(setArgs(document, path, [...current, {flag: key, value: null}]));
    }

    return (
        <div className='policy-management__args-builder'>
            <div className='policy-management__inline-banner'>
                Duplicate flags are accepted here. When /default compiles selected feature_policies, later selected policies win.
            </div>
            {ROLE_GROUPS.map(group => (
                <section key={group.title} className='policy-management__args-group'>
                    <div className='policy-management__section-title'>{group.title}</div>
                    <div className='policy-management__role-grid'>
                        {group.roles.map(role => {
                            const args = argsFor(document, role.path);
                            return (
                                <div key={`${group.title}-${role.label}`} className='policy-management__role-card'>
                                    <div className='policy-management__role-card-header'>
                                        <span>{role.label}</span>
                                        <button
                                            type='button'
                                            className='argo-button argo-button--base-o policy-management__icon-button'
                                            onClick={() => addRow(role.path)}
                                            disabled={readOnly}
                                            aria-label={`Add ${group.title} ${role.label} arg`}>
                                            <i className='fa fa-plus' aria-hidden='true' />
                                        </button>
                                    </div>
                                    {args.length === 0 ? (
                                        <div className='policy-management__empty-inline'>No args</div>
                                    ) : (
                                        <div className='policy-management__arg-rows'>
                                            {args.map((entry, index) => (
                                                <div key={`${entry.flag}-${index}`} className='policy-management__arg-row'>
                                                    <input
                                                        className='argo-field'
                                                        value={entry.flag}
                                                        disabled={readOnly}
                                                        aria-label={`${group.title} ${role.label} flag`}
                                                        onChange={event => updateRow(role.path, index, event.target.value, entry.value == null ? '' : String(entry.value))}
                                                    />
                                                    <input
                                                        className='argo-field'
                                                        value={entry.value == null ? '' : String(entry.value)}
                                                        disabled={readOnly}
                                                        placeholder='flag-only'
                                                        aria-label={`${group.title} ${role.label} value`}
                                                        onChange={event => updateRow(role.path, index, entry.flag, event.target.value)}
                                                    />
                                                    <button
                                                        type='button'
                                                        className='argo-button argo-button--base-o policy-management__icon-button'
                                                        onClick={() => moveRow(role.path, index, -1)}
                                                        disabled={readOnly || index === 0}
                                                        aria-label='Move arg up'>
                                                        <i className='fa fa-arrow-up' aria-hidden='true' />
                                                    </button>
                                                    <button
                                                        type='button'
                                                        className='argo-button argo-button--base-o policy-management__icon-button'
                                                        onClick={() => moveRow(role.path, index, 1)}
                                                        disabled={readOnly || index === args.length - 1}
                                                        aria-label='Move arg down'>
                                                        <i className='fa fa-arrow-down' aria-hidden='true' />
                                                    </button>
                                                    <button
                                                        type='button'
                                                        className='argo-button argo-button--base-o policy-management__icon-button policy-management__button--danger'
                                                        onClick={() => removeRow(role.path, index)}
                                                        disabled={readOnly}
                                                        aria-label='Remove arg'>
                                                        <i className='fa fa-trash' aria-hidden='true' />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
};
