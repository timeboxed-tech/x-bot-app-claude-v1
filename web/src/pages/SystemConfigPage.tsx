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
import Tooltip from '@mui/material/Tooltip';
import AppHeader from '../components/AppHeader';
import { useSystemConfigs, useUpdateSystemConfig } from '../hooks/useSystemConfig';
import type { SystemConfig } from '../hooks/useSystemConfig';
import { useAuth } from '../hooks/useAuth';
import { AxiosError } from 'axios';

export default function SystemConfigPage() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;

  const { data: configs, isLoading, error } = useSystemConfigs();
  const updateConfig = useUpdateSystemConfig();

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<SystemConfig | null>(null);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState('');

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const handleOpenEdit = (config: SystemConfig) => {
    setEditing(config);
    setEditName(config.name);
    setEditValue(config.value);
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setEditing(null);
    setEditName('');
    setEditValue('');
  };

  const handleSave = () => {
    if (!editing) return;

    updateConfig.mutate(
      { id: editing.id, name: editName, value: editValue },
      {
        onSuccess: () => {
          setSnackbar({ open: true, message: 'System config updated', severity: 'success' });
          handleCloseEdit();
        },
        onError: (err) => {
          let message = 'Failed to update system config';
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
            System Config
          </Typography>
        </Box>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load system configs
          </Alert>
        )}

        {configs && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Key</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Last Updated</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>{config.name}</TableCell>
                    <TableCell>
                      <Chip label={config.key} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{config.value}</TableCell>
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
          <DialogTitle>Edit System Config</DialogTitle>
          <DialogContent>
            {editing && (
              <Box sx={{ mt: 1 }}>
                <Chip label={editing.key} size="small" variant="outlined" sx={{ mb: 2 }} />
                <TextField
                  label="Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Value"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  fullWidth
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEdit}>Cancel</Button>
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={!editName.trim() || !editValue.trim() || updateConfig.isPending}
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
