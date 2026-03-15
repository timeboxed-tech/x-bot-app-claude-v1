import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth, useLogoutMutation } from '../hooks/useAuth';

export default function AppHeader() {
  const { user } = useAuth();
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();

  const [adminAnchorEl, setAdminAnchorEl] = useState<null | HTMLElement>(null);
  const adminMenuOpen = Boolean(adminAnchorEl);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        window.location.href = '/login';
      },
    });
  };

  const handleAdminMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAdminAnchorEl(event.currentTarget);
  };

  const handleAdminMenuClose = () => {
    setAdminAnchorEl(null);
  };

  const handleAdminNavigate = (path: string) => {
    handleAdminMenuClose();
    void navigate({ to: path });
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ mr: 2 }}>
          X Bot Platform
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
                <>
                  <Button color="inherit" onClick={handleAdminMenuOpen}>
                    Admin
                  </Button>
                  <Menu
                    anchorEl={adminAnchorEl}
                    open={adminMenuOpen}
                    onClose={handleAdminMenuClose}
                  >
                    <MenuItem onClick={() => handleAdminNavigate('/users')}>Users</MenuItem>
                    <MenuItem onClick={() => handleAdminNavigate('/judges')}>Judges</MenuItem>
                    <MenuItem onClick={() => handleAdminNavigate('/system-prompts')}>
                      System Prompts
                    </MenuItem>
                  </Menu>
                </>
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
