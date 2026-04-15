import { useCallback, useState } from 'react';

interface UseFormStateReturn {
  values: Record<string, string>;
  errors: Record<string, string>;
  setValue: (key: string, value: string) => void;
  setError: (key: string, msg: string) => void;
  clearErrors: () => void;
  reset: () => void;
  /** Validate required fields. Returns true if all pass. */
  validateRequired: (keys: string[]) => boolean;
}

export function useFormState(initial?: Record<string, string>): UseFormStateReturn {
  const [values, setValues] = useState<Record<string, string>>(initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = useCallback((key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const setError = useCallback((key: string, msg: string) => {
    setErrors(prev => ({ ...prev, [key]: msg }));
  }, []);

  const clearErrors = useCallback(() => setErrors({}), []);

  const reset = useCallback(() => {
    setValues(initial ?? {});
    setErrors({});
  }, [initial]);

  const validateRequired = useCallback((keys: string[]): boolean => {
    const newErrors: Record<string, string> = {};
    for (const key of keys) {
      if (!values[key]?.trim()) {
        newErrors[key] = 'This field is required';
      }
    }
    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  }, [values]);

  return { values, errors, setValue, setError, clearErrors, reset, validateRequired };
}
