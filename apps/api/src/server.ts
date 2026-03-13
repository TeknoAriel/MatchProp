/**
 * Entrypoint para Vercel: despliegue nativo de Fastify.
 * Vercel detecta src/server.ts y enruta todas las peticiones al app.
 * Para desarrollo local usamos src/index.ts.
 */
import { buildApp } from './app.js';

export default buildApp({ logger: false });
