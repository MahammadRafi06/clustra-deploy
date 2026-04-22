import {Select, SlidingPanel} from 'argo-ui';
import React, {useState} from 'react';

import type {DownloadRequest} from '../api/types';
import {StatusBadge} from './common/StatusBadge';

interface Props {
    onSubmit: (req: DownloadRequest) => void;
    onClose: () => void;
    isLoading: boolean;
    error: string | null;
}

export const DownloadModelModal: React.FC<Props> = ({onSubmit, onClose, isLoading, error}) => {
    const [form, setForm] = useState<DownloadRequest>({
        repo_id: '',
        source: 'huggingface',
        revision: 'main',
        target_pvc: 'model-cache',
        target_namespace: 'model-cache',
        labels: {},
        display_name: ''
    });
    const [labelKey, setLabelKey] = useState('');
    const [labelValue, setLabelValue] = useState('');

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        onSubmit(form);
    }

    function addLabel() {
        if (!labelKey || !labelValue) {
            return;
        }
        setForm({...form, labels: {...form.labels, [labelKey]: labelValue}});
        setLabelKey('');
        setLabelValue('');
    }

    function removeLabel(key: string) {
        const next = {...form.labels};
        delete next[key];
        setForm({...form, labels: next});
    }

    return (
        <SlidingPanel hasCloseButton={true} header={<strong>Download Model</strong>} isMiddle={true} isShown={true} onClose={onClose}>
            <form className='model-cache__drawer-body model-cache__form' onSubmit={handleSubmit}>
                <div className='argo-form-row'>
                    <label>Source</label>
                    <div className='model-cache__select'>
                        <Select
                            value={form.source}
                            options={[
                                {title: 'Hugging Face', value: 'huggingface'},
                                {title: 'Git Repository', value: 'git'}
                            ]}
                            placeholder='Choose a source'
                            onChange={option => setForm({...form, source: option.value})}
                        />
                    </div>
                </div>

                <div className='argo-form-row'>
                    <label>{form.source === 'huggingface' ? 'Model ID' : 'Repository URL'}</label>
                    <input
                        type='text'
                        className='argo-field'
                        value={form.repo_id}
                        onChange={event => setForm({...form, repo_id: event.target.value})}
                        placeholder={form.source === 'huggingface' ? 'nvidia/DeepSeek-V3.2-NVFP4' : 'https://github.com/org/model.git'}
                        required
                        autoFocus
                    />
                </div>

                <div className='argo-form-row'>
                    <label>Revision / Branch / Tag</label>
                    <input type='text' className='argo-field' value={form.revision} onChange={event => setForm({...form, revision: event.target.value})} placeholder='main' />
                </div>

                <div className='argo-form-row'>
                    <label>Display Name</label>
                    <input
                        type='text'
                        className='argo-field'
                        value={form.display_name || ''}
                        onChange={event => setForm({...form, display_name: event.target.value || undefined})}
                        placeholder='Friendly name for the model'
                    />
                </div>

                <div className='model-cache__two-column'>
                    <div className='argo-form-row'>
                        <label>Target PVC</label>
                        <input type='text' className='argo-field' value={form.target_pvc} onChange={event => setForm({...form, target_pvc: event.target.value})} />
                    </div>
                    <div className='argo-form-row'>
                        <label>Namespace</label>
                        <input type='text' className='argo-field' value={form.target_namespace} onChange={event => setForm({...form, target_namespace: event.target.value})} />
                    </div>
                </div>

                <div className='argo-form-row'>
                    <label>Labels</label>
                    <div className='model-cache__inline-fields'>
                        <input type='text' className='argo-field' value={labelKey} onChange={event => setLabelKey(event.target.value)} placeholder='key' />
                        <input type='text' className='argo-field' value={labelValue} onChange={event => setLabelValue(event.target.value)} placeholder='value' />
                        <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={addLabel}>
                            Add
                        </button>
                    </div>
                    {!!form.labels && Object.keys(form.labels).length > 0 && (
                        <div className='model-cache__chip-list'>
                            {Object.entries(form.labels).map(([key, value]) => (
                                <StatusBadge key={key} tone='muted' onClick={() => removeLabel(key)} iconClassName='fa fa-times'>
                                    {key}: {value}
                                </StatusBadge>
                            ))}
                        </div>
                    )}
                </div>

                {error && <div className='argo-form-row__error-msg'>{error}</div>}

                <div className='model-cache__drawer-actions'>
                    <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={onClose}>
                        Cancel
                    </button>
                    <button type='submit' className='argo-button argo-button--base model-cache__button' disabled={isLoading || !form.repo_id}>
                        {isLoading ? 'Starting…' : 'Download'}
                    </button>
                </div>
            </form>
        </SlidingPanel>
    );
};
