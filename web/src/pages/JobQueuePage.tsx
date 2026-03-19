import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import CancelIcon from '@mui/icons-material/Cancel';
import AppHeader from '../components/AppHeader';
import { useJobQueue, useCancelJob } from '../hooks/useJobQueue';

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);
  const minutes = Math.round(absDiffMs / 60000);
  const hours = Math.round(absDiffMs / 3600000);
  const days = Math.round(absDiffMs / 86400000);

  if (minutes < 1) {
    return diffMs < 0 ? 'just now' : 'in a moment';
  }
  if (minutes < 60) {
    return diffMs < 0
      ? `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
      : `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  if (hours < 24) {
    return diffMs < 0
      ? `${hours} hour${hours !== 1 ? 's' : ''} ago`
      : `in ${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  return diffMs < 0
    ? `${days} day${days !== 1 ? 's' : ''} ago`
    : `in ${days} day${days !== 1 ? 's' : ''}`;
}

function computeDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffMs = end - start;
  if (diffMs < 1000) return `${diffMs}ms`;
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function getErrorFirstLine(error: string | null): string {
  if (!error) return '';
  const firstLine = error.split('\n')[0];
  return firstLine.length > 120 ? firstLine.slice(0, 120) + '...' : firstLine;
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color?: 'default' | 'info' | 'success' | 'error' | 'warning';
}) {
  const colorMap: Record<string, string> = {
    info: 'info.main',
    success: 'success.main',
    error: 'error.main',
    warning: 'warning.main',
  };
  const textColor = color && color !== 'default' ? colorMap[color] : 'text.primary';

  return (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" color={textColor}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

const statusChipColors: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  pending: 'default',
  running: 'info',
  completed: 'success',
  failed: 'error',
  cancelled: 'warning',
};

const typeChipColors: Record<string, 'default' | 'primary' | 'secondary' | 'info'> = {
  'post-generator': 'primary',
  'post-approver': 'info',
  'post-publish': 'secondary',
  cleanup: 'default',
};

type JobDetail = {
  id: string;
  type: string;
  botId: string | null;
  status: string;
  scheduledAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  error: string | null;
  result: string | null;
  createdAt: string;
};

function JobDetailDialog({ job, onClose }: { job: JobDetail | null; onClose: () => void }) {
  if (!job) return null;

  const rows: { label: string; value: string }[] = [
    { label: 'Job ID', value: job.id },
    { label: 'Type', value: job.type },
    { label: 'Status', value: job.status },
    { label: 'Scheduled At', value: new Date(job.scheduledAt).toLocaleString() },
    { label: 'Created At', value: new Date(job.createdAt).toLocaleString() },
    {
      label: 'Started At',
      value: job.startedAt ? new Date(job.startedAt).toLocaleString() : '-',
    },
    {
      label: 'Completed At',
      value: job.completedAt ? new Date(job.completedAt).toLocaleString() : '-',
    },
    {
      label: 'Duration',
      value: computeDuration(job.startedAt ?? null, job.completedAt ?? null),
    },
    { label: 'Result', value: job.result ?? '-' },
  ];

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          Job Details
          <Chip label={job.type} color={typeChipColors[job.type] ?? 'default'} size="small" />
          <Chip label={job.status} color={statusChipColors[job.status] ?? 'default'} size="small" />
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Table size="small" sx={{ mb: job.error ? 2 : 0 }}>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell sx={{ fontWeight: 600, width: 140, borderBottom: 'none', py: 0.75 }}>
                  {row.label}
                </TableCell>
                <TableCell
                  sx={{
                    borderBottom: 'none',
                    py: 0.75,
                    fontFamily: row.label === 'Job ID' ? 'monospace' : undefined,
                    fontSize: row.label === 'Job ID' ? '0.8rem' : undefined,
                  }}
                >
                  {row.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {job.error && (
          <>
            <Typography variant="subtitle2" color="error" sx={{ mt: 2, mb: 1 }}>
              Error
            </Typography>
            <Box
              sx={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                backgroundColor: 'rgba(211, 47, 47, 0.04)',
                border: '1px solid',
                borderColor: 'error.light',
                p: 2,
                borderRadius: 1,
                maxHeight: 400,
                overflow: 'auto',
                wordBreak: 'break-word',
              }}
            >
              {job.error}
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const JOB_TYPES = ['post-generator', 'post-approver', 'post-publish', 'cleanup'] as const;

export default function JobQueuePage() {
  const { data, isLoading, error } = useJobQueue();
  const cancelJob = useCancelJob();
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Container>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AppHeader />
        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Alert severity="error">Failed to load job queue stats: {error.message}</Alert>
        </Container>
      </>
    );
  }

  if (!data) return null;

  // Find pending jobs from recent jobs list for cancel actions
  const pendingJobs = data.recentJobs.filter((j) => j.status === 'pending');

  return (
    <>
      <AppHeader />
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
            Job Queue
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Auto-refreshes every 60 seconds
          </Typography>
        </Box>

        {/* Job Type Schedule */}
        <Typography variant="h6" gutterBottom>
          Job Schedule
        </Typography>
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job Type</TableCell>
                <TableCell>Last Run</TableCell>
                <TableCell>Next Run</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {JOB_TYPES.map((type) => (
                <TableRow key={type}>
                  <TableCell>
                    <Chip label={type} color={typeChipColors[type] ?? 'default'} size="small" />
                  </TableCell>
                  <TableCell>
                    {formatRelativeTime(data.lastCompletedByType[type] ?? null)}
                  </TableCell>
                  <TableCell>{formatRelativeTime(data.nextPendingByType[type] ?? null)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Job Counts (last 24h) */}
        <Typography variant="h6" gutterBottom>
          Jobs (Last 24 Hours)
        </Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={2.4}>
            <StatCard title="Pending" value={data.jobCounts.pending} />
          </Grid>
          <Grid item xs={6} sm={2.4}>
            <StatCard title="Running" value={data.jobCounts.running} color="info" />
          </Grid>
          <Grid item xs={6} sm={2.4}>
            <StatCard title="Completed" value={data.jobCounts.completed} color="success" />
          </Grid>
          <Grid item xs={6} sm={2.4}>
            <StatCard title="Failed" value={data.jobCounts.failed} color="error" />
          </Grid>
          <Grid item xs={6} sm={2.4}>
            <StatCard title="Cancelled" value={data.jobCounts.cancelled} color="warning" />
          </Grid>
        </Grid>

        {/* Pending Jobs (cancellable) */}
        {pendingJobs.length > 0 && (
          <>
            <Typography variant="h6" gutterBottom>
              Pending Jobs
            </Typography>
            <TableContainer component={Paper} sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Scheduled At</TableCell>
                    <TableCell>Created At</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Chip
                          label={job.type}
                          color={typeChipColors[job.type] ?? 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{new Date(job.scheduledAt).toLocaleString()}</TableCell>
                      <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          color="warning"
                          startIcon={<CancelIcon />}
                          onClick={() => cancelJob.mutate(job.id)}
                          disabled={cancelJob.isPending}
                        >
                          Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Recent Jobs */}
        <Typography variant="h6" gutterBottom>
          Recent Jobs
        </Typography>
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Started At</TableCell>
                <TableCell>Completed At</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Result</TableCell>
                <TableCell>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.recentJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No recent jobs
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.recentJobs.map((job) => (
                  <TableRow
                    key={job.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      ...(job.status === 'failed' ? { bgcolor: 'rgba(211, 47, 47, 0.04)' } : {}),
                    }}
                    onClick={() => setSelectedJob(job)}
                  >
                    <TableCell>
                      <Chip
                        label={job.type}
                        color={typeChipColors[job.type] ?? 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={job.status}
                        color={statusChipColors[job.status] ?? 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      {computeDuration(job.startedAt ?? null, job.completedAt ?? null)}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 250 }}>
                      {job.result ? (
                        <Typography variant="body2" noWrap>
                          {job.result}
                        </Typography>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 250 }}>
                      {job.error ? (
                        <Typography variant="body2" color="error" noWrap>
                          {getErrorFirstLine(job.error)}
                        </Typography>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Recent Errors */}
        {data.recentErrors.length > 0 && (
          <>
            <Typography variant="h6" gutterBottom color="error">
              Recent Errors
            </Typography>
            <TableContainer component={Paper} sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'rgba(211, 47, 47, 0.08)' }}>
                    <TableCell>Type</TableCell>
                    <TableCell>Scheduled At</TableCell>
                    <TableCell>Failed At</TableCell>
                    <TableCell>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.recentErrors.map((job) => (
                    <TableRow
                      key={job.id}
                      hover
                      sx={{ cursor: 'pointer', bgcolor: 'rgba(211, 47, 47, 0.04)' }}
                      onClick={() => setSelectedJob(job)}
                    >
                      <TableCell>
                        <Chip
                          label={job.type}
                          color={typeChipColors[job.type] ?? 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{new Date(job.scheduledAt).toLocaleString()}</TableCell>
                      <TableCell>
                        {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300 }}>
                        {job.error ? (
                          <Typography variant="body2" color="error" noWrap>
                            {getErrorFirstLine(job.error)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No error details
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Worker Activity Log */}
        <Typography variant="h6" gutterBottom>
          Worker Activity Log
        </Typography>
        <TableContainer component={Paper} sx={{ mb: 3, maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 180 }}>Time</TableCell>
                <TableCell sx={{ width: 140 }}>Worker</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!data.activityLog || data.activityLog.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No activity yet
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.activityLog.map((entry, i) => (
                  <TableRow
                    key={`${entry.timestamp}-${i}`}
                    sx={{
                      bgcolor:
                        entry.level === 'error'
                          ? 'rgba(211, 47, 47, 0.04)'
                          : entry.level === 'warn'
                            ? 'rgba(237, 108, 2, 0.04)'
                            : undefined,
                    }}
                  >
                    <TableCell
                      sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                    >
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={entry.worker}
                        size="small"
                        variant="outlined"
                        color={
                          entry.worker === 'post-generator'
                            ? 'primary'
                            : entry.worker === 'post-publish'
                              ? 'success'
                              : entry.worker === 'dispatcher'
                                ? 'info'
                                : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        color:
                          entry.level === 'error'
                            ? 'error.main'
                            : entry.level === 'warn'
                              ? 'warning.main'
                              : 'text.primary',
                      }}
                    >
                      {entry.message}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <JobDetailDialog job={selectedJob} onClose={() => setSelectedJob(null)} />
      </Container>
    </>
  );
}
