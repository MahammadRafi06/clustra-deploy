import React, {useState} from 'react';

interface AdvancedSectionProps {
    children: React.ReactNode;
    label?: string;
}

export function AdvancedSection({children, label = 'Advanced Configuration'}: AdvancedSectionProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type='button' className='argo-button argo-button--base-o deploy-models__advanced-toggle' aria-expanded={open} onClick={() => setOpen(value => !value)}>
                <span className={`deploy-models__advanced-chevron${open ? ' is-open' : ''}`}>
                    <i className='fa fa-angle-right' />
                </span>
                {label}
            </button>
            {open && <div className='deploy-models__advanced-body'>{children}</div>}
        </>
    );
}
