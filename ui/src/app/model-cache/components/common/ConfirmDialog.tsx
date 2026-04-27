import {SlidingPanel} from 'argo-ui';
import React, {useState} from 'react';

interface Props {
    title: string;
    message: string;
    confirmText?: string;
    confirmValue?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<Props> = ({title, message, confirmText = 'Confirm', confirmValue, danger = false, onConfirm, onCancel}) => {
    const [inputValue, setInputValue] = useState('');
    const canConfirm = !confirmValue || inputValue === confirmValue;

    return (
        <SlidingPanel hasCloseButton={true} header={<strong>{title}</strong>} isMiddle={true} isShown={true} onClose={onCancel}>
            <div className='model-cache__drawer-body model-cache__form' role='dialog' aria-modal='true' aria-label={title}>
                <p className='model-cache__confirm-copy'>{message}</p>
                {confirmValue && (
                    <div className='argo-form-row'>
                        <label>
                            Type <strong>{confirmValue}</strong> to confirm
                        </label>
                        <input type='text' className='argo-field' value={inputValue} onChange={event => setInputValue(event.target.value)} autoFocus />
                    </div>
                )}
                <div className='model-cache__drawer-actions'>
                    <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type='button'
                        className={`argo-button ${danger ? 'argo-button--base-o model-cache__button--danger' : 'argo-button--base'} model-cache__button`}
                        onClick={onConfirm}
                        disabled={!canConfirm}
                        aria-label={confirmText}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </SlidingPanel>
    );
};
