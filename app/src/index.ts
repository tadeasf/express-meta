import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import compression from 'elysia-compress';
import { logger } from '@bogeychan/elysia-logger';
import { stressTestRoutes } from './routes/stressTest';
import { loadCpuRoutes } from './routes/loadCpu';
import { flushRedisRoutes } from './routes/flushRedis';
import { currentDbRoutes } from './routes/currentDb';
import { switchDbRoutes } from './routes/switchDb';
import { searchTextRoutes } from './routes/searchText';
import { collectionsRoutes } from './routes/collections';
import { messagesRoutes } from './routes/messages';
import { photosRoutes } from './routes/photos';
import { searchRoutes } from './routes/search';
import { deleteRoutes } from './routes/delete';
import { uploadRoutes } from './routes/upload';
import { serveInboxRoutes } from "./routes/serveInbox";
import { redisCommand, redisSubscribe, DatabaseStore } from './utils/redis';

// Load environment variables
dotenv.config();

console.log('Environment variables:');
console.log('API_KEY:', process.env.API_KEY);
console.log('MONGODB_URI:', process.env.MONGODB_URI);
// ... log other relevant environment variables

// MongoDB setup
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

let MESSAGE_DATABASE = 'message_backup';

redisSubscribe.on('message', (channel, message) => {
  console.log(`Received the following message from ${channel}: ${message}`);
  MESSAGE_DATABASE = message;
});

// API key middleware
const apiKeyMiddleware = new Elysia()
  .onRequest(({ request, set }) => {
    const apiKey = request.headers.get('x-api-key');
    console.log('Received API Key:', apiKey);
    console.log('Expected API Key:', process.env.API_KEY);
    if (!apiKey || apiKey !== process.env.API_KEY) {
      set.status = 401;
      return 'Unauthorized';
    }
  });

const app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: 'Meta Messenger API',
        version: '1.0.0',
      },
    },
  }))
  .use(cors())
  .use(compression({ as: 'scoped' }))
  .use(logger())
  .decorate('db', () => client.db(DatabaseStore.MESSAGE_DATABASE))
  .decorate('redis', redisCommand)
  .decorate('databaseStore', DatabaseStore)
  .use(apiKeyMiddleware)
  .get('/', () => 'Hi, Blackbox, grab some data! omnomnomnom...')
  .use(collectionsRoutes)
  .use(messagesRoutes)
  .use(photosRoutes)
  .use(searchRoutes)
  .use(deleteRoutes)
  .use(uploadRoutes)
  .use(stressTestRoutes)
  .use(loadCpuRoutes)
  .use(flushRedisRoutes)
  .use(currentDbRoutes)
  .use(switchDbRoutes)
  .use(searchTextRoutes)
  .use(serveInboxRoutes)
  .listen(5555);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
