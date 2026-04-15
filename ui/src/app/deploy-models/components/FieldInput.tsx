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
  options?: SelectOption[];       // for select
  min?: number;
  max?: number;
  step?: number;
  rows?: number;                  // for textarea
  includeEmptyOption?: boolean;   // for select
}

interface FieldInputProps {
  def: FieldDef;
  value: string;
  error?: string;
  onChange: (key: string, value: string) => void;
}

export function FieldInput({ def, value, error, onChange }: FieldInputProps) {
  const { key, label, type, placeholder, hint, options, min, max, step, rows, includeEmptyOption } = def;
  const normalizedKey = key.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();

  return (
    <div className={`cext-field cext-field--${type} cext-field--key-${normalizedKey}`}>
      <label htmlFor={`cext-field-${key}`}>
        {label}
        {def.required && <span style={{ color: 'var(--brand-status-error)', marginLeft: 3 }}>*</span>}
      </label>

      {type === 'select' ? (
        <div className="cext-argo-select">
          <Select
            id={`cext-field-${key}`}
            value={value}
            options={[
              ...(includeEmptyOption !== false ? [{title: placeholder || '— select —', value: ''}] : []),
              ...(options ?? []).map(opt => ({title: opt.label, value: opt.value})),
            ]}
            placeholder={placeholder || (includeEmptyOption !== false ? '— select —' : 'Select an option')}
            onChange={option => onChange(key, option.value)}
          />
        </div>
      ) : type === 'textarea' ? (
        <textarea
          id={`cext-field-${key}`}
          className="cext-textarea"
          value={value}
          placeholder={placeholder}
          rows={rows ?? 5}
          onChange={e => onChange(key, e.target.value)}
        />
      ) : (
        <input
          id={`cext-field-${key}`}
          className="cext-input"
          type={type}
          value={value}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          onChange={e => onChange(key, e.target.value)}
        />
      )}

      {hint && !error && <p className="cext-field-hint">{hint}</p>}
      {error && <p className="cext-field-error">{error}</p>}
    </div>
  );
}
