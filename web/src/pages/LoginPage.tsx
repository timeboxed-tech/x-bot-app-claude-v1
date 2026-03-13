import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import { useLoginMutation } from '../hooks/useAuth';

const ALLOWED_DOMAINS = ['thestartupfactory.tech', 'ehe.ai'];

function validateEmail(email: string): string | null {
  if (!email) return 'Email is required';
  const parts = email.split('@');
  if (parts.length !== 2) return 'Invalid email address';
  const domain = parts[1];
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return 'Your email is not allowed';
  }
  return null;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [magicLinkUrl, setMagicLinkUrl] = useState<string | null>(null);
  const loginMutation = useLoginMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }
    setEmailError(null);
    setMagicLinkUrl(null);
    loginMutation.mutate(email, {
      onSuccess: (data) => {
        setMagicLinkUrl(data.url);
      },
    });
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
          gap: 3,
        }}
      >
        <Typography variant="h3" component="h1" fontWeight={700}>
          X Bot Platform
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Sign in to manage your bots
        </Typography>

        <Paper sx={{ p: 4, width: '100%' }}>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              error={!!emailError}
              helperText={emailError}
              fullWidth
              autoFocus
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loginMutation.isPending}
              fullWidth
            >
              {loginMutation.isPending ? 'Sending...' : 'Send Magic Link'}
            </Button>
          </Box>

          {loginMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {loginMutation.error instanceof Error
                ? loginMutation.error.message
                : 'Failed to send magic link'}
            </Alert>
          )}

          {magicLinkUrl && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Magic link generated:
              </Typography>
              <Typography
                variant="body2"
                component="a"
                href={magicLinkUrl}
                sx={{ wordBreak: 'break-all' }}
              >
                {magicLinkUrl}
              </Typography>
            </Alert>
          )}
        </Paper>
      </Box>
    </Container>
  );
}
