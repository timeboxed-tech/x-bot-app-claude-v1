import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
} from '@tanstack/react-router';
import Box from '@mui/material/Box';
import { QueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import AppFooter from '../components/AppFooter';
import { DashboardVersionProvider } from '../contexts/DashboardVersionContext';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import PostsPage from '../pages/PostsPage';
import UsersPage from '../pages/UsersPage';
import JobQueuePage from '../pages/JobQueuePage';
import JudgesPage from '../pages/JudgesPage';
import BotEditPage from '../pages/BotEditPage';
import SystemPromptsPage from '../pages/SystemPromptsPage';
import JobConfigPage from '../pages/JobConfigPage';
import SystemConfigPage from '../pages/SystemConfigPage';
import AdminPage from '../pages/AdminPage';

async function checkAuth(): Promise<boolean> {
  try {
    await apiClient.get('/auth/me');
    return true;
  } catch {
    return false;
  }
}

function RootLayout() {
  return (
    <DashboardVersionProvider>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Box sx={{ flex: 1 }}>
          <Outlet />
        </Box>
        <AppFooter />
      </Box>
    </DashboardVersionProvider>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: async () => {
    const authenticated = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: DashboardPage,
});

const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
  beforeLoad: async () => {
    const authenticated = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: PostsPage,
});

const jobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jobs',
  beforeLoad: async () => {
    const authenticated = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: JobQueuePage,
});

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users',
  beforeLoad: async () => {
    const authenticated = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: UsersPage,
});

const judgesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/judges',
  beforeLoad: async () => {
    const authenticated = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: JudgesPage,
});

const systemPromptsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/system-prompts',
  beforeLoad: async () => {
    const authenticated = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: SystemPromptsPage,
});

const jobConfigRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/job-config',
  beforeLoad: async () => {
    const authenticated = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: JobConfigPage,
});

const systemConfigRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/system-config',
  beforeLoad: async () => {
    const authenticated = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: SystemConfigPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  beforeLoad: async () => {
    const authenticated = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: AdminPage,
});

const botEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bots/$botId/edit',
  beforeLoad: async () => {
    const authenticated = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: BotEditPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    const authenticated = await checkAuth();
    if (authenticated) {
      throw redirect({ to: '/dashboard' });
    } else {
      throw redirect({ to: '/login' });
    }
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  dashboardRoute,
  adminRoute,
  botEditRoute,
  postsRoute,
  jobsRoute,
  usersRoute,
  judgesRoute,
  systemPromptsRoute,
  jobConfigRoute,
  systemConfigRoute,
]);

export function createAppRouter(_queryClient?: QueryClient) {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
