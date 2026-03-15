import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
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
  useToggleBotStyle,
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
  const toggleStyle = useToggleBotStyle();
  const [newStyleContent, setNewStyleContent] = useState('');
  const [editingStyles, setEditingStyles] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState(0);

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

  const styleCount = styles?.length ?? 0;
  const canAddStyle = styleCount < 5;
  // The "add new" tab is at index === styleCount (after all style tabs)
  const isAddTab = activeTab === styleCount;

  function getTabLabel(style: { content: string; active: boolean }, index: number) {
    const prefix = `Style ${index + 1}`;
    const preview = style.content.length > 20 ? style.content.slice(0, 20) + '...' : style.content;
    const label = preview || prefix;
    return style.active ? label : `(off) ${label}`;
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
            Style Prompts ({styleCount}/5)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add style prompts to vary how posts are generated. A random active style will be applied
            to each new post.
          </Typography>

          {stylesLoading ? (
            <CircularProgress size={24} />
          ) : (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Tabs
                value={activeTab}
                onChange={(_e, newValue: number) => setActiveTab(newValue)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {styles?.map((style, index) => (
                  <Tab
                    key={style.id}
                    label={getTabLabel(style, index)}
                    sx={{
                      opacity: style.active ? 1 : 0.5,
                      textTransform: 'none',
                    }}
                  />
                ))}
                {canAddStyle && (
                  <Tab
                    icon={<AddIcon />}
                    iconPosition="start"
                    label="Add"
                    sx={{ textTransform: 'none' }}
                  />
                )}
              </Tabs>

              <Box sx={{ p: 2 }}>
                {styles?.map((style, index) => {
                  if (index !== activeTab) return null;
                  const isEditing = editingStyles[style.id] !== undefined;
                  return (
                    <Box key={style.id}>
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
                        sx={{ mb: 2 }}
                      />
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <FormControlLabel
                          control={
                            <Switch
                              checked={style.active}
                              onChange={(e) =>
                                toggleStyle.mutate({
                                  botId: bot.id,
                                  styleId: style.id,
                                  active: e.target.checked,
                                })
                              }
                              disabled={toggleStyle.isPending}
                            />
                          }
                          label={style.active ? 'Active' : 'Inactive'}
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {isEditing && (
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<SaveIcon />}
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
                              Save
                            </Button>
                          )}
                          <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => {
                              deleteStyle.mutate(
                                { botId: bot.id, styleId: style.id },
                                {
                                  onSuccess: () => {
                                    setActiveTab((prev) => Math.max(0, prev - 1));
                                  },
                                },
                              );
                            }}
                            disabled={deleteStyle.isPending}
                          >
                            Delete
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}

                {canAddStyle && isAddTab && (
                  <Box>
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      size="small"
                      placeholder="e.g., Write in a witty, sarcastic tone with pop culture references"
                      value={newStyleContent}
                      onChange={(e) => setNewStyleContent(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        if (newStyleContent.trim()) {
                          createStyle.mutate(
                            { botId: bot.id, content: newStyleContent.trim() },
                            {
                              onSuccess: () => {
                                setNewStyleContent('');
                                setActiveTab(styleCount);
                              },
                            },
                          );
                        }
                      }}
                      disabled={!newStyleContent.trim() || createStyle.isPending}
                    >
                      Add Style
                    </Button>
                  </Box>
                )}

                {styleCount === 0 && !canAddStyle && (
                  <Typography variant="body2" color="text.secondary">
                    No styles configured.
                  </Typography>
                )}

                {styleCount === 0 && canAddStyle && !isAddTab && (
                  <Typography variant="body2" color="text.secondary">
                    No styles yet. Click the + tab to add one.
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Container>
    </>
  );
}
