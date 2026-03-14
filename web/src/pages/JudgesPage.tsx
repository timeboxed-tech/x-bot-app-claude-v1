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
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import AppHeader from '../components/AppHeader';
import {
  useJudges,
  useCreateJudge,
  useUpdateJudge,
  useArchiveJudge,
  useReactivateJudge,
  useDeleteJudge,
} from '../hooks/useJudges';
import { useAuth } from '../hooks/useAuth';
import { AxiosError } from 'axios';

export default function JudgesPage() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;

  const { data: judges, isLoading, error } = useJudges();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [judgeToDelete, setJudgeToDelete] = useState<{ id: string; name: string } | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const createJudge = useCreateJudge();
  const updateJudge = useUpdateJudge();
  const archiveJudge = useArchiveJudge();
  const reactivateJudge = useReactivateJudge();
  const deleteJudge = useDeleteJudge();

  const activeJudges = judges?.filter((j) => j.archivedAt === null) ?? [];
  const archivedJudges = judges?.filter((j) => j.archivedAt !== null) ?? [];

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setPrompt('');
    setFormOpen(true);
  };

  const handleOpenEdit = (judge: { id: string; name: string; prompt: string }) => {
    setEditingId(judge.id);
    setName(judge.name);
    setPrompt(judge.prompt);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setName('');
    setPrompt('');
  };

  const handleSave = () => {
    if (editingId) {
      updateJudge.mutate(
        { id: editingId, name, prompt },
        {
          onSuccess: () => {
            setSnackbar({ open: true, message: 'Judge updated', severity: 'success' });
            handleCloseForm();
          },
          onError: (err) => {
            let message = 'Failed to update judge';
            if (err instanceof AxiosError && err.response?.data?.error) {
              message = err.response.data.error;
            }
            setSnackbar({ open: true, message, severity: 'error' });
          },
        },
      );
    } else {
      createJudge.mutate(
        { name, prompt },
        {
          onSuccess: () => {
            setSnackbar({ open: true, message: 'Judge created', severity: 'success' });
            handleCloseForm();
          },
          onError: (err) => {
            let message = 'Failed to create judge';
            if (err instanceof AxiosError && err.response?.data?.error) {
              message = err.response.data.error;
            }
            setSnackbar({ open: true, message, severity: 'error' });
          },
        },
      );
    }
  };

  const handleArchive = (judge: { id: string; name: string }) => {
    archiveJudge.mutate(judge.id, {
      onSuccess: () => {
        setSnackbar({
          open: true,
          message: `Judge "${judge.name}" archived`,
          severity: 'success',
        });
      },
      onError: (err) => {
        let message = 'Failed to archive judge';
        if (err instanceof AxiosError && err.response?.data?.error) {
          message = err.response.data.error;
        }
        setSnackbar({ open: true, message, severity: 'error' });
      },
    });
  };

  const handleReactivate = (judge: { id: string; name: string }) => {
    reactivateJudge.mutate(judge.id, {
      onSuccess: () => {
        setSnackbar({
          open: true,
          message: `Judge "${judge.name}" reactivated`,
          severity: 'success',
        });
      },
      onError: (err) => {
        let message = 'Failed to reactivate judge';
        if (err instanceof AxiosError && err.response?.data?.error) {
          message = err.response.data.error;
        }
        setSnackbar({ open: true, message, severity: 'error' });
      },
    });
  };

  const handleDeleteClick = (judge: { id: string; name: string }) => {
    setJudgeToDelete(judge);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!judgeToDelete) return;
    deleteJudge.mutate(judgeToDelete.id, {
      onSuccess: () => {
        setSnackbar({
          open: true,
          message: `Judge "${judgeToDelete.name}" permanently deleted`,
          severity: 'success',
        });
        setDeleteConfirmOpen(false);
        setJudgeToDelete(null);
      },
      onError: (err) => {
        let message = 'Failed to delete judge';
        if (err instanceof AxiosError && err.response?.data?.error) {
          message = err.response.data.error;
        }
        setSnackbar({ open: true, message, severity: 'error' });
        setDeleteConfirmOpen(false);
        setJudgeToDelete(null);
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
            Judges
          </Typography>
          <Button variant="contained" onClick={handleOpenCreate}>
            Add Judge
          </Button>
        </Box>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load judges
          </Alert>
        )}

        {judges && (
          <>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Active Judges
            </Typography>
            <TableContainer component={Paper} sx={{ mb: 4 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Personality Prompt</TableCell>
                    <TableCell>Created At</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeJudges.map((judge) => (
                    <TableRow key={judge.id}>
                      <TableCell>{judge.name}</TableCell>
                      <TableCell
                        sx={{
                          maxWidth: 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {judge.prompt}
                      </TableCell>
                      <TableCell>{new Date(judge.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <IconButton size="small" onClick={() => handleOpenEdit(judge)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleArchive(judge)}
                          >
                            <ArchiveIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {archivedJudges.length > 0 && (
              <>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Archived Judges
                </Typography>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Archived Date</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {archivedJudges.map((judge) => (
                        <TableRow key={judge.id}>
                          <TableCell>{judge.name}</TableCell>
                          <TableCell>
                            {judge.archivedAt
                              ? new Date(judge.archivedAt).toLocaleDateString()
                              : ''}
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleReactivate(judge)}
                              >
                                <UnarchiveIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteClick(judge)}
                              >
                                <DeleteForeverIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={formOpen} onClose={handleCloseForm} maxWidth="sm" fullWidth>
          <DialogTitle>{editingId ? 'Edit Judge' : 'Add Judge'}</DialogTitle>
          <DialogContent>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              sx={{ mt: 1, mb: 2 }}
              autoFocus
            />
            <TextField
              label="Personality Prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseForm}>Cancel</Button>
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={
                !name.trim() || !prompt.trim() || createJudge.isPending || updateJudge.isPending
              }
            >
              {createJudge.isPending || updateJudge.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Permanent Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false);
            setJudgeToDelete(null);
          }}
        >
          <DialogTitle>Permanently Delete Judge</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to permanently delete the judge &quot;{judgeToDelete?.name}
              &quot;? This action cannot be undone and will also remove all related reviews.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setDeleteConfirmOpen(false);
                setJudgeToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              color="error"
              variant="contained"
              disabled={deleteJudge.isPending}
            >
              {deleteJudge.isPending ? 'Deleting...' : 'Delete Forever'}
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
