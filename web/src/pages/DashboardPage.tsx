import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Skeleton from '@mui/material/Skeleton';
import AppHeader from '../components/AppHeader';
import BotSetupForm from '../components/BotSetupForm';
import { useBot, useUpdateBot } from '../hooks/useBot';
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

export default function DashboardPage() {
  const { bot, isLoading } = useBot();
  const updateBot = useUpdateBot();
  const [editOpen, setEditOpen] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useStats(bot?.id);
  const { data: recentPostsData, isLoading: recentPostsLoading } = usePosts(undefined, 1, 5);
  const recentPosts = recentPostsData?.data ?? [];

  const handleToggleActive = () => {
    if (!bot) return;
    updateBot.mutate({ id: bot.id, active: !bot.active });
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
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              py: 8,
            }}
          >
            <Typography variant="h4">Set up your bot</Typography>
            <Typography variant="body1" color="text.secondary">
              You don't have a bot yet. Connect your X account to get started.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Bot creation requires connecting your X account first via the API.
            </Typography>
          </Box>
        </Container>
      </>
    );
  }

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
                onChange={handleToggleActive}
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
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button variant="outlined" onClick={handleConnectX} disabled={connectLoading}>
                {connectLoading ? 'Connecting...' : 'Connect X'}
              </Button>
              <Button variant="outlined" onClick={() => setEditOpen(true)}>
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
                onSubmit={(values) => {
                  updateBot.mutate(
                    { id: bot.id, ...values },
                    {
                      onSuccess: () => setEditOpen(false),
                    },
                  );
                }}
                isLoading={updateBot.isPending}
                submitLabel="Update"
              />
            </Box>
          </DialogContent>
        </Dialog>
      </Container>
    </>
  );
}
