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
import type { Post, PostStatus } from '../hooks/usePosts';
import { useUpdatePost, useTweakPost, useAcceptTweak } from '../hooks/usePosts';

const statusColors: Record<PostStatus, 'default' | 'info' | 'success' | 'error'> = {
  draft: 'default',
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
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const updatePost = useUpdatePost();
  const tweakPost = useTweakPost();
  const acceptTweak = useAcceptTweak();

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

  const handleDiscard = () => {
    updatePost.mutate({ id: post.id, status: 'discarded' });
  };

  const handleRatingChange = (_event: React.SyntheticEvent, value: number | null) => {
    updatePost.mutate({ id: post.id, rating: value });
  };

  const handleOpenTweak = () => {
    setTweakCurrent(post.content);
    setConversation([{ role: 'user', content: `Current tweet:\n${post.content}` }]);
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

    tweakPost.mutate(
      {
        postId: post.id,
        feedback: feedbackText,
        previousMessages: conversation.length > 0 ? conversation : undefined,
      },
      {
        onSuccess: (data) => {
          setTweakCurrent(data.content);
          setConversation((prev) => [
            ...prev,
            { role: 'user' as const, content: `Feedback: ${feedbackText}` },
            { role: 'assistant' as const, content: data.content },
          ]);
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
    post.status === 'draft' || post.status === 'scheduled' || post.status === 'published';

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}
        >
          <Chip label={post.status} color={statusColors[post.status]} size="small" />
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
          <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
            {post.content}
          </Typography>
        )}

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
          </Box>
        </Box>
      </CardContent>

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
                  maxHeight: 200,
                  overflowY: 'auto',
                  mb: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                }}
              >
                {conversation.slice(1).map((msg, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      mb: 1,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: msg.role === 'user' ? 'action.hover' : 'primary.50',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {msg.role === 'user' ? 'You' : 'AI'}:
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </Typography>
                  </Box>
                ))}
                <div ref={conversationEndRef} />
              </Box>
            </>
          )}

          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Feedback"
            placeholder="e.g., make it more casual, add a question at the end"
            value={tweakFeedback}
            onChange={(e) => setTweakFeedback(e.target.value)}
            disabled={tweakPost.isPending || acceptTweak.isPending}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTweak} disabled={tweakPost.isPending || acceptTweak.isPending}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            onClick={handleTweak}
            disabled={!tweakFeedback.trim() || tweakPost.isPending || acceptTweak.isPending}
          >
            {tweakPost.isPending ? <CircularProgress size={20} /> : 'Tweak'}
          </Button>
          <Button
            variant="contained"
            onClick={handleAcceptTweak}
            disabled={conversation.length <= 1 || acceptTweak.isPending || tweakPost.isPending}
          >
            {acceptTweak.isPending ? <CircularProgress size={20} /> : 'Accept'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
