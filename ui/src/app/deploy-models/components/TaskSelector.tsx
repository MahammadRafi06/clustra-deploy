import React from 'react';

export type TaskKey = 'default' | 'experiment' | 'generate' | 'support' | 'estimate';

export const TASK_OPTIONS: {
    value: TaskKey;
    label: string;
    title: string;
    description: string;
    badges: string[];
    icon: string;
    accent: string;
}[] = [
    {
        value: 'default',
        label: 'Recommended',
        title: 'Find Best Deployment Plan',
        description: 'Runs an exact preflight, picks a deployment shape, and writes manifests if the run succeeds.',
        badges: ['Writes manifests', 'A few minutes'],
        icon: 'fa-compass',
        accent: 'emerald'
    },
    {
        value: 'experiment',
        label: 'Expert',
        title: 'Replay Existing Config',
        description: 'Replay a known YAML or JSON config when you already know the layout you want to ship.',
        badges: ['Writes manifests', 'Expert input'],
        icon: 'fa-flask',
        accent: 'gold'
    },
    {
        value: 'generate',
        label: 'Quick Deploy',
        title: 'Generate Known Shape',
        description: 'Fastest path when you already know the model, backend, and instance you want.',
        badges: ['Writes manifests', 'Fastest async run'],
        icon: 'fa-rocket',
        accent: 'emerald'
    },
    {
        value: 'support',
        label: 'Compatibility',
        title: 'Check Known Support',
        description: 'Read-only check for whether aggregated or disaggregated serving is known to work.',
        badges: ['Read only', 'Fast check'],
        icon: 'fa-check-circle',
        accent: 'blue'
    },
    {
        value: 'estimate',
        label: 'Estimate',
        title: 'Model Performance Estimate',
        description: 'Read-only estimate of latency, throughput, and GPU utilization for a candidate shape.',
        badges: ['Read only', 'Fast estimate'],
        icon: 'fa-chart-line',
        accent: 'gold'
    }
];

interface TaskSelectorProps {
    value: TaskKey;
    onChange: (task: TaskKey) => void;
}

export function TaskSelector({value, onChange}: TaskSelectorProps) {
    return (
        <div className='deploy-models__task-grid' role='tablist' aria-label='Deploy workflows'>
            {TASK_OPTIONS.map(option => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type='button'
                        className={`argo-button ${active ? 'argo-button--base' : 'argo-button--base-o'} deploy-models__task-button`}
                        onClick={() => onChange(option.value)}
                        role='tab'
                        aria-selected={active}>
                        <span className='deploy-models__task-icon'>
                            <i className={`fa ${option.icon}`} />
                        </span>
                        <span className='deploy-models__task-content'>
                            <span className='deploy-models__task-label'>{option.label}</span>
                            <span className='deploy-models__task-title'>{option.title}</span>
                            <span className='deploy-models__task-description'>{option.description}</span>
                            <span className='deploy-models__task-meta'>
                                {option.badges.map(badge => (
                                    <span key={badge} className='deploy-models__task-badge'>
                                        {badge}
                                    </span>
                                ))}
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
