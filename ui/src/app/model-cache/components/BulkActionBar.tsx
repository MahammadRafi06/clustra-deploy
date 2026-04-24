import React from 'react';

interface Props {
    selectedCount: number;
    onSoftDelete: () => void;
    onPin: () => void;
    onUnpin: () => void;
    onClear: () => void;
}

export const BulkActionBar: React.FC<Props> = ({selectedCount, onSoftDelete, onPin, onUnpin, onClear}) => {
    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className='model-cache__bulk-bar' role='toolbar' aria-label='Bulk model actions'>
            <span className='model-cache__bulk-count'>
                {selectedCount} model{selectedCount > 1 ? 's' : ''} selected
            </span>
            <div className='model-cache__bulk-actions'>
                <button
                    type='button'
                    className='argo-button argo-button--base-o model-cache__button'
                    onClick={onPin}
                    aria-label={`Pin ${selectedCount} selected model${selectedCount > 1 ? 's' : ''}`}
                >
                    <i className='fa fa-thumb-tack' /> Pin
                </button>
                <button
                    type='button'
                    className='argo-button argo-button--base-o model-cache__button'
                    onClick={onUnpin}
                    aria-label={`Unpin ${selectedCount} selected model${selectedCount > 1 ? 's' : ''}`}
                >
                    <i className='fa fa-thumb-tack model-cache__icon--muted' /> Unpin
                </button>
                <button
                    type='button'
                    className='argo-button argo-button--base-o model-cache__button model-cache__button--warning'
                    onClick={onSoftDelete}
                    aria-label={`Soft delete ${selectedCount} selected model${selectedCount > 1 ? 's' : ''}`}
                >
                    <i className='fa fa-eye-slash' /> Soft Delete
                </button>
                <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={onClear} aria-label='Clear selected models'>
                    Clear
                </button>
            </div>
        </div>
    );
};
