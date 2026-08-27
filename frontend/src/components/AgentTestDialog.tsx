'use client';

import React, { useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    InputLabel,
    LinearProgress,
    MenuItem,
    Select,
    TextField,
    Tooltip,
    Typography,
    alpha,
    useTheme,
} from '@mui/material';
import { AlertTriangle, CheckCircle2, Clock, FlaskConical, Play, XCircle } from 'lucide-react';

import { platformApi, formatDuration, type AgentTestResult } from '@/lib/api';

/** The subset of an agent this dialog needs, so it works with either catalog shape. */
export interface HubAgentSummary {
    id: string;
    name: string;
    description?: string;
    input_artifact?: string;
    output_artifact?: string;
}

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
export default function AgentTestDialog({
    agent,
    open,
    onClose,
}: {
    agent: HubAgentSummary | null;
    open: boolean;
    onClose: () => void;
}) {
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';

    const [input, setInput] = useState(SAMPLE);
    const [engine, setEngine] = useState<'mock' | 'copilot'>('mock');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<AgentTestResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        if (!agent || !input.trim()) return;
        setRunning(true);
        setError(null);
        setResult(null);
        try {
            setResult(await platformApi.testAgent(agent.id, { input, engine }));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'The test could not be run');
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
        <Dialog open={open} onClose={close} maxWidth="lg" fullWidth
            PaperProps={{ sx: { borderRadius: 2.5, maxHeight: '90vh' } }}>
            <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <FlaskConical size={20} color={theme.palette.primary.main} />
                <span>Test {agent?.name ?? 'agent'}</span>
                {agent && (
                    <Chip label={agent.id} size="small"
                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 600 }} />
                )}
            </DialogTitle>

            <DialogContent dividers sx={{ p: 3 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
                    Runs this agent once against the input below, in a throwaway workspace. No job
                    is created and nothing is kept — the result is checked against the agent&apos;s
                    declared contract and shown here.
                </Typography>

                <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel id="test-engine-label">Engine</InputLabel>
                        <Select
                            labelId="test-engine-label"
                            label="Engine"
                            value={engine}
                            onChange={(e) => setEngine(e.target.value as 'mock' | 'copilot')}
                        >
                            <MenuItem value="mock">Mock (offline, instant)</MenuItem>
                            <MenuItem value="copilot">Copilot (a real call)</MenuItem>
                        </Select>
                    </FormControl>

                    {agent?.output_artifact && (
                        <Chip
                            variant="outlined"
                            size="small"
                            label={`writes ${agent.output_artifact}`}
                            sx={{ fontSize: '0.72rem', alignSelf: 'center' }}
                        />
                    )}
                </Box>

                <TextField
                    fullWidth
                    multiline
                    minRows={6}
                    maxRows={12}
                    label="Sample input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={running}
                    InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                    helperText={`Staged at ${agent?.input_artifact || 'input/requirement.md'}`}
                    sx={{ mb: 2 }}
                />

                <Button
                    variant="contained"
                    startIcon={running ? <CircularProgress size={16} color="inherit" /> : <Play size={16} />}
                    disabled={running || !input.trim()}
                    onClick={run}
                    sx={{ fontWeight: 700, borderRadius: 2 }}
                >
                    {running ? 'Running…' : 'Run once'}
                </Button>

                {running && <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />}

                {error && (
                    <Alert severity="error" sx={{ mt: 2.5, borderRadius: 2 }}>
                        {error}
                    </Alert>
                )}

                {result && (
                    <Box sx={{ mt: 3 }}>
                        <Divider sx={{ mb: 2.5 }} />

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                            {result.contract_ok ? (
                                <Chip
                                    icon={<CheckCircle2 size={14} />}
                                    color="success"
                                    label={
                                        result.contract_checked.endsWith('.json')
                                            ? `Valid against ${result.contract_checked}`
                                            : 'Ran without error'
                                    }
                                    sx={{ fontWeight: 700 }}
                                />
                            ) : (
                                <Chip
                                    icon={<XCircle size={14} />}
                                    color="error"
                                    label={`Failed ${result.contract_checked}`}
                                    sx={{ fontWeight: 700 }}
                                />
                            )}

                            <Chip
                                icon={<Clock size={13} />}
                                size="small"
                                variant="outlined"
                                label={formatDuration(result.duration_ms)}
                            />
                            {result.engine === 'mock' && (
                                <Tooltip title="Deterministic stand-in — not a real model call">
                                    <Chip size="small" label="mock" sx={{ fontWeight: 700 }} />
                                </Tooltip>
                            )}
                        </Box>

                        {!result.contract_ok && result.contract_errors.length > 0 && (
                            <Alert
                                severity="warning"
                                icon={<AlertTriangle size={18} />}
                                sx={{ mb: 2, borderRadius: 2 }}
                            >
                                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                    The output did not match the contract
                                </Typography>
                                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                    {result.contract_errors.slice(0, 8).map((message, index) => (
                                        <li key={index}>
                                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                                {message}
                                            </Typography>
                                        </li>
                                    ))}
                                </Box>
                                <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                                    In a real run the agent would be handed these errors and given one
                                    chance to correct itself.
                                </Typography>
                            </Alert>
                        )}

                        {result.output && (
                            <>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                                    {result.output_artifact ?? 'Output'}
                                </Typography>
                                <Box
                                    component="pre"
                                    sx={{
                                        mt: 0.5,
                                        p: 1.5,
                                        borderRadius: 2,
                                        bgcolor: isLight ? '#f6f8fa' : '#0d1117',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        fontSize: '0.76rem',
                                        fontFamily: 'monospace',
                                        maxHeight: 320,
                                        overflow: 'auto',
                                        m: 0,
                                    }}
                                >
                                    {result.output}
                                </Box>
                            </>
                        )}

                        {result.log && (
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                                    Agent log
                                </Typography>
                                <Box
                                    component="pre"
                                    sx={{
                                        mt: 0.5,
                                        p: 1.5,
                                        borderRadius: 2,
                                        bgcolor: alpha(theme.palette.text.primary, 0.04),
                                        fontSize: '0.72rem',
                                        fontFamily: 'monospace',
                                        maxHeight: 180,
                                        overflow: 'auto',
                                        m: 0,
                                        color: 'text.secondary',
                                    }}
                                >
                                    {result.log}
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={close} color="inherit">Close</Button>
                {result && (
                    <Button onClick={run} disabled={running} variant="outlined">
                        Run again
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
