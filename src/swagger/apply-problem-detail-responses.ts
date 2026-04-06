import { INestApplication } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import * as http from 'http';
import { ProblemDetailDto, ValidationProblemDetailDto } from './problem-detail.dto';

export interface ApplyProblemDetailResponsesOptions {
  /** HTTP status codes to document. Default: `[400, 500]`. */
  statuses?: number[];

  /**
   * Statuses that use `ValidationProblemDetailDto` (with the `errors` array)
   * instead of the base `ProblemDetailDto`. Default: `[]`.
   *
   * Set to `[400]` if you use `Rfc9457ValidationException` (Tier 2 structured
   * validation) and want the `errors` array documented in your OpenAPI spec.
   */
  validationStatuses?: number[];
}

/**
 * Programmatically applies `@ApiResponse` decorators for RFC 9457 Problem Details
 * to every controller discovered in the application.
 *
 * Responses are documented under `application/problem+json` as required by RFC 9457.
 * All statuses use the base `ProblemDetailDto` by default. To document Tier 2
 * structured validation errors, pass `validationStatuses: [400]`.
 *
 * Call this inside the lazy document factory passed to `SwaggerModule.setup()`
 * so that decorators are attached before the OpenAPI spec is generated:
 *
 * ```typescript
 * SwaggerModule.setup('/api', app, () => {
 *   applyProblemDetailResponses(app);
 *   return SwaggerModule.createDocument(app, config);
 * });
 * ```
 *
 * Requires `DiscoveryModule` from `@nestjs/core` to be imported in your app module.
 *
 * @param app - The NestJS application instance
 * @param options - Configuration options
 */
export function applyProblemDetailResponses(
  app: INestApplication,
  options?: ApplyProblemDetailResponsesOptions,
): void {
  const discoveryService = app.get(DiscoveryService);
  const controllers = discoveryService.getControllers();
  const statuses = options?.statuses ?? [400, 500];
  const validationStatuses = new Set(options?.validationStatuses ?? []);

  for (const controller of controllers) {
    if (!controller.metatype) continue;

    ApiExtraModels(ProblemDetailDto, ValidationProblemDetailDto)(controller.metatype);

    for (const status of statuses) {
      const dtoClass = validationStatuses.has(status)
        ? ValidationProblemDetailDto
        : ProblemDetailDto;

      ApiResponse({
        status,
        description: http.STATUS_CODES[status],
        content: {
          'application/problem+json': {
            schema: { $ref: getSchemaPath(dtoClass) },
          },
        },
      })(controller.metatype);
    }
  }
}
