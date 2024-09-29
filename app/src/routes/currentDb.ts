import { Elysia, Context } from 'elysia';

export const currentDbRoutes = new Elysia()
  .get('/current_db', ({ databaseStore }: Context) => {
    return `${databaseStore.MESSAGE_DATABASE}`;
  });