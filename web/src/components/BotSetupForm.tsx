import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import Stack from '@mui/material/Stack';

const botFormSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  postMode: z.enum(['auto', 'manual']),
  postsPerDay: z.number().min(1).max(15),
  minIntervalHours: z.number().min(1).max(15),
  preferredHoursStart: z.number().min(0).max(23),
  preferredHoursEnd: z.number().min(1).max(24),
});

type BotFormValues = z.infer<typeof botFormSchema>;

interface BotSetupFormProps {
  defaultValues?: BotFormValues;
  onSubmit: (values: BotFormValues) => Promise<void>;
  onCancel?: () => void;
  isSubmitting: boolean;
  submitLabel?: string;
}

const hourOptions = Array.from({ length: 25 }, (_, i) => i);

export default function BotSetupForm({
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel = 'Save',
}: BotSetupFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BotFormValues>({
    resolver: zodResolver(botFormSchema),
    defaultValues: defaultValues ?? {
      prompt: '',
      postMode: 'manual',
      postsPerDay: 3,
      minIntervalHours: 2,
      preferredHoursStart: 9,
      preferredHoursEnd: 18,
    },
  });

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ width: '100%' }}>
      <Stack spacing={3}>
        <Controller
          name="prompt"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Prompt"
              placeholder="Topics, tone, and posting style for the AI agent..."
              multiline
              minRows={3}
              maxRows={8}
              fullWidth
              error={!!errors.prompt}
              helperText={errors.prompt?.message}
            />
          )}
        />

        <Controller
          name="postMode"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel>Post Mode</FormLabel>
              <RadioGroup row {...field}>
                <FormControlLabel
                  value="auto"
                  control={<Radio />}
                  label="Auto (publish without review)"
                />
                <FormControlLabel
                  value="manual"
                  control={<Radio />}
                  label="Manual (review before publishing)"
                />
              </RadioGroup>
            </FormControl>
          )}
        />

        <Controller
          name="postsPerDay"
          control={control}
          render={({ field }) => (
            <Box>
              <Typography gutterBottom>Posts per day: {field.value}</Typography>
              <Slider
                {...field}
                onChange={(_, val) => field.onChange(val)}
                min={1}
                max={15}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
          )}
        />

        <Controller
          name="minIntervalHours"
          control={control}
          render={({ field }) => (
            <Box>
              <Typography gutterBottom>
                Minimum interval: {field.value} hour
                {field.value !== 1 ? 's' : ''}
              </Typography>
              <Slider
                {...field}
                onChange={(_, val) => field.onChange(val)}
                min={1}
                max={15}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
          )}
        />

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Controller
            name="preferredHoursStart"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Preferred Start Hour</InputLabel>
                <Select
                  {...field}
                  label="Preferred Start Hour"
                  onChange={(e) => field.onChange(Number(e.target.value))}
                >
                  {hourOptions.slice(0, 24).map((h) => (
                    <MenuItem key={h} value={h}>
                      {h.toString().padStart(2, '0')}:00
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
          <Controller
            name="preferredHoursEnd"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Preferred End Hour</InputLabel>
                <Select
                  {...field}
                  label="Preferred End Hour"
                  onChange={(e) => field.onChange(Number(e.target.value))}
                >
                  {hourOptions.slice(1).map((h) => (
                    <MenuItem key={h} value={h}>
                      {h.toString().padStart(2, '0')}:00
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            justifyContent: 'flex-end',
          }}
        >
          {onCancel && (
            <Button variant="outlined" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
