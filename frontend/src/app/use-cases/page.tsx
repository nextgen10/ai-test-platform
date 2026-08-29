'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Grid,
  Typography,
  Alert,
  Skeleton,
  Paper,
  useTheme,
  alpha,
} from '@mui/material';
import { Play, ExternalLink, Workflow as WorkflowIcon, Plus, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { hubApi, type HubWorkflow } from '@/lib/hub-api';

/**
 * Every registered use case.
 *
 * This page is generated from the workflow registry: adding a
 * `.workflow.yaml` to `agent-hub/workflows/` puts a card here, and setting
 * `has_custom_ui: true` points that card at the workflow's own page.
 */
export default function UseCasesPage() {
  const theme = useTheme();
  const router = useRouter();

  const [workflows, setWorkflows] = useState<HubWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hubApi
      .listWorkflows()
      .then(setWorkflows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the use cases'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 2 }}>
      <PageHeader
        title="Use Cases"
        subtitle="Every registered multi-agent workflow. Run one here, or open its dedicated interface."
        actions={
          <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => router.push('/registry?tab=workflows')}>
            Onboard a workflow
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {[0, 1, 2].map((i) => (
            <Grid size={{ xs: 12, md: 6 }} key={i}>
              <Skeleton variant="rounded" height={230} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : workflows.length === 0 ? (
        <Paper variant="outlined" sx={{ mt: 3, p: 6, textAlign: 'center', borderRadius: 2, borderStyle: 'dashed' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 0.5 }}>
            No workflows registered yet
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Drop a <code>.workflow.yaml</code> into <code>agent-hub/workflows/</code>, or onboard one
            from the Registry.
          </Typography>
          <Button variant="contained" onClick={() => router.push('/registry?tab=workflows')}>
            Open the Registry
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {workflows.map((wf) => (
            <Grid size={{ xs: 12, md: 6 }} key={wf.id}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'var(--col-background-ui-10-hovered)',
                  },
                }}
              >
                <CardContent sx={{ flex: 1, p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <WorkflowIcon size={18} color={theme.palette.primary.main} />
                    <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '1.05rem' }}>
                      {wf.name}
                    </Typography>
                    {wf.has_custom_ui && (
                      <Chip label="Custom UI" size="small" color="primary" sx={{ fontWeight: 500, height: 20, fontSize: '0.68rem' }} />
                    )}
                    {wf.available === false && (
                      <Chip label="Unavailable" size="small" color="warning" sx={{ fontWeight: 500, height: 20, fontSize: '0.68rem' }} />
                    )}
                  </Box>

                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    {wf.description}
                  </Typography>

                  {wf.available === false && wf.unavailable_reason && (
                    <Alert severity="warning" icon={<AlertTriangle size={16} />} sx={{ mb: 2, py: 0.25, fontSize: '0.78rem', borderRadius: 2 }}>
                      {wf.unavailable_reason}
                    </Alert>
                  )}

                  <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', display: 'block', mb: 0.75 }}>
                    {wf.agents.length} stage{wf.agents.length === 1 ? '' : 's'}
                    {wf.approval_gate ? ' · pauses for your approval' : ''}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {wf.agents.map((ag, idx) => (
                      <Chip key={idx} label={`${idx + 1}. ${ag.stage}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                    ))}
                  </Box>
                </CardContent>

                <CardActions sx={{ p: 3, pt: 0 }}>
                  {wf.has_custom_ui && wf.custom_ui_route ? (
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<ExternalLink size={16} />}
                      onClick={() => router.push(wf.custom_ui_route!)}
                      sx={{ fontWeight: 500, borderRadius: 2 }}
                    >
                      Open {wf.name}
                    </Button>
                  ) : (
                    <Button
                      fullWidth
                      variant="contained"
                      disabled={wf.available === false}
                      startIcon={<Play size={16} />}
                      onClick={() => router.push(`/chat?workflow=${encodeURIComponent(wf.id)}`)}
                      sx={{ fontWeight: 500, borderRadius: 2 }}
                    >
                      Run in the Agent Console
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
