import {SlidingPanel} from 'argo-ui';
import React, {useEffect, useRef, useState} from 'react';

import {streamJobLogs} from '../api/client';
import {StatusBadge} from './common/StatusBadge';

interface Props {
    jobId: string;
    onClose: () => void;
}

export const JobLogViewer: React.FC<Props> = ({jobId, onClose}) => {
    const [lines, setLines] = useState<string[]>([]);
    const [connected, setConnected] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLines([]);
        const stop = streamJobLogs(jobId, {
            onOpen: () => setConnected(true),
            onMessage: line => setLines(prev => [...prev, line]),
            onDone: () => setConnected(false),
            onError: message => {
                setConnected(false);
                setLines(prev => [...prev, `Log stream error: ${message}`]);
            }
        });

        return () => {
            stop();
            setConnected(false);
        };
    }, [jobId]);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [lines]);

    function copyLogs() {
        navigator.clipboard.writeText(lines.join('\n'));
    }

    return (
        <SlidingPanel hasCloseButton={true} header={<strong>Job Logs</strong>} isMiddle={true} isShown={true} onClose={onClose}>
            <div className='model-cache__drawer-body' role='dialog' aria-modal='true' aria-label='Job logs'>
                <div className='model-cache__drawer-toolbar'>
                    <StatusBadge tone={connected ? 'success' : 'muted'} size='small'>
                        {connected ? 'streaming' : 'disconnected'}
                    </StatusBadge>
                    <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={copyLogs} aria-label='Copy job logs'>
                        <i className='fa fa-copy' aria-hidden='true' /> Copy
                    </button>
                </div>
                <div ref={containerRef} className='model-cache__log-viewer' role='log' aria-live='polite' aria-busy={connected}>
                    {lines.length === 0 ? <div className='model-cache__table-meta'>Waiting for logs…</div> : lines.map((line, index) => <div key={index}>{line}</div>)}
                </div>
            </div>
        </SlidingPanel>
    );
};
