import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Rating from '@mui/material/Rating';
import type { Post, PostStatus } from '../hooks/usePosts';
import { useUpdatePost } from '../hooks/usePosts';

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

type PostCardProps = {
  post: Post;
};

export default function PostCard({ post }: PostCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const updatePost = useUpdatePost();

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
    </Card>
  );
}
