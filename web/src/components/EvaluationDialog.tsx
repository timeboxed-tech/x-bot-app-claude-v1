import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  useEvaluatePost,
  usePostEvaluations,
  type EvalMessage,
  type PostEvaluation,
} from '../hooks/useEvaluation';

type EvaluationDialogProps = {
  open: boolean;
  onClose: () => void;
  postId: string;
  postContent: string;
};

export default function EvaluationDialog({
  open,
  onClose,
  postId,
  postContent,
}: EvaluationDialogProps) {
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [currentEvalId, setCurrentEvalId] = useState<string | undefined>(undefined);
  const [currentMessages, setCurrentMessages] = useState<EvalMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const evaluatePost = useEvaluatePost();
  const { data: evaluations } = usePostEvaluations(postId);

  const hasPreviousEvaluations = evaluations && evaluations.length > 0;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMessages]);

  useEffect(() => {
    if (!open) {
      setMessage('');
      setActiveTab(0);
      setCurrentEvalId(undefined);
      setCurrentMessages([]);
    }
  }, [open]);

  const handleSend = () => {
    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage('');

    evaluatePost.mutate(
      {
        postId,
        message: userMessage,
        evaluationId: currentEvalId,
      },
      {
        onSuccess: (data) => {
          setCurrentEvalId(data.evaluationId);
          setCurrentMessages(data.messages);
        },
      },
    );
  };

  const truncatedContent =
    postContent.length > 200 ? postContent.substring(0, 200) + '...' : postContent;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Evaluate Post</DialogTitle>
      <DialogContent>
        {hasPreviousEvaluations && (
          <Tabs
            value={activeTab}
            onChange={(_e, v: number) => setActiveTab(v)}
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="New Evaluation" />
            <Tab label={`Previous (${evaluations.length})`} />
          </Tabs>
        )}

        {activeTab === 0 && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Post content: {truncatedContent}
            </Typography>

            {currentMessages.length > 0 && (
              <Box
                sx={{
                  maxHeight: 350,
                  overflowY: 'auto',
                  mb: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                }}
              >
                {currentMessages.map((msg, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      mb: 1,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: msg.role === 'user' ? 'action.hover' : 'primary.50',
                      ml: msg.role === 'user' ? 4 : 0,
                      mr: msg.role === 'assistant' ? 4 : 0,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      {msg.role === 'user' ? 'You' : 'AI Evaluator'}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
                      {msg.content}
                    </Typography>
                  </Box>
                ))}
                <div ref={messagesEndRef} />
              </Box>
            )}

            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Your feedback or question"
              placeholder="e.g., Is this post engaging enough? How can I improve the hook?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={evaluatePost.isPending}
              sx={{ mt: 1 }}
            />
          </>
        )}

        {activeTab === 1 && hasPreviousEvaluations && (
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {evaluations.map((evaluation: PostEvaluation) => (
              <Box
                key={evaluation.id}
                sx={{
                  mb: 2,
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                  {new Date(evaluation.createdAt).toLocaleString()}
                </Typography>
                {evaluation.messages.map((msg, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      mb: 0.5,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: msg.role === 'user' ? 'action.hover' : 'primary.50',
                      ml: msg.role === 'user' ? 3 : 0,
                      mr: msg.role === 'assistant' ? 3 : 0,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      {msg.role === 'user' ? 'You' : 'AI Evaluator'}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
                      {msg.content}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={evaluatePost.isPending}>
          Close
        </Button>
        {activeTab === 0 && (
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={!message.trim() || evaluatePost.isPending}
          >
            {evaluatePost.isPending ? <CircularProgress size={20} /> : 'Send'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
