import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import AppHeader from '../components/AppHeader';
import BotSetupForm from '../components/BotSetupForm';
import { useBot, useCreateBot, useUpdateBot } from '../hooks/useBot';
import { useStats } from '../hooks/useStats';
import { usePosts, type PostStatus } from '../hooks/usePosts';
import { apiClient } from '../lib/apiClient';
import { useNavigate } from '@tanstack/react-router';

const statusColors: Record<PostStatus, 'default' | 'info' | 'success' | 'error'> = {
  draft: 'default',
  scheduled: 'info',
  published: 'success',
  discarded: 'error',
};

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4">{value}</Typography>
      </CardContent>
    </Card>
  );
}

type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

export default function DashboardPage() {
  const { bot, isLoading } = useBot();
  const createBot = useCreateBot();
  const updateBot = useUpdateBot();
  const [editOpen, setEditOpen] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useStats(bot?.id);
  const { data: recentPostsData, isLoading: recentPostsLoading } = usePosts(undefined, 1, 5);
  const recentPosts = recentPostsData?.data ?? [];

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleToggleClick = () => {
    if (!bot) return;
    setToggleConfirmOpen(true);
  };

  const handleToggleConfirm = () => {
    if (!bot) return;
    const newActive = !bot.active;
    setToggleConfirmOpen(false);
    updateBot.mutate(
      { id: bot.id, active: newActive },
      {
        onSuccess: () => {
          showSnackbar(
            newActive ? 'Bot resumed successfully' : 'Bot paused successfully',
            'success',
          );
        },
        onError: () => {
          showSnackbar('Failed to update bot', 'error');
        },
      },
    );
  };

  const handleToggleCancel = () => {
    setToggleConfirmOpen(false);
  };

  const handleConnectX = async () => {
    if (!bot) return;
    setConnectLoading(true);
    try {
      const response = await apiClient.get<{ data: { url: string } }>(
        `/auth/x/connect?botId=${bot.id}`,
      );
      window.location.href = response.data.data.url;
    } catch {
      setConnectLoading(false);
    }
  };

  const handleConfigSave = (values: {
    prompt: string;
    postMode: 'auto' | 'manual';
    postsPerDay: number;
    minIntervalHours: number;
    preferredHoursStart: number;
    preferredHoursEnd: number;
  }) => {
    if (!bot) return;
    updateBot.mutate(
      { id: bot.id, ...values },
      {
        onSuccess: () => {
          setEditOpen(false);
          showSnackbar('Bot configuration updated', 'success');
        },
        onError: () => {
          showSnackbar('Failed to update bot', 'error');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Container>
      </>
    );
  }

  if (!bot) {
    return (
      <>
        <AppHeader />
        <Container maxWidth="sm" sx={{ mt: 4 }}>
          <Typography variant="h4" gutterBottom>
            Set up your bot
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Configure your bot&apos;s posting behaviour. You can connect your X account afterwards.
          </Typography>
          <BotSetupForm
            onSubmit={(values) => {
              createBot.mutate(values);
            }}
            isLoading={createBot.isPending}
            submitLabel="Create Bot"
          />
        </Container>
      </>
    );
  }

  const lastUpdated = bot.updatedAt ? new Date(bot.updatedAt).toLocaleString() : null;

  return (
    <>
      <AppHeader />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Box>
                <Typography variant="h5">@{bot.xAccountHandle || 'Not connected'}</Typography>
                <Chip
                  label={bot.active ? 'Active' : 'Inactive'}
                  color={bot.active ? 'success' : 'default'}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </Box>
              <Switch
                checked={bot.active}
                onChange={handleToggleClick}
                disabled={updateBot.isPending}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Mode: {bot.postMode} | Posts/day: {bot.postsPerDay} | Min interval:{' '}
                {bot.minIntervalHours}h
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active hours: {bot.preferredHoursStart}:00 - {bot.preferredHoursEnd}:00
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Prompt: {bot.prompt}
              </Typography>
              {lastUpdated && (
                <Typography variant="caption" color="text.secondary">
                  Last updated: {lastUpdated}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button variant="outlined" onClick={handleConnectX} disabled={connectLoading}>
                {connectLoading ? 'Connecting...' : 'Connect X'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => setEditOpen(true)}
                disabled={updateBot.isPending}
              >
                Edit Config
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Stats Section */}
        {statsLoading ? (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[1, 2, 3, 4].map((i) => (
              <Grid item xs={6} sm={3} key={i}>
                <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 1 }} />
              </Grid>
            ))}
          </Grid>
        ) : stats ? (
          <>
            <Typography variant="h6" gutterBottom>
              Stats
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={3}>
                <StatCard title="Total Posts" value={stats.totalPosts} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatCard title="Posts Today" value={stats.postsToday} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatCard
                  title="Avg Rating"
                  value={stats.averageRating != null ? stats.averageRating.toFixed(1) : 'N/A'}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatCard title="Published" value={stats.postsByStatus.published} />
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={3}>
                <StatCard title="Drafts" value={stats.postsByStatus.draft} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatCard title="Scheduled" value={stats.postsByStatus.scheduled} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatCard title="Discarded" value={stats.postsByStatus.discarded} />
              </Grid>
            </Grid>
          </>
        ) : null}

        {/* Recent Posts */}
        <Typography variant="h6" gutterBottom>
          Recent Posts
        </Typography>
        {recentPostsLoading ? (
          <Box>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Box>
        ) : recentPosts.length === 0 ? (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                No posts yet
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              {recentPosts.map((post, index) => (
                <Box
                  key={post.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1.5,
                    borderBottom: index < recentPosts.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      mr: 2,
                      flex: 1,
                    }}
                  >
                    {post.content}
                  </Typography>
                  <Chip label={post.status} color={statusColors[post.status]} size="small" />
                </Box>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Button variant="contained" onClick={() => void navigate({ to: '/posts' })}>
            View Post Queue
          </Button>
          <Button variant="outlined" onClick={() => setEditOpen(true)}>
            Edit Bot Config
          </Button>
        </Box>

        {/* Toggle confirmation dialog */}
        <Dialog open={toggleConfirmOpen} onClose={handleToggleCancel}>
          <DialogTitle>{bot.active ? 'Pause Bot' : 'Resume Bot'}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {bot.active
                ? 'Are you sure you want to pause this bot? Workers will skip pending jobs.'
                : 'Are you sure you want to resume this bot? Pending jobs will resume.'}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleToggleCancel}>Cancel</Button>
            <Button
              onClick={handleToggleConfirm}
              variant="contained"
              disabled={updateBot.isPending}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit config dialog */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Bot Configuration</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <BotSetupForm
                initialValues={{
                  prompt: bot.prompt,
                  postMode: bot.postMode as 'auto' | 'manual',
                  postsPerDay: bot.postsPerDay,
                  minIntervalHours: bot.minIntervalHours,
                  preferredHoursStart: bot.preferredHoursStart,
                  preferredHoursEnd: bot.preferredHoursEnd,
                }}
                onSubmit={handleConfigSave}
                isLoading={updateBot.isPending}
                submitLabel="Update"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)} disabled={updateBot.isPending}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </>
  );
}
