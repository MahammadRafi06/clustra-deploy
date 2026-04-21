import {Select} from 'argo-ui';
import React from 'react';

export type FieldType = 'text' | 'number' | 'select' | 'textarea';

export interface SelectOption {
    value: string;
    label: string;
}

export interface FieldDef {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    placeholder?: string;
    hint?: string;
    options?: SelectOption[];
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
    const {key, label, type, placeholder, hint, options, min, max, step, rows, includeEmptyOption} = def;
    const normalizedKey = key.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    const fieldId = `deploy-models-field-${key}`;

    return (
        <div className={`argo-form-row deploy-models__field deploy-models__field--${type} deploy-models__field--key-${normalizedKey}`}>
            <label htmlFor={fieldId}>
                {label}
                {def.required && <span className='deploy-models__required'>*</span>}
            </label>

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

            {hint && !error && <p className='deploy-models__field-hint'>{hint}</p>}
            {error && <p className='argo-form-row__error-msg'>{error}</p>}
        </div>
    );
}
