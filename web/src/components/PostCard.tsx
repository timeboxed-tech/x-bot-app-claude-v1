import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Rating from '@mui/material/Rating';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileCopyOutlinedIcon from '@mui/icons-material/FileCopyOutlined';
import CheckIcon from '@mui/icons-material/Check';
import FlagIcon from '@mui/icons-material/Flag';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';
import type { Post, PostStatus } from '../hooks/usePosts';
import { useUpdatePost, useTweakPost, useAcceptTweak, useDeletePost } from '../hooks/usePosts';
import {
  usePostReviews,
  useRequestReview,
  useDeleteReview,
  type PostReview,
} from '../hooks/useJudges';

const statusColors: Record<PostStatus, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  draft: 'default',
  approved: 'warning',
  scheduled: 'info',
  published: 'success',
  discarded: 'error',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString();
}

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function PromptTooltipContent({ generationPrompt }: { generationPrompt: string }) {
  try {
    const messages = JSON.parse(generationPrompt) as Array<{ role: string; content: string }>;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {messages.map((msg, idx) => (
          <Box key={idx}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 'bold', textTransform: 'uppercase', color: 'inherit' }}
            >
              {msg.role}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'inherit' }}>
              {msg.content}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  } catch {
    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'inherit' }}>
        {generationPrompt}
      </Typography>
    );
  }
}

type PostCardProps = {
  post: Post;
};

export default function PostCard({ post }: PostCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [tweakOpen, setTweakOpen] = useState(false);
  const [tweakFeedback, setTweakFeedback] = useState('');
  const [tweakCurrent, setTweakCurrent] = useState(post.content);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [contentCopied, setContentCopied] = useState(false);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const updatePost = useUpdatePost();
  const tweakPost = useTweakPost();
  const acceptTweak = useAcceptTweak();
  const { data: reviews } = usePostReviews(post.id);
  const requestReview = useRequestReview();
  const deleteReview = useDeleteReview();
  const deletePost = useDeletePost();
  const [showReviews, setShowReviews] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);

  const handleSave = () => {
    updatePost.mutate(
      { id: post.id, content: editContent },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  };

  const handleCancel = () => {
    setEditContent(post.content);
    setIsEditing(false);
  };

  const handleSchedule = () => {
    updatePost.mutate({ id: post.id, status: 'scheduled' });
  };

  const handleApprove = () => {
    updatePost.mutate({ id: post.id, status: 'approved' });
  };

  const handleBackToDraft = () => {
    updatePost.mutate({ id: post.id, status: 'draft' });
  };

  const handleDiscard = () => {
    updatePost.mutate({ id: post.id, status: 'discarded' });
  };

  const handleRatingChange = (_event: React.SyntheticEvent, value: number | null) => {
    updatePost.mutate({ id: post.id, rating: value });
  };

  const handleToggleFlag = () => {
    updatePost.mutate({ id: post.id, flagged: !post.flagged });
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(post.content).then(() => {
      setContentCopied(true);
      setTimeout(() => setContentCopied(false), 1500);
    });
  };

  const handleCopyPrompt = () => {
    if (!post.generationPrompt) return;
    navigator.clipboard.writeText(post.generationPrompt).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1500);
    });
  };

  const handleOpenTweak = () => {
    setTweakCurrent(post.content);
    setConversation([]);
    setTweakFeedback('');
    setSuccessMessage('');
    setTweakOpen(true);
  };

  const handleCloseTweak = () => {
    setTweakOpen(false);
    setTweakFeedback('');
    setConversation([]);
    setSuccessMessage('');
  };

  const handleTweak = () => {
    if (!tweakFeedback.trim()) return;

    const feedbackText = tweakFeedback.trim();
    setTweakFeedback('');

    // Build messages for the API — include the initial tweet context on first message
    const apiMessages: ConversationMessage[] =
      conversation.length === 0
        ? [{ role: 'user', content: `Current tweet:\n${post.content}` }]
        : [...conversation];

    tweakPost.mutate(
      {
        postId: post.id,
        feedback: feedbackText,
        previousMessages: apiMessages,
      },
      {
        onSuccess: (data) => {
          setTweakCurrent(data.content);
          // Store the full AI response (message + tweet) for conversation continuity
          const aiResponse = data.message
            ? `${data.message}\n\n---TWEET---\n${data.content}`
            : data.content;
          setConversation((prev) => {
            const base =
              prev.length === 0
                ? [{ role: 'user' as const, content: `Current tweet:\n${post.content}` }]
                : prev;
            return [
              ...base,
              { role: 'user' as const, content: feedbackText },
              { role: 'assistant' as const, content: aiResponse },
            ];
          });
        },
      },
    );
  };

  const handleAcceptTweak = () => {
    acceptTweak.mutate(
      {
        postId: post.id,
        content: tweakCurrent,
        conversation,
      },
      {
        onSuccess: (data) => {
          if (data.newTips.length > 0) {
            const tipTexts = data.newTips.map((t) => t.content).join(', ');
            setSuccessMessage(`Post updated! New tips saved: ${tipTexts}`);
          } else {
            setSuccessMessage('Post updated successfully!');
          }
          // Close after short delay so user can see the message
          setTimeout(() => {
            handleCloseTweak();
          }, 2000);
        },
      },
    );
  };

  const ratingEnabled =
    post.status === 'draft' ||
    post.status === 'approved' ||
    post.status === 'scheduled' ||
    post.status === 'published';

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip label={post.status} color={statusColors[post.status]} size="small" />
            <Tooltip
              title={
                post.flagged
                  ? post.flagReasons.length > 0
                    ? `${post.flagReasons.join('\n')}\n\nClick to unflag`
                    : 'Click to unflag'
                  : 'Click to flag'
              }
            >
              <IconButton
                size="small"
                onClick={handleToggleFlag}
                disabled={updatePost.isPending || post.status === 'published'}
                color={post.flagged ? 'warning' : 'default'}
                sx={{ p: 0.25 }}
              >
                {post.flagged ? (
                  <FlagIcon fontSize="small" />
                ) : (
                  <OutlinedFlagIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {formatDate(post.createdAt)}
          </Typography>
        </Box>

        {isEditing ? (
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
                onClick={handleSave}
                disabled={updatePost.isPending}
              >
                Save
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleCancel}
                disabled={updatePost.isPending}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ position: 'relative', mb: 2 }}>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', pr: 4 }}>
              {post.content}
            </Typography>
            <Tooltip title={contentCopied ? 'Copied!' : 'Copy post'}>
              <IconButton
                size="small"
                onClick={handleCopyContent}
                sx={{ position: 'absolute', top: -4, right: -4, p: 0.25 }}
                color={contentCopied ? 'success' : 'default'}
              >
                {contentCopied ? (
                  <CheckIcon fontSize="small" />
                ) : (
                  <FileCopyOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          {(post.behaviourTitle || post.behaviourPrompt) && (
            <Tooltip
              title={
                post.generationPrompt ? (
                  <PromptTooltipContent generationPrompt={post.generationPrompt} />
                ) : (
                  ''
                )
              }
              arrow
              slotProps={{
                tooltip: {
                  sx: { maxWidth: 500, maxHeight: 400, overflow: 'auto' },
                },
              }}
            >
              <Chip
                label={`Behaviour: ${post.behaviourTitle || post.behaviourPrompt}`}
                size="small"
                variant="outlined"
                sx={{
                  mb: 1,
                  maxWidth: '100%',
                  cursor: post.generationPrompt ? 'pointer' : 'default',
                }}
              />
            </Tooltip>
          )}
          {!post.behaviourTitle && !post.behaviourPrompt && post.generationPrompt && (
            <Tooltip
              title={<PromptTooltipContent generationPrompt={post.generationPrompt} />}
              arrow
              slotProps={{
                tooltip: {
                  sx: { maxWidth: 500, maxHeight: 400, overflow: 'auto' },
                },
              }}
            >
              <Chip
                label="Prompt"
                size="small"
                variant="outlined"
                sx={{ mb: 1, cursor: 'pointer' }}
              />
            </Tooltip>
          )}
          {post.generationPrompt && (
            <Tooltip title={promptCopied ? 'Copied!' : 'Copy prompt'}>
              <IconButton
                size="small"
                onClick={handleCopyPrompt}
                sx={{ mb: 1, p: 0.25 }}
                color={promptCopied ? 'success' : 'default'}
              >
                {promptCopied ? (
                  <CheckIcon fontSize="small" />
                ) : (
                  <ContentCopyIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {post.scheduledAt && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Scheduled: {formatDate(post.scheduledAt)}
          </Typography>
        )}
        {post.publishedAt && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Published: {formatDate(post.publishedAt)}
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Rating
            value={post.rating}
            onChange={handleRatingChange}
            disabled={!ratingEnabled || updatePost.isPending}
            size="small"
          />

          <Box sx={{ display: 'flex', gap: 1 }}>
            {post.status === 'draft' && !isEditing && (
              <>
                <Button size="small" variant="outlined" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
                <Button size="small" variant="outlined" onClick={handleOpenTweak}>
                  Tweak
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    requestReview.mutate(post.id, {
                      onSuccess: () => setShowReviews(true),
                    });
                  }}
                  disabled={requestReview.isPending}
                >
                  {requestReview.isPending ? <CircularProgress size={16} /> : 'Ask Judges'}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  onClick={handleApprove}
                  disabled={updatePost.isPending}
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSchedule}
                  disabled={updatePost.isPending}
                >
                  Schedule
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={handleDiscard}
                  disabled={updatePost.isPending}
                >
                  Discard
                </Button>
              </>
            )}
            {post.status === 'approved' && (
              <>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSchedule}
                  disabled={updatePost.isPending}
                >
                  Schedule
                </Button>
                <Button
                  size="small"
                  color="warning"
                  variant="outlined"
                  onClick={handleBackToDraft}
                  disabled={updatePost.isPending}
                >
                  Back to Draft
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={handleDiscard}
                  disabled={updatePost.isPending}
                >
                  Discard
                </Button>
              </>
            )}
            {post.status === 'scheduled' && (
              <Button
                size="small"
                color="error"
                onClick={handleDiscard}
                disabled={updatePost.isPending}
              >
                Discard
              </Button>
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
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={deletePost.isPending}
                >
                  {deletePost.isPending ? <CircularProgress size={16} /> : 'Delete'}
                </Button>
              </>
            )}
          </Box>
        </Box>
      </CardContent>

      {/* Reviews Section */}
      {reviews && reviews.length > 0 && (
        <CardContent sx={{ pt: 0 }}>
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
                    bgcolor: 'action.hover',
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
                        onClick={() =>
                          deleteReview.mutate({ postId: post.id, reviewId: review.id })
                        }
                        disabled={deleteReview.isPending}
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
        </CardContent>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Post</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to permanently delete this post?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deletePost.isPending}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              deletePost.mutate(post.id, {
                onSuccess: () => setDeleteConfirmOpen(false),
              });
            }}
            disabled={deletePost.isPending}
          >
            {deletePost.isPending ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tweak Dialog */}
      <Dialog open={tweakOpen} onClose={handleCloseTweak} maxWidth="sm" fullWidth>
        <DialogTitle>Tweak Post</DialogTitle>
        <DialogContent>
          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMessage}
            </Alert>
          )}

          <Typography variant="subtitle2" sx={{ mb: 1, mt: 1 }}>
            Current version:
          </Typography>
          <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {tweakCurrent}
            </Typography>
          </Card>

          {conversation.length > 1 && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Conversation:
              </Typography>
              <Box
                sx={{
                  maxHeight: 300,
                  overflowY: 'auto',
                  mb: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                }}
              >
                {conversation.slice(1).map((msg, idx) => {
                  // For AI messages, strip the ---TWEET--- portion for display
                  let displayContent = msg.content;
                  if (msg.role === 'assistant') {
                    const markerIdx = msg.content.indexOf('---TWEET---');
                    if (markerIdx !== -1) {
                      displayContent = msg.content.substring(0, markerIdx).trim();
                    }
                  }
                  if (!displayContent) return null;
                  return (
                    <Box
                      key={idx}
                      sx={{
                        mb: 1,
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: msg.role === 'user' ? 'action.hover' : 'primary.50',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" fontWeight="bold">
                        {msg.role === 'user' ? 'You' : 'AI'}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
                        {displayContent}
                      </Typography>
                    </Box>
                  );
                })}
                <div ref={conversationEndRef} />
              </Box>
            </>
          )}

          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Your message"
            placeholder="e.g., make it more casual, add a question at the end..."
            value={tweakFeedback}
            onChange={(e) => setTweakFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTweak();
              }
            }}
            disabled={tweakPost.isPending || acceptTweak.isPending}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseTweak}
            disabled={tweakPost.isPending || acceptTweak.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            onClick={handleTweak}
            disabled={!tweakFeedback.trim() || tweakPost.isPending || acceptTweak.isPending}
          >
            {tweakPost.isPending ? <CircularProgress size={20} /> : 'Send'}
          </Button>
          <Button
            variant="contained"
            onClick={handleAcceptTweak}
            disabled={conversation.length === 0 || acceptTweak.isPending || tweakPost.isPending}
          >
            {acceptTweak.isPending ? <CircularProgress size={20} /> : 'Accept'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
