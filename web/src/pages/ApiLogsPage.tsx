import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import AppHeader from '../components/AppHeader';
import { useApiLogs, useApiLogDetail } from '../hooks/useApiLogs';
import type { ApiLogSummary } from '../hooks/useApiLogs';
import { useAuth } from '../hooks/useAuth';

const providerChipColors: Record<string, 'primary' | 'secondary' | 'default'> = {
  x: 'primary',
  anthropic: 'secondary',
  'url-validation': 'default',
};

function getStatusColor(status: number | null): string {
  if (status === null) return 'text.disabled';
  if (status >= 200 && status < 300) return 'success.main';
  if (status >= 400 && status < 500) return 'warning.main';
  return 'error.main';
}

function truncateUrl(url: string, maxLen = 60): string {
  return url.length > maxLen ? url.slice(0, maxLen) + '...' : url;
}

function LogDetailDialog({ logId, onClose }: { logId: string | null; onClose: () => void }) {
  const { data: log, isLoading } = useApiLogDetail(logId);

  if (!logId) return null;

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          API Log Detail
          {log && (
            <>
              <Chip
                label={log.provider}
                color={providerChipColors[log.provider] ?? 'default'}
                size="small"
              />
              <Chip label={log.method} size="small" variant="outlined" />
            </>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {log && (
          <>
            <Table size="small" sx={{ mb: 2 }}>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 150, borderBottom: 'none' }}>
                    URL
                  </TableCell>
                  <TableCell
                    sx={{ borderBottom: 'none', fontFamily: 'monospace', fontSize: '0.8rem' }}
                  >
                    {log.url}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, borderBottom: 'none' }}>Status</TableCell>
                  <TableCell
                    sx={{ borderBottom: 'none', color: getStatusColor(log.responseStatus) }}
                  >
                    {log.responseStatus ?? 'N/A'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, borderBottom: 'none' }}>Duration</TableCell>
                  <TableCell sx={{ borderBottom: 'none' }}>
                    {log.durationMs != null ? `${log.durationMs}ms` : 'N/A'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, borderBottom: 'none' }}>Timestamp</TableCell>
                  <TableCell sx={{ borderBottom: 'none' }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
                {log.error && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, borderBottom: 'none', color: 'error.main' }}>
                      Error
                    </TableCell>
                    <TableCell sx={{ borderBottom: 'none', color: 'error.main' }}>
                      {log.error}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {log.requestHeaders && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  Request Headers
                </Typography>
                <Box
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    backgroundColor: 'grey.50',
                    p: 2,
                    borderRadius: 1,
                    maxHeight: 200,
                    overflow: 'auto',
                    wordBreak: 'break-word',
                  }}
                >
                  {log.requestHeaders}
                </Box>
              </>
            )}

            {log.requestBody && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  Request Body
                </Typography>
                <Box
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    backgroundColor: 'grey.50',
                    p: 2,
                    borderRadius: 1,
                    maxHeight: 300,
                    overflow: 'auto',
                    wordBreak: 'break-word',
                  }}
                >
                  {log.requestBody}
                </Box>
              </>
            )}

            {log.responseHeaders && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  Response Headers
                </Typography>
                <Box
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    backgroundColor: 'grey.50',
                    p: 2,
                    borderRadius: 1,
                    maxHeight: 200,
                    overflow: 'auto',
                    wordBreak: 'break-word',
                  }}
                >
                  {log.responseHeaders}
                </Box>
              </>
            )}

            {log.responseBody && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  Response Body
                </Typography>
                <Box
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    backgroundColor: 'grey.50',
                    p: 2,
                    borderRadius: 1,
                    maxHeight: 400,
                    overflow: 'auto',
                    wordBreak: 'break-word',
                  }}
                >
                  {log.responseBody}
                </Box>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ApiLogsPage() {
  const { user } = useAuth();
  const [provider, setProvider] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const { data, isLoading, error } = useApiLogs(provider || undefined, page);

  if (!user?.isAdmin) {
    return (
      <>
        <AppHeader />
        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Alert severity="error">Admin access required</Alert>
        </Container>
      </>
    );
  }

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
          <Alert severity="error">Failed to load API logs: {error.message}</Alert>
        </Container>
      </>
    );
  }

  const logs = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, pageSize: 50, total: 0 };
  const totalPages = Math.ceil(meta.total / meta.pageSize);

  return (
    <>
      <AppHeader />
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
            API Logs
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            External API call history. Auto-refreshes every 30 seconds.
          </Typography>
        </Box>

        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Provider</InputLabel>
            <Select
              value={provider}
              label="Provider"
              onChange={(e) => {
                setProvider(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="x">X</MenuItem>
              <MenuItem value="anthropic">Anthropic</MenuItem>
              <MenuItem value="url-validation">URL Validation</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            {meta.total} total logs
          </Typography>
        </Box>

        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>URL</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No logs found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: ApiLogSummary) => (
                  <TableRow
                    key={log.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      ...(log.error ? { bgcolor: 'rgba(211, 47, 47, 0.04)' } : {}),
                    }}
                    onClick={() => setSelectedLogId(log.id)}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={log.provider}
                        color={providerChipColors[log.provider] ?? 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{log.method}</TableCell>
                    <TableCell
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        maxWidth: 300,
                      }}
                    >
                      <Typography variant="body2" noWrap title={log.url}>
                        {truncateUrl(log.url)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: getStatusColor(log.responseStatus), fontWeight: 600 }}>
                      {log.responseStatus ?? '-'}
                    </TableCell>
                    <TableCell>{log.durationMs != null ? `${log.durationMs}ms` : '-'}</TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      {log.error ? (
                        <Typography variant="body2" color="error" noWrap>
                          {log.error.length > 60 ? log.error.slice(0, 60) + '...' : log.error}
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

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Typography variant="body2" color="text.secondary">
            Page {page} of {totalPages || 1}
          </Typography>
          <Button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </Box>

        <LogDetailDialog logId={selectedLogId} onClose={() => setSelectedLogId(null)} />
      </Container>
    </>
  );
}
