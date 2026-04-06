# @camcima/nestjs-rfc9457 — Design Spec

## Overview

A NestJS library that converts all HTTP error responses into [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) Problem Details (`application/problem+json`) format. Provides sensible zero-config defaults with an opt-in customization layer for advanced use cases.

**Package**: `@camcima/nestjs-rfc9457`
**Target**: NestJS 10+ and 11+, Express and Fastify adapters
**Runtime dependencies**: None

## RFC 9457 Problem Details

RFC 9457 (July 2023) obsoletes RFC 7807. It defines a standard JSON format for HTTP API error responses with five standard members:

| Member     | Description                                             |
|------------|---------------------------------------------------------|
| `type`     | URI reference identifying the problem type              |
| `title`    | Short human-readable summary of the problem type        |
| `status`   | HTTP status code (advisory)                             |
| `detail`   | Human-readable explanation of this specific occurrence   |
| `instance` | URI reference identifying this specific occurrence       |

Extension members (arbitrary key-value pairs) are allowed for problem-type-specific data.

Key RFC 9457 additions over 7807: IANA Problem Types Registry, JSON Schema (non-normative), stronger guidance on `type` URIs, multi-problem handling recommendations.

---

## 1. Module Configuration & Public API

### `Rfc9457Module.forRoot(options?)`

```typescript
interface Rfc9457ModuleOptions {
  // When set, generates type URIs like '{typeBaseUri}/not-found'.
  // When omitted, type defaults to 'about:blank'.
  typeBaseUri?: string;

  // Strategy for populating the 'instance' field.
  // Default: 'none'
  instanceStrategy?:
    | 'request-uri'  // Uses the request URL path (e.g., '/api/users/42')
    | 'uuid'         // Generates a URN: 'urn:uuid:<v4>' (RFC 4122 format)
    | 'none'         // Omits instance (field not present in response)
    | ((request: Request, exception: unknown) => string | undefined);

  // When true, non-HttpException throwables become 500 problem details.
  // When false (default), non-HttpException throwables delegate to
  // Nest's default error handling via super.catch().
  catchAllExceptions?: boolean;

  // Custom exception-to-problem mapping callback.
  // Return a ProblemDetail to override default handling, or null to
  // fall through to the next resolution step.
  exceptionMapper?: (exception: unknown, request: Request) => ProblemDetail | null;

  // Custom validation error mapping (Tier 1 — flattened string arrays).
  // Receives the message array from BadRequestException.getResponse().
  // Return a ProblemDetail to override the built-in validation output.
  validationExceptionMapper?: (messages: string[], request: Request) => ProblemDetail;
}
```

### `Rfc9457Module.forRootAsync(options)`

Supports all three NestJS async module patterns:

- `useFactory` + `inject` (e.g., inject `ConfigService`)
- `useClass` (provide a class implementing `Rfc9457OptionsFactory`)
- `useExisting` (reuse an existing provider)

### `ProblemDetail` interface

```typescript
interface ProblemDetail {
  type?: string;               // URI reference — defaults to 'about:blank'
  title?: string;              // Short human-readable summary of the problem type
  status?: number;             // HTTP status code (advisory per RFC 9457)
  detail?: string;             // Human-readable explanation of this specific occurrence
  instance?: string;           // URI reference identifying this specific occurrence
  [key: string]: unknown;      // Extension members
}
```

### Peer dependencies

```json
{
  "peerDependencies": {
    "@nestjs/common": "^10.0.0 || ^11.0.0",
    "@nestjs/core": "^10.0.0 || ^11.0.0",
    "reflect-metadata": "^0.1.13 || ^0.2.0",
    "class-validator": "^0.14.0"
  },
  "peerDependenciesMeta": {
    "class-validator": {
      "optional": true
    }
  }
}
```

Zero runtime dependencies. `class-validator` is an optional peer dependency for users of the enhanced validation integration (Tier 2).

---

## 2. Core Components & Data Flow

### Components

#### `ProblemDetailsFactory` (injectable service)

The core resolver. Takes an exception and request context, returns a problem details response.

**Signature**: `create(exception: unknown, request: Request): { status: number; body: ProblemDetail }`

- `status` is the definitive HTTP status code for the response, decoupled from the advisory `body.status`.
- Exported publicly so users can reuse it outside the HTTP filter (e.g., GraphQL error formatters, microservice exception handlers).

**Resolution order** (most specific wins):

1. **`exceptionMapper` callback** — if configured and returns non-null, use that result.
2. **`@ProblemType()` decorator metadata** — if the exception class has decorator metadata, use it as a template and merge with runtime context (the factory fills missing `detail`, `instance`, extensions from the actual exception/request).
3. **Validation handling** — if the exception is a `Rfc9457ValidationException` (Tier 2) or a `BadRequestException` with a string-array `message` (Tier 1), apply validation mapping.
4. **Default `HttpException` handling** — extract status and message, map to RFC 9457 fields.
5. **Unknown exception fallback** — generic 500 (only reached when `catchAllExceptions` is true).

After resolution, the factory applies:

- **`type` normalization**:
  - Missing → `about:blank`
  - Bare slug (e.g., `not-found`) + `typeBaseUri` configured → `{typeBaseUri}/not-found`
  - User-supplied URI reference → pass through untouched
- **`instance`**: via the configured `instanceStrategy`

**Documented precedence policy**: User-declared `@ProblemType()` metadata outranks built-in validation mapping. If a user decorates a custom validation exception class with `@ProblemType()`, the decorator wins.

#### Core-field overwrite rules

After all mapping and merging, the factory owns final normalization of the five core RFC 9457 fields: `type`, `title`, `status`, `detail`, and `instance`. Extension members returned by mappers or decorator templates that collide with these keys are silently ignored — core fields are always controlled by the factory's resolution logic, never by extension data.

#### Partial mapper output and `status` fallback

When `exceptionMapper` returns a `ProblemDetail` without a `status` field, the factory applies this fallback chain:

1. Use mapper-provided `status` if present and a valid HTTP status code
2. Otherwise, if the exception is an `HttpException`, use `exception.getStatus()`
3. Otherwise (catch-all mode, non-HTTP exception), default to `500`

The same fallback applies to `@ProblemType()` templates missing a `status`.

#### `Rfc9457Request` type

The factory and all public callbacks use a minimal `Rfc9457Request` interface rather than platform-specific `Request` types:

```typescript
interface Rfc9457Request {
  url: string;
  method: string;
  [key: string]: unknown;
}
```

Both Express and Fastify request objects satisfy this interface. For non-HTTP reuse (GraphQL, microservices), callers construct a compatible object with at minimum `{ url, method }`.

#### `Rfc9457ExceptionFilter` (extends `BaseExceptionFilter`)

A thin shell that catches exceptions and delegates to the factory.

- Always `@Catch()` — catches everything (decorator metadata is static, not runtime-configurable).
- Logic:
  - If exception is an `HttpException` → delegate to `ProblemDetailsFactory.create()`, write problem details response
  - If exception is not an `HttpException` and `catchAllExceptions` is `true` → delegate to factory (produces 500)
  - Otherwise → `super.catch(exception, host)` (Nest's default behavior)
- Sets `Content-Type: application/problem+json` and writes the response via `HttpAdapterHost` (adapter-agnostic for Express and Fastify).

#### `@ProblemType()` decorator

Class decorator for user-defined exception classes. Stores a **template** (not the final object) via `Reflect.defineMetadata`.

**`ProblemTypeMetadata` interface**: Contains only problem type identity fields (`type`, `title`, `status`), all optional. Occurrence-specific fields (`detail`, `instance`) are always derived at runtime by the factory from the exception and request context — they are not part of the decorator template. When `status` is omitted, the factory infers it from the exception (`HttpException.getStatus()`) or defaults to `500` in catch-all mode.

```typescript
@ProblemType({
  type: 'https://api.example.com/problems/insufficient-funds',
  title: 'Insufficient Funds',
  status: 422,
})
export class InsufficientFundsException extends HttpException {
  constructor(
    public readonly balance: number,
    public readonly required: number,
  ) {
    super(`Balance ${balance} is less than required ${required}`, 422);
  }
}
```

The factory reads the template and merges it with runtime context — `detail` comes from the exception message, `instance` from the strategy, and extension members can be added via `exceptionMapper`.

**Inheritance semantics**: Metadata lookup walks the prototype chain. If a child class has its own `@ProblemType()` decorator, it **fully overrides** the parent — there is no merging of parent and child metadata. If a child class is undecorated but extends a decorated parent, the parent's metadata is used. This matches standard `Reflect.getMetadata` behavior with prototype chain traversal.

**Note**: `@ProblemType()` can also decorate plain `Error` subclasses (not extending `HttpException`), but these will only be handled by the factory when `catchAllExceptions: true`. Otherwise, they fall through to Nest's default error handling.

### Data flow

```
Exception thrown
  -> Rfc9457ExceptionFilter.catch(exception, host)
    -> Is HttpException?
       -> yes -> factory.create(exception, request)
    -> Is not HttpException?
       -> catchAllExceptions is true  -> factory.create(exception, request)
       -> catchAllExceptions is false -> super.catch(exception, host)
    -> factory.create(exception, request):
       -> 1. exceptionMapper?(exception, request) -> ProblemDetail | null
       -> 2. @ProblemType metadata? -> template, merge with runtime context
       -> 3. Validation errors? -> validation mapper
       -> 4. HttpException? -> extract status/message
       -> 5. Unknown fallback -> generic 500
       -> Normalize type (about:blank / slug expansion / passthrough)
       -> Apply instanceStrategy
       -> Return { status, body }
    -> Set Content-Type: application/problem+json
    -> Write response with status via HttpAdapterHost
```

---

## 3. Default HttpException Mapping

### Field mapping

When no custom mapper or decorator matches, `HttpException` instances are mapped as follows.

**When `typeBaseUri` is NOT configured** (default, `about:blank` mode):

| RFC 9457 Field | Source | Example (`new NotFoundException('User 42 not found')`) |
|---|---|---|
| `type` | `"about:blank"` | `"about:blank"` |
| `title` | HTTP status phrase (per RFC 9457 Section 4.2: when type is `about:blank`, title SHOULD be the HTTP reason phrase) | `"Not Found"` |
| `status` | `exception.getStatus()` | `404` |
| `detail` | Derived from exception response (see rules below) | `"User 42 not found"` |
| `instance` | Per configured `instanceStrategy` | `undefined` (when `'none'`) |

**When `typeBaseUri` IS configured** (custom type mode):

| RFC 9457 Field | Source | Example (typeBaseUri: `https://api.example.com/problems`) |
|---|---|---|
| `type` | `{typeBaseUri}/{slug}` where slug is derived from HTTP status phrase | `"https://api.example.com/problems/not-found"` |
| `title` | HTTP status phrase (library default for custom types, not RFC-mandated) | `"Not Found"` |
| `status` | `exception.getStatus()` | `404` |
| `detail` | Derived from exception response (see rules below) | `"User 42 not found"` |
| `instance` | Per configured `instanceStrategy` | `undefined` (when `'none'`) |

### `detail` derivation rules

- If `getResponse()` returns a `string` that differs from the default HTTP status phrase → use as `detail`
- If `getResponse()` returns an object with `message` as a non-empty `string` that differs from the default HTTP status phrase → use as `detail`
- If the value matches the default HTTP status phrase (e.g., `"Forbidden"` for a 403) → omit `detail` (it is boilerplate, not a user-provided message)
- Otherwise → omit `detail`
- Never stringify arbitrary objects into `detail`

### Slug generation

When `typeBaseUri` is configured, the type slug is derived from the HTTP status phrase (sourced from Node's built-in `http.STATUS_CODES`):

- `"Not Found"` → `not-found`
- `"Internal Server Error"` → `internal-server-error`
- `"Unprocessable Entity"` → `unprocessable-entity`

Simple lowercase + hyphenation.

### Unknown exception fallback (catch-all mode)

When `catchAllExceptions` is `true` and the exception is not an `HttpException`:

- `status`: `500`
- `title`: `"Internal Server Error"`
- `detail`: omitted (no internal information leaking)
- `type`: `"about:blank"` or `"{typeBaseUri}/internal-server-error"`

---

## 4. Validation Error Handling

### Tier 1: Default (filter-level, zero config)

Works automatically with NestJS's default `ValidationPipe` output.

**Detection**: Exception is a `BadRequestException` (status 400) and `exception.getResponse()` is an object whose `message` is an array of strings.

**Output**:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Request validation failed",
  "errors": [
    "email must be an email",
    "age must not be less than 0"
  ]
}
```

**Override**: via `validationExceptionMapper` in module config, which receives `(messages: string[], request: Request)` and returns a `ProblemDetail`.

### Tier 2: Enhanced (opt-in ValidationPipe integration)

For users who want rich structured output with `property`, `constraints`, and nested `children`, the library exports a helper:

```typescript
import { createRfc9457ValidationPipeExceptionFactory } from '@camcima/nestjs-rfc9457';

app.useGlobalPipes(
  new ValidationPipe({
    exceptionFactory: createRfc9457ValidationPipeExceptionFactory(),
  }),
);
```

This helper:

1. Receives the raw `ValidationError[]` from Nest's `ValidationPipe`
2. Wraps them in a `Rfc9457ValidationException` (extends `BadRequestException`) that preserves the full error tree
3. The filter/factory recognizes `Rfc9457ValidationException` by type check and produces structured output:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Request validation failed",
  "errors": [
    {
      "property": "email",
      "constraints": {
        "isEmail": "email must be an email"
      }
    },
    {
      "property": "address.zip",
      "constraints": {
        "isPostalCode": "zip must be a postal code"
      }
    }
  ]
}
```

Nested validation errors are preserved as `children` arrays, matching the `class-validator` `ValidationError` tree structure. They are NOT flattened to dotted paths (e.g., `"address.zip"`). This preserves the original structure and avoids lossy transformations.

`Rfc9457ValidationException` is exported (for `instanceof` checks) but not documented as a primary API — the helper factory is the recommended entry point.

### Precedence

`exceptionMapper` (step 1) > `@ProblemType()` (step 2) > validation handling (step 3) > default `HttpException` (step 4) > unknown fallback (step 5).

---

## 5. Testing Strategy

### Unit tests

**`ProblemDetailsFactory`** (bulk of testing):

- Default `HttpException` mapping — focused matrix:
  - 4xx with default message (no detail)
  - 4xx with custom string detail
  - 4xx with object response (detail derived from `message` string property)
  - 4xx with object response where `message` is not a string (detail omitted)
  - 5xx
- RFC-sensitive invariants:
  - Missing `type` becomes `about:blank`
  - `about:blank` responses use HTTP reason phrase as `title`
  - `body.status` matches returned transport `status`
  - Extension members do not overwrite core fields
- `detail` derivation rules (string, object with string message, object without, no response)
- `exceptionMapper` callback (returns value, returns null for fallthrough, returns partial/malformed output)
- `@ProblemType()` decorator metadata resolution:
  - Template merging with runtime context
  - Metadata on parent class, child thrown
  - Metadata on child overriding parent
  - Undecorated child extending decorated parent
- Tier 1 validation detection and mapping (flattened string arrays)
- Tier 2 `Rfc9457ValidationException` handling (structured `ValidationError[]`)
- Validation precedence: Tier 2 present vs. ordinary `BadRequestException` vs. `exceptionMapper` override
- `typeBaseUri` slug generation and passthrough of user-supplied URIs
- Each `instanceStrategy` variant (`request-uri`, `uuid`, `none`, custom callback returning string, custom callback returning `undefined`)
- Passthrough and non-leakage:
  - Unknown exception in catch-all mode does not expose stack/message
  - Arbitrary object thrown
  - String thrown
- Precedence order verification (mapper > decorator > validation > default > fallback)

**`Rfc9457ExceptionFilter`**:

- Delegates to factory and writes correct status + `Content-Type` header
- Falls through to `super.catch()` for non-HTTP exceptions when `catchAllExceptions` is false
- Handles non-HTTP exceptions when `catchAllExceptions` is true

**`@ProblemType()` decorator**:

- Metadata storage and retrieval
- Inheritance behavior (parent, child, override, undecorated child)

**`createRfc9457ValidationPipeExceptionFactory()`**:

- Produces `Rfc9457ValidationException` with preserved `ValidationError[]`
- Handles empty error arrays

**`Rfc9457Module`**:

- `forRoot()` registers filter globally with correct config
- `forRootAsync()` — all three patterns: `useFactory`, `useClass`, `useExisting`

### E2E tests

A minimal NestJS test app (in `test/e2e/test-app/`, not published) exercising real HTTP requests.

**Express adapter** (`express.e2e-spec.ts`):

- Standard `HttpException` → problem details response
- Custom `@ProblemType()` exception → correct mapping
- Validation Tier 1 (default `ValidationPipe`) → flat errors
- Validation Tier 2 (enhanced factory) → structured errors
- `exceptionMapper` override in real app context
- `Content-Type` starts with `application/problem+json` (frameworks may append charset)
- `request-uri` instance strategy produces correct value

**Fastify adapter** (`fastify.e2e-spec.ts`):

- Same assertion set as Express
- Adapter-neutral behavior verified

### Test style

- Exact body assertions for canonical cases (no snapshot tests) — this package is all about response shape
- Jest + `@nestjs/testing` + `supertest`

---

## 6. Project Structure & Build

### Directory layout

```
nestjs-rfc9457/
├── src/
│   ├── index.ts                                         # Public API barrel export
│   ├── rfc9457.module.ts                                # Rfc9457Module (forRoot / forRootAsync)
│   ├── rfc9457.constants.ts                             # DI tokens, metadata keys
│   ├── rfc9457.interfaces.ts                            # Rfc9457ModuleOptions, ProblemDetail, etc.
│   ├── problem-details.factory.ts                       # ProblemDetailsFactory
│   ├── rfc9457.exception-filter.ts                      # Rfc9457ExceptionFilter
│   ├── problem-type.decorator.ts                        # @ProblemType() decorator
│   ├── validation/
│   │   ├── rfc9457-validation.exception.ts              # Rfc9457ValidationException
│   │   └── rfc9457-validation-pipe-exception.factory.ts # createRfc9457ValidationPipeExceptionFactory
│   └── utils/
│       └── slug.ts                                      # Phrase -> kebab-case slug
├── test/
│   ├── unit/
│   │   ├── problem-details.factory.spec.ts
│   │   ├── rfc9457.exception-filter.spec.ts
│   │   ├── problem-type.decorator.spec.ts
│   │   ├── validation.spec.ts
│   │   └── rfc9457.module.spec.ts
│   └── e2e/
│       ├── express.e2e-spec.ts
│       ├── fastify.e2e-spec.ts
│       └── test-app/
│           ├── app.module.ts
│           └── app.controller.ts
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── jest.config.ts
├── .eslintrc.js
├── .prettierrc
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml                                       # GitHub Actions CI pipeline
├── .release-it.json
├── lefthook.yml
├── commitlint.config.js
├── LICENSE
└── README.md
```

### Build & publish

- TypeScript compiled to `dist/` via `tsc`
- `tsconfig.build.json` excludes `test/`
- CJS output only for v1 (standard for NestJS ecosystem; ESM can be added later with proper consumer testing to avoid the dual package hazard)
- `"types"` points to `dist/index.d.ts`
- `engines.node`: `">=18"` in `package.json` (matches CI matrix, documents supported range for consumers)
- Publish scope: `@camcima/nestjs-rfc9457`
- HTTP status phrases sourced from Node's built-in `http.STATUS_CODES` (no hand-maintained table)

### Tooling

**Commit hooks** via [Lefthook](https://github.com/evilmartians/lefthook):

- `pre-commit`: ESLint + Prettier (on staged files)
- `commit-msg`: commitlint with `@commitlint/config-conventional`

**Release management** via [release-it](https://github.com/release-it/release-it):

- Conventional changelog generation
- npm publish to `@camcima` scope
- GitHub release creation
- Version bumping via conventional commits

### CI Pipeline (GitHub Actions)

Single workflow (`.github/workflows/ci.yml`) triggered on push to `main` and all pull requests.

**Jobs**:

1. **quality** — runs ESLint and Prettier check (`--check` mode) in a single job
2. **test** — runs the full test suite (unit + E2E)
   - Matrix: Node 18, 20, 22
   - Installs dependencies, builds, then runs `jest --coverage`
3. **build** — verifies `tsc` compiles cleanly with `tsconfig.build.json`

All jobs run in parallel. PRs require all three to pass.

### Documentation (README.md)

The README follows the conventions of well-regarded open-source NestJS libraries (e.g., `@nestjs/throttler`, `nestjs-cls`, `nestjs-pino`).

**Structure**:

1. **Header** — package name, one-line description, badges (npm version, CI status, license, npm downloads)
2. **What is RFC 9457?** — brief explanation of Problem Details for HTTP APIs with a link to the RFC, plus a short example of what a problem details response looks like
3. **Features** — bullet list of key capabilities
4. **Installation** — `npm install` / `yarn add` / `pnpm add` commands with peer dependency notes
5. **Quick Start** — minimal working example: import module, register in `AppModule`, done. Show a before/after of a NestJS error response vs. the RFC 9457 output.
6. **Configuration** — full `Rfc9457ModuleOptions` reference with description of each option, defaults, and examples:
   - `typeBaseUri`
   - `instanceStrategy` (all four variants with examples)
   - `catchAllExceptions`
   - `exceptionMapper`
   - `validationExceptionMapper`
7. **Async Configuration** — `forRootAsync()` example with `ConfigService`
8. **Custom Exception Types** — `@ProblemType()` decorator usage with examples, inheritance behavior documented
9. **Validation Integration** — two subsections:
   - Tier 1: automatic (zero config) with example output
   - Tier 2: enhanced with `createRfc9457ValidationPipeExceptionFactory()`, step-by-step setup, example output
10. **Advanced Usage** — using `ProblemDetailsFactory` directly (GraphQL, microservices, custom filters)
11. **API Reference** — table of all public exports with one-line descriptions and links to relevant sections
12. **Example Responses** — 3-4 annotated JSON examples showing different scenarios (basic 404, validation error, custom problem type, catch-all 500)
13. **Contributing** — brief guide (clone, install, test, PR)
14. **License** — MIT

### Public API exports (from `src/index.ts`)

- `Rfc9457Module`
- `ProblemDetailsFactory`
- `ProblemDetail` (interface)
- `Rfc9457ModuleOptions` (interface)
- `Rfc9457OptionsFactory` (interface, for `useClass` async pattern)
- `ProblemType` (decorator)
- `ProblemTypeMetadata` (interface, for decorator options)
- `Rfc9457Request` (interface, minimal request context)
- `Rfc9457ValidationException` (class, exported but not primary API)
- `createRfc9457ValidationPipeExceptionFactory` (function)
