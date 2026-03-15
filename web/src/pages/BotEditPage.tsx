import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import AppHeader from '../components/AppHeader';
import BotSetupForm from '../components/BotSetupForm';
import { useBot, useUpdateBot } from '../hooks/useBot';
import {
  useBotBehaviours,
  useCreateBotBehaviour,
  useUpdateBotBehaviour,
  useDeleteBotBehaviour,
  useToggleBotBehaviour,
} from '../hooks/useBotBehaviours';
import { useNavigate, useParams } from '@tanstack/react-router';

export default function BotEditPage() {
  const { botId } = useParams({ strict: false }) as { botId: string };
  const { bots, isLoading } = useBot();
  const updateBot = useUpdateBot();
  const navigate = useNavigate();
  const { data: behaviours, isLoading: behavioursLoading } = useBotBehaviours(botId);
  const createBehaviour = useCreateBotBehaviour();
  const updateBehaviour = useUpdateBotBehaviour();
  const deleteBehaviour = useDeleteBotBehaviour();
  const toggleBehaviour = useToggleBotBehaviour();
  const [newBehaviourContent, setNewBehaviourContent] = useState('');
  const [newBehaviourTitle, setNewBehaviourTitle] = useState('');
  const [editingBehaviours, setEditingBehaviours] = useState<Record<string, string>>({});
  const [editingTitles, setEditingTitles] = useState<Record<string, string>>({});
  const [editingKnowledgeSources, setEditingKnowledgeSources] = useState<Record<string, string>>(
    {},
  );
  const [editingWeights, setEditingWeights] = useState<Record<string, number>>({});
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

  const behaviourCount = behaviours?.length ?? 0;
  const canAddBehaviour = behaviourCount < 5;
  // The "add new" tab is at index === behaviourCount (after all behaviour tabs)
  const isAddTab = activeTab === behaviourCount;

  const activeBehaviours = behaviours?.filter((b) => b.active) ?? [];
  const totalWeight = activeBehaviours.reduce((sum, b) => {
    const editedWeight = editingWeights[b.id];
    return sum + (editedWeight !== undefined ? editedWeight : b.weight);
  }, 0);

  function distributeEqually() {
    if (activeBehaviours.length === 0) return;
    const equalWeight = Math.floor(100 / activeBehaviours.length);
    const remainder = 100 - equalWeight * activeBehaviours.length;
    const newWeights: Record<string, number> = {};
    activeBehaviours.forEach((b, i) => {
      newWeights[b.id] = equalWeight + (i < remainder ? 1 : 0);
    });
    setEditingWeights((prev) => ({ ...prev, ...newWeights }));
  }

  function getTabLabel(
    behaviour: { title: string; content: string; active: boolean; weight: number },
    index: number,
  ) {
    const prefix = `Behaviour ${index + 1}`;
    const label =
      behaviour.title ||
      (behaviour.content.length > 20
        ? behaviour.content.slice(0, 20) + '...'
        : behaviour.content) ||
      prefix;
    const weight =
      editingWeights[behaviours?.[index]?.id ?? ''] !== undefined
        ? editingWeights[behaviours![index].id]
        : behaviour.weight;
    const weightSuffix = behaviour.active ? ` (${weight}%)` : '';
    return behaviour.active ? `${label}${weightSuffix}` : `(off) ${label}`;
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
              knowledgeSource: (bot.knowledgeSource as 'ai' | 'ai+web') ?? 'ai',
              judgeKnowledgeSource: (bot.judgeKnowledgeSource as 'ai' | 'ai+web') ?? 'ai',
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
            Behaviours ({behaviourCount}/5)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add behaviours to vary how posts are generated. Active behaviours are selected using
            weighted random distribution.
          </Typography>

          {behavioursLoading ? (
            <CircularProgress size={24} />
          ) : (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
              {activeBehaviours.length > 0 && (
                <Box
                  sx={{
                    px: 2,
                    pt: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: totalWeight === 100 ? 'success.main' : 'error.main',
                      fontWeight: 'bold',
                    }}
                  >
                    Total weight: {totalWeight}%{totalWeight !== 100 ? ' (should be 100%)' : ''}
                  </Typography>
                  <Button size="small" variant="outlined" onClick={distributeEqually}>
                    Distribute Equally
                  </Button>
                </Box>
              )}

              <Tabs
                value={activeTab}
                onChange={(_e, newValue: number) => setActiveTab(newValue)}
                variant="fullWidth"
              >
                {behaviours?.map((behaviour, index) => (
                  <Tab
                    key={behaviour.id}
                    label={
                      <Tooltip title={getTabLabel(behaviour, index)} enterDelay={400}>
                        <span
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {getTabLabel(behaviour, index)}
                        </span>
                      </Tooltip>
                    }
                    sx={{
                      minWidth: 0,
                      opacity: behaviour.active ? 1 : 0.5,
                      textTransform: 'none',
                    }}
                  />
                ))}
                {canAddBehaviour && (
                  <Tab
                    icon={<AddIcon />}
                    iconPosition="start"
                    label="Add"
                    sx={{ textTransform: 'none' }}
                  />
                )}
              </Tabs>

              <Box sx={{ p: 2 }}>
                {behaviours?.map((behaviour, index) => {
                  if (index !== activeTab) return null;
                  const isEditing =
                    editingBehaviours[behaviour.id] !== undefined ||
                    editingTitles[behaviour.id] !== undefined ||
                    editingKnowledgeSources[behaviour.id] !== undefined ||
                    editingWeights[behaviour.id] !== undefined;
                  return (
                    <Box key={behaviour.id}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Title"
                        placeholder="e.g., Witty & Sarcastic"
                        value={
                          editingTitles[behaviour.id] !== undefined
                            ? editingTitles[behaviour.id]
                            : behaviour.title
                        }
                        onChange={(e) =>
                          setEditingTitles((prev) => ({
                            ...prev,
                            [behaviour.id]: e.target.value,
                          }))
                        }
                        onFocus={() => {
                          if (editingTitles[behaviour.id] === undefined) {
                            setEditingTitles((prev) => ({
                              ...prev,
                              [behaviour.id]: behaviour.title,
                            }));
                          }
                        }}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        size="small"
                        label="Prompt"
                        value={
                          editingBehaviours[behaviour.id] !== undefined
                            ? editingBehaviours[behaviour.id]
                            : behaviour.content
                        }
                        onChange={(e) =>
                          setEditingBehaviours((prev) => ({
                            ...prev,
                            [behaviour.id]: e.target.value,
                          }))
                        }
                        onFocus={() => {
                          if (editingBehaviours[behaviour.id] === undefined) {
                            setEditingBehaviours((prev) => ({
                              ...prev,
                              [behaviour.id]: behaviour.content,
                            }));
                          }
                        }}
                        sx={{ mb: 2 }}
                      />
                      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>Knowledge Source</InputLabel>
                        <Select
                          value={
                            editingKnowledgeSources[behaviour.id] !== undefined
                              ? editingKnowledgeSources[behaviour.id]
                              : behaviour.knowledgeSource
                          }
                          label="Knowledge Source"
                          onChange={(e) =>
                            setEditingKnowledgeSources((prev) => ({
                              ...prev,
                              [behaviour.id]: e.target.value,
                            }))
                          }
                        >
                          <MenuItem value="default">Use Bot Default</MenuItem>
                          <MenuItem value="ai">AI Only</MenuItem>
                          <MenuItem value="ai+web">AI + Web Search</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Weight (%)"
                        InputProps={{
                          inputProps: { min: 0, max: 100 },
                        }}
                        value={
                          editingWeights[behaviour.id] !== undefined
                            ? editingWeights[behaviour.id]
                            : behaviour.weight
                        }
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 0 && val <= 100) {
                            setEditingWeights((prev) => ({
                              ...prev,
                              [behaviour.id]: val,
                            }));
                          }
                        }}
                        disabled={!behaviour.active}
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
                              checked={behaviour.active}
                              onChange={(e) =>
                                toggleBehaviour.mutate({
                                  botId: bot.id,
                                  behaviourId: behaviour.id,
                                  active: e.target.checked,
                                })
                              }
                              disabled={toggleBehaviour.isPending}
                            />
                          }
                          label={behaviour.active ? 'Active' : 'Inactive'}
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {isEditing && (
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<SaveIcon />}
                              onClick={() => {
                                const content =
                                  editingBehaviours[behaviour.id] ?? behaviour.content;
                                const title = editingTitles[behaviour.id] ?? behaviour.title;
                                const ks =
                                  editingKnowledgeSources[behaviour.id] ??
                                  behaviour.knowledgeSource;
                                const weight = editingWeights[behaviour.id] ?? behaviour.weight;
                                if (content && content.trim()) {
                                  updateBehaviour.mutate(
                                    {
                                      botId: bot.id,
                                      behaviourId: behaviour.id,
                                      content: content.trim(),
                                      title: title?.trim(),
                                      knowledgeSource: ks,
                                      weight,
                                    },
                                    {
                                      onSuccess: () => {
                                        setEditingBehaviours((prev) => {
                                          const next = { ...prev };
                                          delete next[behaviour.id];
                                          return next;
                                        });
                                        setEditingTitles((prev) => {
                                          const next = { ...prev };
                                          delete next[behaviour.id];
                                          return next;
                                        });
                                        setEditingKnowledgeSources((prev) => {
                                          const next = { ...prev };
                                          delete next[behaviour.id];
                                          return next;
                                        });
                                        setEditingWeights((prev) => {
                                          const next = { ...prev };
                                          delete next[behaviour.id];
                                          return next;
                                        });
                                      },
                                    },
                                  );
                                }
                              }}
                              disabled={updateBehaviour.isPending}
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
                              deleteBehaviour.mutate(
                                { botId: bot.id, behaviourId: behaviour.id },
                                {
                                  onSuccess: () => {
                                    setActiveTab((prev) => Math.max(0, prev - 1));
                                  },
                                },
                              );
                            }}
                            disabled={deleteBehaviour.isPending}
                          >
                            Delete
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}

                {canAddBehaviour && isAddTab && (
                  <Box>
                    <TextField
                      fullWidth
                      size="small"
                      label="Title"
                      placeholder="e.g., Witty & Sarcastic"
                      value={newBehaviourTitle}
                      onChange={(e) => setNewBehaviourTitle(e.target.value)}
                      sx={{ mb: 1 }}
                    />
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      size="small"
                      label="Prompt"
                      placeholder="e.g., Write in a witty, sarcastic tone with pop culture references"
                      value={newBehaviourContent}
                      onChange={(e) => setNewBehaviourContent(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        if (newBehaviourContent.trim()) {
                          // Auto-distribute weights equally when adding a new behaviour
                          const newCount = activeBehaviours.length + 1;
                          const equalWeight = Math.floor(100 / newCount);
                          createBehaviour.mutate(
                            {
                              botId: bot.id,
                              content: newBehaviourContent.trim(),
                              title: newBehaviourTitle.trim() || undefined,
                              weight: equalWeight,
                            },
                            {
                              onSuccess: () => {
                                setNewBehaviourContent('');
                                setNewBehaviourTitle('');
                                setActiveTab(behaviourCount);
                              },
                            },
                          );
                        }
                      }}
                      disabled={!newBehaviourContent.trim() || createBehaviour.isPending}
                    >
                      Add Behaviour
                    </Button>
                  </Box>
                )}

                {behaviourCount === 0 && !canAddBehaviour && (
                  <Typography variant="body2" color="text.secondary">
                    No behaviours configured.
                  </Typography>
                )}

                {behaviourCount === 0 && canAddBehaviour && !isAddTab && (
                  <Typography variant="body2" color="text.secondary">
                    No behaviours yet. Click the + tab to add one.
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
