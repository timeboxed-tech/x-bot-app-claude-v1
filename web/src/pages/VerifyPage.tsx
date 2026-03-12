import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import apiClient from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export default function VerifyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasAttempted = useRef(false);

  const verifyMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiClient.get(`/auth/verify?token=${token}`);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.me, data.user);
      navigate({ to: '/dashboard' });
    },
  });

  useEffect(() => {
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      verifyMutation.mutate(token);
    }
  }, []);

  const params = new URLSearchParams(window.location.search);
  const hasToken = params.get('token');

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        {verifyMutation.isPending && (
          <>
            <CircularProgress />
            <Typography>Verifying your login...</Typography>
          </>
        )}
        {verifyMutation.isError && (
          <>
            <Alert severity="error" sx={{ width: '100%' }}>
              Verification failed. The link may have expired.
            </Alert>
            <Button variant="contained" onClick={() => navigate({ to: '/login' })}>
              Back to Login
            </Button>
          </>
        )}
        {!hasToken && !verifyMutation.isPending && !verifyMutation.isError && (
          <>
            <Alert severity="warning" sx={{ width: '100%' }}>
              No verification token found.
            </Alert>
            <Button variant="contained" onClick={() => navigate({ to: '/login' })}>
              Back to Login
            </Button>
          </>
        )}
      </Box>
    </Container>
  );
}
