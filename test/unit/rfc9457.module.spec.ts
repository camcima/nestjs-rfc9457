import { Test } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { Rfc9457Module } from '../../src/rfc9457.module';
import { ProblemDetailsFactory } from '../../src/problem-details.factory';
import { RFC9457_MODULE_OPTIONS } from '../../src/rfc9457.constants';
import { Rfc9457ModuleOptions, Rfc9457OptionsFactory } from '../../src/rfc9457.interfaces';
import { Injectable, Module } from '@nestjs/common';

const mockAdapterHost = {
  httpAdapter: {
    setHeader: jest.fn(),
    reply: jest.fn(),
  },
};

describe('Rfc9457Module', () => {
  describe('forRoot()', () => {
    it('registers ProblemDetailsFactory as a provider', async () => {
      const module = await Test.createTestingModule({
        imports: [Rfc9457Module.forRoot()],
      })
        .overrideProvider(HttpAdapterHost)
        .useValue(mockAdapterHost)
        .compile();

      const factory = module.get(ProblemDetailsFactory);
      expect(factory).toBeInstanceOf(ProblemDetailsFactory);
    });

    it('registers module options with defaults', async () => {
      const module = await Test.createTestingModule({
        imports: [Rfc9457Module.forRoot()],
      })
        .overrideProvider(HttpAdapterHost)
        .useValue(mockAdapterHost)
        .compile();

      const options = module.get(RFC9457_MODULE_OPTIONS);
      expect(options).toEqual({});
    });

    it('passes custom options through', async () => {
      const module = await Test.createTestingModule({
        imports: [
          Rfc9457Module.forRoot({
            typeBaseUri: 'https://example.com/problems',
            catchAllExceptions: true,
          }),
        ],
      })
        .overrideProvider(HttpAdapterHost)
        .useValue(mockAdapterHost)
        .compile();

      const options: Rfc9457ModuleOptions = module.get(RFC9457_MODULE_OPTIONS);
      expect(options.typeBaseUri).toBe('https://example.com/problems');
      expect(options.catchAllExceptions).toBe(true);
    });
  });

  describe('forRootAsync()', () => {
    it('supports useFactory', async () => {
      const module = await Test.createTestingModule({
        imports: [
          Rfc9457Module.forRootAsync({
            useFactory: () => ({
              typeBaseUri: 'https://example.com/async',
            }),
          }),
        ],
      })
        .overrideProvider(HttpAdapterHost)
        .useValue(mockAdapterHost)
        .compile();

      const options: Rfc9457ModuleOptions = module.get(RFC9457_MODULE_OPTIONS);
      expect(options.typeBaseUri).toBe('https://example.com/async');
    });

    it('supports useClass', async () => {
      @Injectable()
      class TestOptionsFactory implements Rfc9457OptionsFactory {
        createRfc9457Options(): Rfc9457ModuleOptions {
          return { instanceStrategy: 'uuid' };
        }
      }

      const module = await Test.createTestingModule({
        imports: [
          Rfc9457Module.forRootAsync({
            useClass: TestOptionsFactory,
          }),
        ],
      })
        .overrideProvider(HttpAdapterHost)
        .useValue(mockAdapterHost)
        .compile();

      const options: Rfc9457ModuleOptions = module.get(RFC9457_MODULE_OPTIONS);
      expect(options.instanceStrategy).toBe('uuid');
    });

    it('supports useExisting', async () => {
      @Injectable()
      class ExistingOptionsFactory implements Rfc9457OptionsFactory {
        createRfc9457Options(): Rfc9457ModuleOptions {
          return { catchAllExceptions: true };
        }
      }

      @Module({
        providers: [ExistingOptionsFactory],
        exports: [ExistingOptionsFactory],
      })
      class ExistingOptionsModule {}

      const module = await Test.createTestingModule({
        imports: [
          ExistingOptionsModule,
          Rfc9457Module.forRootAsync({
            imports: [ExistingOptionsModule],
            useExisting: ExistingOptionsFactory,
          }),
        ],
      })
        .overrideProvider(HttpAdapterHost)
        .useValue(mockAdapterHost)
        .compile();

      const options: Rfc9457ModuleOptions = module.get(RFC9457_MODULE_OPTIONS);
      expect(options.catchAllExceptions).toBe(true);
    });
  });
});
