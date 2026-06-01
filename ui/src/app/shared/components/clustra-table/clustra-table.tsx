import * as React from 'react';

require('./clustra-table.scss');

// =============================================================================
// Shared, theme-aware UI primitives used across every first-party page so the
// tables and headers look identical everywhere.
// =============================================================================

export type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

export const StatusPill: React.FC<{
    tone?: PillTone;
    icon?: string;
    title?: string;
    ariaLabel?: string;
    onClick?: () => void;
    children: React.ReactNode;
    className?: string;
}> = ({tone = 'neutral', icon, title, ariaLabel, onClick, children, className}) => {
    const cls = `ctbl-pill ctbl-pill--${tone}${onClick ? ' ctbl-pill--button' : ''}${className ? ' ' + className : ''}`;
    const content = (
        <>
            {icon ? <i className={icon} aria-hidden='true' /> : null}
            {children}
        </>
    );
    return onClick ? (
        <button type='button' className={cls} onClick={onClick} title={title} aria-label={ariaLabel || title}>
            {content}
        </button>
    ) : (
        <span className={cls} title={title} aria-label={ariaLabel}>
            {content}
        </span>
    );
};

export interface Column<T> {
    /** Stable key for the column. */
    key: string;
    /** Header label. */
    header: React.ReactNode;
    /** Cell renderer. */
    render: (row: T) => React.ReactNode;
    /** CSS grid track for the column, e.g. 'minmax(0, 2fr)' or '120px'. Defaults to 'minmax(0, 1fr)'. */
    width?: string;
    align?: 'left' | 'right' | 'center';
}

export interface DataTableProps<T> {
    columns: Array<Column<T>>;
    rows: T[];
    rowKey: (row: T) => string;
    onRowClick?: (row: T) => void;
    isRowSelected?: (row: T) => boolean;
    loading?: boolean;
    /** Shown when there are no rows and not loading. */
    empty?: React.ReactNode;
    ariaLabel?: string;
}

function cellClass<T>(col: Column<T>): string {
    return `ctbl__cell${col.align === 'right' ? ' ctbl__cell--right' : col.align === 'center' ? ' ctbl__cell--center' : ''}`;
}

export function DataTable<T>(props: DataTableProps<T>) {
    const {columns, rows, rowKey, onRowClick, isRowSelected, loading, empty, ariaLabel} = props;
    const gridCols = columns.map(c => c.width || 'minmax(0, 1fr)').join(' ');
    const style = {['--ctbl-cols' as any]: gridCols} as React.CSSProperties;

    return (
        <div className='ctbl' role='table' aria-label={ariaLabel}>
            <div className='ctbl__head' role='row' style={style}>
                {columns.map(col => (
                    <div key={col.key} className={cellClass(col)} role='columnheader'>
                        {col.header}
                    </div>
                ))}
            </div>
            <div className='ctbl__body'>
                {loading ? (
                    <div className='ctbl__loading'>Loading…</div>
                ) : rows.length === 0 ? (
                    <div className='ctbl__empty'>{empty || 'No items.'}</div>
                ) : (
                    rows.map(row => {
                        const clickable = !!onRowClick;
                        const selected = isRowSelected ? isRowSelected(row) : false;
                        return (
                            <div
                                key={rowKey(row)}
                                role='row'
                                className={`ctbl__row${clickable ? ' ctbl__row--clickable' : ''}${selected ? ' ctbl__row--selected' : ''}`}
                                style={style}
                                tabIndex={clickable ? 0 : undefined}
                                onClick={clickable ? () => onRowClick!(row) : undefined}
                                onKeyDown={
                                    clickable
                                        ? e => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                  e.preventDefault();
                                                  onRowClick!(row);
                                              }
                                          }
                                        : undefined
                                }>
                                {columns.map(col => (
                                    <div key={col.key} className={cellClass(col)} role='cell'>
                                        {col.render(row)}
                                    </div>
                                ))}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export const PageHeader: React.FC<{
    eyebrow?: string;
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
}> = ({eyebrow, title, description, actions}) => (
    <div className='ctbl-page-header'>
        <div>
            {eyebrow ? <div className='ctbl-page-header__eyebrow'>{eyebrow}</div> : null}
            <h1 className='ctbl-page-header__title'>{title}</h1>
            {description ? <p className='ctbl-page-header__desc'>{description}</p> : null}
        </div>
        {actions ? <div className='ctbl-page-header__actions'>{actions}</div> : null}
    </div>
);
