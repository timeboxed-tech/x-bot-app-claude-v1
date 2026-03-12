import { useState } from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import AppHeader from '../components/AppHeader';
import PostCard from '../components/PostCard';
import { usePosts } from '../hooks/usePosts';

const TAB_CONFIG = [
  { label: 'All', status: undefined, emptyMessage: 'No posts yet' },
  { label: 'Drafts', status: 'draft', emptyMessage: 'No drafts yet' },
  {
    label: 'Scheduled',
    status: 'scheduled',
    emptyMessage: 'No scheduled posts',
  },
  {
    label: 'Published',
    status: 'published',
    emptyMessage: 'No published posts',
  },
  {
    label: 'Discarded',
    status: 'discarded',
    emptyMessage: 'No discarded posts',
  },
] as const;

export default function PostsPage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [page, setPage] = useState(1);

  const currentTab = TAB_CONFIG[tabIndex];
  const { data, isLoading } = usePosts(currentTab.status, page);

  const posts = data?.data ?? [];
  const meta = data?.meta;
  const hasMore = meta ? meta.page * meta.pageSize < meta.total : false;

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
    setPage(1);
  };

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  return (
    <>
      <AppHeader />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Posts
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            {TAB_CONFIG.map((tab) => (
              <Tab key={tab.label} label={tab.label} />
            ))}
          </Tabs>
        </Box>

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
            {hasMore && (
              <Box sx={{ textAlign: 'center', mt: 2, mb: 4 }}>
                <Button variant="outlined" onClick={handleLoadMore}>
                  Load more
                </Button>
              </Box>
            )}
          </>
        )}
      </Container>
    </>
  );
}
