import {Autocomplete} from 'argo-ui/v2';
import {Tooltip} from 'argo-ui';
import * as React from 'react';

import './filter.scss';

interface FilterProps {
    selected: string[];
    setSelected: (items: string[]) => void;
    options?: CheckboxOption[];
    label?: string;
    labels?: string[];
    abbreviations?: Map<string, string>;
    field?: boolean;
    error?: boolean;
    retry?: () => void;
    loading?: boolean;
    radio?: boolean;
    collapsed?: boolean;
}

export interface CheckboxOption {
    label: string;
    count?: number;
    icon?: React.ReactNode;
}

export const CheckboxRow = (props: {value: boolean; onChange?: (value: boolean) => void; option: CheckboxOption}) => {
    return null;
};

export const FiltersGroup = (props: {
    children?: React.ReactNode;
    content: React.ReactNode;
    appliedFilter?: string[];
    onClearFilter?: () => void;
    collapsed?: boolean;
    title?: string;
    extra?: React.ReactNode;
}) => {
    return (
        !props.collapsed && (
            <div className='filters-group'>
                <div className='filters-group__filters'>
                    {props.children}
                    {props.appliedFilter?.length > 0 && props.onClearFilter && (
                        <button onClick={() => props.onClearFilter()} className='filters-group__clear-btn'>
                            <i className='fa fa-times' /> Clear
                        </button>
                    )}
                </div>
                {props.extra && <div className='filters-group__extra'>{props.extra}</div>}
                <div className='filters-group__content'>{props.content}</div>
            </div>
        )
    );
};

export const Filter = (props: FilterProps) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [input, setInput] = React.useState('');
    const ref = React.useRef<HTMLDivElement>(null);

    const options = props.options || [];
    const labels = props.labels || options.map(o => o.label);

    React.useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const toggleOption = (label: string) => {
        if (props.selected.includes(label)) {
            props.setSelected(props.selected.filter(s => s !== label));
        } else {
            if (props.radio) {
                props.setSelected([label]);
            } else {
                props.setSelected([...props.selected, label]);
            }
        }
    };

    const removeTag = (label: string) => {
        props.setSelected(props.selected.filter(s => s !== label));
    };

    if (props.collapsed) {
        return null;
    }

    const filteredOptions = props.field
        ? labels.filter(l => !input || l.toLowerCase().includes(input.toLowerCase())).map(l => {
            const opt = options.find(o => o.label === l);
            return opt || {label: l};
        })
        : options;

    return (
        <div className='filter-dropdown' ref={ref}>
            <div className='filter-dropdown__trigger' onClick={() => setIsOpen(!isOpen)}>
                <span className='filter-dropdown__label'>{props.label}</span>
                {props.selected.length > 0 && (
                    <span className='filter-dropdown__badge'>{props.selected.length}</span>
                )}
                <i className={`fa fa-chevron-${isOpen ? 'up' : 'down'} filter-dropdown__arrow`} />
            </div>

            {isOpen && (
                <div className='filter-dropdown__menu'>
                    {props.loading ? (
                        <div className='filter-dropdown__status'><i className='fa fa-circle-notch fa-spin' /> Loading...</div>
                    ) : props.error ? (
                        <div className='filter-dropdown__status filter-dropdown__status--error'>
                            <i className='fa fa-exclamation-circle' /> Error
                            <span onClick={() => props.retry && props.retry()} className='filter-dropdown__retry'> Retry</span>
                        </div>
                    ) : (
                        <>
                            {props.field && (
                                <input
                                    className='filter-dropdown__search'
                                    placeholder={`Search ${props.label?.toLowerCase()}...`}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    autoFocus
                                    onClick={e => e.stopPropagation()}
                                />
                            )}
                            <div className='filter-dropdown__options'>
                                {filteredOptions.map((opt, i) => (
                                    <div
                                        key={i}
                                        className={`filter-dropdown__option ${props.selected.includes(opt.label) ? 'filter-dropdown__option--selected' : ''}`}
                                        onClick={() => toggleOption(opt.label)}>
                                        {opt.icon && <span className='filter-dropdown__option-icon'>{opt.icon}</span>}
                                        <span className='filter-dropdown__option-label'>{opt.label}</span>
                                        {opt.count !== undefined && <span className='filter-dropdown__option-count'>{opt.count}</span>}
                                        {props.selected.includes(opt.label) && <i className='fa fa-check filter-dropdown__option-check' />}
                                    </div>
                                ))}
                                {filteredOptions.length === 0 && (
                                    <div className='filter-dropdown__empty'>No matches</div>
                                )}
                            </div>
                            {props.field && input && !labels.includes(input) && (
                                <div
                                    className='filter-dropdown__option filter-dropdown__option--add'
                                    onClick={() => { toggleOption(input); setInput(''); }}>
                                    <i className='fa fa-plus' /> Add "{input}"
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

const FilterError = (props: {retry: () => void}) => (
    <div className='filter__error'>
        <i className='fa fa-exclamation-circle' /> ERROR LOADING FILTER
        <div onClick={() => props.retry()} className='filter__error__retry'>
            <i className='fa fa-redo' /> RETRY
        </div>
    </div>
);

const FilterLoading = () => (
    <div className='filter__loading'>
        <i className='fa fa-circle-notch fa-spin' /> LOADING
    </div>
);
