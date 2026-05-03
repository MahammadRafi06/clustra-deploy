import {SlidingPanel} from 'argo-ui';
import * as React from 'react';

export const PolicyConfirmDialog: React.FC<{
    title: string;
    message: string;
    confirmLabel: string;
    pending?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}> = ({title, message, confirmLabel, pending, onCancel, onConfirm}) => (
    <SlidingPanel hasCloseButton={true} header={<strong>{title}</strong>} isMiddle={true} isShown={true} onClose={onCancel}>
        <div className='policy-management__drawer-body policy-management__form' role='dialog' aria-modal='true' aria-label={title}>
            <p className='policy-management__confirm-copy'>{message}</p>
            <div className='policy-management__drawer-actions'>
                <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={onCancel}>
                    Cancel
                </button>
                <button
                    type='button'
                    className='argo-button argo-button--base-o policy-management__button policy-management__button--danger'
                    onClick={onConfirm}
                    disabled={pending}>
                    {pending ? 'Working...' : confirmLabel}
                </button>
            </div>
        </div>
    </SlidingPanel>
);
