import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import { useLoginMutation, useRegisterMutation } from '../hooks/useAuth';
import { AxiosError } from 'axios';

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
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }
    setEmailError(null);
    setApiError(null);

    const onError = (err: unknown) => {
      if (err instanceof AxiosError && err.response?.data?.error) {
        setApiError(err.response.data.error);
      } else if (err instanceof Error) {
        setApiError(err.message);
      } else {
        setApiError('An unexpected error occurred');
      }
    };

    const onSuccess = () => {
      window.location.href = '/dashboard';
    };

    if (isRegister) {
      registerMutation.mutate({ email, password, name }, { onSuccess, onError });
    } else {
      loginMutation.mutate({ email, password }, { onSuccess, onError });
    }
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
          EHE Signal
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {isRegister ? 'Create an account' : 'Sign in to your account'}
        </Typography>

        <Paper sx={{ p: 4, width: '100%' }}>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {isRegister && (
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                autoFocus
              />
            )}
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
              autoFocus={!isRegister}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" disabled={isPending} fullWidth>
              {isPending ? 'Please wait...' : isRegister ? 'Register' : 'Login'}
            </Button>
          </Box>

          {apiError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {apiError}
            </Alert>
          )}

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Link
              component="button"
              variant="body2"
              onClick={() => {
                setIsRegister(!isRegister);
                setApiError(null);
                setEmailError(null);
              }}
            >
              {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
            </Link>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
