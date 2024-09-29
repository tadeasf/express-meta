import { Elysia } from 'elysia';

export const loadCpuRoutes = new Elysia()
  .get('/load-cpu', () => {
    let total = 0;
    const startTime = Date.now();
    for (let i = 0; i < 70000000; i++) {
      total += Math.sqrt(i) * Math.random();
      total -= Math.pow(i, 2) * Math.random();
      total *= Math.sin(i) * Math.random();
    }
    const endTime = Date.now();
    const duration = endTime - startTime;
    return {
      duration: `${duration} ms`,
      result: total,
    };
  });