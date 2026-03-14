import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { Link } from '@tanstack/react-router';
import Tooltip from '@mui/material/Tooltip';
import { useAuth, useLogoutMutation } from '../hooks/useAuth';

declare const __GIT_SHA__: string;
declare const __GIT_DATE__: string;

export default function AppHeader() {
  const { user } = useAuth();
  const logoutMutation = useLogoutMutation();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        window.location.href = '/login';
      },
    });
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ mr: 1 }}>
          X Bot Platform
        </Typography>
        <Tooltip title={`${__GIT_SHA__} (${__GIT_DATE__})`}>
          <Typography
            variant="caption"
            sx={{ mr: 2, opacity: 0.5, cursor: 'default', userSelect: 'none' }}
          >
            {__GIT_SHA__}
          </Typography>
        </Tooltip>
        {user && (
          <>
            <Box sx={{ display: 'flex', gap: 1, flexGrow: 1 }}>
              <Button color="inherit" component={Link} to="/dashboard">
                Dashboard
              </Button>
              <Button color="inherit" component={Link} to="/posts">
                Posts
              </Button>
              <Button color="inherit" component={Link} to="/jobs">
                Jobs
              </Button>
              <Button color="inherit" component={Link} to="/users">
                Users
              </Button>
              {user.isAdmin && (
                <Button color="inherit" component={Link} to="/judges">
                  Judges
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">{user.email}</Typography>
              <Button color="inherit" onClick={handleLogout} disabled={logoutMutation.isPending}>
                Logout
              </Button>
            </Box>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
