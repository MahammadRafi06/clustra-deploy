import * as monacoEditor from 'monaco-editor';
import * as React from 'react';
import {useEffect, useRef} from 'react';

import {MonacoEditor} from '../../shared/components';
import {formatPolicyJson, parsePolicyJson} from '../validation';

interface PolicyJsonEditorProps {
    value: string;
    onChange: (value: string) => void;
    validationErrors: string[];
    serverError?: string | null;
    originalValue?: string | null;
    readOnly?: boolean;
    onReset?: () => void;
}

export const PolicyJsonEditor: React.FC<PolicyJsonEditorProps> = ({value, onChange, validationErrors, serverError, originalValue, readOnly, onReset}) => {
    const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
    const subscriptionRef = useRef<monacoEditor.IDisposable | null>(null);

    useEffect(
        () => () => {
            subscriptionRef.current?.dispose();
            subscriptionRef.current = null;
        },
        []
    );

    function bindEditor(api: monacoEditor.editor.IEditor) {
        const codeEditor = api as monacoEditor.editor.IStandaloneCodeEditor;
        if (editorRef.current === codeEditor) {
            return;
        }
        subscriptionRef.current?.dispose();
        editorRef.current = codeEditor;
        subscriptionRef.current = codeEditor.onDidChangeModelContent(() => {
            const model = codeEditor.getModel();
            if (model) {
                onChange(model.getValue());
            }
        });
    }

    function formatJson() {
        const parsed = parsePolicyJson(value);
        if (parsed.document) {
            onChange(formatPolicyJson(parsed.document));
        }
    }

    function copyJson() {
        navigator.clipboard?.writeText(value);
    }

    const hasErrors = validationErrors.length > 0 || !!serverError;

    return (
        <div className='policy-management__json-editor'>
            <div className='policy-management__drawer-toolbar policy-management__drawer-toolbar--compact'>
                <div className={`policy-management__validation-state ${hasErrors ? 'policy-management__validation-state--error' : 'policy-management__validation-state--ok'}`}>
                    {hasErrors ? 'Validation needs attention' : 'JSON is valid'}
                </div>
                <div className='policy-management__toolbar-actions'>
                    <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={formatJson} disabled={readOnly}>
                        <i className='fa fa-align-left' aria-hidden='true' /> Format
                    </button>
                    <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={copyJson}>
                        <i className='fa fa-copy' aria-hidden='true' /> Copy
                    </button>
                    {onReset && (
                        <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={onReset} disabled={readOnly}>
                            <i className='fa fa-undo' aria-hidden='true' /> Reset
                        </button>
                    )}
                </div>
            </div>

            {validationErrors.length > 0 && (
                <div className='policy-management__inline-error'>
                    {validationErrors.map(error => (
                        <div key={error}>{error}</div>
                    ))}
                </div>
            )}
            {serverError && <div className='policy-management__inline-error'>{serverError}</div>}

            <div className='policy-management__monaco-frame'>
                <MonacoEditor
                    minHeight={360}
                    vScrollBar={true}
                    editor={{
                        input: {text: value, language: 'json'},
                        options: {
                            readOnly,
                            minimap: {enabled: false},
                            lineNumbers: 'on',
                            wordWrap: 'on',
                            automaticLayout: true
                        },
                        getApi: bindEditor
                    }}
                />
            </div>

            {originalValue !== null && originalValue !== undefined && (
                <div className='policy-management__diff-grid' aria-label='Original and modified JSON'>
                    <div>
                        <div className='policy-management__meta-label'>Original</div>
                        <pre className='policy-management__code-block'>{originalValue}</pre>
                    </div>
                    <div>
                        <div className='policy-management__meta-label'>Modified</div>
                        <pre className='policy-management__code-block'>{value}</pre>
                    </div>
                </div>
            )}
        </div>
    );
};
