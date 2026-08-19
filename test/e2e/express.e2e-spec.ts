import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  DefaultAppModule,
  ConfiguredAppModule,
  CatchAllAppModule,
  MapperAppModule,
  ValidationStatusesAppModule,
} from './test-app/app.module';

describe('Express E2E', () => {
  describe('default configuration', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [DefaultAppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
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

    it('delegates a non-error HttpException status to NestJS', async () => {
      const { headers } = await request(app.getHttpServer()).get('/test/redirect-ish').expect(302);

      // Not a problem document: RFC 9457 covers error responses only.
      expect(headers['content-type']).not.toMatch(/problem\+json/);
    });

    it('returns problem details for @ProblemType decorated exception', async () => {
      const { body } = await request(app.getHttpServer()).get('/test/custom-exception').expect(422);

      expect(body).toEqual({
        type: 'https://example.com/problems/insufficient-funds',
        title: 'Insufficient Funds',
        status: 422,
        detail: 'Balance 50 is less than required 100',
      });
    });

    it('returns Tier 1 validation errors (flat string array)', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/test/validate-default')
        .send({ email: 'not-an-email', age: -5 })
        .expect(400);

      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Bad Request');
      expect(body.status).toBe(400);
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toBeInstanceOf(Array);
      expect(body.errors.length).toBeGreaterThan(0);
      expect(body.errors.every((e: unknown) => typeof e === 'string')).toBe(true);
    });

    it('returns Tier 2 validation errors (structured)', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/test/validate-enhanced')
        .send({ email: 'not-an-email', age: -5 })
        .expect(400);

      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Bad Request');
      expect(body.status).toBe(400);
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toBeInstanceOf(Array);
      expect(body.errors[0]).toHaveProperty('property');
      expect(body.errors[0]).toHaveProperty('constraints');
    });

    it('preserves 422 validation messages in detail when 422 is not a declared validation status', async () => {
      // Default validationStatuses is [400]: the 422 ValidationPipe output is
      // not classified as validation, but the messages survive joined in detail.
      const { body } = await request(app.getHttpServer())
        .post('/test/validate-422')
        .send({ email: 'not-an-email', age: -5 })
        .expect(422);

      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Unprocessable Entity');
      expect(body.status).toBe(422);
      expect(typeof body.detail).toBe('string');
      expect(body.detail.length).toBeGreaterThan(0);
      expect(body.errors).toBeUndefined();
    });

    it('does not catch unhandled exceptions by default', async () => {
      // Default NestJS error handler returns its own format
      const { body } = await request(app.getHttpServer()).get('/test/unhandled').expect(500);

      // Should NOT be problem+json format — it fell through to Nest's default
      expect(body.type).toBeUndefined();
    });
  });

  describe('configured with instanceStrategy and typeBaseUri', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ConfiguredAppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('includes instance from request-uri strategy', async () => {
      const { body } = await request(app.getHttpServer()).get('/test/not-found').expect(404);

      expect(body.instance).toBe('/test/not-found');
    });

    it('generates type URI with typeBaseUri', async () => {
      const { body } = await request(app.getHttpServer()).get('/test/not-found').expect(404);

      expect(body.type).toBe('https://api.example.com/problems/not-found');
    });
  });

  describe('configured with catchAllExceptions', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [CatchAllAppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('catches unhandled exceptions as 500 problem details', async () => {
      const { body, headers } = await request(app.getHttpServer())
        .get('/test/unhandled')
        .expect(500);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body).toEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
      });
      expect(body.detail).toBeUndefined();
    });

    it('does not attempt a second write when the response is already committed', async () => {
      const response = await request(app.getHttpServer()).get('/test/committed').expect(200);
      expect(response.text).toBe('partial');
    });
  });

  describe('configured with exceptionMapper', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MapperAppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('exceptionMapper overrides decorated exception', async () => {
      const { body } = await request(app.getHttpServer()).get('/test/custom-exception').expect(422);

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
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns Tier 1 validation errors at a declared custom errorHttpStatusCode (422)', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/test/validate-422')
        .send({ email: 'not-an-email', age: -5 })
        .expect(422);

      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Unprocessable Entity');
      expect(body.status).toBe(422);
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toBeInstanceOf(Array);
      expect(body.errors.length).toBeGreaterThan(0);
      expect(body.errors.every((e: unknown) => typeof e === 'string')).toBe(true);
    });

    it('still handles default 400 validation alongside the declared 422', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/test/validate-default')
        .send({ email: 'not-an-email', age: -5 })
        .expect(400);

      expect(body.title).toBe('Bad Request');
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toBeInstanceOf(Array);
    });
  });
});
