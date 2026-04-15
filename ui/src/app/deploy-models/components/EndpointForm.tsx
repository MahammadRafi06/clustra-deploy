import React from 'react';
import type { FieldDef } from './FieldInput';
import { FieldInput } from './FieldInput';
import { AdvancedSection } from './AdvancedSection';

interface EndpointFormProps {
  requiredFields: FieldDef[];
  advancedFields: FieldDef[];
  values: Record<string, string>;
  errors: Record<string, string>;
  submitting: boolean;
  submitLabel?: string;
  onChange: (key: string, value: string) => void;
  onSubmit: () => void;
  /** Optional content rendered between required and advanced sections */
  extraSection?: React.ReactNode;
  /** Optional content rendered after the advanced section (before submit) */
  footerSection?: React.ReactNode;
}

export function EndpointForm({
  requiredFields,
  advancedFields,
  values,
  errors,
  submitting,
  submitLabel = 'Run',
  onChange,
  onSubmit,
  extraSection,
  footerSection,
}: EndpointFormProps) {
  return (
    <div className="cext-form">
      {/* Required fields */}
      {requiredFields.map(def => (
        <FieldInput
          key={def.key}
          def={def}
          value={values[def.key] ?? ''}
          error={errors[def.key]}
          onChange={onChange}
        />
      ))}

      {extraSection}

      {/* Advanced / optional fields */}
      {advancedFields.length > 0 && (
        <AdvancedSection>
          {advancedFields.map(def => (
            <FieldInput
              key={def.key}
              def={def}
              value={values[def.key] ?? ''}
              error={errors[def.key]}
              onChange={onChange}
            />
          ))}
        </AdvancedSection>
      )}

      {footerSection}

      <div>
        <button
          type="button"
          className="argo-button argo-button--base cext-btn"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="cext-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Running…
            </>
          ) : (
            <>
              <i className="fa fa-play" />
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
