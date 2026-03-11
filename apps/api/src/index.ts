import { config } from './config.js';
import { buildApp } from './app.js';

buildApp()
  .then(async (fastify) => {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Server running at http://localhost:${config.port}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
