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

const PLATFORMS = [
  { value: 'x', label: 'X (Twitter)', enabled: true },
  { value: 'linkedin', label: 'LinkedIn', enabled: false },
  { value: 'threads', label: 'Threads', enabled: false },
] as const;

const botConfigSchema = z.object({
  platform: z.enum(['x']),
  prompt: z.string().min(1, 'Prompt is required'),
  postMode: z.enum(['auto', 'manual']),
  postsPerDay: z.number().int().min(1).max(15),
  minIntervalHours: z.number().int().min(1).max(15),
  preferredHoursStart: z.number().int().min(0).max(23),
  preferredHoursEnd: z.number().int().min(1).max(24),
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
              postMode: e.target.value as 'auto' | 'manual',
            }))
          }
        >
          <FormControlLabel value="auto" control={<Radio />} label="Auto" />
          <FormControlLabel value="manual" control={<Radio />} label="Manual" />
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

      {Object.keys(errors).length > 0 && (
        <Alert severity="error">Please fix the errors above.</Alert>
      )}

      <Button type="submit" variant="contained" size="large" disabled={isLoading}>
        {isLoading ? 'Saving...' : submitLabel}
      </Button>
    </Box>
  );
}
