import { useState } from 'react';
import Container from '@mui/material/Container';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import AppHeader from '../components/AppHeader';
import PostCard from '../components/PostCard';
import { useAuth } from '../hooks/useAuth';
import { useAllBots } from '../hooks/useBot';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import { usePosts, usePostCounts, useDeleteAllDiscarded } from '../hooks/usePosts';
import { useDashboardVersion } from '../contexts/DashboardVersionContext';
import PostQueueBPage from './PostQueueBPage';

const TAB_CONFIG = [
  { label: 'Drafts', status: 'draft', emptyMessage: 'No drafts yet' },
  {
    label: 'Approved',
    status: 'approved',
    emptyMessage: 'No approved posts',
  },
  {
    label: 'Published',
    status: 'published',
    emptyMessage: 'No published posts',
  },
  { label: 'Failed', status: 'failed', emptyMessage: 'No failed posts' },
  {
    label: 'Discarded',
    status: 'discarded',
    emptyMessage: 'No discarded posts',
  },
  { label: 'All', status: undefined, emptyMessage: 'No posts yet' },
] as const;

export default function PostsPage() {
  const { version } = useDashboardVersion();
  if (version === 'B') return <PostQueueBPage />;
  return <PostsAPage />;
}

function PostsAPage() {
  const { user } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState<string>('');

  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const deleteAllDiscarded = useDeleteAllDiscarded();

  const { data: allBots } = useAllBots(showAll && !!user?.isAdmin);

  const { data: counts } = usePostCounts(showAll, selectedBotId || undefined);

  const currentTab = TAB_CONFIG[tabIndex];
  const { data, isLoading } = usePosts(
    currentTab.status,
    page,
    10,
    showAll,
    selectedBotId || undefined,
  );
  const isDiscardedTab = currentTab.status === 'discarded';

  const posts = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 0;

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
    setPage(1);
  };

  return (
    <>
      <AppHeader />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
            Posts
          </Typography>
          {user?.isAdmin && (
            <FormControlLabel
              control={
                <Switch
                  checked={showAll}
                  onChange={(e) => {
                    setShowAll(e.target.checked);
                    setPage(1);
                  }}
                />
              }
              label="Show everyone's bots"
            />
          )}
        </Box>

        {allBots && allBots.length > 1 && (
          <Box sx={{ mb: 2 }}>
            <Select
              size="small"
              value={selectedBotId}
              onChange={(e) => {
                setSelectedBotId(e.target.value);
                setPage(1);
              }}
              displayEmpty
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">All Bots</MenuItem>
              {allBots.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  @{b.xAccountHandle || b.id.slice(0, 8)}
                  {b.user && b.userId !== user?.id ? ` (${b.user.name})` : ''}
                </MenuItem>
              ))}
            </Select>
          </Box>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            {TAB_CONFIG.map((tab) => {
              const count = counts ? (tab.status ? counts[tab.status] : counts.total) : undefined;
              const label = count !== undefined ? `${tab.label} (${count})` : tab.label;
              return <Tab key={tab.label} label={label} />;
            })}
          </Tabs>
        </Box>

        {isDiscardedTab && posts.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={() => setDeleteAllOpen(true)}
              disabled={deleteAllDiscarded.isPending}
            >
              {deleteAllDiscarded.isPending ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
              Delete All Discarded
            </Button>
          </Box>
        )}

        {isLoading ? (
          <Box>
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                height={160}
                sx={{ mb: 2, borderRadius: 2 }}
              />
            ))}
          </Box>
        ) : posts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" color="text.secondary">
              {currentTab.emptyMessage}
            </Typography>
          </Box>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {totalPages > 1 && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 2,
                  mt: 2,
                  mb: 4,
                }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Typography variant="body2" color="text.secondary">
                  Page {page} of {totalPages}
                  {meta ? ` (${meta.total} posts)` : ''}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </Box>
            )}
          </>
        )}
        <Dialog open={deleteAllOpen} onClose={() => setDeleteAllOpen(false)}>
          <DialogTitle>Delete All Discarded Posts</DialogTitle>
          <DialogContent>
            Are you sure you want to permanently delete all discarded posts
            {showAll && user?.isAdmin ? ' across all bots' : ''}?
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteAllOpen(false)} disabled={deleteAllDiscarded.isPending}>
              Cancel
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                deleteAllDiscarded.mutate(showAll && !!user?.isAdmin, {
                  onSuccess: () => {
                    setDeleteAllOpen(false);
                    setPage(1);
                  },
                });
              }}
              disabled={deleteAllDiscarded.isPending}
            >
              {deleteAllDiscarded.isPending ? <CircularProgress size={20} /> : 'Delete All'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
}
