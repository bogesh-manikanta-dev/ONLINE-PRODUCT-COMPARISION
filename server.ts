import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import adminRoutes from './server/routes/adminRoutes.ts';
import authRoutes from './server/routes/authRoutes.ts';
import cartRoutes from './server/routes/cartRoutes.ts';
import catalogRoutes from './server/routes/catalogRoutes.ts';
import orderRoutes from './server/routes/orderRoutes.ts';
import userWorkspaceRoutes from './server/routes/userWorkspaceRoutes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    })
  );

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'CompareX API' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api', orderRoutes);
  app.use('/api/workspace', userWorkspaceRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true' ? undefined : false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`CompareX server listening on http://0.0.0.0:${port}`);
  });
}

if (!process.env.VITEST) {
  startServer().catch((err) => {
    console.error('Failed to start CompareX server:', err);
    process.exit(1);
  });
}
