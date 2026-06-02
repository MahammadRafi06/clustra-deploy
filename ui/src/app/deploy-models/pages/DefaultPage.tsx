import React, {useEffect, useMemo, useRef, useState} from 'react';

import {policyApiClient} from '../../policy-management/api/client';
import type {ManifestOverlayRecord, PolicyRecord, RequestPolicyType, RuntimeConfigPolicyRecord} from '../../policy-management/api/types';
import {Spinner} from '../../shared/components';

import {listDeployments, submitDefault} from '../api';
import {ErrorAlert} from '../components/ErrorAlert';
import {FieldInput} from '../components/FieldInput';
import type {SelectOption} from '../components/FieldInput';
import {JobRunConsole} from '../components/JobRunConsole';
import {NoticeAlert} from '../components/NoticeAlert';
import {useFormState} from '../hooks/useFormState';
import {useJobPoller} from '../hooks/useJobPoller';
import {getGitOpsStatus, isJobSettled} from '../jobState';
import {FIELD_HELP} from '../options';
import type {DeploymentStatus, DeploymentSummary} from '../types';

interface DefaultPageProps {
    /**
     * Fired once when a run settles with a committed GitOps result, i.e. a new
     * deployment manifest landed in Git. The deploy-models page uses this to
     * refresh the deployments table without the user having to reload.
     */
    onDeploySettled?: () => void;
    /**
     * The selected Argo CD project (team). The parent only mounts this page once a
     * project + namespace are chosen, so both are set.
     */
    projectName?: string;
    /**
     * The selected target namespace. Sent with the deploy and used to predict the
     * app_name (<namespace>-<deployment>) for the live availability check.
     */
    namespace?: string;
}

const POLICY_OPTION_FETCH_LIMIT = 200;

// The deployment name is the Git directory basename AND the Argo CD application
// suffix (<namespace>-<deployment>). Three independent normalizers must agree on
// it: ai-service namespace_app_name(), the SCM-matrix ApplicationSet's
// basenameNormalized, and the 1:1 guard's predicted app_name. They only stay in
// lock-step when the input is already a clean RFC 1123 label with NO leading,
// trailing, or consecutive hyphens (otherwise normalization collapses '--' -> '-'
// and the prediction diverges from the live app). So we require the strict form:
// alphanumeric runs joined by single hyphens.
const RFC1123_LABEL = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DEPLOYMENT_NAME_MAX_LENGTH = 50;

// Non-terminal deployment statuses still "occupy" their app_name (the backend
// 1:1 guard rejects a new deploy onto any of these). 'failed'/'removed' left no
// live DGD and do not occupy.
const OCCUPYING_STATUSES: ReadonlySet<DeploymentStatus> = new Set<DeploymentStatus>(['committing', 'active', 'removing']);

// Mirror of ai-service gitops.committer.namespace_app_name(namespace, name) — keep
// byte-identical so the client-side availability check queries the SAME app_name
// the backend guard will compute. Python:
//   slug = re.sub(r'[^a-z0-9-]+', '-', f'{namespace}-{name}'.lower())
//   slug = re.sub(r'-+', '-', slug).strip('-')
//   return slug[:63].rstrip('-') or namespace
// normalizeNamespaceSlug is the UN-truncated slug. ai-service truncates to 63, but
// the SCM-matrix ApplicationSet builds the live Application name from the full
// path-derived name — so if this exceeds 63 the recorded app_name and the live
// Application would diverge. We use the raw length to reject such names.
function normalizeNamespaceSlug(namespace: string, name: string): string {
    return `${namespace}-${name}`
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function predictNamespaceAppName(namespace: string, name: string): string {
    const slug = normalizeNamespaceSlug(namespace, name).slice(0, 63).replace(/-+$/g, '');
    return slug || namespace;
}

type RequestPolicyOptions = Record<RequestPolicyType, SelectOption[]>;

interface PolicyOptionState extends RequestPolicyOptions {
    runtime: SelectOption[];
    infrastructureRecords: PolicyRecord[];
    runtimeRecords: RuntimeConfigPolicyRecord[];
    overlayRecords: ManifestOverlayRecord[];
}

const EMPTY_POLICY_OPTIONS: PolicyOptionState = {
    workload: [],
    infrastructure: [],
    serving: [],
    runtime: [],
    infrastructureRecords: [],
    runtimeRecords: [],
    overlayRecords: []
};

function documentString(document: Record<string, unknown>, key: string): string {
    return typeof document[key] === 'string' ? (document[key] as string) : '';
}

function documentObject(document: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = document[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function policyLabel(record: PolicyRecord | RuntimeConfigPolicyRecord): string {
    const displayName = documentString(record.document || {}, 'display_name');
    return displayName ? `${displayName} (${record.policy_id})` : record.policy_id;
}

function requestPolicyOptions(records: PolicyRecord[]): SelectOption[] {
    return records.map(record => ({
        value: record.policy_id,
        label: policyLabel(record),
        description: documentString(record.document || {}, 'description')
    }));
}

function runtimePolicyOptions(records: RuntimeConfigPolicyRecord[]): SelectOption[] {
    return records.map(record => ({
        value: record.policy_id,
        label: policyLabel(record),
        description: [record.deployment_type, record.engine, record.engine_version, record.dynamo_version].filter(Boolean).join(' / ')
    }));
}

function overlayOptions(records: ManifestOverlayRecord[]): SelectOption[] {
    const byKey = new Map<string, ManifestOverlayRecord[]>();
    records.forEach(record => {
        const existing = byKey.get(record.overlay_key) || [];
        existing.push(record);
        byKey.set(record.overlay_key, existing);
    });
    return Array.from(byKey.entries()).map(([overlayKey, grouped]) => {
        const primary = grouped.find(record => record.is_default) || grouped[0];
        const crdVersions = Array.from(new Set(grouped.map(record => record.crd_version))).sort();
        return {
            value: overlayKey,
            label: primary.display_name ? `${primary.display_name} (${overlayKey})` : overlayKey,
            description: [
                primary.cloud_provider,
                primary.engine,
                primary.engine_version,
                primary.dynamo_version,
                primary.deployment_type,
                crdVersions.length ? `CRD: ${crdVersions.join(', ')}` : ''
            ]
                .filter(Boolean)
                .join(' / ')
        };
    });
}

export function DefaultPage({onDeploySettled, namespace}: DefaultPageProps = {}) {
    const {values, errors, setValue, setError, validateRequired, reset} = useFormState();
    const [jobId, setJobId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<unknown | null>(null);
    // Live availability: the deployment whose app_name collides with what the
    // user typed (null = name appears free). Best-effort + advisory — the list
    // is visibility-scoped, so a hit is always a true collision but a miss is
    // not a guarantee (the global backend guard remains authoritative).
    const [nameConflict, setNameConflict] = useState<DeploymentSummary | null>(null);
    const [checkingName, setCheckingName] = useState(false);
    const [policyOptions, setPolicyOptions] = useState<PolicyOptionState>(EMPTY_POLICY_OPTIONS);
    const [policyOptionsLoading, setPolicyOptionsLoading] = useState(true);
    const [policyOptionsError, setPolicyOptionsError] = useState<unknown | null>(null);
    const {job, cancelling, cancelError, pollRecovery, cancel, retry, reset: resetPoller} = useJobPoller(jobId);
    const deploySettledNotifiedRef = useRef(false);

    // Notify the parent exactly once when this run reaches a committed, settled
    // state so the deployments table can refresh. Resets when the run clears
    // (New run / form reset) so the next deploy can notify again.
    useEffect(() => {
        if (!job) {
            deploySettledNotifiedRef.current = false;
            return;
        }
        if (!deploySettledNotifiedRef.current && isJobSettled(job) && getGitOpsStatus(job) === 'committed') {
            deploySettledNotifiedRef.current = true;
            onDeploySettled?.();
        }
    }, [job, onDeploySettled]);

    // Live availability check for the deployment name. Debounced: once the user
    // has typed a valid name under a selected project, look up whether the
    // predicted app_name (team-<project>-<name>) is already occupied and surface
    // it before they submit. Advisory only — see nameConflict above.
    useEffect(() => {
        const name = (values.public_model_name || '').trim();
        if (!namespace || !name || name.length > DEPLOYMENT_NAME_MAX_LENGTH || !RFC1123_LABEL.test(name)) {
            setNameConflict(null);
            setCheckingName(false);
            return;
        }

        const predicted = predictNamespaceAppName(namespace, name);
        let cancelled = false;
        // Drop any conflict from the PREVIOUS name immediately so a stale warning
        // never lingers (and never blocks submit) while the new check is in
        // flight — the authoritative backend guard covers the in-flight gap.
        setNameConflict(null);
        setCheckingName(true);
        const handle = setTimeout(() => {
            listDeployments({appName: predicted})
                .then(resp => {
                    if (cancelled) {
                        return;
                    }
                    const occupying = (resp.deployments || []).find(deployment => deployment.app_name === predicted && OCCUPYING_STATUSES.has(deployment.status));
                    setNameConflict(occupying ?? null);
                })
                .catch(() => {
                    // Best-effort only — never block on a transient lookup failure;
                    // the authoritative backend guard still runs at deploy time.
                    if (!cancelled) {
                        setNameConflict(null);
                    }
                })
                .finally(() => {
                    if (!cancelled) {
                        setCheckingName(false);
                    }
                });
        }, 400);

        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [namespace, values.public_model_name]);

    useEffect(() => {
        let cancelled = false;
        setPolicyOptionsLoading(true);
        setPolicyOptionsError(null);

        Promise.all([
            policyApiClient.listPolicies({type: 'workload', active: true, limit: POLICY_OPTION_FETCH_LIMIT, offset: 0}),
            policyApiClient.listPolicies({type: 'infrastructure', active: true, limit: POLICY_OPTION_FETCH_LIMIT, offset: 0}),
            policyApiClient.listPolicies({type: 'serving', active: true, limit: POLICY_OPTION_FETCH_LIMIT, offset: 0}),
            policyApiClient.listRuntimeConfigPolicies({active: true, limit: POLICY_OPTION_FETCH_LIMIT, offset: 0}),
            policyApiClient.listManifestOverlays({active: true, limit: POLICY_OPTION_FETCH_LIMIT, offset: 0})
        ])
            .then(([workload, infrastructure, serving, runtime, overlays]) => {
                if (cancelled) {
                    return;
                }
                setPolicyOptions({
                    workload: requestPolicyOptions(workload.policies || []),
                    infrastructure: requestPolicyOptions(infrastructure.policies || []),
                    serving: requestPolicyOptions(serving.policies || []),
                    runtime: runtimePolicyOptions(runtime.runtime_config_policies || []),
                    infrastructureRecords: infrastructure.policies || [],
                    runtimeRecords: runtime.runtime_config_policies || [],
                    overlayRecords: overlays.overlays || []
                });
            })
            .catch(error => {
                if (!cancelled) {
                    setPolicyOptionsError(error);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setPolicyOptionsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const policyLoadingHint = useMemo(() => (policyOptionsLoading ? 'Loading active policies...' : undefined), [policyOptionsLoading]);

    const matchingOverlayOptions = useMemo(() => {
        const selectedRuntime = policyOptions.runtimeRecords.find(record => record.policy_id === values.runtime_config_policy_id);
        const selectedInfrastructure = policyOptions.infrastructureRecords.find(record => record.policy_id === values.infrastructure_policy);
        const infraEffects = selectedInfrastructure ? documentObject(selectedInfrastructure.document || {}, 'effects') : {};
        const cloudProvider = typeof infraEffects.cloud_provider === 'string' ? infraEffects.cloud_provider : undefined;
        const filtered = policyOptions.overlayRecords.filter(record => {
            if (cloudProvider && record.cloud_provider !== cloudProvider) {
                return false;
            }
            if (!selectedRuntime) {
                return true;
            }
            return (
                record.engine === selectedRuntime.engine &&
                record.engine_version === selectedRuntime.engine_version &&
                record.dynamo_version === selectedRuntime.dynamo_version &&
                record.deployment_type === selectedRuntime.deployment_type
            );
        });
        return overlayOptions(filtered.length || selectedRuntime || cloudProvider ? filtered : policyOptions.overlayRecords);
    }, [policyOptions.infrastructureRecords, policyOptions.overlayRecords, policyOptions.runtimeRecords, values.infrastructure_policy, values.runtime_config_policy_id]);

    useEffect(() => {
        if (values.overlay_key && !matchingOverlayOptions.some(option => option.value === values.overlay_key)) {
            setValue('overlay_key', '');
        }
    }, [matchingOverlayOptions, setValue, values.overlay_key]);

    function handleFieldChange(key: string, value: string) {
        setValue(key, value);
        if (submitError) {
            setSubmitError(null);
        }
    }

    function buildRequest() {
        const request = {
            model_path: values.model_path,
            public_model_name: values.public_model_name,
            namespace,
            total_gpus: Number(values.total_gpus),
            policies: {
                workload: [values.workload_policy],
                infrastructure: [values.infrastructure_policy],
                serving: [values.serving_policy]
            },
            runtime_config_policy_id: values.runtime_config_policy_id
        };
        return values.overlay_key ? {...request, overlay_key: values.overlay_key} : request;
    }

    async function handleSubmit() {
        if (!validateRequired(['model_path', 'public_model_name', 'total_gpus', 'workload_policy', 'infrastructure_policy', 'serving_policy', 'runtime_config_policy_id'])) {
            return;
        }

        const deploymentName = (values.public_model_name || '').trim();
        if (deploymentName.length > DEPLOYMENT_NAME_MAX_LENGTH) {
            setError('public_model_name', `Keep the deployment name to ${DEPLOYMENT_NAME_MAX_LENGTH} characters or fewer.`);
            return;
        }
        if (!RFC1123_LABEL.test(deploymentName)) {
            setError('public_model_name', 'Use lowercase letters, numbers and hyphens only; must start and end with a letter or number, with no double hyphens.');
            return;
        }
        if (namespace && normalizeNamespaceSlug(namespace, deploymentName).length > 63) {
            // Over 63 the backend would truncate the app_name while the live Argo
            // Application keeps the full name — keep them identical by rejecting.
            setError('public_model_name', 'Too long for this namespace — the generated application name would exceed 63 characters. Use a shorter deployment name.');
            return;
        }
        if (nameConflict) {
            // A visible deployment already holds this app_name; the global 1:1
            // guard would reject it, so block before submitting a doomed job.
            setError('public_model_name', `This name is already ${nameConflict.status} in this project. Choose a different deployment name, or remove the existing one first.`);
            return;
        }

        setSubmitError(null);
        setSubmitting(true);
        resetPoller();
        setJobId(null);

        try {
            const accepted = await submitDefault(buildRequest());
            setJobId(accepted.job_id);
        } catch (err) {
            setSubmitError(err);
        } finally {
            setSubmitting(false);
        }
    }

    function handleReset() {
        reset();
        resetPoller();
        setJobId(null);
        setSubmitError(null);
        setNameConflict(null);
    }

    return (
        <div className='deploy-models__form'>
            <FieldInput
                def={{key: 'model_path', label: 'Model Path', type: 'text', required: true, placeholder: 'Qwen/Qwen3-32B-FP8', help: FIELD_HELP.modelPath}}
                value={values.model_path || ''}
                error={errors.model_path}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'public_model_name',
                    label: 'Deployment Name',
                    type: 'text',
                    required: true,
                    placeholder: 'qwen3-32b-chat',
                    help: FIELD_HELP.publicModelName
                }}
                value={values.public_model_name || ''}
                error={errors.public_model_name}
                onChange={handleFieldChange}
            />
            {checkingName && <p className='deploy-models__field-hint'>Checking name availability…</p>}
            {nameConflict && !errors.public_model_name && (
                <NoticeAlert
                    variant='warning'
                    message={`A deployment named "${(values.public_model_name || '').trim()}" is already ${nameConflict.status} in this project. Each name maps to one deployment — choose a different name, or remove the existing one from the list first.`}
                />
            )}
            <FieldInput
                def={{
                    key: 'total_gpus',
                    label: 'Total GPUs',
                    type: 'number',
                    required: true,
                    min: 1,
                    placeholder: '8',
                    help: FIELD_HELP.totalGpus
                }}
                value={values.total_gpus || ''}
                error={errors.total_gpus}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'workload_policy',
                    label: 'Workload Policy',
                    type: 'select',
                    required: true,
                    placeholder: 'Select workload policy',
                    options: policyOptions.workload,
                    hint: policyLoadingHint
                }}
                value={values.workload_policy || ''}
                error={errors.workload_policy}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'infrastructure_policy',
                    label: 'Infra Policy',
                    type: 'select',
                    required: true,
                    placeholder: 'Select infra policy',
                    options: policyOptions.infrastructure,
                    hint: policyLoadingHint
                }}
                value={values.infrastructure_policy || ''}
                error={errors.infrastructure_policy}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'serving_policy',
                    label: 'Serving Policy',
                    type: 'select',
                    required: true,
                    placeholder: 'Select serving policy',
                    options: policyOptions.serving,
                    hint: policyLoadingHint
                }}
                value={values.serving_policy || ''}
                error={errors.serving_policy}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'runtime_config_policy_id',
                    label: 'Runtime Config Policy',
                    type: 'select',
                    required: true,
                    placeholder: 'Select runtime config policy',
                    options: policyOptions.runtime,
                    hint: policyLoadingHint
                }}
                value={values.runtime_config_policy_id || ''}
                error={errors.runtime_config_policy_id}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'overlay_key',
                    label: 'Manifest Overlay',
                    type: 'select',
                    required: false,
                    placeholder: 'Use matching default overlay',
                    options: matchingOverlayOptions,
                    hint: policyLoadingHint
                }}
                value={values.overlay_key || ''}
                error={errors.overlay_key}
                onChange={handleFieldChange}
            />

            <div className='deploy-models__actions'>
                <button type='button' className='argo-button argo-button--base' onClick={handleSubmit} disabled={submitting || policyOptionsLoading}>
                    {submitting ? (
                        <>
                            <span className='deploy-models__button-spinner'>
                                <Spinner show={true} />
                            </span>
                            Submitting...
                        </>
                    ) : (
                        <>
                            <i className='fa fa-paper-plane' /> Submit
                        </>
                    )}
                </button>
                {(jobId || submitError) && (
                    <button type='button' className='argo-button argo-button--base-o' onClick={handleReset}>
                        New run
                    </button>
                )}
            </div>

            {policyOptionsError && <ErrorAlert error={policyOptionsError} />}
            {submitError && <ErrorAlert error={submitError} />}

            <JobRunConsole job={job} cancelling={cancelling} cancelError={cancelError} pollRecovery={pollRecovery} onRetryPoll={retry} onCancel={cancel} />
        </div>
    );
}
