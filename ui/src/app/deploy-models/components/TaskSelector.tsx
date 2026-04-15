import React from 'react';

export type TaskKey = 'default' | 'experiment' | 'generate' | 'support' | 'estimate';

export const TASK_OPTIONS: {
  value: TaskKey;
  label: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
}[] = [
  {
    value: 'default',
    label: 'Default',
    title: 'Best Deployment Plan',
    description: 'Find the strongest aggregated or disaggregated setup for the selected model and target.',
    icon: 'fa-compass',
    accent: 'emerald',
  },
  {
    value: 'experiment',
    label: 'Experiment',
    title: 'Replay Existing Config',
    description: 'Run a saved YAML or inline config when you already know the experiment you want to evaluate.',
    icon: 'fa-flask',
    accent: 'gold',
  },
  {
    value: 'generate',
    label: 'Quick Deploy',
    title: 'Generate Deployment Files',
    description: 'Skip the full sweep and generate deploy artifacts directly for a known model, backend, and instance.',
    icon: 'fa-rocket',
    accent: 'emerald',
  },
  {
    value: 'support',
    label: 'Compatibility',
    title: 'Check Compatibility',
    description: 'See whether the selected model and platform are known to work before you commit to a run.',
    icon: 'fa-check-circle',
    accent: 'blue',
  },
  {
    value: 'estimate',
    label: 'Estimate',
    title: 'Estimate Performance',
    description: 'Inspect latency, throughput, and GPU utilization for a candidate deployment shape.',
    icon: 'fa-chart-line',
    accent: 'gold',
  },
];

interface TaskSelectorProps {
  value: TaskKey;
  onChange: (task: TaskKey) => void;
}

export function TaskSelector({ value, onChange }: TaskSelectorProps) {
  return (
    <div className="cext-task-grid" role="tablist" aria-label="Deploy workflows">
      {TASK_OPTIONS.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`cext-task-card cext-task-card--${option.accent}${active ? ' is-active' : ''}`}
            onClick={() => onChange(option.value)}
            role="tab"
            aria-selected={active}
          >
            <span className="cext-task-card__icon">
              <i className={`fa ${option.icon}`} />
            </span>
            <span className="cext-task-card__body">
              <span className="cext-task-card__eyebrow">{option.label}</span>
              <span className="cext-task-card__title">{option.title}</span>
              <span className="cext-task-card__description">{option.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
