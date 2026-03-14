import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
} from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import PostsPage from '../pages/PostsPage';
import UsersPage from '../pages/UsersPage';
import JobQueuePage from '../pages/JobQueuePage';
import JudgesPage from '../pages/JudgesPage';
import BotEditPage from '../pages/BotEditPage';

async function checkAuth(): Promise<boolean> {
  try {
    await apiClient.get('/auth/me');
    return true;
  } catch {
    return false;
  }
}

const rootRoute = createRootRoute({
  component: Outlet,
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
  botEditRoute,
  postsRoute,
  jobsRoute,
  usersRoute,
  judgesRoute,
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
