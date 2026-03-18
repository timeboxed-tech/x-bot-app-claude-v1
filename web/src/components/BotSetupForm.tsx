import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import InputLabel from '@mui/material/InputLabel';
import { z } from 'zod';

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Mexico_City',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Zurich',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
];

const PLATFORMS = [
  { value: 'x', label: 'X (Twitter)', enabled: true },
  { value: 'linkedin', label: 'LinkedIn', enabled: false },
  { value: 'threads', label: 'Threads', enabled: false },
] as const;

const botConfigSchema = z.object({
  platform: z.enum(['x']),
  prompt: z.string().min(1, 'Prompt is required'),
  postMode: z.enum(['auto', 'manual', 'with-approval']),
  postsPerDay: z.number().int().min(1).max(15),
  minIntervalHours: z.number().int().min(1).max(15),
  preferredHoursStart: z.number().int().min(0).max(23),
  preferredHoursEnd: z.number().int().min(1).max(24),
  timezone: z.string().min(1),
  knowledgeSource: z.enum(['ai', 'ai+web']),
  judgeKnowledgeSource: z.enum(['ai', 'ai+web']),
});

type BotConfigValues = z.infer<typeof botConfigSchema>;

type BotSetupFormProps = {
  initialValues?: Partial<BotConfigValues>;
  onSubmit: (values: BotConfigValues) => void;
  isLoading?: boolean;
  submitLabel?: string;
};

const defaultValues: BotConfigValues = {
  platform: 'x',
  prompt: '',
  postMode: 'manual',
  postsPerDay: 3,
  minIntervalHours: 2,
  preferredHoursStart: 9,
  preferredHoursEnd: 18,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  knowledgeSource: 'ai',
  judgeKnowledgeSource: 'ai',
};

export default function BotSetupForm({
  initialValues,
  onSubmit,
  isLoading = false,
  submitLabel = 'Save',
}: BotSetupFormProps) {
  const [values, setValues] = useState<BotConfigValues>({
    ...defaultValues,
    ...initialValues,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = botConfigSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(result.data);
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
    >
      <FormControl>
        <FormLabel>Platform</FormLabel>
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          {PLATFORMS.map((p) => (
            <Chip
              key={p.value}
              label={p.enabled ? p.label : `${p.label} (coming soon)`}
              color={values.platform === p.value ? 'primary' : 'default'}
              variant={values.platform === p.value ? 'filled' : 'outlined'}
              onClick={
                p.enabled ? () => setValues((v) => ({ ...v, platform: p.value as 'x' })) : undefined
              }
              disabled={!p.enabled}
              sx={{ opacity: p.enabled ? 1 : 0.5 }}
            />
          ))}
        </Box>
      </FormControl>

      <TextField
        label="Bot Prompt"
        multiline
        minRows={8}
        maxRows={20}
        value={values.prompt}
        onChange={(e) => setValues((v) => ({ ...v, prompt: e.target.value }))}
        error={!!errors['prompt']}
        helperText={
          errors['prompt'] ||
          'Describe how your bot should write posts. This can be multiple paragraphs.'
        }
        fullWidth
        InputProps={{
          sx: { overflowY: 'auto' },
        }}
      />

      <FormControl>
        <FormLabel>Post Mode</FormLabel>
        <RadioGroup
          row
          value={values.postMode}
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              postMode: e.target.value as 'auto' | 'manual' | 'with-approval',
            }))
          }
        >
          <FormControlLabel value="auto" control={<Radio />} label="Auto" />
          <FormControlLabel value="manual" control={<Radio />} label="Manual" />
          <FormControlLabel value="with-approval" control={<Radio />} label="With Approval" />
        </RadioGroup>
      </FormControl>

      <Box>
        <Typography gutterBottom>Posts Per Day: {values.postsPerDay}</Typography>
        <Slider
          value={values.postsPerDay}
          onChange={(_, val) => setValues((v) => ({ ...v, postsPerDay: val as number }))}
          min={1}
          max={15}
          step={1}
          marks
          valueLabelDisplay="auto"
        />
      </Box>

      <Box>
        <Typography gutterBottom>Min Interval (hours): {values.minIntervalHours}</Typography>
        <Slider
          value={values.minIntervalHours}
          onChange={(_, val) => setValues((v) => ({ ...v, minIntervalHours: val as number }))}
          min={1}
          max={15}
          step={1}
          marks
          valueLabelDisplay="auto"
        />
      </Box>

      <FormControl fullWidth>
        <InputLabel>Preferred Hours Start</InputLabel>
        <Select
          value={values.preferredHoursStart}
          label="Preferred Hours Start"
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              preferredHoursStart: e.target.value as number,
            }))
          }
        >
          {Array.from({ length: 24 }, (_, i) => (
            <MenuItem key={i} value={i}>
              {i.toString().padStart(2, '0')}:00
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth>
        <InputLabel>Preferred Hours End</InputLabel>
        <Select
          value={values.preferredHoursEnd}
          label="Preferred Hours End"
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              preferredHoursEnd: e.target.value as number,
            }))
          }
        >
          {Array.from({ length: 24 }, (_, i) => (
            <MenuItem key={i + 1} value={i + 1}>
              {(i + 1).toString().padStart(2, '0')}:00
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth>
        <InputLabel>Timezone</InputLabel>
        <Select
          value={values.timezone}
          label="Timezone"
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              timezone: e.target.value as string,
            }))
          }
        >
          {COMMON_TIMEZONES.map((tz) => (
            <MenuItem key={tz} value={tz}>
              {tz.replace(/_/g, ' ')}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Preferred hours will be interpreted in this timezone.
        </Typography>
      </FormControl>

      <FormControl fullWidth>
        <InputLabel>Knowledge Source</InputLabel>
        <Select
          value={values.knowledgeSource}
          label="Knowledge Source"
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              knowledgeSource: e.target.value as 'ai' | 'ai+web',
            }))
          }
        >
          <MenuItem value="ai">AI Only</MenuItem>
          <MenuItem value="ai+web">AI + Web Search</MenuItem>
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Web search allows the AI to look up current information. Additional cost applies.
        </Typography>
      </FormControl>

      <FormControl fullWidth>
        <InputLabel>Judge Knowledge Source</InputLabel>
        <Select
          value={values.judgeKnowledgeSource}
          label="Judge Knowledge Source"
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              judgeKnowledgeSource: e.target.value as 'ai' | 'ai+web',
            }))
          }
        >
          <MenuItem value="ai">AI Only</MenuItem>
          <MenuItem value="ai+web">AI + Web Search</MenuItem>
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          When enabled, judges can verify facts and timeliness via web search. Additional cost
          applies.
        </Typography>
      </FormControl>

      {Object.keys(errors).length > 0 && (
        <Alert severity="error">Please fix the errors above.</Alert>
      )}

      <Button type="submit" variant="contained" size="large" disabled={isLoading}>
        {isLoading ? 'Saving...' : submitLabel}
      </Button>
    </Box>
  );
}
