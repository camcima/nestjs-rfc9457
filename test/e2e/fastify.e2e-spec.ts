import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import {
  DefaultAppModule,
  ConfiguredAppModule,
  CatchAllAppModule,
  MapperAppModule,
  ValidationStatusesAppModule,
} from './test-app/app.module';

describe('Fastify E2E', () => {
  describe('default configuration', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [DefaultAppModule],
      }).compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns problem details for NotFoundException', async () => {
      const { body, headers } = await request(app.getHttpServer())
        .get('/test/not-found')
        .expect(404);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body).toEqual({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Resource not found',
      });
    });

    it('returns extension members from a ProblemDetailException', async () => {
      const { body, headers } = await request(app.getHttpServer())
        .get('/test/problem-detail')
        .expect(402);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body).toEqual({
        type: 'https://api.example.com/problems/insufficient-funds',
        title: 'Insufficient Funds',
        status: 402,
        detail: 'Your balance is too low to cover this transfer.',
        balance: 30,
        cost: 50,
      });
    });

    it('sends headers carried by a ProblemDetailException', async () => {
      const { body, headers } = await request(app.getHttpServer())
        .get('/test/rate-limited')
        .expect(429);

      expect(headers['retry-after']).toBe('60');
      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body.retryAfterSeconds).toBe(60);
    });

    it('keeps the problem media type when the body has a statusCode extension', async () => {
      // Nest's adapters overwrite Content-Type with application/json whenever
      // the reply body has statusCode >= 400.
      const { body, headers } = await request(app.getHttpServer())
        .get('/test/status-code-extension')
        .expect(400);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body.statusCode).toBe(400);
    });

    it('drops an invalid header instead of failing the problem response', async () => {
      const { body, headers } = await request(app.getHttpServer())
        .get('/test/bad-header')
        .expect(400);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(headers['x-trace']).toBeUndefined();
      expect(headers['retry-after']).toBe('60');
      expect(body).toEqual({ type: 'about:blank', title: 'Bad Request', status: 400 });
    });

    it('delegates a non-error HttpException status to NestJS', async () => {
      const { headers } = await request(app.getHttpServer()).get('/test/redirect-ish').expect(302);

      // Not a problem document: RFC 9457 covers error responses only.
      expect(headers['content-type']).not.toMatch(/problem\+json/);
    });

    it('returns problem details for @ProblemType decorated exception', async () => {
      const { body } = await request(app.getHttpServer()).get('/test/custom-exception').expect(422);

      expect(body.type).toBe('https://example.com/problems/insufficient-funds');
      expect(body.title).toBe('Insufficient Funds');
      expect(body.status).toBe(422);
    });

    it('returns Tier 1 validation errors', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/test/validate-default')
        .send({ email: 'bad', age: -1 })
        .expect(400);

      expect(body.type).toBe('about:blank');
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toBeInstanceOf(Array);
    });

    it('returns Tier 2 validation errors', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/test/validate-enhanced')
        .send({ email: 'bad', age: -1 })
        .expect(400);

      expect(body.errors[0]).toHaveProperty('property');
      expect(body.errors[0]).toHaveProperty('constraints');
    });
  });

  describe('configured with instanceStrategy and typeBaseUri', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ConfiguredAppModule],
      }).compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('request-uri instance strategy works with Fastify', async () => {
      const { body } = await request(app.getHttpServer()).get('/test/not-found').expect(404);

      expect(body.instance).toBe('/test/not-found');
    });
  });

  describe('configured with catchAllExceptions', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [CatchAllAppModule],
      }).compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('catches unhandled exceptions as 500 problem details on Fastify', async () => {
      const { body, headers } = await request(app.getHttpServer())
        .get('/test/unhandled')
        .expect(500);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Internal Server Error');
      expect(body.status).toBe(500);
      expect(body.detail).toBeUndefined();
    });

    it('preserves the 413 for an oversized request body', async () => {
      // Fastify's default body limit is 1 MiB.
      const { body, headers } = await request(app.getHttpServer())
        .post('/test/validate-default')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ padding: 'x'.repeat(2 * 1024 * 1024) }))
        .expect(413);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body.status).toBe(413);
      expect(body.title).toBe('Payload Too Large');
    });
  });

  describe('configured with exceptionMapper', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MapperAppModule],
      }).compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('exceptionMapper overrides decorated exception', async () => {
      const { body, headers } = await request(app.getHttpServer())
        .get('/test/custom-exception')
        .expect(422);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body.type).toBe('https://api.example.com/problems/mapper-override');
      expect(body.title).toBe('Mapper Override');
    });

    it('falls through to default handling when mapper returns null', async () => {
      const { body } = await request(app.getHttpServer()).get('/test/not-found').expect(404);

      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Not Found');
    });
  });

  describe('configured with validationStatuses: [400, 422]', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ValidationStatusesAppModule],
      }).compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns Tier 1 validation errors at a declared custom errorHttpStatusCode (422)', async () => {
      const { body, headers } = await request(app.getHttpServer())
        .post('/test/validate-422')
        .send({ email: 'not-an-email', age: -5 })
        .expect(422);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body.title).toBe('Unprocessable Entity');
      expect(body.status).toBe(422);
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toBeInstanceOf(Array);
    });
  });
});
