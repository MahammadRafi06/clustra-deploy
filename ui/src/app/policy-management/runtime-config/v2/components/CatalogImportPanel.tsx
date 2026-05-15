import * as React from 'react';
import {useMemo, useState} from 'react';

import type {
    PolicyApiClient,
    RuntimeConfigCatalogImportItem,
    RuntimeConfigCatalogListResponse,
    RuntimeConfigKind
} from '../../../api/types';
import {PolicyError} from '../../../components/PolicyError';
import {runtimeEngineLabel} from '../../runtimeConfigUtils';

type ParsedFile = {
    file: File;
    engine: string;
    engine_version: string;
    kind: RuntimeConfigKind;
    /** Parsed JSON document, or null if parsing failed. */
    document: Record<string, unknown> | null;
    /** Hex sha256 of the file bytes. */
    sha256: string;
    /** Reason this row can't be imported as-is; null when ready. */
    issue: string | null;
};

/**
 * Catalog filename convention from the publisher repo:
 *
 *   <engine>_<kind>_<version>.json
 *
 * where `kind` is exactly `args` or `envs`. `engine` and `version` can contain
 * underscores (e.g. `vllm_omni`, `0.5.10.post1`) — we anchor on the `_args_`
 * or `_envs_` token to split unambiguously.
 */
const FILENAME_PATTERN = /^(?<engine>.+)_(?<kind>args|envs)_(?<version>[^/\\]+)\.json$/i;

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Catalog import surface. Picks one or more catalog JSON files (matches the
 * publisher repo's `<engine>_<kind>_<version>.json` convention), parses each
 * client-side, lets the user override the dynamo version + any per-row fields,
 * then POSTs the whole batch in a single atomic request.
 *
 * If any catalog fails server-side validation, the API rolls the entire batch
 * back; the panel just surfaces the structured error message.
 */
export const CatalogImportPanel: React.FC<{client: PolicyApiClient; onImported: () => void}> = ({client, onImported}) => {
    const [files, setFiles] = useState<ParsedFile[]>([]);
    const [dynamoVersion, setDynamoVersion] = useState('1.1.1');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<unknown | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    async function handleFiles(fileList: FileList | null) {
        setError(null);
        setSuccess(null);
        if (!fileList || fileList.length === 0) {
            setFiles([]);
            return;
        }
        const parsed: ParsedFile[] = await Promise.all(
            Array.from(fileList).map(async file => parseCatalogFile(file))
        );
        setFiles(parsed);
    }

    const ready = useMemo(() => files.length > 0 && files.every(f => f.issue === null) && dynamoVersion.trim().length > 0, [files, dynamoVersion]);

    async function submit() {
        if (!ready) return;
        setSubmitting(true);
        setError(null);
        setSuccess(null);
        const catalogs: RuntimeConfigCatalogImportItem[] = files.map(f => ({
            engine: f.engine,
            engine_version: f.engine_version,
            dynamo_version: dynamoVersion.trim(),
            kind: f.kind,
            document: f.document as Record<string, unknown>,
            sha256: f.sha256
        }));
        try {
            const result: RuntimeConfigCatalogListResponse = await client.importRuntimeConfigCatalogs({catalogs});
            setSuccess(`Imported ${result.total} catalog${result.total === 1 ? '' : 's'} atomically.`);
            setFiles([]);
            onImported();
        } catch (err) {
            setError(err);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className='rcfg-v2-catalog-import' aria-label='Import catalogs'>
            <header className='rcfg-v2-catalog-import__head'>
                <div>
                    <h2><i className='fa fa-upload' aria-hidden='true' /> Import catalogs</h2>
                    <p>
                        Upload one or more <code>&lt;engine&gt;_&lt;kind&gt;_&lt;version&gt;.json</code> catalog files. The
                        whole batch is sent in a single atomic request — if any catalog fails validation, none are persisted.
                    </p>
                </div>
            </header>

            <div className='rcfg-v2-catalog-import__form'>
                <label className='rcfg-v2-catalog-import__field'>
                    <span>Dynamo version</span>
                    <input
                        type='text'
                        className='argo-field'
                        value={dynamoVersion}
                        onChange={event => setDynamoVersion(event.target.value)}
                        placeholder='e.g. 1.1.1'
                        aria-label='Dynamo version for all uploaded catalogs'
                    />
                </label>
                <label className='rcfg-v2-catalog-import__field rcfg-v2-catalog-import__field--files'>
                    <span>Catalog JSON files</span>
                    <input
                        type='file'
                        accept='.json,application/json'
                        multiple
                        onChange={event => handleFiles(event.target.files)}
                        aria-label='Pick catalog JSON files'
                    />
                </label>
            </div>

            {error && <PolicyError error={error} prefix='Atomic import failed (no catalogs persisted)' />}
            {success && <div className='rcfg-v2-catalog-import__success' role='status'>{success}</div>}

            {files.length > 0 && (
                <table className='rcfg-v2-catalog-import__table' aria-label='Files staged for import'>
                    <thead>
                        <tr>
                            <th>File</th>
                            <th>Engine</th>
                            <th>Kind</th>
                            <th>Engine version</th>
                            <th>Records</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {files.map((parsed, index) => {
                            const recordCount = parsed.document ? Object.keys(parsed.document).length : 0;
                            return (
                                <tr key={`${parsed.file.name}:${index}`} className={parsed.issue ? 'is-invalid' : ''}>
                                    <td><code>{parsed.file.name}</code></td>
                                    <td>{parsed.engine ? runtimeEngineLabel(parsed.engine) : <em>—</em>}</td>
                                    <td><code>{parsed.kind || '—'}</code></td>
                                    <td><code>{parsed.engine_version || '—'}</code></td>
                                    <td>{parsed.document ? recordCount : <em>—</em>}</td>
                                    <td>{parsed.issue ? <span className='rcfg-v2-catalog-import__issue'>{parsed.issue}</span> : <span className='rcfg-v2-catalog-import__ok'><i className='fa fa-check' aria-hidden='true' /> Ready</span>}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            <footer className='rcfg-v2-catalog-import__foot'>
                <small>
                    {files.length === 0
                        ? 'No files staged yet.'
                        : `${files.filter(f => !f.issue).length} of ${files.length} files ready for atomic import.`}
                </small>
                <button
                    type='button'
                    className='argo-button argo-button--base'
                    disabled={!ready || submitting}
                    onClick={submit}
                    title={!ready ? 'Resolve file issues and provide a Dynamo version' : 'Send the whole batch as one atomic request'}>
                    {submitting ? (
                        <><i className='fa fa-spinner fa-spin' aria-hidden='true' /> Importing…</>
                    ) : (
                        <><i className='fa fa-upload' aria-hidden='true' /> Import {files.length} catalog{files.length === 1 ? '' : 's'} atomically</>
                    )}
                </button>
            </footer>
        </section>
    );
};

async function parseCatalogFile(file: File): Promise<ParsedFile> {
    const bytes = await file.arrayBuffer();
    const sha256 = await sha256Hex(bytes);
    let document: Record<string, unknown> | null = null;
    let parseIssue: string | null = null;
    try {
        const text = new TextDecoder('utf-8').decode(bytes);
        const json = JSON.parse(text);
        if (json && typeof json === 'object' && !Array.isArray(json)) {
            document = json as Record<string, unknown>;
        } else {
            parseIssue = 'Not a JSON object.';
        }
    } catch (err) {
        parseIssue = err instanceof Error ? err.message : 'Failed to parse JSON.';
    }

    const match = file.name.match(FILENAME_PATTERN);
    let engine = '';
    let engineVersion = '';
    let kind: RuntimeConfigKind = 'args';
    if (match?.groups) {
        engine = match.groups.engine;
        kind = match.groups.kind.toLowerCase() as RuntimeConfigKind;
        engineVersion = match.groups.version;
    }
    if (document) {
        const docEngine = typeof document.engine === 'string' ? document.engine : null;
        const docVersion = typeof document.version === 'string' ? document.version : null;
        if (docEngine) engine = docEngine;
        if (docVersion) engineVersion = docVersion;
    }

    let issue: string | null = parseIssue;
    if (!issue && !engine) issue = 'Could not infer engine. Rename to <engine>_<kind>_<version>.json.';
    if (!issue && !engineVersion) issue = 'Could not infer version. Rename to <engine>_<kind>_<version>.json.';

    return {file, engine, engine_version: engineVersion, kind, document, sha256, issue};
}
