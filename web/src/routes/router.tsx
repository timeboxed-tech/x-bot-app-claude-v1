import { lazy, Suspense } from 'react';
import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import apiClient from '../lib/apiClient';

const LoginPage = lazy(() => import('../pages/LoginPage'));
const VerifyPage = lazy(() => import('../pages/VerifyPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const PostsPage = lazy(() => import('../pages/PostsPage'));

function LoadingFallback() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress />
    </Box>
  );
}

async function checkAuth(): Promise<boolean> {
  try {
    await apiClient.get('/auth/me');
    return true;
  } catch {
    return false;
  }
}

// Root route
const rootRoute = createRootRoute({
  component: () => (
    <Suspense fallback={<LoadingFallback />}>
      <Outlet />
    </Suspense>
  ),
});

// Login route
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: () => <LoginPage />,
});

// Verify route
const verifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/verify',
  component: () => <VerifyPage />,
});

// Protected dashboard route
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: async () => {
    const isAuth = await checkAuth();
    if (!isAuth) {
      throw redirect({ to: '/login' });
    }
  },
  component: () => <DashboardPage />,
});

// Protected posts route
const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
  beforeLoad: async () => {
    const isAuth = await checkAuth();
    if (!isAuth) {
      throw redirect({ to: '/login' });
    }
  },
  component: () => <PostsPage />,
});

// Index route — redirect to dashboard
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    const isAuth = await checkAuth();
    if (isAuth) {
      throw redirect({ to: '/dashboard' });
    } else {
      throw redirect({ to: '/login' });
    }
  },
});

// Build route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  verifyRoute,
  dashboardRoute,
  postsRoute,
]);

// Create router
export const router = createRouter({ routeTree });

// Type augmentation for TanStack Router
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
