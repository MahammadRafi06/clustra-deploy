import {SlidingPanel} from 'argo-ui';
import React, {useEffect, useState} from 'react';

import * as api from '../api/client';
import type {PresetSummary} from '../api/types';
import {formatRelativeTime} from '../utils/formatters';
import {StatusBadge} from './common/StatusBadge';

interface Props {
    visible: boolean;
    onClose: () => void;
    onToast: (msg: string) => void;
}

export const PresetsPanel: React.FC<Props> = ({visible, onClose, onToast}) => {
    const [presets, setPresets] = useState<PresetSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [modelInput, setModelInput] = useState('');
    const [models, setModels] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    function fetchPresets() {
        setLoading(true);
        api.listPresets()
            .then(setPresets)
            .catch(() => {})
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        if (visible) {
            fetchPresets();
        }
    }, [visible]);

    useEffect(() => {
        if (!visible) {
            resetCreateForm();
        }
    }, [visible]);

    function resetCreateForm() {
        setShowCreate(false);
        setName('');
        setDescription('');
        setModelInput('');
        setModels([]);
        setSubmitting(false);
        setCreateError(null);
    }

    async function handleApply(preset: PresetSummary) {
        try {
            const result = await api.applyPreset(preset.id);
            onToast(`Preset "${preset.name}": ${result.triggered.length} triggered, ${result.skipped.length} skipped`);
        } catch (error) {
            onToast(`Failed to apply preset: ${error}`);
        }
    }

    async function handleDelete(preset: PresetSummary) {
        if (!confirm(`Delete preset "${preset.name}"?`)) {
            return;
        }
        try {
            await api.deletePreset(preset.id);
            onToast(`Deleted preset "${preset.name}"`);
            fetchPresets();
        } catch (error) {
            onToast(`Failed to delete preset: ${error}`);
        }
    }

    function addModel() {
        const trimmed = modelInput.trim();
        if (!trimmed || models.includes(trimmed)) {
            return;
        }
        setModels([...models, trimmed]);
        setModelInput('');
    }

    async function createPreset(event: React.FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        setCreateError(null);
        try {
            await api.createPreset({
                name,
                description: description || undefined,
                models: models.map(model => ({repo_id: model, source: 'huggingface', revision: 'main'}))
            });
            onToast('Preset created');
            fetchPresets();
            resetCreateForm();
        } catch (error) {
            setCreateError(String(error));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <SlidingPanel hasCloseButton={true} hasNoPadding={true} header={<strong>Cache Warmup Presets</strong>} isNarrow={true} isShown={visible} onClose={onClose}>
            <div className='model-cache__drawer-toolbar'>
                <button type='button' className='argo-button argo-button--base model-cache__button' onClick={() => setShowCreate(value => !value)}>
                    <i className='fa fa-plus' /> {showCreate ? 'Hide Form' : 'New Preset'}
                </button>
            </div>

            <div className='model-cache__drawer-body'>
                {showCreate && (
                    <form className='model-cache__inline-form' onSubmit={createPreset}>
                        <div className='argo-form-row'>
                            <label>Name</label>
                            <input className='argo-field' value={name} onChange={event => setName(event.target.value)} required placeholder='production-llm-stack' />
                        </div>
                        <div className='argo-form-row'>
                            <label>Description</label>
                            <input className='argo-field' value={description} onChange={event => setDescription(event.target.value)} placeholder='Optional' />
                        </div>
                        <div className='argo-form-row'>
                            <label>Models</label>
                            <div className='model-cache__inline-fields'>
                                <input
                                    className='argo-field'
                                    value={modelInput}
                                    onChange={event => setModelInput(event.target.value)}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            addModel();
                                        }
                                    }}
                                    placeholder='org/model-name'
                                />
                                <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={addModel}>
                                    Add
                                </button>
                            </div>
                            {models.length > 0 && (
                                <div className='model-cache__chip-list'>
                                    {models.map(model => (
                                        <StatusBadge key={model} tone='muted' onClick={() => setModels(models.filter(item => item !== model))} iconClassName='fa fa-times'>
                                            {model}
                                        </StatusBadge>
                                    ))}
                                </div>
                            )}
                        </div>
                        {createError && <div className='argo-form-row__error-msg'>{createError}</div>}
                        <div className='model-cache__drawer-actions'>
                            <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={resetCreateForm}>
                                Cancel
                            </button>
                            <button type='submit' className='argo-button argo-button--base model-cache__button' disabled={submitting || !name || models.length === 0}>
                                {submitting ? 'Creating…' : 'Create'}
                            </button>
                        </div>
                    </form>
                )}

                {loading ? (
                    <div className='model-cache__table-empty'>Loading…</div>
                ) : presets.length === 0 ? (
                    <div className='model-cache__table-empty'>No presets yet. Create one to bundle related models.</div>
                ) : (
                    presets.map(preset => (
                        <div key={preset.id} className='model-cache__job-card'>
                            <div className='model-cache__job-card-header'>
                                <div className='model-cache__job-title'>
                                    <span>{preset.name}</span>
                                </div>
                            </div>
                            {preset.description && <div className='model-cache__job-meta'>{preset.description}</div>}
                            <div className='model-cache__job-meta'>
                                {preset.model_count} models · {formatRelativeTime(preset.updated_at)}
                            </div>
                            <div className='model-cache__job-actions'>
                                <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={() => handleApply(preset)}>
                                    <i className='fa fa-cloud-download' /> Apply
                                </button>
                                <button
                                    type='button'
                                    className='argo-button argo-button--base-o model-cache__button model-cache__button--danger'
                                    onClick={() => handleDelete(preset)}>
                                    <i className='fa fa-trash' /> Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </SlidingPanel>
    );
};
