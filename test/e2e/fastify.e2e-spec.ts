import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { DefaultAppModule, ConfiguredAppModule, CatchAllAppModule } from './test-app/app.module';

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
  });
});
