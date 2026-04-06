import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  DefaultAppModule,
  ConfiguredAppModule,
  CatchAllAppModule,
  MapperAppModule,
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
});
