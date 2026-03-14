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
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AppHeader from '../components/AppHeader';
import BotSetupForm from '../components/BotSetupForm';
import {
  useBot,
  useCreateBot,
  useUpdateBot,
  useGenerateDrafts,
  useBotShares,
  useShareBot,
  useUnshareBot,
  useBotTips,
  useUpdateTip,
  useDeleteTip,
} from '../hooks/useBot';
import { useJudges, useBotJudges, useAssignJudge, useRemoveJudge } from '../hooks/useJudges';
import { useAuth } from '../hooks/useAuth';
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
  const { user } = useAuth();
  const { bots, isLoading } = useBot();
  const createBot = useCreateBot();
  const updateBot = useUpdateBot();
  const [selectedBotIndex, setSelectedBotIndex] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const navigate = useNavigate();

  const bot = bots.length > 0 ? bots[Math.min(selectedBotIndex, bots.length - 1)] : null;
  const isOwner = bot ? bot.userId === user?.id : false;

  const generateDrafts = useGenerateDrafts();

  const { data: shares } = useBotShares(bot?.id);
  const shareBot = useShareBot();
  const unshareBot = useUnshareBot();

  const { data: tips } = useBotTips(bot?.id);
  const updateTip = useUpdateTip();
  const deleteTip = useDeleteTip();
  const [editingTipId, setEditingTipId] = useState<string | null>(null);
  const [editingTipContent, setEditingTipContent] = useState('');
  const [deleteConfirmTipId, setDeleteConfirmTipId] = useState<string | null>(null);

  const { data: allJudges } = useJudges();
  const { data: botJudges } = useBotJudges(bot?.id);
  const assignJudge = useAssignJudge();
  const removeJudge = useRemoveJudge();

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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="h4">Dashboard</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {bots.length > 1 && (
              <Select
                size="small"
                value={selectedBotIndex}
                onChange={(e) => setSelectedBotIndex(Number(e.target.value))}
                sx={{ minWidth: 200 }}
              >
                {bots.map((b, i) => (
                  <MenuItem key={b.id} value={i}>
                    @{b.xAccountHandle || `Bot ${i + 1}`}
                    {!b.active && ' (paused)'}
                    {b.userId !== user?.id && b.user
                      ? ` (Owner: ${b.user.name})`
                      : b.userId !== user?.id
                        ? ' (Shared)'
                        : ''}
                  </MenuItem>
                ))}
              </Select>
            )}
            <Button variant="outlined" size="small" onClick={() => setCreateOpen(true)}>
              + New Bot
            </Button>
          </Box>
        </Box>

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
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Chip
                    label={bot.platform === 'x' ? 'X (Twitter)' : bot.platform}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={bot.active ? 'Active' : 'Inactive'}
                    color={bot.active ? 'success' : 'default'}
                    size="small"
                  />
                  {!isOwner && (
                    <Chip
                      label={bot.user ? `Owner: ${bot.user.name}` : 'Shared'}
                      color="info"
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
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

        {/* Memory Tips */}
        <Typography variant="h6" gutterBottom>
          Memory Tips {tips && `(${tips.length}/10)`}
        </Typography>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            {tips && tips.length > 0 ? (
              <List dense disablePadding>
                {tips.map((tip, index) => (
                  <div key={tip.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      secondaryAction={
                        editingTipId === tip.id ? (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => {
                                updateTip.mutate(
                                  {
                                    botId: bot!.id,
                                    tipId: tip.id,
                                    content: editingTipContent,
                                  },
                                  {
                                    onSuccess: () => {
                                      setEditingTipId(null);
                                      showSnackbar('Tip updated', 'success');
                                    },
                                    onError: () => showSnackbar('Failed to update tip', 'error'),
                                  },
                                );
                              }}
                              disabled={updateTip.isPending}
                            >
                              <CheckIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => setEditingTipId(null)}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => {
                                setEditingTipId(tip.id);
                                setEditingTipContent(tip.content);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => setDeleteConfirmTipId(tip.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )
                      }
                    >
                      {editingTipId === tip.id ? (
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          minRows={2}
                          maxRows={6}
                          value={editingTipContent}
                          onChange={(e) => setEditingTipContent(e.target.value)}
                          sx={{ mr: 2 }}
                        />
                      ) : (
                        <ListItemText primary={tip.content} />
                      )}
                    </ListItem>
                  </div>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No memory tips yet. Tips are generated when you tweak and accept posts.
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Delete tip confirmation dialog */}
        <Dialog open={!!deleteConfirmTipId} onClose={() => setDeleteConfirmTipId(null)}>
          <DialogTitle>Delete Tip</DialogTitle>
          <DialogContent>
            <DialogContentText>Are you sure you want to delete this memory tip?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmTipId(null)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              disabled={deleteTip.isPending}
              onClick={() => {
                if (!deleteConfirmTipId || !bot) return;
                deleteTip.mutate(
                  { botId: bot.id, tipId: deleteConfirmTipId },
                  {
                    onSuccess: () => {
                      setDeleteConfirmTipId(null);
                      showSnackbar('Tip deleted', 'success');
                    },
                    onError: () => showSnackbar('Failed to delete tip', 'error'),
                  },
                );
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Judges Section */}
        <Typography variant="h6" gutterBottom>
          Judges {botJudges && `(${botJudges.length}/5)`}
        </Typography>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            {botJudges && botJudges.length > 0 ? (
              <List dense disablePadding>
                {botJudges.map((bj, index) => (
                  <div key={bj.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      secondaryAction={
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => {
                            if (!bot) return;
                            removeJudge.mutate(
                              { botId: bot.id, judgeId: bj.judgeId },
                              {
                                onSuccess: () =>
                                  showSnackbar(`Removed judge "${bj.judge.name}"`, 'success'),
                                onError: () => showSnackbar('Failed to remove judge', 'error'),
                              },
                            );
                          }}
                          disabled={removeJudge.isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={bj.judge.name}
                        secondary={
                          bj.judge.prompt.length > 100
                            ? bj.judge.prompt.substring(0, 100) + '...'
                            : bj.judge.prompt
                        }
                      />
                    </ListItem>
                  </div>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No judges assigned. Assign judges to get AI-powered reviews on your posts.
              </Typography>
            )}
            {allJudges && botJudges && botJudges.length < 5 && (
              <Box sx={{ mt: 2 }}>
                <Select
                  size="small"
                  displayEmpty
                  value=""
                  onChange={(e) => {
                    const judgeId = e.target.value as string;
                    if (!judgeId || !bot) return;
                    assignJudge.mutate(
                      { botId: bot.id, judgeId },
                      {
                        onSuccess: () => showSnackbar('Judge assigned', 'success'),
                        onError: () => showSnackbar('Failed to assign judge', 'error'),
                      },
                    );
                  }}
                  sx={{ minWidth: 200 }}
                  disabled={assignJudge.isPending}
                >
                  <MenuItem value="" disabled>
                    Add a judge...
                  </MenuItem>
                  {allJudges
                    .filter((j) => !botJudges.some((bj) => bj.judgeId === j.id))
                    .map((j) => (
                      <MenuItem key={j.id} value={j.id}>
                        {j.name}
                      </MenuItem>
                    ))}
                </Select>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Button
            variant="contained"
            disabled={generateDrafts.isPending}
            onClick={() => {
              if (!bot) return;
              generateDrafts.mutate(
                { botId: bot.id, count: 3 },
                {
                  onSuccess: (posts) => {
                    showSnackbar(`Generated ${posts.length} practice draft(s)`, 'success');
                  },
                  onError: () => {
                    showSnackbar('Failed to generate drafts', 'error');
                  },
                },
              );
            }}
          >
            {generateDrafts.isPending ? (
              <>
                <CircularProgress size={18} sx={{ mr: 1 }} />
                Generating...
              </>
            ) : (
              'Generate Practice Drafts'
            )}
          </Button>
          <Button variant="outlined" onClick={() => void navigate({ to: '/posts' })}>
            View Post Queue
          </Button>
          <Button variant="outlined" onClick={() => setEditOpen(true)}>
            Edit Bot Config
          </Button>
        </Box>

        {/* Sharing Section (owner only) */}
        {isOwner && (
          <>
            <Typography variant="h6" gutterBottom>
              Sharing
            </Typography>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle2">Shared with</Typography>
                  <Button variant="outlined" size="small" onClick={() => setShareOpen(true)}>
                    Share Bot
                  </Button>
                </Box>
                {shares && shares.length > 0 ? (
                  <List dense disablePadding>
                    {shares.map((share, index) => (
                      <div key={share.id}>
                        {index > 0 && <Divider />}
                        <ListItem
                          secondaryAction={
                            <IconButton
                              edge="end"
                              aria-label="unshare"
                              onClick={() => {
                                unshareBot.mutate(
                                  { botId: bot.id, userId: share.userId },
                                  {
                                    onSuccess: () =>
                                      showSnackbar(
                                        `Removed ${share.user.email} from shared users`,
                                        'success',
                                      ),
                                    onError: () =>
                                      showSnackbar('Failed to remove shared user', 'error'),
                                  },
                                );
                              }}
                              disabled={unshareBot.isPending}
                            >
                              <DeleteIcon />
                            </IconButton>
                          }
                        >
                          <ListItemText primary={share.user.name} secondary={share.user.email} />
                        </ListItem>
                      </div>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    This bot is not shared with anyone yet.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Share Bot dialog */}
        <Dialog
          open={shareOpen}
          onClose={() => {
            setShareOpen(false);
            setShareEmail('');
          }}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Share Bot</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Enter the email address of the user you want to share this bot with.
            </DialogContentText>
            <TextField
              autoFocus
              fullWidth
              label="Email address"
              type="email"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setShareOpen(false);
                setShareEmail('');
              }}
              disabled={shareBot.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={!shareEmail || shareBot.isPending}
              onClick={() => {
                if (!bot) return;
                shareBot.mutate(
                  { botId: bot.id, email: shareEmail },
                  {
                    onSuccess: () => {
                      setShareOpen(false);
                      setShareEmail('');
                      showSnackbar('Bot shared successfully', 'success');
                    },
                    onError: () => {
                      showSnackbar('Failed to share bot', 'error');
                    },
                  },
                );
              }}
            >
              {shareBot.isPending ? 'Sharing...' : 'Share'}
            </Button>
          </DialogActions>
        </Dialog>

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

        {/* Create new bot dialog */}
        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create New Bot</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <BotSetupForm
                onSubmit={(values) => {
                  createBot.mutate(values, {
                    onSuccess: () => {
                      setCreateOpen(false);
                      setSelectedBotIndex(bots.length);
                      showSnackbar('Bot created successfully', 'success');
                    },
                    onError: () => {
                      showSnackbar('Failed to create bot', 'error');
                    },
                  });
                }}
                isLoading={createBot.isPending}
                submitLabel="Create Bot"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)} disabled={createBot.isPending}>
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
