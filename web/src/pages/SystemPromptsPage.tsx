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
import RestoreIcon from '@mui/icons-material/Restore';
import DialogContentText from '@mui/material/DialogContentText';
import Tooltip from '@mui/material/Tooltip';
import AppHeader from '../components/AppHeader';
import {
  useSystemPrompts,
  useUpdateSystemPrompt,
  useResetSystemPrompt,
} from '../hooks/useSystemPrompts';
import type { SystemPrompt } from '../hooks/useSystemPrompts';
import { useAuth } from '../hooks/useAuth';
import { AxiosError } from 'axios';

export default function SystemPromptsPage() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;

  const { data: prompts, isLoading, error } = useSystemPrompts();
  const updatePrompt = useUpdateSystemPrompt();
  const resetPrompt = useResetSystemPrompt();

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<SystemPrompt | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resettingPrompt, setResettingPrompt] = useState<SystemPrompt | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const handleOpenEdit = (prompt: SystemPrompt) => {
    setEditing(prompt);
    setEditName(prompt.name);
    setEditContent(prompt.content);
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setEditing(null);
    setEditName('');
    setEditContent('');
  };

  const handleSave = () => {
    if (!editing) return;

    updatePrompt.mutate(
      { id: editing.id, name: editName, content: editContent },
      {
        onSuccess: () => {
          setSnackbar({ open: true, message: 'System prompt updated', severity: 'success' });
          handleCloseEdit();
        },
        onError: (err) => {
          let message = 'Failed to update system prompt';
          if (err instanceof AxiosError && err.response?.data?.error) {
            message = err.response.data.error;
          }
          setSnackbar({ open: true, message, severity: 'error' });
        },
      },
    );
  };

  const handleOpenResetConfirm = (prompt: SystemPrompt) => {
    setResettingPrompt(prompt);
    setResetConfirmOpen(true);
  };

  const handleCloseResetConfirm = () => {
    setResetConfirmOpen(false);
    setResettingPrompt(null);
  };

  const handleReset = () => {
    if (!resettingPrompt) return;

    resetPrompt.mutate(resettingPrompt.id, {
      onSuccess: () => {
        setSnackbar({ open: true, message: 'System prompt reset to default', severity: 'success' });
        handleCloseResetConfirm();
      },
      onError: (err) => {
        let message = 'Failed to reset system prompt';
        if (err instanceof AxiosError && err.response?.data?.error) {
          message = err.response.data.error;
        }
        setSnackbar({ open: true, message, severity: 'error' });
      },
    });
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
            System Prompts
          </Typography>
        </Box>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load system prompts
          </Alert>
        )}

        {prompts && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Key</TableCell>
                  <TableCell>Content</TableCell>
                  <TableCell>Last Updated</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {prompts.map((prompt) => (
                  <TableRow key={prompt.id}>
                    <TableCell>{prompt.name}</TableCell>
                    <TableCell>
                      <Chip label={prompt.key} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prompt.content}
                    </TableCell>
                    <TableCell>{new Date(prompt.updatedAt).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenEdit(prompt)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reset to Default">
                        <IconButton size="small" onClick={() => handleOpenResetConfirm(prompt)}>
                          <RestoreIcon fontSize="small" />
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
        <Dialog open={editOpen} onClose={handleCloseEdit} maxWidth="md" fullWidth>
          <DialogTitle>Edit System Prompt</DialogTitle>
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
                  label="Content"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  fullWidth
                  multiline
                  minRows={8}
                  maxRows={20}
                  InputProps={{
                    sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
                  }}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEdit}>Cancel</Button>
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={!editName.trim() || !editContent.trim() || updatePrompt.isPending}
            >
              {updatePrompt.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reset Confirmation Dialog */}
        <Dialog open={resetConfirmOpen} onClose={handleCloseResetConfirm}>
          <DialogTitle>Reset to Default</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to reset &quot;{resettingPrompt?.name}&quot; to its default
              content? This will overwrite any custom changes.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseResetConfirm}>Cancel</Button>
            <Button
              onClick={handleReset}
              variant="contained"
              color="warning"
              disabled={resetPrompt.isPending}
            >
              {resetPrompt.isPending ? 'Resetting...' : 'Reset'}
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
