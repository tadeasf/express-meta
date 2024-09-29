import { Elysia } from 'elysia';
import { Context } from 'elysia';

export const switchDbRoutes = new Elysia()
  .get('/switch_db', async ({ redis, databaseStore }: Context) => {
    const newDb = databaseStore.MESSAGE_DATABASE === "messages" ? "message_backup" : "messages";
    await redis.publish("DB_SWITCH_CHANNEL", newDb);
    await redis.flushdb();
    databaseStore.MESSAGE_DATABASE = newDb;
    return `Database switch initiated: ${newDb}`;
  });