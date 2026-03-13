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
import TablePagination from '@mui/material/TablePagination';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import AppHeader from '../components/AppHeader';
import {
  useUsers,
  useUpdateUserPassword,
  useArchiveUser,
  useReinstateUser,
} from '../hooks/useUsers';
import { useAuth } from '../hooks/useAuth';
import { AxiosError } from 'axios';

const ADMIN_DOMAIN = '@thestartupfactory.tech';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.email?.endsWith(ADMIN_DOMAIN) ?? false;

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data, isLoading, error } = useUsers(page + 1, pageSize, includeArchived);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string } | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [userToArchive, setUserToArchive] = useState<{ id: string; email: string } | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const updatePasswordMutation = useUpdateUserPassword();
  const archiveMutation = useArchiveUser();
  const reinstateMutation = useReinstateUser();

  const handleOpenDialog = (user: { id: string; email: string }) => {
    setSelectedUser(user);
    setPassword('');
    setPasswordError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedUser(null);
    setPassword('');
    setPasswordError(null);
  };

  const handleSavePassword = () => {
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (!selectedUser) return;

    updatePasswordMutation.mutate(
      { id: selectedUser.id, password },
      {
        onSuccess: () => {
          setSnackbar({
            open: true,
            message: 'Password updated successfully',
            severity: 'success',
          });
          handleCloseDialog();
        },
        onError: (err) => {
          let message = 'Failed to update password';
          if (err instanceof AxiosError && err.response?.data?.error) {
            message = err.response.data.error;
          }
          setSnackbar({ open: true, message, severity: 'error' });
        },
      },
    );
  };

  const handleArchiveClick = (user: { id: string; email: string }) => {
    setUserToArchive(user);
    setArchiveConfirmOpen(true);
  };

  const handleArchiveConfirm = () => {
    if (!userToArchive) return;

    archiveMutation.mutate(userToArchive.id, {
      onSuccess: () => {
        setSnackbar({
          open: true,
          message: `User ${userToArchive.email} archived successfully`,
          severity: 'success',
        });
        setArchiveConfirmOpen(false);
        setUserToArchive(null);
      },
      onError: (err) => {
        let message = 'Failed to archive user';
        if (err instanceof AxiosError && err.response?.data?.error) {
          message = err.response.data.error;
        }
        setSnackbar({ open: true, message, severity: 'error' });
        setArchiveConfirmOpen(false);
        setUserToArchive(null);
      },
    });
  };

  const handleReinstate = (user: { id: string; email: string }) => {
    reinstateMutation.mutate(user.id, {
      onSuccess: () => {
        setSnackbar({
          open: true,
          message: `User ${user.email} reinstated successfully`,
          severity: 'success',
        });
      },
      onError: (err) => {
        let message = 'Failed to reinstate user';
        if (err instanceof AxiosError && err.response?.data?.error) {
          message = err.response.data.error;
        }
        setSnackbar({ open: true, message, severity: 'error' });
      },
    });
  };

  return (
    <Box>
      <AppHeader />
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" component="h1" fontWeight={700}>
            Users
          </Typography>
          {isAdmin && (
            <FormControlLabel
              control={
                <Switch
                  checked={includeArchived}
                  onChange={(e) => {
                    setIncludeArchived(e.target.checked);
                    setPage(0);
                  }}
                />
              }
              label="Show archived"
            />
          )}
        </Box>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load users
          </Alert>
        )}

        {data && (
          <>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Created At</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.data.map((user) => {
                    const isArchived = !!user.archivedAt;
                    const isSelf = currentUser?.id === user.id;

                    return (
                      <TableRow
                        key={user.id}
                        sx={
                          isArchived ? { opacity: 0.5, backgroundColor: 'action.hover' } : undefined
                        }
                      >
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {isArchived ? (
                            <Chip label="Archived" size="small" color="default" />
                          ) : (
                            <Chip label="Active" size="small" color="success" />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleOpenDialog({ id: user.id, email: user.email })}
                            >
                              Change Password
                            </Button>
                            {isAdmin && !isSelf && (
                              <>
                                {isArchived ? (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="success"
                                    onClick={() =>
                                      handleReinstate({ id: user.id, email: user.email })
                                    }
                                    disabled={reinstateMutation.isPending}
                                  >
                                    Reinstate
                                  </Button>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    onClick={() =>
                                      handleArchiveClick({ id: user.id, email: user.email })
                                    }
                                    disabled={archiveMutation.isPending}
                                  >
                                    Archive
                                  </Button>
                                )}
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={data.meta.total}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={pageSize}
              onRowsPerPageChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}

        {/* Change Password Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Change Password for {selectedUser?.email}</DialogTitle>
          <DialogContent>
            <TextField
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError(null);
              }}
              error={!!passwordError}
              helperText={passwordError}
              fullWidth
              sx={{ mt: 1 }}
              autoFocus
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              onClick={handleSavePassword}
              variant="contained"
              disabled={updatePasswordMutation.isPending}
            >
              {updatePasswordMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Archive Confirmation Dialog */}
        <Dialog
          open={archiveConfirmOpen}
          onClose={() => {
            setArchiveConfirmOpen(false);
            setUserToArchive(null);
          }}
        >
          <DialogTitle>Archive User</DialogTitle>
          <DialogContent>
            <DialogContentText>Are you sure you want to archive this user?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setArchiveConfirmOpen(false);
                setUserToArchive(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleArchiveConfirm}
              color="error"
              variant="contained"
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? 'Archiving...' : 'Archive'}
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
