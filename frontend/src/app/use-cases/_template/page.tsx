'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Grid,
  Alert,
  Chip,
  LinearProgress,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { Play, Bot, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { api, type Workflow } from '@/lib/api';
import { getSessionGithubToken, getSavedSettings } from '@/lib/settings';

/**
 * Bespoke use-case UI template.
 *
 * To add a use case:
 *   1. Copy this directory to `frontend/src/app/use-cases/<your-workflow-id>/`.
 *   2. Change WORKFLOW_ID below to match your workflow.
 *   3. Register the workflow in `agent-hub/workflows/<your-workflow-id>.workflow.yaml`
 *      with `has_custom_ui: true` and
 *      `custom_ui_route: /use-cases/<your-workflow-id>`.
 *
 * Nothing else needs editing: the navigation, the Registry and the Use Cases
 * index all read the workflow definition.
 *
 * (This directory is named with a leading underscore, so Next.js treats it as
 * private and never routes to it.)
 */
const WORKFLOW_ID = 'my-workflow';

export default function BespokeUseCaseTemplatePage() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const router = useRouter();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the definition so the page describes itself from the registry rather
  // than repeating the workflow's name and stages in two places.
  useEffect(() => {
    api
      .workflows()
      .then((all) => setWorkflow(all.find((w) => w.id === WORKFLOW_ID) ?? null))
      .catch(() => setWorkflow(null));
  }, []);

  const handleExecute = async () => {
    if (!input.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved = getSavedSettings();
      const { job_id } = await api.createJob({
        workflow: WORKFLOW_ID,
        requirement: input,
        engine: saved.generationEngine,
        copilot_model: saved.copilotModel || undefined,
        github_token: getSessionGithubToken() || undefined,
      });
      // The job page streams stage progress and shows the artifacts, so there
      // is no need to reimplement any of that here.
      router.push(`/jobs/${job_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the workflow');
      setSubmitting(false);
    }
  };

  const unavailable = workflow?.available === false;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 2 }}>
      <PageHeader
        title={workflow?.name ?? 'Bespoke Use Case'}
        subtitle={workflow?.description ?? 'Describe what this multi-agent workflow accomplishes.'}
        actions={
          <Button
            variant="outlined"
            startIcon={<Bot size={16} />}
            onClick={() => router.push(`/chat?workflow=${encodeURIComponent(WORKFLOW_ID)}`)}
          >
            Open in Agent Console
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {unavailable && (
        <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
          {workflow?.unavailable_reason ?? 'This workflow is currently marked unavailable.'}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Input */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
              Input
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              What you enter here becomes the workflow&apos;s input document.
            </Typography>

            <TextField
              multiline
              minRows={10}
              maxRows={20}
              fullWidth
              placeholder="Paste your input here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={submitting}
              sx={{ mb: 2.5 }}
            />

            {submitting && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Play size={18} />}
              disabled={submitting || unavailable || !input.trim()}
              onClick={handleExecute}
              sx={{ fontWeight: 800, py: 1.25, borderRadius: 2 }}
            >
              {submitting ? 'Starting the pipeline…' : 'Run this workflow'}
            </Button>
          </Paper>
        </Grid>

        {/* What will happen */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
              bgcolor: isLight ? '#f8fafc' : '#11161d',
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>
              What runs
            </Typography>

            {workflow ? (
              <>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
                  {workflow.agents.map((agent, index) => (
                    <Box key={agent.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Chip
                        label={index + 1}
                        size="small"
                        sx={{ minWidth: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {agent.stage}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {agent.description ?? agent.id}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>

                {workflow.approval_gate && (
                  <Alert severity="info" sx={{ mb: 2, borderRadius: 2, fontSize: '0.82rem' }}>
                    This workflow pauses partway through and waits for you to approve or reject
                    before it continues.
                  </Alert>
                )}

                <Button
                  size="small"
                  startIcon={<ExternalLink size={14} />}
                  onClick={() => router.push('/jobs')}
                  sx={{ textTransform: 'none' }}
                >
                  See previous runs
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Register <code>{WORKFLOW_ID}</code> in <code>agent-hub/workflows/</code> and its
                stages will be listed here.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
