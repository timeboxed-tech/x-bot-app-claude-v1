import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import AppHeader from '../components/AppHeader';
import BotSetupForm from '../components/BotSetupForm';
import { useBot, useUpdateBot } from '../hooks/useBot';
import {
  useBotStyles,
  useCreateBotStyle,
  useUpdateBotStyle,
  useDeleteBotStyle,
} from '../hooks/useBotStyles';
import { useNavigate, useParams } from '@tanstack/react-router';

export default function BotEditPage() {
  const { botId } = useParams({ strict: false }) as { botId: string };
  const { bots, isLoading } = useBot();
  const updateBot = useUpdateBot();
  const navigate = useNavigate();
  const { data: styles, isLoading: stylesLoading } = useBotStyles(botId);
  const createStyle = useCreateBotStyle();
  const updateStyle = useUpdateBotStyle();
  const deleteStyle = useDeleteBotStyle();
  const [newStyleContent, setNewStyleContent] = useState('');
  const [editingStyles, setEditingStyles] = useState<Record<string, string>>({});

  const bot = bots.find((b) => b.id === botId);

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
          <Typography variant="h5">Bot not found</Typography>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => void navigate({ to: '/dashboard' })}
            sx={{ mt: 2 }}
          >
            Back to Dashboard
          </Button>
        </Container>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => void navigate({ to: '/dashboard' })}
          sx={{ mb: 3 }}
        >
          Back to Dashboard
        </Button>

        <Typography variant="h4" gutterBottom>
          Edit @{bot.xAccountHandle || 'Bot'}
        </Typography>

        <Box sx={{ mt: 3 }}>
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
                  onSuccess: () => {
                    void navigate({ to: '/dashboard' });
                  },
                },
              );
            }}
            isLoading={updateBot.isPending}
            submitLabel="Update"
          />
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Style Prompts ({styles?.length ?? 0}/5)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add style prompts to vary how posts are generated. A random style will be applied to
            each new post.
          </Typography>

          {stylesLoading ? (
            <CircularProgress size={24} />
          ) : (
            <>
              {styles?.map((style) => {
                const isEditing = editingStyles[style.id] !== undefined;
                return (
                  <Box key={style.id} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'start' }}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      size="small"
                      value={isEditing ? editingStyles[style.id] : style.content}
                      onChange={(e) =>
                        setEditingStyles((prev) => ({ ...prev, [style.id]: e.target.value }))
                      }
                      onFocus={() => {
                        if (!isEditing) {
                          setEditingStyles((prev) => ({ ...prev, [style.id]: style.content }));
                        }
                      }}
                    />
                    {isEditing && (
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => {
                          const content = editingStyles[style.id];
                          if (content && content.trim()) {
                            updateStyle.mutate(
                              { botId: bot.id, styleId: style.id, content: content.trim() },
                              {
                                onSuccess: () => {
                                  setEditingStyles((prev) => {
                                    const next = { ...prev };
                                    delete next[style.id];
                                    return next;
                                  });
                                },
                              },
                            );
                          }
                        }}
                        disabled={updateStyle.isPending}
                      >
                        <SaveIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => deleteStyle.mutate({ botId: bot.id, styleId: style.id })}
                      disabled={deleteStyle.isPending}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                );
              })}

              {(styles?.length ?? 0) < 5 && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    size="small"
                    placeholder="e.g., Write in a witty, sarcastic tone with pop culture references"
                    value={newStyleContent}
                    onChange={(e) => setNewStyleContent(e.target.value)}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      if (newStyleContent.trim()) {
                        createStyle.mutate(
                          { botId: bot.id, content: newStyleContent.trim() },
                          {
                            onSuccess: () => setNewStyleContent(''),
                          },
                        );
                      }
                    }}
                    disabled={!newStyleContent.trim() || createStyle.isPending}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Add
                  </Button>
                </Box>
              )}
            </>
          )}
        </Box>
      </Container>
    </>
  );
}
