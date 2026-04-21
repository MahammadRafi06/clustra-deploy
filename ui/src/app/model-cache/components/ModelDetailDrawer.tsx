import {SlidingPanel} from 'argo-ui';
import React, {useEffect, useState} from 'react';

import * as api from '../api/client';
import type {ModelDetail, RelatedModel} from '../api/types';
import {formatBytes, formatDate, formatRelativeTime, type Tone} from '../utils/formatters';
import {AuditTimeline} from './AuditTimeline';
import {StatusBadge} from './common/StatusBadge';

interface Props {
    model: ModelDetail | null;
    isLoading: boolean;
    airgapped?: boolean;
    onClose: () => void;
    onSoftDelete: (id: string) => void;
    onHardDelete: (id: string) => void;
    onRestore: (id: string) => void;
    onIntegrityCheck: (id: string) => void;
    onTogglePin: (id: string, pinned: boolean) => void;
}

export const ModelDetailDrawer: React.FC<Props> = ({model: initialModel, isLoading, airgapped, onClose, onSoftDelete, onHardDelete, onRestore, onIntegrityCheck, onTogglePin}) => {
    const [model, setModel] = useState(initialModel);
    const [checkingVersion, setCheckingVersion] = useState(false);
    const [related, setRelated] = useState<RelatedModel[]>([]);

    useEffect(() => {
        setModel(initialModel);
    }, [initialModel]);

    useEffect(() => {
        if (initialModel?.id) {
            api.getRelatedModels(initialModel.id)
                .then(setRelated)
                .catch(() => setRelated([]));
        }
    }, [initialModel?.id]);

    async function handleCheckVersion() {
        if (!model) {
            return;
        }
        setCheckingVersion(true);
        try {
            const updated = await api.checkModelVersion(model.id);
            setModel(updated);
        } catch (error) {
            console.error('Version check failed:', error);
        } finally {
            setCheckingVersion(false);
        }
    }

    if (!model && !isLoading) {
        return null;
    }

    const header = (
        <div className='model-cache__drawer-title'>
            <strong>{model?.display_name || model?.repo_id || 'Model Details'}</strong>
            {!isLoading && model && <StatusBadge status={model.status} />}
        </div>
    );

    return (
        <SlidingPanel hasCloseButton={true} hasNoPadding={true} header={header} isMiddle={true} isShown={!!model || isLoading} onClose={onClose}>
            {isLoading || !model ? (
                <div className='model-cache__drawer-body model-cache__table-meta'>Loading…</div>
            ) : (
                <div className='model-cache__drawer-body'>
                    <div className='model-cache__drawer-section'>
                        <div className='model-cache__drawer-subtitle'>{model.repo_id}</div>
                    </div>

                    <div className='model-cache__drawer-section'>
                        <h4 className='model-cache__section-title'>Metadata</h4>
                        <div className='model-cache__meta-grid'>
                            <MetaField label='Source' value={model.source} />
                            <MetaField label='Revision' value={model.revision} />
                            <MetaField label='Size' value={formatBytes(model.total_size_bytes)} />
                            <MetaField label='Files' value={model.file_count?.toString() || '-'} />
                            <MetaField label='Format' value={model.format || '-'} />
                            <MetaField label='Task Type' value={model.task_type || '-'} />
                            <MetaField label='SHA256' value={model.sha256 ? `${model.sha256.substring(0, 12)}…` : '-'} />
                            <MetaField label='Created By' value={model.created_by || '-'} />
                            <MetaField label='Created' value={formatDate(model.created_at)} />
                            <MetaField label='Updated' value={formatRelativeTime(model.updated_at)} />
                        </div>
                        {Object.keys(model.labels).length > 0 && (
                            <div className='model-cache__chip-list'>
                                {Object.entries(model.labels).map(([key, value]) => (
                                    <StatusBadge key={key} tone='muted'>
                                        {key}: {value}
                                    </StatusBadge>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className='model-cache__drawer-section'>
                        <h4 className='model-cache__section-title'>Cache Status</h4>
                        <div className='model-cache__meta-grid'>
                            <MetaField label='Complete' value={model.is_complete ? 'Yes' : 'No'} />
                            <MetaField label='Kind' value={model.model_kind || 'unknown'} />
                            <MetaField label='Disk Path' value={model.disk_path || '-'} />
                            <MetaField label='Last Scanned' value={model.last_scanned_at ? formatRelativeTime(model.last_scanned_at) : 'Never'} />
                            {model.base_model && <MetaField label='Base Model' value={model.base_model} />}
                        </div>
                    </div>

                    {related.length > 0 && (
                        <div className='model-cache__drawer-section'>
                            <h4 className='model-cache__section-title'>Related Models</h4>
                            <div className='model-cache__related-list'>
                                {related.map(relatedModel => (
                                    <div key={relatedModel.id} className='model-cache__related-item'>
                                        <div>
                                            <div>{relatedModel.repo_id}</div>
                                            <div className='model-cache__table-meta'>
                                                {relatedModel.revision} · {relatedModel.model_kind || 'unknown'}
                                            </div>
                                        </div>
                                        <StatusBadge tone={relationshipTone(relatedModel.relationship)} size='small'>
                                            {relatedModel.relationship}
                                        </StatusBadge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!airgapped && (
                        <div className='model-cache__drawer-section'>
                            <div className='model-cache__drawer-toolbar'>
                                <h4 className='model-cache__section-title'>Version</h4>
                                <button type='button' className='argo-button argo-button--base-o model-cache__button' disabled={checkingVersion} onClick={handleCheckVersion}>
                                    <i className={`fa fa-cloud${checkingVersion ? ' fa-spin' : ''}`} /> {checkingVersion ? 'Checking…' : 'Check upstream'}
                                </button>
                            </div>
                            {model.update_available && (
                                <div className='model-cache__inline-banner model-cache__inline-banner--accent'>A newer version is available upstream. Re-download to update.</div>
                            )}
                            <div className='model-cache__meta-grid'>
                                <MetaField label='Local SHA' value={model.sha256 ? model.sha256.substring(0, 12) : '-'} />
                                <MetaField label='Upstream SHA' value={model.upstream_sha256 ? model.upstream_sha256.substring(0, 12) : '-'} />
                                <MetaField label='Last Checked' value={model.upstream_checked_at ? formatRelativeTime(model.upstream_checked_at) : 'Never'} />
                            </div>
                        </div>
                    )}

                    <div className='model-cache__drawer-section'>
                        <h4 className='model-cache__section-title'>Activity</h4>
                        <AuditTimeline modelId={model.id} />
                    </div>

                    <div className='model-cache__drawer-section'>
                        <h4 className='model-cache__section-title'>Actions</h4>
                        <div className='model-cache__drawer-actions model-cache__drawer-actions--wrap'>
                            <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={() => onTogglePin(model.id, !model.pinned)}>
                                <i className='fa fa-thumb-tack' /> {model.pinned ? 'Unpin' : 'Pin'}
                            </button>
                            <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={() => onIntegrityCheck(model.id)}>
                                <i className='fa fa-check-circle' /> Check Integrity
                            </button>
                            {model.status === 'soft_deleted' ? (
                                <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={() => onRestore(model.id)}>
                                    <i className='fa fa-undo' /> Restore
                                </button>
                            ) : (
                                <button
                                    type='button'
                                    className='argo-button argo-button--base-o model-cache__button model-cache__button--warning'
                                    onClick={() => onSoftDelete(model.id)}>
                                    <i className='fa fa-eye-slash' /> Soft Delete
                                </button>
                            )}
                            <button
                                type='button'
                                className='argo-button argo-button--base-o model-cache__button model-cache__button--danger'
                                onClick={() => onHardDelete(model.id)}>
                                <i className='fa fa-trash' /> Hard Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SlidingPanel>
    );
};

const MetaField = ({label, value}: {label: string; value: string}) => (
    <div className='model-cache__meta-item'>
        <div className='model-cache__meta-label'>{label}</div>
        <div className='model-cache__meta-value'>{value}</div>
    </div>
);

function relationshipTone(relationship: string): Tone {
    switch (relationship) {
        case 'adapter':
        case 'adapter_of':
            return 'violet';
        case 'base':
        case 'tokenizer':
            return 'warning';
        case 'duplicate':
        case 'duplicate_of':
            return 'accent';
        default:
            return 'muted';
    }
}
