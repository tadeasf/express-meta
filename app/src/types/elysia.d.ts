import { Db } from 'mongodb';
import Redis from 'ioredis';

declare module 'elysia' {
  interface Context {
    db: () => Db;
    redis: Redis;
    databaseStore: { MESSAGE_DATABASE: string };
    body: any;
  }
}