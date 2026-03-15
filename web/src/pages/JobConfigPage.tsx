import { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import AppHeader from '../components/AppHeader';
import { useJobConfigs, useUpdateJobConfig } from '../hooks/useJobConfig';
import type { JobConfig } from '../hooks/useJobConfig';
import { useAuth } from '../hooks/useAuth';
import { AxiosError } from 'axios';

function formatInterval(ms: number): string {
  const totalMinutes = ms / 60000;
  if (totalMinutes < 1) {
    return `${ms / 1000} seconds`;
  }
  if (totalMinutes < 60) {
    return totalMinutes === 1 ? '1 minute' : `${totalMinutes} minutes`;
  }
  const hours = totalMinutes / 60;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

export default function JobConfigPage() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;

  const { data: configs, isLoading, error } = useJobConfigs();
  const updateConfig = useUpdateJobConfig();

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<JobConfig | null>(null);
  const [editIntervalMinutes, setEditIntervalMinutes] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const handleOpenEdit = (config: JobConfig) => {
    setEditing(config);
    setEditIntervalMinutes(String(config.intervalMs / 60000));
    setEditEnabled(config.enabled);
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setEditing(null);
    setEditIntervalMinutes('');
    setEditEnabled(true);
  };

  const handleSave = () => {
    if (!editing) return;

    const intervalMs = Math.round(parseFloat(editIntervalMinutes) * 60000);
    if (isNaN(intervalMs) || intervalMs < 1000) {
      setSnackbar({
        open: true,
        message: 'Interval must be at least 1 second',
        severity: 'error',
      });
      return;
    }

    updateConfig.mutate(
      { id: editing.id, intervalMs, enabled: editEnabled },
      {
        onSuccess: () => {
          setSnackbar({ open: true, message: 'Job config updated', severity: 'success' });
          handleCloseEdit();
        },
        onError: (err) => {
          let message = 'Failed to update job config';
          if (err instanceof AxiosError && err.response?.data?.error) {
            message = err.response.data.error;
          }
          setSnackbar({ open: true, message, severity: 'error' });
        },
      },
    );
  };

  if (!isAdmin) {
    return (
      <Box>
        <AppHeader />
        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Alert severity="error">Admin access required</Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box>
      <AppHeader />
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" component="h1" fontWeight={700}>
            Job Config
          </Typography>
        </Box>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load job configs
          </Alert>
        )}

        {configs && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Job Type</TableCell>
                  <TableCell>Interval</TableCell>
                  <TableCell>Enabled</TableCell>
                  <TableCell>Last Updated</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <Chip label={config.jobType} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{formatInterval(config.intervalMs)}</TableCell>
                    <TableCell>
                      <Chip
                        label={config.enabled ? 'Enabled' : 'Disabled'}
                        size="small"
                        color={config.enabled ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{new Date(config.updatedAt).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenEdit(config)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Edit Dialog */}
        <Dialog open={editOpen} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Job Config</DialogTitle>
          <DialogContent>
            {editing && (
              <Box sx={{ mt: 1 }}>
                <Chip label={editing.jobType} size="small" variant="outlined" sx={{ mb: 2 }} />
                <TextField
                  label="Interval (minutes)"
                  type="number"
                  value={editIntervalMinutes}
                  onChange={(e) => setEditIntervalMinutes(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  inputProps={{ min: 0.017, step: 'any' }}
                  helperText={
                    editIntervalMinutes && !isNaN(parseFloat(editIntervalMinutes))
                      ? `= ${formatInterval(Math.round(parseFloat(editIntervalMinutes) * 60000))}`
                      : ''
                  }
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography>Enabled</Typography>
                  <Switch
                    checked={editEnabled}
                    onChange={(e) => setEditEnabled(e.target.checked)}
                  />
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEdit}>Cancel</Button>
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={!editIntervalMinutes || updateConfig.isPending}
            >
              {updateConfig.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}
