import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { apiClient } from '../lib/apiClient';

declare const __GIT_SHA__: string;
declare const __GIT_DATE__: string;

export default function AppFooter() {
  const [apiSha, setApiSha] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ gitSha: string }>('/health')
      .then((res) => setApiSha(res.data.gitSha))
      .catch(() => setApiSha(null));
  }, []);

  const mismatch = apiSha !== null && apiSha !== 'dev' && apiSha !== __GIT_SHA__;

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
      <Tooltip
        title={
          mismatch
            ? `Version mismatch! Web: ${__GIT_SHA__} (${__GIT_DATE__}) / API: ${apiSha}`
            : `${__GIT_SHA__} (${__GIT_DATE__})`
        }
      >
        <Typography
          variant="caption"
          sx={{
            cursor: 'default',
            userSelect: 'none',
            color: mismatch ? 'error.main' : 'text.secondary',
            fontWeight: mismatch ? 'bold' : 'normal',
          }}
        >
          web: {__GIT_SHA__}
          {apiSha && ` / api: ${apiSha}`}
        </Typography>
      </Tooltip>
    </Box>
  );
}
