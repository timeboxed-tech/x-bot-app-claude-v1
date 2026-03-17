import { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import AppHeader from '../components/AppHeader';
import { StepCard, type ProcessStep } from '../components/ProcessVisualisationDialog';
import { useBot, useUpdateBot, useBotTips } from '../hooks/useBot';
import { useDeletePost } from '../hooks/usePosts';
import {
  useBotBehaviours,
  useCreateBotBehaviour,
  useUpdateBotBehaviour,
  useDeleteBotBehaviour,
  useToggleBotBehaviour,
  useQuickRunBehaviour,
} from '../hooks/useBotBehaviours';
import { useJudges, useBotJudges, useAssignJudge, useRemoveJudge } from '../hooks/useJudges';
import { useNavigate, useParams } from '@tanstack/react-router';

type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

export default function BotEditBPage() {
  const { botId } = useParams({ strict: false }) as { botId: string };
  const { bots, isLoading } = useBot();
  const updateBot = useUpdateBot();
  const navigate = useNavigate();
  const { data: behaviours, isLoading: behavioursLoading } = useBotBehaviours(botId);
  const createBehaviour = useCreateBotBehaviour();
  const updateBehaviour = useUpdateBotBehaviour();
  const deleteBehaviour = useDeleteBotBehaviour();
  const toggleBehaviour = useToggleBotBehaviour();
  const quickRunBehaviour = useQuickRunBehaviour();
  const deletePost = useDeletePost();

  const { data: allJudges } = useJudges();
  const { data: botJudges } = useBotJudges(botId);
  const assignJudge = useAssignJudge();
  const removeJudge = useRemoveJudge();
  const { data: tips } = useBotTips(botId);

  const [prompt, setPrompt] = useState<string | null>(null);
  const [postMode, setPostMode] = useState<string | null>(null);
  const [postsPerDay, setPostsPerDay] = useState<string | null>(null);
  const [minInterval, setMinInterval] = useState<string | null>(null);
  const [hoursStart, setHoursStart] = useState<string | null>(null);
  const [hoursEnd, setHoursEnd] = useState<string | null>(null);
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

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Test run panel state
  const [selectedBehaviourId, setSelectedBehaviourId] = useState<string>('');
  const [testRunLoading, setTestRunLoading] = useState(false);
  const [testRunResult, setTestRunResult] = useState<{
    postId: string;
    content: string;
    metadata?: string | null;
  } | null>(null);
  const [testRunError, setTestRunError] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const bot = bots.find((b) => b.id === botId);

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Container>
      </>
    );
  }

  if (!bot) {
    return (
      <>
        <AppHeader />
        <Container maxWidth="lg" sx={{ mt: 4 }}>
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

  const currentPrompt = prompt ?? bot.prompt;
  const currentPostMode = postMode ?? bot.postMode;
  const currentPostsPerDay = postsPerDay ?? String(bot.postsPerDay);
  const currentMinInterval = minInterval ?? String(bot.minIntervalHours);
  const currentHoursStart = hoursStart ?? String(bot.preferredHoursStart);
  const currentHoursEnd = hoursEnd ?? String(bot.preferredHoursEnd);

  const hasPromptChanges = prompt !== null && prompt !== bot.prompt;
  const hasSettingsChanges =
    (postMode !== null && postMode !== bot.postMode) ||
    (postsPerDay !== null && postsPerDay !== String(bot.postsPerDay)) ||
    (minInterval !== null && minInterval !== String(bot.minIntervalHours)) ||
    (hoursStart !== null && hoursStart !== String(bot.preferredHoursStart)) ||
    (hoursEnd !== null && hoursEnd !== String(bot.preferredHoursEnd));

  const handleSaveBot = () => {
    const updates: Record<string, unknown> = { id: bot.id };
    if (prompt !== null) updates.prompt = prompt;
    if (postMode !== null) updates.postMode = postMode;
    if (postsPerDay !== null) updates.postsPerDay = parseInt(postsPerDay, 10);
    if (minInterval !== null) updates.minIntervalHours = parseInt(minInterval, 10);
    if (hoursStart !== null) updates.preferredHoursStart = parseInt(hoursStart, 10);
    if (hoursEnd !== null) updates.preferredHoursEnd = parseInt(hoursEnd, 10);
    updateBot.mutate(updates as Parameters<typeof updateBot.mutate>[0], {
      onSuccess: () => {
        showSnackbar('Bot updated', 'success');
        setPrompt(null);
        setPostMode(null);
        setPostsPerDay(null);
        setMinInterval(null);
        setHoursStart(null);
        setHoursEnd(null);
      },
      onError: () => showSnackbar('Failed to update bot', 'error'),
    });
  };

  const activeBehaviours = behaviours?.filter((b) => b.active) ?? [];
  const totalWeight = activeBehaviours.reduce((sum, b) => {
    const editedWeight = editingWeights[b.id];
    return sum + (editedWeight !== undefined ? editedWeight : b.weight);
  }, 0);
  const behaviourCount = behaviours?.length ?? 0;
  const canAddBehaviour = behaviourCount < 10;

  const handleAccordionChange =
    (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false);
    };

  const handleTestRun = () => {
    if (!selectedBehaviourId) return;
    setTestRunLoading(true);
    setTestRunResult(null);
    setTestRunError(null);
    quickRunBehaviour.mutate(
      { botId: bot.id, behaviourId: selectedBehaviourId },
      {
        onSuccess: (data) => {
          setTestRunLoading(false);
          setTestRunResult({
            postId: data.post.id,
            content: data.post.content,
            metadata: data.post.metadata,
          });
        },
        onError: (err: unknown) => {
          setTestRunLoading(false);
          setTestRunError(err instanceof Error ? err.message : 'Generation failed');
        },
      },
    );
  };

  // --- Tab content renderers ---

  const renderPromptTab = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Bot Prompt
      </Typography>
      <TextField
        fullWidth
        multiline
        minRows={6}
        maxRows={20}
        value={currentPrompt}
        onChange={(e) => setPrompt(e.target.value)}
        sx={{ mb: 2 }}
      />
      {hasPromptChanges && (
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSaveBot}
          disabled={updateBot.isPending}
          sx={{ mb: 2 }}
        >
          {updateBot.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      )}
    </Box>
  );

  const renderScheduleModeTab = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Schedule & Mode Settings
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Post Mode</InputLabel>
            <Select
              value={currentPostMode}
              label="Post Mode"
              onChange={(e) => setPostMode(e.target.value)}
            >
              <MenuItem value="auto">Auto</MenuItem>
              <MenuItem value="manual">Manual</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Posts/Day"
            value={currentPostsPerDay}
            onChange={(e) => setPostsPerDay(e.target.value)}
            InputProps={{ inputProps: { min: 1, max: 48 } }}
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Min Interval (h)"
            value={currentMinInterval}
            onChange={(e) => setMinInterval(e.target.value)}
            InputProps={{ inputProps: { min: 1, max: 24 } }}
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Hours Start"
            value={currentHoursStart}
            onChange={(e) => setHoursStart(e.target.value)}
            InputProps={{ inputProps: { min: 0, max: 23 } }}
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Hours End"
            value={currentHoursEnd}
            onChange={(e) => setHoursEnd(e.target.value)}
            InputProps={{ inputProps: { min: 0, max: 23 } }}
          />
        </Grid>
        <Grid item xs={12}>
          <FormControl fullWidth size="small">
            <InputLabel>Knowledge Source</InputLabel>
            <Select
              value={bot.knowledgeSource ?? 'ai'}
              label="Knowledge Source"
              onChange={(e) => {
                updateBot.mutate(
                  { id: bot.id, knowledgeSource: e.target.value },
                  {
                    onSuccess: () => showSnackbar('Knowledge source updated', 'success'),
                    onError: () => showSnackbar('Failed to update', 'error'),
                  },
                );
              }}
            >
              <MenuItem value="ai">AI Only</MenuItem>
              <MenuItem value="ai+web">AI + Web Search</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      {hasSettingsChanges && (
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSaveBot}
          disabled={updateBot.isPending}
          sx={{ mt: 2 }}
        >
          {updateBot.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      )}
    </Box>
  );

  const renderBehavioursTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Behaviours ({behaviourCount}/10)
      </Typography>

      {behavioursLoading ? (
        <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 1 }} />
      ) : (
        <>
          {activeBehaviours.length > 0 && (
            <Box
              sx={{
                px: 2,
                py: 1,
                mb: 1,
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
                Weight: {totalWeight}%{totalWeight !== 100 ? ' (should be 100%)' : ''}
              </Typography>
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
                  sx={{
                    '& .MuiAccordionSummary-content': {
                      alignItems: 'center',
                      gap: 1,
                    },
                  }}
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
                    <Chip label={`${weight}%`} size="small" color="primary" variant="outlined" />
                  )}
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
                      This behaviour only responds to posts that @mention your account or quote your
                      tweets.
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
                    InputProps={{ inputProps: { min: 0, max: 100 } }}
                    value={weight}
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
                            editingQueryPrompts[behaviour.id] ?? behaviour.queryPrompt ?? undefined;
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
                                  showSnackbar('Behaviour saved', 'success');
                                },
                                onError: () => showSnackbar('Failed to save behaviour', 'error'),
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
                              if (expanded === behaviour.id) setExpanded(false);
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

          {canAddBehaviour && (
            <Box sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Add New Behaviour
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Title"
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
                minRows={2}
                size="small"
                label="Prompt"
                value={newBehaviourContent}
                onChange={(e) => setNewBehaviourContent(e.target.value)}
                sx={{ mb: 1 }}
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
                Add
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );

  const renderJudgesTipsTab = () => (
    <Box>
      {/* Judges */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Judges {botJudges ? `(${botJudges.length}/5)` : ''}
          </Typography>
          {botJudges && botJudges.length > 0 ? (
            <List dense disablePadding>
              {botJudges.map((bj, index) => (
                <div key={bj.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    disablePadding
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() =>
                          removeJudge.mutate(
                            { botId: bot.id, judgeId: bj.judgeId },
                            {
                              onSuccess: () =>
                                showSnackbar(`Removed "${bj.judge.name}"`, 'success'),
                              onError: () => showSnackbar('Failed to remove', 'error'),
                            },
                          )
                        }
                        disabled={removeJudge.isPending}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={bj.judge.name}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                </div>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No judges assigned
            </Typography>
          )}
          {allJudges && botJudges && botJudges.length < 5 && (
            <Select
              size="small"
              displayEmpty
              value=""
              onChange={(e) => {
                const judgeId = e.target.value as string;
                if (!judgeId) return;
                assignJudge.mutate(
                  { botId: bot.id, judgeId },
                  {
                    onSuccess: () => showSnackbar('Judge assigned', 'success'),
                    onError: () => showSnackbar('Failed to assign', 'error'),
                  },
                );
              }}
              fullWidth
              disabled={assignJudge.isPending}
              sx={{ mt: 1 }}
            >
              <MenuItem value="" disabled>
                Add a judge...
              </MenuItem>
              {allJudges
                .filter((j) => !botJudges.some((bj) => bj.judgeId === j.id))
                .map((j) => (
                  <MenuItem key={j.id} value={j.id}>
                    {j.name}
                  </MenuItem>
                ))}
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Memory Tips {tips ? `(${tips.length}/10)` : ''}
          </Typography>
          {tips && tips.length > 0 ? (
            <List dense disablePadding>
              {tips.map((tip, index) => (
                <div key={tip.id}>
                  {index > 0 && <Divider />}
                  <ListItem disablePadding>
                    <ListItemText
                      primary={tip.content}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                </div>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No tips yet
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );

  const renderTestRunSidebar = () => (
    <Box sx={{ position: 'sticky', top: 16 }}>
      <Card>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Test Run
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel>Behaviour</InputLabel>
            <Select
              value={selectedBehaviourId}
              label="Behaviour"
              onChange={(e) => setSelectedBehaviourId(e.target.value)}
            >
              {behaviours
                ?.filter((b) => b.active)
                .map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.title || 'Untitled'}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            size="small"
            fullWidth
            startIcon={testRunLoading ? <CircularProgress size={16} /> : <PlayArrowIcon />}
            onClick={handleTestRun}
            disabled={!selectedBehaviourId || testRunLoading}
          >
            {testRunLoading ? 'Generating...' : 'Generate'}
          </Button>

          {testRunError && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {testRunError}
            </Typography>
          )}

          {testRunResult && (
            <Box sx={{ mt: 2 }}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {testRunResult.content}
                  </Typography>
                </CardContent>
              </Card>
              {/* Process visualisation for results with processSteps */}
              {(() => {
                if (!testRunResult.metadata) return null;
                try {
                  const parsed = JSON.parse(testRunResult.metadata) as {
                    outcome?: string;
                    processSteps?: ProcessStep[];
                  };
                  if (Array.isArray(parsed.processSteps) && parsed.processSteps.length > 0) {
                    return (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Process Visualisation
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {parsed.processSteps.map(
                            (step: ProcessStep, idx: number, arr: ProcessStep[]) => (
                              <Box key={idx}>
                                <StepCard step={step} index={idx} />
                                {idx < arr.length - 1 && (
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      justifyContent: 'center',
                                      py: 0.5,
                                    }}
                                  >
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
              <Box sx={{ display: 'flex', gap: 1, mt: 1, justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    void navigate({ to: '/posts' });
                  }}
                >
                  Keep (View Posts)
                </Button>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  onClick={() => {
                    deletePost.mutate(testRunResult.postId);
                    setTestRunResult(null);
                  }}
                >
                  Discard
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );

  return (
    <>
      <AppHeader />
      <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
        {/* Top navigation and bot title — always visible above tabs */}
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => void navigate({ to: '/dashboard' })}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>

        <Typography variant="h4" gutterBottom>
          Edit @{bot.xAccountHandle || 'Bot'}
        </Typography>

        <Grid container spacing={3}>
          {/* Left column: tabs + tab content */}
          <Grid item xs={12} md={7}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs
                value={activeTab}
                onChange={(_e, newValue: number) => setActiveTab(newValue)}
                aria-label="Bot edit tabs"
              >
                <Tab label="Prompt" />
                <Tab label="Schedule & Mode" />
                <Tab label="Behaviours" />
                <Tab label="Judges & Tips" />
              </Tabs>
            </Box>

            {activeTab === 0 && renderPromptTab()}
            {activeTab === 1 && renderScheduleModeTab()}
            {activeTab === 2 && renderBehavioursTab()}
            {activeTab === 3 && renderJudgesTipsTab()}
          </Grid>

          {/* Right column: persistent test run sidebar */}
          <Grid item xs={12} md={5}>
            {renderTestRunSidebar()}
          </Grid>
        </Grid>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </>
  );
}
