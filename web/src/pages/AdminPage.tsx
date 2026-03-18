import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import AppHeader from '../components/AppHeader';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const adminLinks = [
  { label: 'Users', description: 'Manage user accounts and permissions', path: '/users' },
  { label: 'Judges', description: 'Manage judge prompts for post review', path: '/judges' },
  {
    label: 'System Prompts',
    description: 'Edit system-level generation prompts',
    path: '/system-prompts',
  },
  {
    label: 'Job Config',
    description: 'Configure scheduled job parameters',
    path: '/job-config',
  },
  {
    label: 'System Config',
    description: 'Manage non-prompt configuration values',
    path: '/system-config',
  },
];

export default function AdminPage() {
  return (
    <>
      <AppHeader />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          Admin
        </Typography>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          {adminLinks.map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item.path}>
              <Card
                component={Link}
                to={item.path}
                sx={{
                  textDecoration: 'none',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 6 },
                }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {item.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ mb: 3 }} />

        <Typography variant="h5" sx={{ mb: 2 }}>
          Export Config
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Download configuration data for offline review.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            component="a"
            href={`${API_BASE}/export/config?format=json`}
            download
          >
            Export Config (JSON)
          </Button>
          <Button
            variant="outlined"
            component="a"
            href={`${API_BASE}/export/config?format=csv`}
            download
          >
            Export Config (CSV)
          </Button>
        </Box>
      </Container>
    </>
  );
}
