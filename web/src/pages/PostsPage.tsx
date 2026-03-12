import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import AppHeader from '../components/AppHeader';

export default function PostsPage() {
  return (
    <>
      <AppHeader />
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Posts
        </Typography>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '40vh',
          }}
        >
          <Typography variant="body1" color="text.secondary">
            Post management coming soon.
          </Typography>
        </Box>
      </Container>
    </>
  );
}
