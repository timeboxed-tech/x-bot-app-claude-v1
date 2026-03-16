import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { Link } from '@tanstack/react-router';
import { useAuth, useLogoutMutation } from '../hooks/useAuth';
import { tokens } from '../../../shared/theme/tokens';

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
    <AppBar
      position="static"
      sx={{
        background: `linear-gradient(90deg, ${tokens.colors.secondary}, ${tokens.colors.primary})`,
      }}
    >
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ mr: 2, color: 'white' }}>
          EHE Signal
        </Typography>
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
              {user.isAdmin && (
                <Button color="inherit" component={Link} to="/admin">
                  Admin
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ color: 'white' }}>
                {user.email}
              </Typography>
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
