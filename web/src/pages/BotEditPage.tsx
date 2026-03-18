import { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AppHeader from '../components/AppHeader';
import BotSetupForm from '../components/BotSetupForm';
import { useDashboardVersion } from '../contexts/DashboardVersionContext';
import BotEditBPage from './BotEditBPage';
import { StepCard, type ProcessStep } from '../components/ProcessVisualisationDialog';
import { useBot, useUpdateBot } from '../hooks/useBot';
import { useDeletePost } from '../hooks/usePosts';
import {
  useBotBehaviours,
  useCreateBotBehaviour,
  useUpdateBotBehaviour,
  useDeleteBotBehaviour,
  useToggleBotBehaviour,
  useQuickRunBehaviour,
} from '../hooks/useBotBehaviours';
import { useNavigate, useParams } from '@tanstack/react-router';

export default function BotEditPage() {
  const { version } = useDashboardVersion();
  if (version === 'B') return <BotEditBPage />;
  return <BotEditAPage />;
}

function BotEditAPage() {
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
  const [newBehaviourOutcome, setNewBehaviourOutcome] = useState('write_post');
  const [editingBehaviours, setEditingBehaviours] = useState<Record<string, string>>({});
  const [editingTitles, setEditingTitles] = useState<Record<string, string>>({});
  const [editingKnowledgeSources, setEditingKnowledgeSources] = useState<Record<string, string>>(
    {},
  );
  const [editingWeights, setEditingWeights] = useState<Record<string, number>>({});
  const [editingOutcomes, setEditingOutcomes] = useState<Record<string, string>>({});
  const [editingQueryPrompts, setEditingQueryPrompts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | false>(false);
  const quickRunBehaviour = useQuickRunBehaviour();
  const deletePost = useDeletePost();
  const [quickRunModal, setQuickRunModal] = useState<{
    open: boolean;
    loading: boolean;
    postId: string | null;
    content: string | null;
    metadata: string | null;
    generationPrompt: string | null;
    error: string | null;
    message: string | null;
  }>({
    open: false,
    loading: false,
    postId: null,
    content: null,
    metadata: null,
    generationPrompt: null,
    error: null,
    message: null,
  });

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
  const canAddBehaviour = behaviourCount < 10;

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

  function fillRemaining() {
    if (activeBehaviours.length === 0) return;
    if (totalWeight >= 100) return;
    const gap = 100 - totalWeight;
    const perBehaviour = Math.floor(gap / activeBehaviours.length);
    const remainder = gap - perBehaviour * activeBehaviours.length;
    const newWeights: Record<string, number> = {};
    activeBehaviours.forEach((b, i) => {
      const currentWeight = editingWeights[b.id] !== undefined ? editingWeights[b.id] : b.weight;
      newWeights[b.id] = currentWeight + perBehaviour + (i < remainder ? 1 : 0);
    });
    setEditingWeights((prev) => ({ ...prev, ...newWeights }));
  }

  const handleAccordionChange =
    (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false);
    };

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
              timezone: bot.timezone || 'UTC',
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
            Behaviours ({behaviourCount}/10)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add behaviours to vary how posts are generated. Active behaviours are selected using
            weighted random distribution.
          </Typography>

          {behavioursLoading ? (
            <CircularProgress size={24} />
          ) : (
            <Box>
              {activeBehaviours.length > 0 && (
                <Box
                  sx={{
                    px: 2,
                    py: 2,
                    mb: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
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
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" onClick={distributeEqually}>
                      Distribute Equally
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={fillRemaining}
                      disabled={totalWeight >= 100}
                    >
                      Fill Remaining
                    </Button>
                  </Box>
                </Box>
              )}

              {behaviours?.map((behaviour) => {
                const weight =
                  editingWeights[behaviour.id] !== undefined
                    ? editingWeights[behaviour.id]
                    : behaviour.weight;
                const isEditing =
                  editingBehaviours[behaviour.id] !== undefined ||
                  editingTitles[behaviour.id] !== undefined ||
                  editingKnowledgeSources[behaviour.id] !== undefined ||
                  editingOutcomes[behaviour.id] !== undefined ||
                  editingQueryPrompts[behaviour.id] !== undefined ||
                  editingWeights[behaviour.id] !== undefined;

                return (
                  <Accordion
                    key={behaviour.id}
                    expanded={expanded === behaviour.id}
                    onChange={handleAccordionChange(behaviour.id)}
                    sx={{ opacity: behaviour.active ? 1 : 0.7 }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5 } }}
                    >
                      <Switch
                        size="small"
                        checked={behaviour.active}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          event.stopPropagation();
                          toggleBehaviour.mutate({
                            botId: bot.id,
                            behaviourId: behaviour.id,
                            active: event.target.checked,
                          });
                        }}
                        disabled={toggleBehaviour.isPending}
                      />
                      <Typography sx={{ flexGrow: 1 }}>{behaviour.title || 'Untitled'}</Typography>
                      {behaviour.active && (
                        <Chip
                          label={`${weight}%`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      <Chip
                        label={behaviour.active ? 'Active' : 'Inactive'}
                        size="small"
                        color={behaviour.active ? 'success' : 'default'}
                        variant="outlined"
                      />
                      <Tooltip title="Quick Run: generate a draft using this behaviour">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            setQuickRunModal({
                              open: true,
                              loading: true,
                              postId: null,
                              content: null,
                              metadata: null,
                              generationPrompt: null,
                              error: null,
                              message: null,
                            });
                            quickRunBehaviour.mutate(
                              { botId: bot.id, behaviourId: behaviour.id },
                              {
                                onSuccess: (data) => {
                                  if (!data.post) {
                                    setQuickRunModal({
                                      open: true,
                                      loading: false,
                                      postId: null,
                                      content: null,
                                      metadata: null,
                                      generationPrompt: null,
                                      error: null,
                                      message: data.message ?? 'No post generated',
                                    });
                                    return;
                                  }
                                  setQuickRunModal({
                                    open: true,
                                    loading: false,
                                    postId: data.post.id,
                                    content: data.post.content,
                                    metadata: data.post.metadata ?? null,
                                    generationPrompt: data.post.generationPrompt ?? null,
                                    error: null,
                                    message: null,
                                  });
                                },
                                onError: (err: unknown) => {
                                  const errMessage =
                                    err instanceof Error ? err.message : 'Generation failed';
                                  setQuickRunModal({
                                    open: true,
                                    loading: false,
                                    postId: null,
                                    content: null,
                                    metadata: null,
                                    generationPrompt: null,
                                    error: errMessage,
                                    message: null,
                                  });
                                },
                              },
                            );
                          }}
                          disabled={quickRunBehaviour.isPending}
                        >
                          <PlayArrowIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </AccordionSummary>
                    <AccordionDetails>
                      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>Outcome</InputLabel>
                        <Select
                          value={
                            editingOutcomes[behaviour.id] !== undefined
                              ? editingOutcomes[behaviour.id]
                              : behaviour.outcome
                          }
                          label="Outcome"
                          onChange={(e) =>
                            setEditingOutcomes((prev) => ({
                              ...prev,
                              [behaviour.id]: e.target.value,
                            }))
                          }
                        >
                          <MenuItem value="write_post">Write Post</MenuItem>
                          <MenuItem value="reply_to_post">Reply to Post</MenuItem>
                          <MenuItem value="like_post">Like Post</MenuItem>
                          <MenuItem value="follow_account">Follow Account</MenuItem>
                        </Select>
                      </FormControl>
                      {(editingOutcomes[behaviour.id] !== undefined
                        ? editingOutcomes[behaviour.id]
                        : behaviour.outcome) === 'reply_to_post' && (
                        <Typography
                          variant="body2"
                          color="info.main"
                          sx={{ mb: 1, fontStyle: 'italic' }}
                        >
                          This behaviour only responds to posts that @mention your account or quote
                          your tweets.
                        </Typography>
                      )}
                      {(editingOutcomes[behaviour.id] !== undefined
                        ? editingOutcomes[behaviour.id]
                        : behaviour.outcome) === 'like_post' && (
                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          maxRows={3}
                          size="small"
                          label="Query Prompt"
                          placeholder="e.g. Generate a list of topics a pragmatic CTO should be interested in"
                          value={
                            editingQueryPrompts[behaviour.id] !== undefined
                              ? editingQueryPrompts[behaviour.id]
                              : (behaviour.queryPrompt ?? '')
                          }
                          onChange={(e) =>
                            setEditingQueryPrompts((prev) => ({
                              ...prev,
                              [behaviour.id]: e.target.value,
                            }))
                          }
                          onFocus={() => {
                            if (editingQueryPrompts[behaviour.id] === undefined) {
                              setEditingQueryPrompts((prev) => ({
                                ...prev,
                                [behaviour.id]: behaviour.queryPrompt ?? '',
                              }));
                            }
                          }}
                          sx={{ mb: 1 }}
                        />
                      )}
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
                          justifyContent: 'flex-end',
                          gap: 1,
                        }}
                      >
                        {isEditing && (
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<SaveIcon />}
                            onClick={() => {
                              const content = editingBehaviours[behaviour.id] ?? behaviour.content;
                              const title = editingTitles[behaviour.id] ?? behaviour.title;
                              const ks =
                                editingKnowledgeSources[behaviour.id] ?? behaviour.knowledgeSource;
                              const oc = editingOutcomes[behaviour.id] ?? behaviour.outcome;
                              const qp =
                                editingQueryPrompts[behaviour.id] ??
                                behaviour.queryPrompt ??
                                undefined;
                              const w = editingWeights[behaviour.id] ?? behaviour.weight;
                              if (content && content.trim()) {
                                updateBehaviour.mutate(
                                  {
                                    botId: bot.id,
                                    behaviourId: behaviour.id,
                                    content: content.trim(),
                                    title: title?.trim(),
                                    knowledgeSource: ks,
                                    outcome: oc,
                                    queryPrompt: qp,
                                    weight: w,
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
                                      setEditingOutcomes((prev) => {
                                        const next = { ...prev };
                                        delete next[behaviour.id];
                                        return next;
                                      });
                                      setEditingQueryPrompts((prev) => {
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
                                  if (expanded === behaviour.id) {
                                    setExpanded(false);
                                  }
                                },
                              },
                            );
                          }}
                          disabled={deleteBehaviour.isPending}
                        >
                          Delete
                        </Button>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                );
              })}

              {behaviourCount === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No behaviours configured. Add one below.
                </Typography>
              )}

              {canAddBehaviour && (
                <Box sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Add New Behaviour
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    label="Title"
                    placeholder="e.g., Witty & Sarcastic"
                    value={newBehaviourTitle}
                    onChange={(e) => setNewBehaviourTitle(e.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                    <InputLabel>Outcome</InputLabel>
                    <Select
                      value={newBehaviourOutcome}
                      label="Outcome"
                      onChange={(e) => setNewBehaviourOutcome(e.target.value)}
                    >
                      <MenuItem value="write_post">Write Post</MenuItem>
                      <MenuItem value="reply_to_post">Reply to Post</MenuItem>
                      <MenuItem value="like_post">Like Post</MenuItem>
                      <MenuItem value="follow_account">Follow Account</MenuItem>
                    </Select>
                  </FormControl>
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
                        const newCount = activeBehaviours.length + 1;
                        const equalWeight = Math.floor(100 / newCount);
                        createBehaviour.mutate(
                          {
                            botId: bot.id,
                            content: newBehaviourContent.trim(),
                            title: newBehaviourTitle.trim() || undefined,
                            outcome: newBehaviourOutcome,
                            weight: equalWeight,
                          },
                          {
                            onSuccess: () => {
                              setNewBehaviourContent('');
                              setNewBehaviourTitle('');
                              setNewBehaviourOutcome('write_post');
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
            </Box>
          )}
        </Box>
      </Container>

      <Dialog
        open={quickRunModal.open}
        onClose={() =>
          setQuickRunModal({
            open: false,
            loading: false,
            postId: null,
            content: null,
            metadata: null,
            generationPrompt: null,
            error: null,
            message: null,
          })
        }
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Quick Run Result</DialogTitle>
        <DialogContent>
          {quickRunModal.loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {quickRunModal.error && (
            <Typography color="error" sx={{ py: 2 }}>
              {quickRunModal.error}
            </Typography>
          )}
          {quickRunModal.message && (
            <Typography color="info.main" sx={{ py: 2 }}>
              {quickRunModal.message}
            </Typography>
          )}
          {quickRunModal.content && (
            <Typography sx={{ py: 2, whiteSpace: 'pre-wrap' }}>{quickRunModal.content}</Typography>
          )}
          {(() => {
            if (!quickRunModal.metadata) return null;
            try {
              const parsed = JSON.parse(quickRunModal.metadata) as {
                outcome?: string;
                processSteps?: ProcessStep[];
              };
              if (
                parsed.outcome === 'like_post' &&
                Array.isArray(parsed.processSteps) &&
                parsed.processSteps.length > 0
              ) {
                return (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      Process Visualisation
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {parsed.processSteps.map(
                        (step: ProcessStep, idx: number, arr: ProcessStep[]) => (
                          <Box key={idx}>
                            <StepCard step={step} index={idx} />
                            {idx < arr.length - 1 && (
                              <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
                                <ArrowDownwardIcon color="action" />
                              </Box>
                            )}
                          </Box>
                        ),
                      )}
                    </Box>
                  </Box>
                );
              }
              return null;
            } catch {
              return null;
            }
          })()}
        </DialogContent>
        <DialogActions>
          {quickRunModal.postId && (
            <>
              <Button
                color="error"
                onClick={() => {
                  if (quickRunModal.postId) {
                    deletePost.mutate(quickRunModal.postId);
                  }
                  setQuickRunModal({
                    open: false,
                    loading: false,
                    postId: null,
                    content: null,
                    metadata: null,
                    generationPrompt: null,
                    error: null,
                    message: null,
                  });
                }}
              >
                Discard
              </Button>
              <Button
                onClick={() => {
                  setQuickRunModal({
                    open: false,
                    loading: false,
                    postId: null,
                    content: null,
                    metadata: null,
                    generationPrompt: null,
                    error: null,
                    message: null,
                  });
                  void navigate({ to: '/posts' });
                }}
              >
                View Posts
              </Button>
            </>
          )}
          <Button
            onClick={() =>
              setQuickRunModal({
                open: false,
                loading: false,
                postId: null,
                content: null,
                metadata: null,
                generationPrompt: null,
                error: null,
                message: null,
              })
            }
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
