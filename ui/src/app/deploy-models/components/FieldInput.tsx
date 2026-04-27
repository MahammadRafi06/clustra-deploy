import {Select} from 'argo-ui';
import React from 'react';

export type FieldType = 'text' | 'number' | 'select' | 'textarea';

export interface SelectOption {
    value: string;
    label: string;
    description?: string;
}

export interface FieldDef {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    help?: string;
    placeholder?: string;
    hint?: string;
    options?: readonly SelectOption[];
    min?: number;
    max?: number;
    step?: number;
    rows?: number;
    includeEmptyOption?: boolean;
}

interface FieldInputProps {
    def: FieldDef;
    value: string;
    error?: string;
    onChange: (key: string, value: string) => void;
}

export function FieldInput({def, value, error, onChange}: FieldInputProps) {
    const {key, label, type, help, placeholder, hint, options, min, max, step, rows, includeEmptyOption} = def;
    const normalizedKey = key.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    const fieldId = `deploy-models-field-${key}`;
    const selectedOptionDescription = type === 'select' ? options?.find(option => option.value === value)?.description : undefined;
    const fieldHint = [hint, selectedOptionDescription].filter(Boolean).join(' ');

    return (
        <div className={`argo-form-row deploy-models__field deploy-models__field--${type} deploy-models__field--key-${normalizedKey}`}>
            <div className='deploy-models__field-label-row'>
                <label htmlFor={fieldId}>
                    {label}
                    {def.required && <span className='deploy-models__required'>*</span>}
                </label>
                {help && (
                    <span className='deploy-models__field-help' tabIndex={0} role='note' aria-label={`${label}: ${help}`} title={help}>
                        <i className='fa fa-question-circle-o' aria-hidden='true' />
                        <span className='deploy-models__field-help-text' aria-hidden='true'>
                            {help}
                        </span>
                    </span>
                )}
            </div>

            {type === 'select' ? (
                <div className='deploy-models__select'>
                    <Select
                        id={fieldId}
                        value={value}
                        options={[
                            ...(includeEmptyOption !== false ? [{title: placeholder || '— select —', value: ''}] : []),
                            ...(options || []).map(opt => ({title: opt.label, value: opt.value}))
                        ]}
                        placeholder={placeholder || (includeEmptyOption !== false ? '— select —' : 'Select an option')}
                        onChange={option => onChange(key, option.value)}
                    />
                </div>
            ) : type === 'textarea' ? (
                <textarea
                    id={fieldId}
                    className='argo-field deploy-models__textarea'
                    value={value}
                    placeholder={placeholder}
                    rows={rows || 5}
                    onChange={e => onChange(key, e.target.value)}
                />
            ) : (
                <input
                    id={fieldId}
                    className='argo-field'
                    type={type}
                    value={value}
                    placeholder={placeholder}
                    min={min}
                    max={max}
                    step={step}
                    onChange={e => onChange(key, e.target.value)}
                />
            )}

            {fieldHint && !error && <p className='deploy-models__field-hint'>{fieldHint}</p>}
            {error && <p className='argo-form-row__error-msg'>{error}</p>}
        </div>
    );
}
