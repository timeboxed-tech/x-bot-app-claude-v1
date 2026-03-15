import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';

declare const __GIT_SHA__: string;
declare const __GIT_DATE__: string;

export default function AppFooter() {
  return (
    <Box
      component="footer"
      sx={{
        py: 2,
        px: 3,
        mt: 'auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        by EHE Venture Studio
      </Typography>
      <Tooltip title={`${__GIT_SHA__} (${__GIT_DATE__})`}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ cursor: 'default', userSelect: 'none' }}
        >
          {__GIT_SHA__}
        </Typography>
      </Tooltip>
    </Box>
  );
}
