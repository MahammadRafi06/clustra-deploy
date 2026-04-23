import React, {useState} from 'react';

interface AdvancedSectionProps {
    children: React.ReactNode;
    label?: string;
}

export function AdvancedSection({children, label = 'Advanced Configuration'}: AdvancedSectionProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <div className='argo-form-row deploy-models__advanced-toggle-row'>
                <label aria-hidden='true' className='deploy-models__advanced-toggle-spacer'>
                    &nbsp;
                </label>
                <button type='button' className='argo-button argo-button--base-o deploy-models__advanced-toggle' aria-expanded={open} onClick={() => setOpen(value => !value)}>
                    <span className={`deploy-models__advanced-chevron${open ? ' is-open' : ''}`}>
                        <i className='fa fa-angle-right' />
                    </span>
                    {label}
                </button>
            </div>
            {open && <div className='deploy-models__advanced-body'>{children}</div>}
        </>
    );
}
