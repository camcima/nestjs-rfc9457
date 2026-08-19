import { INestApplication, Type } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import * as http from 'node:http';
import { ProblemDetailDto, ValidationProblemDetailDto } from './problem-detail.dto';

/**
 * Structural view of a discovered controller passed to the `filter` option.
 * Deliberately typed structurally (rather than as Nest's internal
 * `InstanceWrapper`) so the published type declarations do not depend on
 * non-semver-protected `@nestjs/core` internals.
 */
export interface DiscoveredController {
  /** The controller class, when available. */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- must remain a supertype of Nest's InstanceWrapper['metatype'] (Type<T> | Function | null)
  metatype?: Type<unknown> | Function | null;
  /** The provider token name (usually the class name). */
  name?: string;
}

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

  /**
   * Return `false` to skip a controller (e.g. health-check controllers).
   * Receives the discovered controller wrapper. Default: include all controllers.
   */
  filter?: (controller: DiscoveredController) => boolean;
}

/**
 * Tracks which statuses have already been applied to each controller class,
 * making repeated invocations (lazy document factories, hot reload, multiple
 * SwaggerModule.setup calls) idempotent. Per status, the first call's options
 * win. WeakMap-keyed by the controller constructor so reloaded module graphs
 * with fresh classes are documented anew while stale classes can be collected.
 *
 * Deliberately keyed by class rather than by application, even though two Nest
 * apps in one process can share controller classes. `@ApiResponse` stores its
 * metadata *on the class*, which both apps then read, so per-application
 * options are not representable: applying twice does not give each app its own
 * view, it appends a second response object to the shared class and
 * @nestjs/swagger merges the two into one entry with a doubled description
 * ("Bad Request\n\nBad Request"). First-wins is therefore the only coherent
 * policy — see the caveat in the JSDoc of applyProblemDetailResponses.
 */
const appliedStatuses = new WeakMap<object, Set<number>>();

/**
 * Programmatically applies `@ApiResponse` decorators for RFC 9457 Problem Details
 * to every controller discovered in the application.
 *
 * Responses are documented under `application/problem+json` as required by RFC 9457.
 * All statuses use the base `ProblemDetailDto` by default. To document Tier 2
 * structured validation errors, pass `validationStatuses: [400]`.
 *
 * Idempotent per controller class and status: it is safe to call this more than
 * once (lazy document factories invoked repeatedly, hot reload, multiple
 * `SwaggerModule.setup()` calls) — for a given controller and status, only the
 * first call's options are applied.
 *
 * Granularity is per controller, not per route: every route on a documented
 * controller receives every configured status. Use the `filter` option to skip
 * controllers this is wrong for, and per-route `@ApiResponse()` decorators for
 * finer control.
 *
 * **Caveat — two applications sharing a controller class in one process** (an
 * e2e suite, a monorepo harness): the first call wins for that class, and a
 * later call with different `validationStatuses` is ignored. This is a
 * constraint of `@nestjs/swagger`, not a cache policy choice — `@ApiResponse`
 * writes its metadata onto the class itself, so both applications necessarily
 * read the same annotations. Give each application its own controller classes
 * if they must be documented differently.
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
  let discoveryService: DiscoveryService;
  try {
    discoveryService = app.get(DiscoveryService);
  } catch (error) {
    throw new Error(
      'applyProblemDetailResponses requires DiscoveryModule. Add DiscoveryModule (from @nestjs/core) to your application module imports.',
      { cause: error },
    );
  }
  const controllers = discoveryService.getControllers();
  const statuses = options?.statuses ?? [400, 500];
  const validationStatuses = new Set(options?.validationStatuses ?? []);

  for (const controller of controllers) {
    if (!controller.metatype) continue;
    if (options?.filter && !options.filter(controller)) continue;

    let applied = appliedStatuses.get(controller.metatype);
    if (!applied) {
      applied = new Set<number>();
      appliedStatuses.set(controller.metatype, applied);
      ApiExtraModels(ProblemDetailDto, ValidationProblemDetailDto)(controller.metatype);
    }

    for (const status of statuses) {
      if (applied.has(status)) continue;
      applied.add(status);

      const dtoClass = validationStatuses.has(status)
        ? ValidationProblemDetailDto
        : ProblemDetailDto;

      ApiResponse({
        status,
        description: http.STATUS_CODES[status] ?? `HTTP ${status}`,
        content: {
          'application/problem+json': {
            schema: { $ref: getSchemaPath(dtoClass) },
          },
        },
      })(controller.metatype);
    }
  }
}
