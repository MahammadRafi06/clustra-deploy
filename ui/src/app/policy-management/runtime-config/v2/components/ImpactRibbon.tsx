import * as React from 'react';

import type {ImpactSummary} from '../types';

/**
 * A compact ribbon above the role view that translates current overrides into
 * the runtime impact areas they touch. Lives at the top of the role editor —
 * the goal is to make abstract flag changes feel like business outcomes.
 *
 * We deliberately don't claim a direction (↓ / ↑) for tagged impacts yet —
 * that requires hand-curated metadata per field. Instead we surface the *areas*
 * being affected and a few headline numbers (GPU memory, batched tokens) when
 * the user has actually set them.
 */
export const ImpactRibbon: React.FC<{
    summary: ImpactSummary;
    overrideCount: number;
}> = ({summary, overrideCount}) => {
    const hasTaggedImpact = summary.tags.length > 0 || summary.gpuMemoryFraction != null || summary.maxBatchedTokens != null || summary.maxNumSeqs != null;
    const isEmpty = overrideCount === 0;
    return (
        <section className='rcfg-v2-impact-ribbon' aria-label='Estimated impact'>
            <header>
                <span className='rcfg-v2-impact-ribbon__label'>Estimated impact</span>
                <span className='rcfg-v2-impact-ribbon__count'>
                    <strong>{overrideCount}</strong> override{overrideCount === 1 ? '' : 's'} in this role
                </span>
            </header>
            {isEmpty ? (
                <div className='rcfg-v2-impact-ribbon__empty'>No overrides yet — this role will run on engine defaults.</div>
            ) : !hasTaggedImpact ? (
                <div className='rcfg-v2-impact-ribbon__empty rcfg-v2-impact-ribbon__empty--neutral'>
                    {overrideCount} override{overrideCount === 1 ? '' : 's'} active · impact areas not tagged in the catalog yet.
                </div>
            ) : (
                <div className='rcfg-v2-impact-ribbon__items'>
                    {summary.tags.map(tag => (
                        <span key={tag} className={`rcfg-v2-impact-ribbon__pill rcfg-v2-impact-ribbon__pill--${tag.toLowerCase()}`}>
                            <i className='fa fa-circle' aria-hidden='true' />
                            {capitalize(tag)}
                            <small>{summary.counts[tag] || 0}</small>
                        </span>
                    ))}
                    {summary.gpuMemoryFraction != null && (
                        <span className='rcfg-v2-impact-ribbon__metric' title='GPU memory fraction the engine is configured to reserve'>
                            <i className='fa fa-microchip' aria-hidden='true' />
                            GPU mem fraction <strong>{formatPercent(summary.gpuMemoryFraction)}</strong>
                        </span>
                    )}
                    {summary.maxBatchedTokens != null && (
                        <span className='rcfg-v2-impact-ribbon__metric' title='Maximum tokens batched per step. Higher = throughput, lower = latency.'>
                            <i className='fa fa-layer-group' aria-hidden='true' />
                            Batched tokens <strong>{summary.maxBatchedTokens.toLocaleString()}</strong>
                        </span>
                    )}
                    {summary.maxNumSeqs != null && (
                        <span className='rcfg-v2-impact-ribbon__metric' title='Maximum concurrent sequences the engine will hold.'>
                            <i className='fa fa-stream' aria-hidden='true' />
                            Max seqs <strong>{summary.maxNumSeqs.toLocaleString()}</strong>
                        </span>
                    )}
                </div>
            )}
        </section>
    );
};

function capitalize(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPercent(value: number): string {
    if (value > 1) {
        return `${Math.round(value)}%`;
    }
    return `${Math.round(value * 100)}%`;
}
