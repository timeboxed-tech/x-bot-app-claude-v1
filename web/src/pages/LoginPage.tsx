import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import apiClient from '../lib/apiClient';

const ALLOWED_DOMAINS = ['thestartupfactory.tech', 'ehe.ai'];

function validateEmailDomain(email: string): string | null {
  if (!email) return 'Email is required';
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
    return `Only emails from ${ALLOWED_DOMAINS.join(', ')} are allowed.`;
  }
  return null;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const magicLinkMutation = useMutation({
    mutationFn: async (emailValue: string) => {
      const res = await apiClient.post('/auth/magic-link', {
        email: emailValue,
      });
      return res.data.data as { message: string; magicLink?: string };
    },
    onSuccess: (data) => {
      setSuccessMessage(
        data.magicLink
          ? `Magic link generated! Check the API response. Link: ${data.magicLink}`
          : 'Magic link generated! Check the API response.',
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    setSuccessMessage(null);

    const domainError = validateEmailDomain(email);
    if (domainError) {
      setClientError(domainError);
      return;
    }

    magicLinkMutation.mutate(email);
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          py: 4,
        }}
      >
        <Paper
          sx={{
            p: { xs: 3, sm: 4 },
            width: '100%',
            maxWidth: 440,
          }}
        >
          <Typography variant="h3" component="h1" sx={{ mb: 1, textAlign: 'center' }}>
            X Bot Platform
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            Sign in with your work email to get started.
          </Typography>

          {clientError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {clientError}
            </Alert>
          )}
          {magicLinkMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to send magic link. Please try again.
            </Alert>
          )}
          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMessage}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Work Email"
              type="email"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@thestartupfactory.tech"
              sx={{ mb: 2 }}
              disabled={magicLinkMutation.isPending}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={magicLinkMutation.isPending}
            >
              {magicLinkMutation.isPending ? 'Sending...' : 'Send Magic Link'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
