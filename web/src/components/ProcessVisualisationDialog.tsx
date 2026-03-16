import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

export type ProcessStep = {
  step: string;
  input: string;
  output: string;
};

type ProcessVisualisationDialogProps = {
  open: boolean;
  onClose: () => void;
  steps: ProcessStep[];
};

function StepCard({ step, index }: { step: ProcessStep; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const truncate = (text: string, maxLen = 120) =>
    text.length > maxLen ? text.substring(0, maxLen) + '...' : text;

  const handleCopy = () => {
    const text = `Step: ${step.step}\n\nInput:\n${step.input}\n\nOutput:\n${step.output}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Card
      variant="outlined"
      sx={{
        cursor: 'pointer',
        '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent sx={{ pb: expanded ? 1 : '16px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 'bold',
                flexShrink: 0,
              }}
            >
              {index + 1}
            </Box>
            <Typography variant="subtitle1" fontWeight="bold">
              {step.step}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={copied ? 'Copied!' : 'Copy step details'}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                color={copied ? 'success' : 'default'}
              >
                {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <IconButton size="small">
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>

        {!expanded && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">
              Input:
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {truncate(step.input)}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">
              Output:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {truncate(step.output)}
            </Typography>
          </Box>
        )}

        <Collapse in={expanded}>
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">
              Input:
            </Typography>
            <Box
              sx={{
                p: 1.5,
                mt: 0.5,
                mb: 1,
                borderRadius: 1,
                bgcolor: 'action.hover',
                maxHeight: 300,
                overflowY: 'auto',
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {step.input}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">
              Output:
            </Typography>
            <Box
              sx={{
                p: 1.5,
                mt: 0.5,
                borderRadius: 1,
                bgcolor: 'action.hover',
                maxHeight: 300,
                overflowY: 'auto',
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {step.output}
              </Typography>
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

export default function ProcessVisualisationDialog({
  open,
  onClose,
  steps,
}: ProcessVisualisationDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Like Post Process</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, mt: 1 }}>
          {steps.map((step, idx) => (
            <Box key={idx}>
              <StepCard step={step} index={idx} />
              {idx < steps.length - 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
                  <ArrowDownwardIcon color="action" />
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
