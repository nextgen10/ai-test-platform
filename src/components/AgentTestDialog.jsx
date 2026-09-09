import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FlaskConical, Play, XCircle } from 'lucide-react';

import { formatDuration, platformApi } from '@/lib/api';
import { Alert, Button, Chip, Divider, LinearProgress, Spinner, Tooltip } from './ui/primitives';
import { Select, TextArea } from './ui/inputs';
import { Dialog, DialogActions, DialogContent, DialogTitle } from './ui/overlays';

const SAMPLE = `REQ-101 Export report to CSV

A signed-in user can export the current report to CSV.

- The export includes every column visible in the table.
- Exports over 50,000 rows are queued and emailed instead.
- A user without the "export" permission sees the button disabled.`;

/**
 * Run one agent against sample input and show what came back.
 *
 * The point is a fast loop while writing an agent: without this, the only way
 * to find out whether a prompt works is to wire the agent into a workflow,
 * submit a job and read the logs.
 */
export default function AgentTestDialog({ agent, open, onClose }) {
    const [input, setInput] = useState(SAMPLE);
    const [engine, setEngine] = useState('mock');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const run = async () => {
        if (!agent || !input.trim()) return;
        setRunning(true);
        setError(null);
        setResult(null);
        try {
            setResult(await platformApi.testAgent(agent.id, { input, engine }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'The test could not be run');
        } finally {
            setRunning(false);
        }
    };

    const close = () => {
        setResult(null);
        setError(null);
        onClose();
    };

    return (
        <Dialog open={open} onClose={close} maxWidth="lg">
            <DialogTitle onClose={close}>
                <span className="flex items-center gap-3">
                    <FlaskConical size={20} className="text-brand" />
                    <span>Test {agent?.name ?? 'agent'}</span>
                    {agent && <Chip className="font-mono text-[0.7rem] font-medium">{agent.id}</Chip>}
                </span>
            </DialogTitle>

            <DialogContent>
                <p className="ui-body2 mb-5 text-subtle">
                    Runs this agent once against the input below, in a throwaway workspace. No job is
                    created and nothing is kept — the result is checked against the agent&apos;s declared
                    contract and shown here.
                </p>

                <div className="mb-4 flex flex-wrap items-end gap-3">
                    <Select
                        className="w-[200px] shrink-0"
                        label="Engine"
                        value={engine}
                        onChange={(event) => setEngine(event.target.value)}
                    >
                        <option value="mock">Mock (offline, instant)</option>
                        <option value="copilot">Copilot (a real call)</option>
                    </Select>

                    {agent?.output_artifact && (
                        <Chip variant="outlined" className="self-center text-[0.72rem]">
                            {`writes ${agent.output_artifact}`}
                        </Chip>
                    )}
                </div>

                <TextArea
                    className="mb-4"
                    rows={8}
                    label="Sample input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    disabled={running}
                    inputClassName="font-mono text-[0.8rem]"
                    helperText={`Staged at ${agent?.input_artifact || 'input/requirement.md'}`}
                />

                <Button variant="contained" disabled={running || !input.trim()} onClick={run}>
                    {running ? <Spinner size={16} className="text-white" /> : <Play size={16} />}
                    {running ? 'Running…' : 'Run once'}
                </Button>

                {running && <LinearProgress className="mt-4" />}

                {error && (
                    <Alert severity="error" className="mt-5">
                        {error}
                    </Alert>
                )}

                {result && (
                    <div className="mt-6">
                        <Divider className="mb-5" />

                        <div className="mb-4 flex flex-wrap items-center gap-3">
                            {result.contract_ok ? (
                                <Chip color="success" className="gap-1.5 font-medium">
                                    <CheckCircle2 size={14} />
                                    {result.contract_checked.endsWith('.json')
                                        ? `Valid against ${result.contract_checked}`
                                        : 'Ran without error'}
                                </Chip>
                            ) : (
                                <Chip color="error" className="gap-1.5 font-medium">
                                    <XCircle size={14} />
                                    {`Failed ${result.contract_checked}`}
                                </Chip>
                            )}

                            <Chip variant="outlined" className="gap-1.5">
                                <Clock size={13} />
                                {formatDuration(result.duration_ms)}
                            </Chip>

                            {result.engine === 'mock' && (
                                <Tooltip title="Deterministic stand-in — not a real model call">
                                    <Chip className="font-medium">mock</Chip>
                                </Tooltip>
                            )}
                        </div>

                        {!result.contract_ok && result.contract_errors.length > 0 && (
                            <Alert severity="warning" icon={<AlertTriangle size={18} />} className="mb-4">
                                <p className="ui-body2 mb-1 font-medium">
                                    The output did not match the contract
                                </p>
                                <ul className="list-disc pl-6">
                                    {result.contract_errors.slice(0, 8).map((message, index) => (
                                        <li key={index}>
                                            <span className="ui-caption font-mono">{message}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="ui-caption mt-2 block">
                                    In a real run the agent would be handed these errors and given one chance to
                                    correct itself.
                                </p>
                            </Alert>
                        )}

                        {result.output && (
                            <>
                                <p className="ui-caption font-medium text-subtle">
                                    {result.output_artifact ?? 'Output'}
                                </p>
                                <pre className="ui-code mt-1 max-h-[320px] text-[0.76rem]">{result.output}</pre>
                            </>
                        )}

                        {result.log && (
                            <div className="mt-4">
                                <p className="ui-caption font-medium text-subtle">Agent log</p>
                                <pre className="mt-1 max-h-[180px] overflow-auto rounded-ubs bg-[color-mix(in_srgb,var(--col-text-primary)_4%,transparent)] p-3 font-mono text-[0.72rem] text-subtle">
                                    {result.log}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={close}>Close</Button>
                {result && (
                    <Button onClick={run} disabled={running} variant="outlined">
                        Run again
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
