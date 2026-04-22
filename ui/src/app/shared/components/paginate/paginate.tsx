import {DataLoader} from 'argo-ui';

import * as React from 'react';
import ReactPaginate from 'react-paginate';
import {services} from '../../services';

require('./paginate.scss');

export interface SortOption<T> {
    title: string;
    compare: (a: T, b: T) => number;
}

export interface PaginateProps<T> {
    page: number;
    onPageChange: (page: number) => any;
    children: (data: T[]) => React.ReactNode;
    data: T[];
    totalItems?: number;
    serverSide?: boolean;
    emptyState?: () => React.ReactNode;
    preferencesKey?: string;
    header?: React.ReactNode;
    showHeader?: boolean;
    sortOptions?: SortOption<T>[];
}

export const PaginateDropdown = (props: {label: string; value: string; items: {title: string; action: () => void}[]}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <div className='paginate-dropdown' ref={ref}>
            <div className='paginate-dropdown__trigger' onClick={() => setIsOpen(!isOpen)}>
                <span className='paginate-dropdown__label'>{props.label}</span>
                <span className='paginate-dropdown__value'>{props.value}</span>
                <i className={`fa fa-chevron-${isOpen ? 'up' : 'down'} paginate-dropdown__arrow`} />
            </div>
            {isOpen && (
                <div className='paginate-dropdown__menu'>
                    {props.items.map((item, i) => (
                        <div
                            key={i}
                            className={`paginate-dropdown__option ${item.title === props.value ? 'paginate-dropdown__option--selected' : ''}`}
                            onClick={() => {
                                item.action();
                                setIsOpen(false);
                            }}>
                            <span>{item.title}</span>
                            {item.title === props.value && <i className='fa fa-check paginate-dropdown__option-check' />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export function Paginate<T>({page, onPageChange, children, data, totalItems, serverSide, emptyState, preferencesKey, header, showHeader, sortOptions}: PaginateProps<T>) {
    return (
        <DataLoader load={() => services.viewPreferences.getPreferences()}>
            {pref => {
                preferencesKey = preferencesKey || 'default';
                const pageSize = pref.pageSizes[preferencesKey] || 10;
                const sortOption = sortOptions ? (pref.sortOptions && pref.sortOptions[preferencesKey]) || sortOptions[0].title : '';
                const itemCount = totalItems ?? data.length;
                const pageCount = pageSize === -1 ? 1 : Math.ceil(itemCount / pageSize);
                if (pageCount <= page) {
                    page = Math.max(pageCount - 1, 0);
                }

                function paginator() {
                    return (
                        <div style={{marginBottom: '0.5em'}}>
                            <div style={{display: 'flex', alignItems: 'center', marginBottom: '0.5em', paddingLeft: '1em'}}>
                                {pageCount > 1 && (
                                    <ReactPaginate
                                        containerClassName='paginate__paginator'
                                        forcePage={page}
                                        pageCount={pageCount}
                                        pageRangeDisplayed={5}
                                        marginPagesDisplayed={2}
                                        onPageChange={item => onPageChange(item.selected)}
                                    />
                                )}
                            </div>
                            {showHeader && header}
                        </div>
                    );
                }
                if (sortOption) {
                    sortOptions
                        .filter(o => o.title === sortOption)
                        .forEach(so => {
                            data.sort(so.compare);
                        });
                }
                return (
                    <React.Fragment>
                        <div className='paginate'>{paginator()}</div>
                        {data.length === 0 && emptyState ? emptyState() : children(serverSide || pageSize === -1 ? data : data.slice(pageSize * page, pageSize * (page + 1)))}
                        <div className='paginate'>{pageCount > 1 && paginator()}</div>
                    </React.Fragment>
                );
            }}
        </DataLoader>
    );
}
