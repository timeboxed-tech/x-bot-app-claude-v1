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
import Grid from '@mui/material/Grid';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AppHeader from '../components/AppHeader';
import BotSetupForm from '../components/BotSetupForm';
import { useDashboardVersion } from '../contexts/DashboardVersionContext';
import DashboardBPage from './DashboardBPage';
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
import { usePosts } from '../hooks/usePosts';
import { useStats } from '../hooks/useStats';
import { apiClient } from '../lib/apiClient';
import { useNavigate } from '@tanstack/react-router';

type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
  action?: React.ReactNode;
};

export default function DashboardPage() {
  const { version } = useDashboardVersion();
  if (version === 'B') return <DashboardBPage />;
  return <DashboardAPage />;
}

function DashboardAPage() {
  const { user } = useAuth();
  const { bots, isLoading } = useBot();
  const createBot = useCreateBot();
  const updateBot = useUpdateBot();
  const [selectedBotIndex, setSelectedBotIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [manualDraftContent, setManualDraftContent] = useState('');
  const [manualDraftLoading, setManualDraftLoading] = useState(false);
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

  const { data: statsData } = useStats(bot?.id);

  const { data: recentPostsData, isLoading: recentPostsLoading } = usePosts('published', 1, 10);
  const recentPosts = recentPostsData?.data ?? [];

  const showSnackbar = (
    message: string,
    severity: 'success' | 'error',
    action?: React.ReactNode,
  ) => {
    setSnackbar({ open: true, message, severity, action });
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
                Active hours: {bot.preferredHoursStart}:00 - {bot.preferredHoursEnd}:00 (
                {bot.timezone || 'UTC'})
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
                onClick={() => void navigate({ to: `/bots/${bot.id}/edit` })}
              >
                Edit Config
              </Button>
            </Box>
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
                  onSuccess: (result) => {
                    const { posts, errors } = result;
                    if (posts.length === 0 && errors.length > 0) {
                      showSnackbar(`Failed to generate drafts: ${errors[0]}`, 'error');
                    } else if (errors.length > 0) {
                      showSnackbar(
                        `Generated ${posts.length} draft(s). ${errors.length} failed: ${errors[0]}`,
                        'error',
                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => void navigate({ to: '/posts' })}
                        >
                          View Drafts
                        </Button>,
                      );
                    } else {
                      showSnackbar(
                        `Generated ${posts.length} practice draft(s)`,
                        'success',
                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => void navigate({ to: '/posts' })}
                        >
                          View Drafts
                        </Button>,
                      );
                    }
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
          <Button variant="outlined" onClick={() => void navigate({ to: `/bots/${bot.id}/edit` })}>
            Edit Bot Config
          </Button>
        </Box>

        {/* Manual Draft */}
        <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'flex-start' }}>
          <TextField
            size="small"
            multiline
            minRows={2}
            maxRows={4}
            placeholder="Type draft content..."
            value={manualDraftContent}
            onChange={(e) => setManualDraftContent(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            disabled={!manualDraftContent.trim() || manualDraftLoading}
            onClick={async () => {
              if (!bot) return;
              setManualDraftLoading(true);
              try {
                await apiClient.post(`/bots/${bot.id}/manual-draft`, {
                  content: manualDraftContent.trim(),
                });
                showSnackbar('Draft created', 'success');
                setManualDraftContent('');
              } catch {
                showSnackbar('Failed to create draft', 'error');
              } finally {
                setManualDraftLoading(false);
              }
            }}
            sx={{ minWidth: 130, height: 40 }}
          >
            {manualDraftLoading ? <CircularProgress size={18} /> : 'Create Draft'}
          </Button>
        </Box>

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

        {/* Stats Section */}
        <Typography variant="h6" gutterBottom>
          Stats
        </Typography>
        {statsData ? (
          <>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {(
                [
                  { label: 'Draft', value: String(statsData.postsByStatus.draft) },
                  { label: 'Scheduled', value: String(statsData.postsByStatus.scheduled) },
                  { label: 'Approved', value: String(statsData.postsByStatus.approved) },
                  { label: 'Published', value: String(statsData.postsByStatus.published) },
                  { label: 'Discarded', value: String(statsData.postsByStatus.discarded) },
                ] as const
              ).map((stat) => (
                <Grid item xs={6} sm={4} md key={stat.label}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="h5">{stat.value}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {stat.label}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                {(
                  [
                    {
                      label: 'Avg Post Rating',
                      value:
                        statsData.avgPostRating != null ? statsData.avgPostRating.toFixed(1) : '-',
                    },
                    {
                      label: 'Avg Judge Rating (Draft+Published)',
                      value:
                        statsData.avgJudgeRatingDraftPublished != null
                          ? statsData.avgJudgeRatingDraftPublished.toFixed(1)
                          : '-',
                    },
                    {
                      label: 'Avg Judge Rating (All)',
                      value:
                        statsData.avgJudgeRatingAll != null
                          ? statsData.avgJudgeRatingAll.toFixed(1)
                          : '-',
                    },
                  ] as const
                ).map((stat, index) => (
                  <Box
                    key={stat.label}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 0.75,
                      borderBottom: index < 2 ? '1px solid' : 'none',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {stat.label}
                    </Typography>
                    <Typography variant="h6">{stat.value}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </>
        ) : (
          <Skeleton variant="rectangular" height={80} sx={{ mb: 3, borderRadius: 1 }} />
        )}

        {/* Recent Published Posts */}
        <Typography variant="h6" gutterBottom>
          Recent Published Posts
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
                No published posts yet
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
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
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
          autoHideDuration={snackbar.action ? 8000 : 4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            variant="filled"
            action={snackbar.action}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </>
  );
}
