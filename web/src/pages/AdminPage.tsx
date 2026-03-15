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
];

const exportItems = [
  { label: 'System Prompts', endpoint: 'system-prompts' },
  { label: 'Judge Prompts', endpoint: 'judges' },
  { label: 'Bot Configs (with behaviours)', endpoint: 'bots' },
];

function downloadUrl(endpoint: string, format: 'json' | 'csv'): string {
  return `${API_BASE}/export/${endpoint}?format=${format}`;
}

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
          Explore Config
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Download configuration data for offline review.
        </Typography>

        <Grid container spacing={3}>
          {exportItems.map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item.endpoint}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {item.label}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      component="a"
                      href={downloadUrl(item.endpoint, 'json')}
                      download
                    >
                      Download JSON
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      component="a"
                      href={downloadUrl(item.endpoint, 'csv')}
                      download
                    >
                      Download CSV
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </>
  );
}
