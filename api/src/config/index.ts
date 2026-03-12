export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    magicLinkExpiresInSeconds: 15 * 60, // 15 minutes
    sessionExpiresInSeconds: 7 * 24 * 60 * 60, // 7 days
  },
  app: {
    version: process.env.APP_VERSION || '0.1.0',
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:3001',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  allowedDomains: ['thestartupfactory.tech', 'ehe.ai'],
  cookie: {
    name: 'session',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  },
};
