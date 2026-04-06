import { DynamicModule, Module, Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ProblemDetailsFactory } from './problem-details.factory';
import { Rfc9457ExceptionFilter } from './rfc9457.exception-filter';
import { RFC9457_MODULE_OPTIONS } from './rfc9457.constants';
import {
  Rfc9457AsyncModuleOptions,
  Rfc9457ModuleOptions,
  Rfc9457OptionsFactory,
} from './rfc9457.interfaces';

@Module({})
export class Rfc9457Module {
  static forRoot(options: Rfc9457ModuleOptions = {}): DynamicModule {
    return {
      module: Rfc9457Module,
      global: true,
      providers: [
        {
          provide: RFC9457_MODULE_OPTIONS,
          useValue: options,
        },
        ProblemDetailsFactory,
        Rfc9457ExceptionFilter,
        {
          provide: APP_FILTER,
          useExisting: Rfc9457ExceptionFilter,
        },
      ],
      exports: [ProblemDetailsFactory, RFC9457_MODULE_OPTIONS],
    };
  }

  static forRootAsync(options: Rfc9457AsyncModuleOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);
    return {
      module: Rfc9457Module,
      global: true,
      imports: options.imports || [],
      providers: [
        ...asyncProviders,
        ProblemDetailsFactory,
        Rfc9457ExceptionFilter,
        {
          provide: APP_FILTER,
          useExisting: Rfc9457ExceptionFilter,
        },
      ],
      exports: [ProblemDetailsFactory, RFC9457_MODULE_OPTIONS],
    };
  }

  private static createAsyncProviders(options: Rfc9457AsyncModuleOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: RFC9457_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }
    if (options.useClass) {
      return [
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: RFC9457_MODULE_OPTIONS,
          useFactory: (factory: Rfc9457OptionsFactory) => factory.createRfc9457Options(),
          inject: [options.useClass],
        },
      ];
    }
    if (options.useExisting) {
      return [
        {
          provide: RFC9457_MODULE_OPTIONS,
          useFactory: (factory: Rfc9457OptionsFactory) => factory.createRfc9457Options(),
          inject: [options.useExisting],
        },
      ];
    }
    return [];
  }
}
