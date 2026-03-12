import { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import { useBot } from '../hooks/useBot';
import BotSetupForm from '../components/BotSetupForm';
import AppHeader from '../components/AppHeader';

export default function DashboardPage() {
  const { bot, isLoading, createBot, isCreating, updateBot, isUpdating } = useBot();
  const [isEditing, setIsEditing] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  // Read URL params for X connection status
  const params = new URLSearchParams(window.location.search);
  const xConnected = params.get('xConnected');
  const xError = params.get('xError');

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <Container maxWidth="md">
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '60vh',
            }}
          >
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Dashboard
        </Typography>

        {xConnected && (
          <Alert severity="success" sx={{ mb: 2 }}>
            X account connected successfully!
          </Alert>
        )}
        {xError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to connect X account: {xError}
          </Alert>
        )}

        {!bot && !showSetup && (
          <Card>
            <CardContent
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                py: 6,
                gap: 2,
              }}
            >
              <Typography variant="h5" color="text.secondary">
                No bot configured yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Set up your AI-powered X bot to start automating your posts.
              </Typography>
              <Button variant="contained" size="large" onClick={() => setShowSetup(true)}>
                Set Up Your Bot
              </Button>
            </CardContent>
          </Card>
        )}

        {!bot && showSetup && (
          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 3 }}>
                Bot Setup
              </Typography>
              <BotSetupForm
                onSubmit={async (values) => {
                  await createBot(values);
                  setShowSetup(false);
                }}
                onCancel={() => setShowSetup(false)}
                isSubmitting={isCreating}
                submitLabel="Create Bot"
              />
            </CardContent>
          </Card>
        )}

        {bot && !isEditing && (
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                    mb: 2,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Typography variant="h5">Bot Status</Typography>
                    <Chip
                      label={bot.active ? 'Active' : 'Inactive'}
                      color={bot.active ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={bot.active}
                        onChange={async () => {
                          await updateBot({
                            botId: bot.id,
                            active: !bot.active,
                          });
                        }}
                        disabled={isUpdating}
                      />
                    }
                    label={bot.active ? 'Active' : 'Inactive'}
                  />
                </Box>

                {bot.xAccountHandle ? (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Connected X account:
                    </Typography>
                    <Chip label={bot.xAccountHandle} variant="outlined" />
                  </Box>
                ) : (
                  <Button
                    variant="outlined"
                    href={`/api/auth/x/connect?botId=${bot.id}`}
                    sx={{ mb: 2 }}
                  >
                    Connect X Account
                  </Button>
                )}

                <Divider sx={{ my: 2 }} />

                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" component="div">
                      Prompt
                    </Typography>
                    <Typography variant="body2">{bot.prompt}</Typography>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 3,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box>
                      <Typography variant="caption" color="text.secondary" component="div">
                        Post Mode
                      </Typography>
                      <Typography variant="body2">{bot.postMode}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" component="div">
                        Posts / Day
                      </Typography>
                      <Typography variant="body2">{bot.postsPerDay}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" component="div">
                        Min Interval
                      </Typography>
                      <Typography variant="body2">{bot.minIntervalHours}h</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" component="div">
                        Preferred Hours
                      </Typography>
                      <Typography variant="body2">
                        {bot.preferredHoursStart.toString().padStart(2, '0')}:00
                        {' - '}
                        {bot.preferredHoursEnd.toString().padStart(2, '0')}:00
                      </Typography>
                    </Box>
                  </Box>
                </Stack>

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="outlined" onClick={() => setIsEditing(true)}>
                    Edit Configuration
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        )}

        {bot && isEditing && (
          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 3 }}>
                Edit Bot Configuration
              </Typography>
              <BotSetupForm
                defaultValues={{
                  prompt: bot.prompt,
                  postMode: bot.postMode as 'auto' | 'manual',
                  postsPerDay: bot.postsPerDay,
                  minIntervalHours: bot.minIntervalHours,
                  preferredHoursStart: bot.preferredHoursStart,
                  preferredHoursEnd: bot.preferredHoursEnd,
                }}
                onSubmit={async (values) => {
                  await updateBot({ botId: bot.id, ...values });
                  setIsEditing(false);
                }}
                onCancel={() => setIsEditing(false)}
                isSubmitting={isUpdating}
              />
            </CardContent>
          </Card>
        )}
      </Container>
    </>
  );
}
