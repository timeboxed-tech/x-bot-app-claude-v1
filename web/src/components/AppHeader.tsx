import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { useAuth } from '../hooks/useAuth';

export default function AppHeader() {
  const { user, isAuthenticated, logout, isLoggingOut } = useAuth();

  return (
    <AppBar position="static" color="default" elevation={0}>
      <Toolbar
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, fontWeight: 700 }}
          color="primary"
        >
          X Bot Platform
        </Typography>
        {isAuthenticated && user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => logout()}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
