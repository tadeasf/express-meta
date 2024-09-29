import { Elysia, Context } from 'elysia';

export const flushRedisRoutes = new Elysia()
  .get('/flush_redis', async ({ redis }: Context) => {
    await redis.flushdb();
    return "Redis cache flushed successfully.";
  });