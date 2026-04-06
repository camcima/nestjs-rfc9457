import { Controller, Get, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { applyProblemDetailResponses } from '../../../src/swagger/apply-problem-detail-responses';

@Controller('alpha')
class AlphaController {
  @Get()
  index() {
    return 'ok';
  }
}

@Controller('beta')
class BetaController {
  @Get()
  index() {
    return 'ok';
  }
}

@Module({
  imports: [DiscoveryModule],
  controllers: [AlphaController, BetaController],
})
class TestModule {}

function getResponseContent(pathObj: any, status: string) {
  return pathObj?.[status]?.content?.['application/problem+json'];
}

describe('applyProblemDetailResponses', () => {
  async function createApp() {
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    return app;
  }

  it('documents default 400 and 500 as ProblemDetailDto under application/problem+json', async () => {
    const app = await createApp();

    applyProblemDetailResponses(app);

    const config = new DocumentBuilder().build();
    const document = SwaggerModule.createDocument(app, config);

    for (const path of ['/alpha', '/beta']) {
      const responses = document.paths[path]?.get?.responses;

      const content400 = getResponseContent(responses, '400');
      expect(content400).toBeDefined();
      expect(content400.schema.$ref).toContain('ProblemDetailDto');
      expect(content400.schema.$ref).not.toContain('Validation');

      const content500 = getResponseContent(responses, '500');
      expect(content500).toBeDefined();
      expect(content500.schema.$ref).toContain('ProblemDetailDto');
      expect(content500.schema.$ref).not.toContain('Validation');
    }

    await app.close();
  });

  it('does not emit application/json for problem responses', async () => {
    const app = await createApp();

    applyProblemDetailResponses(app);

    const config = new DocumentBuilder().build();
    const document = SwaggerModule.createDocument(app, config);

    const responses = document.paths['/alpha']?.get?.responses as any;
    expect(responses?.['400']?.content?.['application/json']).toBeUndefined();
    expect(responses?.['500']?.content?.['application/json']).toBeUndefined();

    await app.close();
  });

  it('uses ProblemDetailDto for non-validation statuses', async () => {
    const app = await createApp();

    applyProblemDetailResponses(app, { statuses: [404, 500] });

    const config = new DocumentBuilder().build();
    const document = SwaggerModule.createDocument(app, config);

    const responses = document.paths['/alpha']?.get?.responses;
    const content404 = getResponseContent(responses, '404');
    expect(content404.schema.$ref).toContain('ProblemDetailDto');
    expect(content404.schema.$ref).not.toContain('Validation');

    await app.close();
  });

  it('applies custom statuses', async () => {
    const app = await createApp();

    applyProblemDetailResponses(app, { statuses: [401, 403, 404] });

    const config = new DocumentBuilder().build();
    const document = SwaggerModule.createDocument(app, config);

    const responses = document.paths['/alpha']?.get?.responses;
    expect(getResponseContent(responses, '401')).toBeDefined();
    expect(getResponseContent(responses, '403')).toBeDefined();
    expect(getResponseContent(responses, '404')).toBeDefined();

    await app.close();
  });

  it('uses ValidationProblemDetailDto for explicitly configured validation statuses', async () => {
    const app = await createApp();

    applyProblemDetailResponses(app, {
      statuses: [400, 422, 500],
      validationStatuses: [400, 422],
    });

    const config = new DocumentBuilder().build();
    const document = SwaggerModule.createDocument(app, config);

    const responses = document.paths['/alpha']?.get?.responses;

    expect(getResponseContent(responses, '400')?.schema.$ref).toContain(
      'ValidationProblemDetailDto',
    );
    expect(getResponseContent(responses, '422')?.schema.$ref).toContain(
      'ValidationProblemDetailDto',
    );
    expect(getResponseContent(responses, '500')?.schema.$ref).not.toContain('Validation');

    await app.close();
  });

  it('sets description from HTTP status phrase', async () => {
    const app = await createApp();

    applyProblemDetailResponses(app, { statuses: [404] });

    const config = new DocumentBuilder().build();
    const document = SwaggerModule.createDocument(app, config);

    const responses = document.paths['/alpha']?.get?.responses as any;
    expect(responses['404'].description).toBe('Not Found');

    await app.close();
  });

  it('registers DTO schemas in components', async () => {
    const app = await createApp();

    applyProblemDetailResponses(app);

    const config = new DocumentBuilder().build();
    const document = SwaggerModule.createDocument(app, config);

    expect(document.components?.schemas?.['ProblemDetailDto']).toBeDefined();
    expect(document.components?.schemas?.['ValidationProblemDetailDto']).toBeDefined();
    expect(document.components?.schemas?.['ValidationErrorDto']).toBeDefined();

    await app.close();
  });
});
