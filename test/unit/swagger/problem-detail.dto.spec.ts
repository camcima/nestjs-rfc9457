import { Controller, Get, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import {
  ProblemDetailDto,
  ValidationErrorDto,
  ValidationProblemDetailDto,
} from '../../../src/swagger/problem-detail.dto';

@Controller('test')
class StubController {
  @Get()
  index() {
    return 'ok';
  }
}

@Module({
  imports: [DiscoveryModule],
  controllers: [StubController],
})
class StubModule {}

describe('ProblemDetailDto', () => {
  it('produces an OpenAPI schema with the five RFC 9457 fields', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [StubModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const config = new DocumentBuilder().build();
    const document = SwaggerModule.createDocument(app, config, {
      extraModels: [ProblemDetailDto],
    });

    const schema = document.components?.schemas?.['ProblemDetailDto'] as any;
    expect(schema).toBeDefined();
    expect(schema.properties.type).toBeDefined();
    expect(schema.properties.title).toBeDefined();
    expect(schema.properties.status).toBeDefined();
    expect(schema.properties.detail).toBeDefined();
    expect(schema.properties.instance).toBeDefined();

    expect(schema.required).toContain('status');
    expect(schema.required).not.toContain('type');
    expect(schema.required).not.toContain('title');
    expect(schema.required).not.toContain('detail');
    expect(schema.required).not.toContain('instance');

    await app.close();
  });
});

describe('ValidationErrorDto', () => {
  it('produces an OpenAPI schema with property, constraints, and children', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [StubModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const config = new DocumentBuilder().build();
    const document = SwaggerModule.createDocument(app, config, {
      extraModels: [ValidationErrorDto],
    });

    const schema = document.components?.schemas?.['ValidationErrorDto'] as any;
    expect(schema).toBeDefined();
    expect(schema.properties.property).toBeDefined();
    expect(schema.properties.constraints).toBeDefined();
    expect(schema.properties.children).toBeDefined();
    expect(schema.properties.children.items.$ref).toContain('ValidationErrorDto');

    expect(schema.required).toContain('property');
    expect(schema.required).not.toContain('constraints');
    expect(schema.required).not.toContain('children');

    await app.close();
  });
});

describe('ValidationProblemDetailDto', () => {
  it('extends ProblemDetailDto', () => {
    const dto = new ValidationProblemDetailDto();
    expect(dto).toBeInstanceOf(ProblemDetailDto);
  });

  it('produces an OpenAPI schema with errors array referencing ValidationErrorDto', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [StubModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const config = new DocumentBuilder().build();
    const document = SwaggerModule.createDocument(app, config, {
      extraModels: [ValidationProblemDetailDto],
    });

    const schema = document.components?.schemas?.['ValidationProblemDetailDto'] as any;
    expect(schema).toBeDefined();

    // Should reference the base schema via allOf and add errors
    const hasErrors =
      schema.properties?.errors || schema.allOf?.some((s: any) => s.properties?.errors);
    expect(hasErrors).toBeTruthy();

    await app.close();
  });
});
