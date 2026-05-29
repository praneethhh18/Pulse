import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// Full-wiring smoke test: boots the real app in demo mode and exercises the
// core endpoints end-to-end (DI graph, guards, filters, persistence, agent).
describe('Pulse API (integration, demo mode)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → ok, demo mode', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.storage).toBe('memory');
    expect(res.body.ai).toBe('demo');
  });

  it('GET /context/nudges → returns nudges', async () => {
    const res = await request(app.getHttpServer())
      .get('/context/nudges')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /overview → greeting + stats + nudges', async () => {
    const res = await request(app.getHttpServer()).get('/overview').expect(200);
    expect(res.body.greetingName).toBeTruthy();
    expect(res.body.stats).toBeDefined();
    expect(Array.isArray(res.body.nudges)).toBe(true);
  });

  it('POST /agent/chat → grounded demo answer', async () => {
    const res = await request(app.getHttpServer())
      .post('/agent/chat')
      .send({ message: 'what is due this week?' })
      .expect(201);
    expect(res.body.mode).toBe('demo');
    expect(typeof res.body.answer).toBe('string');
    expect(res.body.answer.length).toBeGreaterThan(0);
  });

  it('GET /documents/search → finds by meaning', async () => {
    const res = await request(app.getHttpServer())
      .get('/documents/search')
      .query({ q: 'health coverage' })
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]?.title).toBe('Health Insurance Policy');
  });
});
