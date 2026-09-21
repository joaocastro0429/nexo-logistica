import type { NextConfig } from 'next';
import path from 'node:path';

const backendUrl = process.env.BACKEND_URL?.trim().replace(/\/+$/, '') || 'http://127.0.0.1:3001';

if (process.env.VERCEL === '1') {
  if (!process.env.BACKEND_URL?.trim()) {
    throw new Error('Configure BACKEND_URL na Vercel com a origem HTTPS do backend antes do deploy.');
  }
  let backend: URL;
  try { backend = new URL(backendUrl); }
  catch { throw new Error('BACKEND_URL na Vercel deve conter uma URL HTTPS válida.'); }
  if (backend.protocol !== 'https:' || backend.origin !== backendUrl || ['localhost', '127.0.0.1', '[::1]'].includes(backend.hostname)) {
    throw new Error('BACKEND_URL na Vercel deve ser uma origem HTTPS pública, sem caminho, credenciais ou /api.');
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname, '..'),
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
