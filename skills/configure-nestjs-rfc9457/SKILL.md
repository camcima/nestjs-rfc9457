---
name: configure-nestjs-rfc9457
description: Install and wire the @camcima/nestjs-rfc9457 library into a NestJS application so every HTTP error becomes an RFC 9457 / RFC 7807 Problem Details (application/problem+json) response. Use this skill whenever the user asks to standardize NestJS error responses, adopt Problem Details, return application/problem+json, integrate @camcima/nestjs-rfc9457, configure Rfc9457Module, set up structured validation errors with class-validator, document error responses in Swagger/OpenAPI, or normalize 4xx/5xx payloads in a Nest app — even if they only describe the symptom (inconsistent error shapes, "make my errors look the same", RFC 7807, problem+json) without naming the package.
metadata:
  package: '@camcima/nestjs-rfc9457'
  framework: nestjs
---

# Configure @camcima/nestjs-rfc9457

Install `@camcima/nestjs-rfc9457` and wire it into a NestJS app. The package's [README on npm](https://www.npmjs.com/package/@camcima/nestjs-rfc9457) (also at `node_modules/@camcima/nestjs-rfc9457/README.md` once installed) has the full API; consult it for option shapes and DTO details. This skill exists to lock in **judgment** — what to enable when, and what NOT to do.

## Decision flow

Read the user's signals and apply only the matching rows. Don't volunteer steps the user didn't ask for.

| Signal                                                                          | Action                                                                                               |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| "Add Problem Details" / "RFC 9457" with no other constraints                    | `Rfc9457Module.forRoot()` only — nothing else                                                        |
| Mentions a docs URL or `https://.../problems/...`                               | add `typeBaseUri`                                                                                    |
| Wants traceable error IDs / which-request-failed                                | `instanceStrategy: 'request-uri'` (path) or `'uuid'` (opaque)                                        |
| Project has `class-validator` DTOs + a global `ValidationPipe`                  | offer Tier 2 — pass `createRfc9457ValidationPipeExceptionFactory()` as the pipe's `exceptionFactory` |
| User wants structured / field-level / nested validation errors                  | Tier 2 (same as above)                                                                               |
| Project uses `@nestjs/swagger` (look for `SwaggerModule.setup`)                 | offer Swagger integration — see "Swagger" below                                                      |
| Wants non-HTTP throwables (DB errors, plain `Error`) to also be Problem Details | `catchAllExceptions: true`                                                                           |
| Mentions Sentry / Datadog / structured logging for unhandled errors             | `onUnhandled` callback — **observability only, cannot change the response**                          |
| User has domain exception classes (e.g. `OrderNotFoundException`)               | decorate them with `@ProblemType({ type, title, status })`                                           |
| Config comes from `ConfigService` / env vars                                    | use `forRootAsync({ useFactory })`                                                                   |

Combine matching rows into one `forRoot({...})` call.

## Wiring (most common case)

```ts
// app.module.ts — global, exception filter auto-registers
import { Rfc9457Module } from '@camcima/nestjs-rfc9457';

@Module({
  imports: [Rfc9457Module.forRoot(/* options from decision flow */)],
})
export class AppModule {}
```

Don't touch `main.ts` for the baseline case. The module is `@Global()` and registers its filter via `APP_FILTER` internally.

## Tier 2 validation (when offered)

Find the existing `ValidationPipe` registration and **add** `exceptionFactory`. Preserve every other option (`whitelist`, `forbidNonWhitelisted`, `transform`, `transformOptions`, …) — losing them is a real footgun.

```ts
import { createRfc9457ValidationPipeExceptionFactory } from '@camcima/nestjs-rfc9457';

new ValidationPipe({
  /* ...keep all existing options... */
  exceptionFactory: createRfc9457ValidationPipeExceptionFactory(),
});
```

## Swagger (when offered)

Two requirements that are easy to miss:

1. Import `DiscoveryModule` from `@nestjs/core` in `AppModule` (sibling to `Rfc9457Module`).
2. Call `applyProblemDetailResponses(app)` **inside the lazy factory** passed to `SwaggerModule.setup` — DI must be wired before it walks the controller graph.

```ts
import { applyProblemDetailResponses } from '@camcima/nestjs-rfc9457/swagger';

SwaggerModule.setup('/api', app, () => {
  applyProblemDetailResponses(app, {
    statuses: [
      /* every status the API actually returns, e.g. 400, 404, 422, 500 */
    ],
    validationStatuses: [
      /* statuses that use Tier 2 structured errors */
    ],
  });
  return SwaggerModule.createDocument(app, config);
});
```

Pass the actual `statuses` the API returns — the `[400, 500]` default misses common ones like 401/404/422. If the user uses Tier 2 (above), list those statuses in `validationStatuses` so the OpenAPI shape includes the structured `errors` array.

All Swagger exports live under the `/swagger` subpath so projects without `@nestjs/swagger` don't pay for the dependency. `@ProblemType()` itself imports from the root path, not `/swagger`.

## Pitfalls (the actually-non-obvious stuff)

- **Never** `app.useGlobalFilters(new Rfc9457ExceptionFilter(...))` or wire it via `APP_FILTER`. The module already does this; doubling up causes silent shadowing.
- **Never** add a second `ValidationPipe` for Tier 2 — modify the existing one in place.
- `onUnhandled` is observability-only. The 500 Problem Details still goes out regardless. To **replace** the response, use `exceptionMapper` instead.
- `@ProblemType()` on a child class is a **full override**, not a merge. Apply it only when you genuinely want different `type`/`title`/`status` than the parent.
- `@ProblemType()` on a plain `Error` (non-`HttpException`) only takes effect when `catchAllExceptions: true` is set.
- Tier 2 (structured) errors **bypass** `validationExceptionMapper`. If both are configured, the mapper is silently unused for class-validator errors.

## When done

- Run the project's typecheck (`tsc --noEmit` or `pnpm tsc --noEmit`) — wrong import paths surface here.
- Hit one error route and verify `Content-Type: application/problem+json` plus the `type`/`title`/`status` shape.
- Briefly tell the user **which options you turned on and why**, especially `catchAllExceptions` or `onUnhandled` since those affect production observability.
