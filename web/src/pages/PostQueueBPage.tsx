import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Rating from '@mui/material/Rating';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileCopyOutlinedIcon from '@mui/icons-material/FileCopyOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DeleteIcon from '@mui/icons-material/Delete';
import FlagIcon from '@mui/icons-material/Flag';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';
import RateReviewIcon from '@mui/icons-material/RateReview';
import RestoreIcon from '@mui/icons-material/Restore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { AxiosError } from 'axios';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import AppHeader from '../components/AppHeader';
import EvaluationDialog from '../components/EvaluationDialog';
import ProcessVisualisationDialog, {
  type ProcessStep,
} from '../components/ProcessVisualisationDialog';
import { useAuth } from '../hooks/useAuth';
import { useAllBots } from '../hooks/useBot';
import {
  usePosts,
  usePostCounts,
  useUpdatePost,
  useDeletePost,
  usePublishPost,
  type PostStatus,
} from '../hooks/usePosts';
import {
  usePostReviews,
  useRequestReview,
  useDeleteReview,
  type PostReview,
} from '../hooks/useJudges';

const STATUS_FILTERS: Array<{ label: string; status?: PostStatus }> = [
  { label: 'All' },
  { label: 'Drafts', status: 'draft' },
  { label: 'Approved', status: 'approved' },
  { label: 'Scheduled', status: 'scheduled' },
  { label: 'Published', status: 'published' },
  { label: 'Discarded', status: 'discarded' },
];

const statusColors: Record<PostStatus, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  draft: 'default',
  approved: 'warning',
  scheduled: 'info',
  published: 'success',
  discarded: 'error',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function PostReviewsSection({
  postId,
  onDeleteReview,
  isDeleting,
}: {
  postId: string;
  onDeleteReview: (params: { postId: string; reviewId: string }) => void;
  isDeleting: boolean;
}) {
  const { data: reviews } = usePostReviews(postId);
  const [showReviews, setShowReviews] = useState(false);

  if (!reviews || reviews.length === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Button size="small" onClick={() => setShowReviews(!showReviews)} sx={{ mb: 1 }}>
        {showReviews ? 'Hide Reviews' : `Show Reviews (${reviews.length})`}
      </Button>
      {showReviews && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {reviews.map((review: PostReview) => (
            <Box
              key={review.id}
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 0.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="subtitle2">{review.judge.name}</Typography>
                  <IconButton
                    size="small"
                    onClick={() => onDeleteReview({ postId, reviewId: review.id })}
                    disabled={isDeleting}
                    sx={{ p: 0.25 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Rating value={review.rating} readOnly size="small" />
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {review.opinion}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function PostQueueBPage() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<PostStatus | undefined>('draft');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [contentCopied, setContentCopied] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState<string | null>(null);
  const [processDialogPostId, setProcessDialogPostId] = useState<string | null>(null);
  const [evaluatePostId, setEvaluatePostId] = useState<string | null>(null);

  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const { data: allBots } = useAllBots(showAll && !!user?.isAdmin);

  const { data: counts } = usePostCounts(showAll, selectedBotId || undefined);
  const { data, isLoading } = usePosts(activeFilter, page, 15, showAll, selectedBotId || undefined);
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  const publishPost = usePublishPost();
  const requestReview = useRequestReview();
  const deleteReview = useDeleteReview();

  const posts = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 0;

  const handleFilterChange = (status?: PostStatus) => {
    setActiveFilter(status);
    setPage(1);
    setExpandedId(null);
  };

  return (
    <>
      <AppHeader />
      <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4">Post Queue</Typography>
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
              label="Show all bots"
            />
          )}
        </Box>

        {/* Bot filter */}
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

        {/* Chip filters */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
          {STATUS_FILTERS.map((filter) => {
            const count = counts
              ? filter.status
                ? counts[filter.status]
                : counts.total
              : undefined;
            const isActive =
              (filter.status === undefined && activeFilter === undefined) ||
              filter.status === activeFilter;
            return (
              <Chip
                key={filter.label}
                label={count !== undefined ? `${filter.label} (${count})` : filter.label}
                onClick={() => handleFilterChange(filter.status)}
                color={isActive ? 'primary' : 'default'}
                variant={isActive ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
              />
            );
          })}
        </Box>

        {/* Post list */}
        {isLoading ? (
          <Box>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                height={48}
                sx={{ mb: 0.5, borderRadius: 1 }}
              />
            ))}
          </Box>
        ) : posts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" color="text.secondary">
              No posts found
            </Typography>
          </Box>
        ) : (
          <Card>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              {posts.map((post, index) => {
                const isExpanded = expandedId === post.id;
                // Parse metadata for process steps
                const parsedMetadata = (() => {
                  if (!post.metadata) return null;
                  try {
                    const parsed = JSON.parse(post.metadata) as {
                      outcome?: string;
                      processSteps?: ProcessStep[];
                    };
                    if (Array.isArray(parsed.processSteps) && parsed.processSteps.length > 0) {
                      return parsed;
                    }
                    return null;
                  } catch {
                    return null;
                  }
                })();
                const hasProcessSteps =
                  parsedMetadata !== null &&
                  parsedMetadata.processSteps !== undefined &&
                  parsedMetadata.processSteps.length > 0;

                return (
                  <Box key={post.id}>
                    {/* Compact row */}
                    <Box
                      onClick={() => setExpandedId(isExpanded ? null : post.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        py: 1,
                        gap: 1.5,
                        cursor: 'pointer',
                        borderBottom: index < posts.length - 1 || isExpanded ? '1px solid' : 'none',
                        borderColor: 'divider',
                        '&:hover': { bgcolor: 'action.hover' },
                        '&:hover .row-hover-actions': { opacity: 1 },
                      }}
                    >
                      <Chip
                        label={post.status}
                        color={statusColors[post.status]}
                        size="small"
                        sx={{ minWidth: 80, justifyContent: 'center' }}
                      />
                      <Typography
                        variant="body2"
                        sx={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {post.content.substring(0, 100)}
                        {post.content.length > 100 ? '...' : ''}
                      </Typography>
                      <Rating value={post.rating} readOnly size="small" sx={{ flexShrink: 0 }} />
                      {post.behaviourTitle && (
                        <Chip
                          label={post.behaviourTitle}
                          size="small"
                          variant="outlined"
                          sx={{
                            maxWidth: 120,
                            display: { xs: 'none', md: 'flex' },
                          }}
                        />
                      )}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ whiteSpace: 'nowrap', minWidth: 60, textAlign: 'right' }}
                      >
                        {timeAgo(post.createdAt)}
                      </Typography>
                      {/* Hover action icons */}
                      <Box
                        className="row-hover-actions"
                        sx={{
                          display: 'flex',
                          gap: 0.25,
                          opacity: 0,
                          transition: 'opacity 0.15s',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {post.status === 'draft' && (
                          <>
                            <Tooltip title="Approve">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() =>
                                  updatePost.mutate({ id: post.id, status: 'approved' })
                                }
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Publish Now">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => {
                                  setPublishError(null);
                                  setPublishingId(post.id);
                                  publishPost.mutate(post.id, {
                                    onSettled: () => setPublishingId(null),
                                    onError: (err: unknown) => {
                                      const message =
                                        err instanceof AxiosError && err.response?.data?.error
                                          ? err.response.data.error
                                          : err instanceof Error
                                            ? err.message
                                            : 'Failed to publish';
                                      setPublishError(message);
                                    },
                                  });
                                }}
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                {publishPost.isPending && publishingId === post.id ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <SendIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Schedule">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  updatePost.mutate({ id: post.id, status: 'scheduled' })
                                }
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                <ScheduleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Discard">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  updatePost.mutate({ id: post.id, status: 'discarded' })
                                }
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {post.status === 'approved' && (
                          <>
                            <Tooltip title="Publish Now">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => {
                                  setPublishError(null);
                                  setPublishingId(post.id);
                                  publishPost.mutate(post.id, {
                                    onSettled: () => setPublishingId(null),
                                    onError: (err: unknown) => {
                                      const message =
                                        err instanceof AxiosError && err.response?.data?.error
                                          ? err.response.data.error
                                          : err instanceof Error
                                            ? err.message
                                            : 'Failed to publish';
                                      setPublishError(message);
                                    },
                                  });
                                }}
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                {publishPost.isPending && publishingId === post.id ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <SendIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Schedule">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  updatePost.mutate({ id: post.id, status: 'scheduled' })
                                }
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                <ScheduleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Discard">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  updatePost.mutate({ id: post.id, status: 'discarded' })
                                }
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {post.status === 'scheduled' && (
                          <>
                            <Tooltip title="Publish Now">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => {
                                  setPublishError(null);
                                  setPublishingId(post.id);
                                  publishPost.mutate(post.id, {
                                    onSettled: () => setPublishingId(null),
                                    onError: (err: unknown) => {
                                      const message =
                                        err instanceof AxiosError && err.response?.data?.error
                                          ? err.response.data.error
                                          : err instanceof Error
                                            ? err.message
                                            : 'Failed to publish';
                                      setPublishError(message);
                                    },
                                  });
                                }}
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                {publishPost.isPending && publishingId === post.id ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <SendIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Discard">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  updatePost.mutate({ id: post.id, status: 'discarded' })
                                }
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {post.status === 'discarded' && (
                          <Tooltip title="Reinstate">
                            <IconButton
                              size="small"
                              onClick={() => updatePost.mutate({ id: post.id, status: 'draft' })}
                              disabled={updatePost.isPending}
                            >
                              <RestoreIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title={post.flagged ? 'Unflag' : 'Flag'}>
                          <IconButton
                            size="small"
                            color={post.flagged ? 'warning' : 'default'}
                            onClick={() =>
                              updatePost.mutate({ id: post.id, flagged: !post.flagged })
                            }
                            disabled={updatePost.isPending || post.status === 'published'}
                          >
                            {post.flagged ? (
                              <FlagIcon fontSize="small" />
                            ) : (
                              <OutlinedFlagIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {/* Expanded content */}
                    <Collapse in={isExpanded}>
                      <Box
                        sx={{
                          px: 3,
                          py: 2,
                          bgcolor: 'action.hover',
                          borderBottom: index < posts.length - 1 ? '1px solid' : 'none',
                          borderColor: 'divider',
                        }}
                      >
                        {editingId === post.id ? (
                          <Box sx={{ mb: 2 }}>
                            <TextField
                              fullWidth
                              multiline
                              minRows={3}
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              disabled={updatePost.isPending}
                              sx={{ mb: 1 }}
                            />
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                  updatePost.mutate(
                                    { id: post.id, content: editContent },
                                    {
                                      onSuccess: () => {
                                        setEditingId(null);
                                      },
                                    },
                                  );
                                }}
                                disabled={updatePost.isPending}
                              >
                                Save
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditContent('');
                                }}
                                disabled={updatePost.isPending}
                              >
                                Cancel
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <Box sx={{ position: 'relative' }}>
                            <Typography
                              variant="body1"
                              sx={{ whiteSpace: 'pre-wrap', mb: 2, pr: 4 }}
                            >
                              {post.content}
                            </Typography>
                            <Tooltip
                              title={contentCopied === post.id ? 'Copied!' : 'Copy post content'}
                            >
                              <IconButton
                                size="small"
                                onClick={() => {
                                  navigator.clipboard.writeText(post.content).then(() => {
                                    setContentCopied(post.id);
                                    setTimeout(() => setContentCopied(null), 1500);
                                  });
                                }}
                                sx={{ position: 'absolute', top: -4, right: -4, p: 0.25 }}
                                color={contentCopied === post.id ? 'success' : 'default'}
                              >
                                {contentCopied === post.id ? (
                                  <CheckIcon fontSize="small" />
                                ) : (
                                  <FileCopyOutlinedIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            flexWrap: 'wrap',
                          }}
                        >
                          {post.behaviourTitle && (
                            <Chip
                              label={`Behaviour: ${post.behaviourTitle}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {post.generationPrompt && (
                            <Tooltip title={promptCopied === post.id ? 'Copied!' : 'Copy prompt'}>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  navigator.clipboard.writeText(post.generationPrompt!).then(() => {
                                    setPromptCopied(post.id);
                                    setTimeout(() => setPromptCopied(null), 1500);
                                  });
                                }}
                                sx={{ p: 0.25 }}
                                color={promptCopied === post.id ? 'success' : 'default'}
                              >
                                {promptCopied === post.id ? (
                                  <CheckIcon fontSize="small" />
                                ) : (
                                  <ContentCopyIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                          )}
                          {hasProcessSteps && (
                            <Tooltip title="View process">
                              <IconButton
                                size="small"
                                onClick={() => setProcessDialogPostId(post.id)}
                                sx={{ p: 0.25 }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {post.scheduledAt && (
                            <Typography variant="caption" color="text.secondary">
                              Scheduled: {new Date(post.scheduledAt).toLocaleString()}
                            </Typography>
                          )}
                          {post.publishedAt && (
                            <Typography variant="caption" color="text.secondary">
                              Published: {new Date(post.publishedAt).toLocaleString()}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            Created: {new Date(post.createdAt).toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                          {post.status === 'draft' && (
                            <>
                              {editingId !== post.id && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setEditingId(post.id);
                                    setEditContent(post.content);
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  requestReview.mutate(post.id);
                                }}
                                disabled={requestReview.isPending}
                              >
                                {requestReview.isPending ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  'Ask Judges'
                                )}
                              </Button>
                              <Tooltip title="Evaluate">
                                <IconButton size="small" onClick={() => setEvaluatePostId(post.id)}>
                                  <RateReviewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() =>
                                  updatePost.mutate({ id: post.id, status: 'approved' })
                                }
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                  setPublishError(null);
                                  setPublishingId(post.id);
                                  publishPost.mutate(post.id, {
                                    onSettled: () => setPublishingId(null),
                                    onError: (err: unknown) => {
                                      const message =
                                        err instanceof AxiosError && err.response?.data?.error
                                          ? err.response.data.error
                                          : err instanceof Error
                                            ? err.message
                                            : 'Failed to publish';
                                      setPublishError(message);
                                    },
                                  });
                                }}
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                {publishPost.isPending && publishingId === post.id ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  'Publish Now'
                                )}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  updatePost.mutate({ id: post.id, status: 'scheduled' })
                                }
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                Schedule
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                onClick={() =>
                                  updatePost.mutate({ id: post.id, status: 'discarded' })
                                }
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                Discard
                              </Button>
                            </>
                          )}
                          {post.status === 'approved' && (
                            <>
                              <Tooltip title="Evaluate">
                                <IconButton size="small" onClick={() => setEvaluatePostId(post.id)}>
                                  <RateReviewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                  setPublishError(null);
                                  setPublishingId(post.id);
                                  publishPost.mutate(post.id, {
                                    onSettled: () => setPublishingId(null),
                                    onError: (err: unknown) => {
                                      const message =
                                        err instanceof AxiosError && err.response?.data?.error
                                          ? err.response.data.error
                                          : err instanceof Error
                                            ? err.message
                                            : 'Failed to publish';
                                      setPublishError(message);
                                    },
                                  });
                                }}
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                {publishPost.isPending && publishingId === post.id ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  'Publish Now'
                                )}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  updatePost.mutate({ id: post.id, status: 'scheduled' })
                                }
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                Schedule
                              </Button>
                              <Button
                                size="small"
                                color="warning"
                                variant="outlined"
                                onClick={() => updatePost.mutate({ id: post.id, status: 'draft' })}
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                Back to Draft
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                onClick={() =>
                                  updatePost.mutate({ id: post.id, status: 'discarded' })
                                }
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                Discard
                              </Button>
                            </>
                          )}
                          {post.status === 'scheduled' && (
                            <>
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                  setPublishError(null);
                                  setPublishingId(post.id);
                                  publishPost.mutate(post.id, {
                                    onSettled: () => setPublishingId(null),
                                    onError: (err: unknown) => {
                                      const message =
                                        err instanceof AxiosError && err.response?.data?.error
                                          ? err.response.data.error
                                          : err instanceof Error
                                            ? err.message
                                            : 'Failed to publish';
                                      setPublishError(message);
                                    },
                                  });
                                }}
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                {publishPost.isPending && publishingId === post.id ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  'Publish Now'
                                )}
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                onClick={() =>
                                  updatePost.mutate({ id: post.id, status: 'discarded' })
                                }
                                disabled={updatePost.isPending || publishPost.isPending}
                              >
                                Discard
                              </Button>
                            </>
                          )}
                          {post.status === 'discarded' && (
                            <>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => updatePost.mutate({ id: post.id, status: 'draft' })}
                                disabled={updatePost.isPending}
                              >
                                Reinstate
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                onClick={() => deletePost.mutate(post.id)}
                                disabled={deletePost.isPending}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </Box>
                        {publishError && expandedId === post.id && (
                          <Alert
                            severity="error"
                            onClose={() => setPublishError(null)}
                            sx={{ mt: 1 }}
                          >
                            {publishError}
                          </Alert>
                        )}
                        {/* Reviews Section */}
                        <PostReviewsSection
                          postId={post.id}
                          onDeleteReview={(params) => deleteReview.mutate(params)}
                          isDeleting={deleteReview.isPending}
                        />
                      </Box>
                      {/* Process Visualisation Dialog for this post */}
                      {hasProcessSteps && (
                        <ProcessVisualisationDialog
                          open={processDialogPostId === post.id}
                          onClose={() => setProcessDialogPostId(null)}
                          steps={parsedMetadata!.processSteps!}
                        />
                      )}
                      {/* Evaluation Dialog */}
                      {(post.status === 'draft' || post.status === 'approved') && (
                        <EvaluationDialog
                          open={evaluatePostId === post.id}
                          onClose={() => setEvaluatePostId(null)}
                          postId={post.id}
                          postContent={post.content}
                        />
                      )}
                    </Collapse>
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2,
              mt: 2,
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
      </Container>
    </>
  );
}
