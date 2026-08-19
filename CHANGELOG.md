# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the version is below 1.0.0, minor releases may contain breaking changes;
those are marked **BREAKING**.

Maintained by hand: add your entry to `## [Unreleased]` in the same pull request
as the change. Commit messages already follow
[Conventional Commits](https://www.conventionalcommits.org/) (enforced by
commitlint), so this can be automated later with
`@release-it/conventional-changelog` if the manual step wears thin.

## [Unreleased]

### Added

- `ProblemDetailException` for throwing a complete problem document, including
  extension members, which a plain `HttpException` cannot carry. Combines with
  `@ProblemType()`: decorator metadata supplies the reusable identity, the
  instance supplies what happened this time.
- Per-occurrence response headers via `new ProblemDetailException(problem, { headers })`,
  and a global `responseHeaders` module option, for status companions such as
  `Retry-After` (429/503) and `WWW-Authenticate` (401).
- `onUnhandled` receives the resolved problem body as a third parameter, so the
  `instance` identifier the client sees can be recorded alongside the stack
  trace. The default log line now includes it too.
- `Rfc9457Request.originalUrl`: the `'request-uri'` instance strategy prefers it
  over `url`, which Express rewrites inside a mounted router.
- CI job verifying the declared lowest supported peers (NestJS 10, Swagger 7,
  class-validator 0.14) — previously the range was advertised but never executed.
- `SECURITY.md` with a private reporting channel and the disclosure scope.

### Changed

- **BREAKING:** an `HttpException` whose status is outside 400–599 (e.g.
  `new HttpException('moved', 302)`) is no longer rendered as a problem document.
  RFC 9457 covers error responses only, so emitting `application/problem+json` on
  a 3xx was non-conformant; the filter now hands such exceptions to NestJS's
  default handler, which sends its standard response at the requested status. An
  `exceptionMapper` that claims the exception still wins. Called directly, the
  factory clamps a non-error status to 500 and warns.
- The published package now ships JSDoc in its `.d.ts` files, so option
  documentation is visible on hover in an editor. Source maps resolve too: `src`
  is published alongside `dist` and declaration maps are emitted, making
  go-to-definition land on real source.
- An exception carrying `@ProblemType()` metadata that does not extend
  `HttpException` now logs a warning (once per class) when it is delegated to
  NestJS because `catchAllExceptions` is off, instead of silently ignoring the
  metadata.

### Fixed

- Tier 2 validation flattening no longer drops a validation-error object that
  legitimately appears under two different parents. Cycle detection now tracks
  the current recursion path rather than every node ever visited, so genuine
  cycles are still broken while shared subtrees are emitted in full.
- The `'request-uri'` instance strategy reports the client-facing path for
  handlers inside a mounted Express router.
- Documentation: the custom-exception-filter example wrote its response with
  `res.json(...)`, which sends `application/json` and silently loses RFC 9457
  conformance. It now writes through the HTTP adapter and sets
  `application/problem+json` explicitly.

## [0.5.0] - 2026-07-09

### Added

- `suppress5xxDetail` option to strip `detail` from every 5xx problem response.

### Changed

- **BREAKING:** Tier 2 validation status is configurable.
  `Rfc9457ValidationException` extends `HttpException` rather than
  `BadRequestException`, so `instanceof BadRequestException` no longer matches.
  `createRfc9457ValidationPipeExceptionFactory({ status })` sets the status, and
  the `validationStatuses` module option declares which statuses count as
  validation errors.

### Fixed

- Callback failures are contained end to end: `exceptionMapper`,
  `validationExceptionMapper`, `instanceStrategy`, and `onUnhandled` (including
  rejected promises from `async` callbacks) can no longer replace the response
  or crash the process.
- Non-error statuses supplied by mappers and decorators are rejected, and
  `Rfc9457ValidationException` rejects out-of-range, `NaN`, and non-integer
  statuses.
- The response write is skipped when headers are already sent, mirroring
  `BaseExceptionFilter`.
- Malformed and cyclic Tier 2 validation errors are tolerated.
- `applyProblemDetailResponses` is idempotent across repeated invocations.

## [0.4.0] - 2026-06-23

### Changed

- **BREAKING:** code review remediation across the public surface, plus
  dependency updates ([#67](https://github.com/camcima/nestjs-rfc9457/pull/67)).

## [0.3.2] - 2026-05-30

### Changed

- Dependency and tooling maintenance.

## [0.3.1] - 2026-04-30

### Added

- `configure-nestjs-rfc9457` coding-agent skill.

### Fixed

- Test isolation in the `applyProblemDetailResponses` spec.

## [0.3.0] - 2026-04-23

### Added

- Unhandled non-HTTP exceptions are logged at `error` level.

### Fixed

- `Rfc9457ExceptionFilter` logger context is preserved.
- Vulnerable transitive dev dependencies resolved; pnpm pinned to 9.15.0.

## [0.2.0] - 2026-04-06

### Added

- Swagger/OpenAPI integration: `ProblemDetailDto`, `ValidationProblemDetailDto`,
  and `applyProblemDetailResponses()`.

## [0.1.0] - 2026-04-06

### Added

- Initial public release: `Rfc9457Module`, `ProblemDetailsFactory`,
  `Rfc9457ExceptionFilter`, `@ProblemType()`, and `ValidationPipe` integration.

## [0.0.2] - 2026-04-06

### Added

- Initial package scaffold.

[unreleased]: https://github.com/camcima/nestjs-rfc9457/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/camcima/nestjs-rfc9457/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/camcima/nestjs-rfc9457/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/camcima/nestjs-rfc9457/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/camcima/nestjs-rfc9457/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/camcima/nestjs-rfc9457/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/camcima/nestjs-rfc9457/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/camcima/nestjs-rfc9457/compare/v0.0.2...v0.1.0
[0.0.2]: https://github.com/camcima/nestjs-rfc9457/releases/tag/v0.0.2
