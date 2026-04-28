<div align="center">

<picture>
  <img alt="nestjs-rfc9457" src="assets/logo.svg" width="580">
</picture>

<br>

[![CI](https://github.com/camcima/nestjs-rfc9457/actions/workflows/ci.yml/badge.svg)](https://github.com/camcima/nestjs-rfc9457/actions/workflows/ci.yml)
[![CodeQL](https://github.com/camcima/nestjs-rfc9457/actions/workflows/codeql.yml/badge.svg)](https://github.com/camcima/nestjs-rfc9457/actions/workflows/codeql.yml)
[![codecov](https://codecov.io/gh/camcima/nestjs-rfc9457/graph/badge.svg)](https://codecov.io/gh/camcima/nestjs-rfc9457)
[![npm version](https://img.shields.io/npm/v/@camcima/nestjs-rfc9457)](https://www.npmjs.com/package/@camcima/nestjs-rfc9457)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%20%7C%2020%20%7C%2022-green.svg)](https://nodejs.org/)

</div>

NestJS library for [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) Problem Details HTTP error responses.

## Table of Contents

- [What is RFC 9457?](#what-is-rfc-9457)
- [Features](#features)
- [Installation](#installation)
- [Coding Agent Skill](#coding-agent-skill)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Async Configuration](#async-configuration)
- [Custom Exception Types](#custom-exception-types)
- [Validation Integration](#validation-integration)
- [Swagger / OpenAPI Integration](#swagger--openapi-integration)
- [Advanced Usage](#advanced-usage)
- [API Reference](#api-reference)
- [Example Responses](#example-responses)
- [Examples](#examples)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## What is RFC 9457?

[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) (July 2023) defines a standard JSON format for HTTP API error responses, using the `application/problem+json` media type. It supersedes RFC 7807 and gives APIs a consistent, machine-readable way to communicate errors.

A Problem Details response looks like this:

```json
{
  "type": "https://api.example.com/problems/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "User 42 not found",
  "instance": "/api/users/42"
}
```

The five standard members are:

| Member     | Description                                            |
| ---------- | ------------------------------------------------------ |
| `type`     | URI identifying the problem type                       |
| `title`    | Short human-readable summary of the problem type       |
| `status`   | HTTP status code (advisory)                            |
| `detail`   | Human-readable explanation of this specific occurrence |
| `instance` | URI identifying this specific occurrence               |

Extension members (arbitrary key-value pairs) are allowed for problem-type-specific data.

---

## Features

- Zero-config drop-in: import the module once in `AppModule` and all HTTP exceptions become RFC 9457 responses
- Automatic `ValidationPipe` integration — flat string-array errors work out of the box (Tier 1)
- Enhanced structured validation errors with `property`, `constraints`, and nested `children` (Tier 2)
- `@ProblemType()` class decorator for custom exception types with full prototype-chain inheritance
- Configurable `type` URI generation with `typeBaseUri` and automatic kebab-case slug derivation
- Four `instance` strategies: `'request-uri'`, `'uuid'`, `'none'`, or a custom callback
- Optional catch-all mode for non-`HttpException` throwables (produces 500 Problem Details)
- Custom `exceptionMapper` callback for full control over any exception
- Default `error`-level logging of unhandled exceptions when `catchAllExceptions: true` (override via `onUnhandled` callback)
- `ProblemDetailsFactory` is injectable — use it directly in GraphQL, microservices, or custom filters
- Optional `@nestjs/swagger` integration: `ProblemDetailDto` and `ValidationProblemDetailDto` for OpenAPI documentation, plus a `applyProblemDetailResponses()` helper that auto-applies `@ApiResponse` decorators to all controllers under `application/problem+json`
- Works with both Express and Fastify adapters
- Zero runtime dependencies; `class-validator` and `@nestjs/swagger` are optional peer dependencies

---

## Installation

```bash
npm install @camcima/nestjs-rfc9457
```

```bash
yarn add @camcima/nestjs-rfc9457
```

```bash
pnpm add @camcima/nestjs-rfc9457
```

### Peer dependencies

| Package            | Version                           | Required                               |
| ------------------ | --------------------------------- | -------------------------------------- |
| `@nestjs/common`   | `^10.0.0 \|\| ^11.0.0`            | Yes                                    |
| `@nestjs/core`     | `^10.0.0 \|\| ^11.0.0`            | Yes                                    |
| `reflect-metadata` | `^0.1.13 \|\| ^0.2.0`             | Yes                                    |
| `class-validator`  | `^0.14.0`                         | No (optional, for Tier 2 validation)   |
| `@nestjs/swagger`  | `^7.0.0 \|\| ^8.0.0 \|\| ^11.0.0` | No (optional, for OpenAPI integration) |

---

## Coding Agent Skill

This repository ships an [agent skill](./skills/configure-nestjs-rfc9457/SKILL.md) that teaches AI coding agents (Claude Code, Cursor, Cline, Copilot, and others) how to install and wire `@camcima/nestjs-rfc9457` into a NestJS project. It covers module registration, Tier 1/Tier 2 validation, Swagger integration, custom exception types via `@ProblemType()`, and async configuration with `ConfigService`.

### Install via the [Vercel skills CLI](https://github.com/vercel-labs/skills)

From the root of the NestJS project where you want the agent to use the skill:

```bash
npx skills add camcima/nestjs-rfc9457
```

The CLI auto-detects your agent (Claude Code, Cursor, Cline, etc.) and installs the skill into the right location. After installation, ask your agent something like _"set up RFC 9457 problem details in this project"_ — the skill activates automatically and the agent will follow it to install the package, register `Rfc9457Module`, and apply any optional integrations you ask for.

To list installed skills: `npx skills list`. To remove: `npx skills remove configure-nestjs-rfc9457`.

### Manual install

If you don't use the Vercel CLI, copy the skill folder directly into your agent's skill directory. Common locations:

| Agent         | Path                                       |
| ------------- | ------------------------------------------ |
| Claude Code   | `.claude/skills/configure-nestjs-rfc9457/` |
| Cursor        | `.cursor/skills/configure-nestjs-rfc9457/` |
| Generic / SDK | `.agents/skills/configure-nestjs-rfc9457/` |

The skill is a single self-contained `SKILL.md` — no scripts or assets are required.

---

## Quick Start

Import `Rfc9457Module` once in your root `AppModule`. Because the module is **global**, you do not need to import it in any other module — the exception filter applies everywhere in your application automatically.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { Rfc9457Module } from '@camcima/nestjs-rfc9457';

@Module({
  imports: [Rfc9457Module.forRoot()],
})
export class AppModule {}
```

That is all the configuration you need. Every `HttpException` thrown anywhere in your application will now produce an RFC 9457 response.

### Before and after

**Before** (standard NestJS `NotFoundException`):

```json
{
  "statusCode": 404,
  "message": "User 42 not found",
  "error": "Not Found"
}
```

**After** (with `@camcima/nestjs-rfc9457`):

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "User 42 not found"
}
```

The response `Content-Type` is set to `application/problem+json` as required by the RFC.

---

## Configuration

`Rfc9457Module.forRoot()` accepts an optional `Rfc9457ModuleOptions` object.

```typescript
Rfc9457Module.forRoot({
  typeBaseUri: 'https://api.example.com/problems',
  instanceStrategy: 'request-uri',
  catchAllExceptions: true,
  exceptionMapper: (exception, request) => {
    /* ... */
  },
  validationExceptionMapper: (messages, request) => {
    /* ... */
  },
});
```

### `typeBaseUri`

**Type**: `string` | **Default**: `undefined`

When set, the library generates `type` URIs by combining the base URI with a kebab-case slug derived from the HTTP status phrase. When omitted, `type` defaults to `"about:blank"` (per RFC 9457 §4.2).

```typescript
Rfc9457Module.forRoot({
  typeBaseUri: 'https://api.example.com/problems',
});
```

A `NotFoundException` (404) becomes:

```json
{
  "type": "https://api.example.com/problems/not-found",
  "title": "Not Found",
  "status": 404
}
```

Slug derivation uses the HTTP status phrase from Node's built-in `http.STATUS_CODES`:

- `"Not Found"` → `not-found`
- `"Internal Server Error"` → `internal-server-error`
- `"Unprocessable Entity"` → `unprocessable-entity`

### `instanceStrategy`

**Type**: `'request-uri' | 'uuid' | 'none' | ((request, exception) => string | undefined)` | **Default**: `'none'`

Controls how the `instance` field is populated.

**`'none'`** — `instance` is omitted from the response (default):

```typescript
Rfc9457Module.forRoot({ instanceStrategy: 'none' });
```

**`'request-uri'`** — uses the request URL path:

```typescript
Rfc9457Module.forRoot({ instanceStrategy: 'request-uri' });
// instance: "/api/users/42"
```

**`'uuid'`** — generates a `urn:uuid:<v4>` per occurrence:

```typescript
Rfc9457Module.forRoot({ instanceStrategy: 'uuid' });
// instance: "urn:uuid:a8098c1a-f86e-11da-bd1a-00112444be1e"
```

**Custom callback** — full control, receives the request and the original exception:

```typescript
Rfc9457Module.forRoot({
  instanceStrategy: (request, exception) => {
    return `https://errors.example.com/log?path=${request.url}`;
  },
});
```

Return `undefined` from a custom callback to omit `instance` for that occurrence.

The `request` parameter implements `Rfc9457Request`:

```typescript
interface Rfc9457Request {
  url: string;
  method: string;
  [key: string]: unknown;
}
```

Both Express and Fastify request objects satisfy this interface.

### `catchAllExceptions`

**Type**: `boolean` | **Default**: `false`

When `false` (default), exceptions that are not `HttpException` instances are passed to NestJS's default error handling via `super.catch()`. When `true`, any throwable — including plain `Error` objects and non-HTTP exceptions — is caught and produces a generic 500 Problem Details response. Internal error information is never exposed in the response body.

```typescript
Rfc9457Module.forRoot({ catchAllExceptions: true });
```

**Observability:** when this branch fires (a non-`HttpException` reaches the filter and no `exceptionMapper` claims it), the library logs the exception at `error` level via NestJS's built-in `Logger` (context `Rfc9457ExceptionFilter`) before sending the generic 500. This keeps unexpected throwables visible in server logs even though the response body is intentionally bland. To redirect or replace this logging, use the [`onUnhandled`](#onunhandled) callback described below.

### `exceptionMapper`

**Type**: `(exception: unknown, request: Rfc9457Request) => ProblemDetail | null`

A callback that runs first in the resolution chain. Return a `ProblemDetail` object to take full control of the response, or `null` to fall through to the next resolution step (`@ProblemType()` metadata, then validation handling, then default mapping).

```typescript
Rfc9457Module.forRoot({
  exceptionMapper: (exception, request) => {
    if (exception instanceof DatabaseException) {
      return {
        type: 'https://api.example.com/problems/database-error',
        title: 'Database Error',
        status: 503,
        detail: 'A temporary database error occurred',
      };
    }
    return null; // fall through to default handling
  },
});
```

If the returned `ProblemDetail` omits `status`, the factory falls back to `exception.getStatus()` (if it is an `HttpException`) or `500`.

### `onUnhandled`

**Type**: `(exception: unknown, request: Rfc9457Request) => void` | **Default**: built-in `Logger.error(...)` (context `Rfc9457ExceptionFilter`)

Called when a non-`HttpException` reaches the catch-all branch (i.e. `catchAllExceptions: true` AND the `exceptionMapper` returned `null`). Use this to send unhandled exceptions to a structured sink (Sentry, Datadog, a custom pino child logger) or to suppress the default log entirely.

```typescript
Rfc9457Module.forRoot({
  catchAllExceptions: true,
  onUnhandled: (exception, request) => {
    // Route to Sentry, Datadog, etc.
    sentry.captureException(exception, {
      tags: { method: request.method, url: request.url },
    });
  },
});
```

**The filter still sends the generic 500 Problem Details response after invoking `onUnhandled`.** This callback exists purely for observability — it never changes the HTTP response.

When `onUnhandled` is **not** provided, the library calls `Logger.error(...)` with either the exception's `stack` string or a `{ exception }` structured context (for non-`Error` values). The log context is `Rfc9457ExceptionFilter` so it can be filtered or silenced via NestJS's logger configuration.

### `validationExceptionMapper`

**Type**: `(messages: string[], request: Rfc9457Request) => ProblemDetail`

Overrides the default Tier 1 validation error response. Receives the flat string array from `BadRequestException.getResponse().message`. Only applies to Tier 1 (flat string) validation errors — Tier 2 structured errors from `Rfc9457ValidationException` bypass this callback.

```typescript
Rfc9457Module.forRoot({
  validationExceptionMapper: (messages, request) => ({
    type: 'https://api.example.com/problems/validation-error',
    title: 'Validation Error',
    status: 400,
    detail: 'One or more fields failed validation',
    violations: messages,
  }),
});
```

---

## Async Configuration

Use `Rfc9457Module.forRootAsync()` to inject configuration from a service such as `ConfigService`.

### `useFactory`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Rfc9457Module } from '@camcima/nestjs-rfc9457';

@Module({
  imports: [
    ConfigModule.forRoot(),
    Rfc9457Module.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        typeBaseUri: config.get<string>('PROBLEM_TYPE_BASE_URI'),
        instanceStrategy: 'uuid',
        catchAllExceptions: config.get<boolean>('CATCH_ALL_EXCEPTIONS', false),
      }),
    }),
  ],
})
export class AppModule {}
```

### `useClass`

Implement the `Rfc9457OptionsFactory` interface:

```typescript
import { Injectable } from '@nestjs/common';
import { Rfc9457OptionsFactory, Rfc9457ModuleOptions } from '@camcima/nestjs-rfc9457';

@Injectable()
export class Rfc9457ConfigService implements Rfc9457OptionsFactory {
  createRfc9457Options(): Rfc9457ModuleOptions {
    return {
      typeBaseUri: 'https://api.example.com/problems',
      instanceStrategy: 'uuid',
    };
  }
}
```

```typescript
Rfc9457Module.forRootAsync({
  useClass: Rfc9457ConfigService,
});
```

### `useExisting`

Reuse an existing provider that implements `Rfc9457OptionsFactory`:

```typescript
Rfc9457Module.forRootAsync({
  imports: [SharedConfigModule],
  useExisting: SharedConfigService,
});
```

---

## Custom Exception Types

Use the `@ProblemType()` decorator to attach RFC 9457 problem type metadata to your exception classes. The decorator stores a **template** with type identity fields (`type`, `title`, `status`). Occurrence-specific fields (`detail`, `instance`) are always resolved at runtime by the factory from the exception message and the configured instance strategy.

```typescript
import { HttpException } from '@nestjs/common';
import { ProblemType } from '@camcima/nestjs-rfc9457';

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

When this exception is thrown, the response is:

```json
{
  "type": "https://api.example.com/problems/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 422,
  "detail": "Balance 50 is less than required 100"
}
```

The decorator accepts a `ProblemTypeMetadata` object:

```typescript
interface ProblemTypeMetadata {
  type?: string; // URI for the problem type
  title?: string; // Short human-readable summary
  status?: number; // HTTP status code
}
```

All three fields are optional. If `status` is omitted, the factory uses `exception.getStatus()` for `HttpException` subclasses or falls back to `500` in catch-all mode. If `type` is omitted and `typeBaseUri` is configured, the slug for the status code is used.

### Inheritance

Metadata lookup walks the prototype chain, so child classes automatically inherit their parent's `@ProblemType()` metadata:

```typescript
// Parent defines the problem type
@ProblemType({
  type: 'https://api.example.com/problems/payment-error',
  title: 'Payment Error',
  status: 402,
})
export class PaymentException extends HttpException {
  constructor(message: string) {
    super(message, 402);
  }
}

// Child inherits parent's @ProblemType() metadata
export class CardDeclinedException extends PaymentException {
  constructor() {
    super('Card was declined');
  }
}
```

A child class can **fully override** the parent's metadata by applying its own `@ProblemType()` decorator. There is no merging — the child's decorator replaces the parent's entirely.

```typescript
@ProblemType({
  type: 'https://api.example.com/problems/card-declined',
  title: 'Card Declined',
  status: 402,
})
export class CardDeclinedException extends PaymentException {
  constructor() {
    super('Card was declined');
  }
}
```

`@ProblemType()` can also decorate plain `Error` subclasses (not extending `HttpException`), but these are only handled by the factory when `catchAllExceptions: true` is set.

---

## Validation Integration

### Tier 1 — Automatic (zero config)

When NestJS's `ValidationPipe` rejects a request, it throws a `BadRequestException` whose response contains a `message` array of strings. The library detects this automatically and produces a structured validation error response with no configuration required.

```typescript
// main.ts — standard ValidationPipe setup, nothing extra needed
app.useGlobalPipes(new ValidationPipe());
```

Response:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Request validation failed",
  "errors": ["email must be an email", "age must not be less than 0"]
}
```

To customize the Tier 1 response, use the `validationExceptionMapper` option described in the [Configuration](#configuration) section.

### Tier 2 — Enhanced structured errors (opt-in)

For rich, structured validation output with `property`, `constraints`, and nested `children` arrays, use the `createRfc9457ValidationPipeExceptionFactory` helper.

**Step 1** — Install `class-validator` if you have not already:

```bash
npm install class-validator class-transformer
```

**Step 2** — Use the factory as the `ValidationPipe` exception factory:

```typescript
// main.ts
import { ValidationPipe } from '@nestjs/common';
import { createRfc9457ValidationPipeExceptionFactory } from '@camcima/nestjs-rfc9457';

app.useGlobalPipes(
  new ValidationPipe({
    exceptionFactory: createRfc9457ValidationPipeExceptionFactory(),
  }),
);
```

Response for a DTO with nested validation:

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
      "property": "address",
      "children": [
        {
          "property": "zip",
          "constraints": {
            "isPostalCode": "zip must be a postal code"
          }
        }
      ]
    }
  ]
}
```

Nested validation errors are preserved as `children` arrays matching the `class-validator` `ValidationError` tree. They are **not** flattened to dotted paths (e.g., `"address.zip"`) — the original structure is preserved.

---

## Swagger / OpenAPI Integration

The library ships optional Swagger support under a separate import path so it does not require `@nestjs/swagger` as a mandatory dependency. Install `@nestjs/swagger` as usual if you have not already:

```bash
npm install @nestjs/swagger
```

All Swagger-related exports are imported from the `/swagger` subpath:

```typescript
import {
  ProblemDetailDto,
  ValidationProblemDetailDto,
  ValidationErrorDto,
  applyProblemDetailResponses,
} from '@camcima/nestjs-rfc9457/swagger';
```

### Auto-applying error schemas to all controllers

The `applyProblemDetailResponses()` helper uses NestJS's `DiscoveryService` to programmatically attach `@ApiResponse` decorators to every controller in your application. Responses are documented under `application/problem+json` as required by RFC 9457.

**Step 1** — Import `DiscoveryModule` in your app module:

```typescript
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Rfc9457Module } from '@camcima/nestjs-rfc9457';

@Module({
  imports: [DiscoveryModule, Rfc9457Module.forRoot()],
})
export class AppModule {}
```

**Step 2** — Call the helper inside the lazy document factory passed to `SwaggerModule.setup()`:

```typescript
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { applyProblemDetailResponses } from '@camcima/nestjs-rfc9457/swagger';

const config = new DocumentBuilder().setTitle('My API').build();

SwaggerModule.setup('/api', app, () => {
  applyProblemDetailResponses(app);
  return SwaggerModule.createDocument(app, config);
});
```

By default, this documents `400` and `500` responses on every route using `ProblemDetailDto`. The generated OpenAPI spec will show `application/problem+json` as the response media type with the correct schema.

### Options

`applyProblemDetailResponses` accepts an optional second argument:

```typescript
interface ApplyProblemDetailResponsesOptions {
  /** HTTP status codes to document. Default: [400, 500]. */
  statuses?: number[];

  /**
   * Statuses that use ValidationProblemDetailDto (with the errors array)
   * instead of the base ProblemDetailDto. Default: [].
   */
  validationStatuses?: number[];
}
```

#### Documenting additional statuses

```typescript
applyProblemDetailResponses(app, {
  statuses: [400, 401, 403, 404, 500],
});
```

#### Documenting Tier 2 structured validation errors

If you use `Rfc9457ValidationException` (Tier 2) for validation, you can tell the helper to use `ValidationProblemDetailDto` for specific statuses. This DTO includes the `errors` array of structured `ValidationErrorDto` objects:

```typescript
applyProblemDetailResponses(app, {
  statuses: [400, 500],
  validationStatuses: [400],
});
```

This documents 400 responses with the `ValidationProblemDetailDto` schema (which includes `errors: ValidationErrorDto[]`) and 500 responses with the base `ProblemDetailDto`.

### Using DTOs manually for per-route documentation

For finer control, use the DTO classes directly with `@ApiResponse()` on individual routes:

```typescript
import { ApiResponse } from '@nestjs/swagger';
import { ProblemDetailDto, ValidationProblemDetailDto } from '@camcima/nestjs-rfc9457/swagger';

@Get(':id')
@ApiResponse({
  status: 404,
  description: 'Not Found',
  content: {
    'application/problem+json': {
      schema: { $ref: '#/components/schemas/ProblemDetailDto' },
    },
  },
})
findOne(@Param('id') id: string) {
  // ...
}
```

Or more concisely using the `type` shorthand (documents as `application/json` instead of `application/problem+json`):

```typescript
@ApiResponse({ status: 404, type: ProblemDetailDto })
```

### Extending DTOs for custom extension members

If your API returns extension members (additional fields beyond the five standard RFC 9457 members), extend `ProblemDetailDto` to document them:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { ProblemDetailDto } from '@camcima/nestjs-rfc9457/swagger';

export class InsufficientFundsProblemDto extends ProblemDetailDto {
  @ApiProperty({ example: 50 })
  balance!: number;

  @ApiProperty({ example: 100 })
  required!: number;
}
```

### Available DTOs

| DTO                          | Description                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `ProblemDetailDto`           | The five standard RFC 9457 fields (`type`, `title`, `status`, `detail`, `instance`)  |
| `ValidationProblemDetailDto` | Extends `ProblemDetailDto` with `errors: ValidationErrorDto[]` for Tier 2 validation |
| `ValidationErrorDto`         | Structured validation error (`property`, `constraints?`, `children?`)                |

### Design note

The auto-apply helper uses `ProblemDetailDto` for all statuses by default. This is intentional: a single HTTP status (e.g. 400) can produce different response shapes at runtime — a plain problem detail for non-validation errors, `errors: string[]` for Tier 1 validation, or `errors: ValidationErrorDto[]` for Tier 2 validation. The base DTO is the common denominator that is always correct. Use `validationStatuses` to opt in to the more specific schema when your application uses Tier 2 validation exclusively.

---

## Advanced Usage

### Using `ProblemDetailsFactory` directly

`ProblemDetailsFactory` is an injectable service exported by `Rfc9457Module`. You can inject it into any provider to produce Problem Details responses in contexts outside the standard HTTP filter — for example, GraphQL error formatters or microservice exception handlers.

```typescript
import { Injectable } from '@nestjs/common';
import { ProblemDetailsFactory, Rfc9457Request } from '@camcima/nestjs-rfc9457';

@Injectable()
export class GraphQLErrorFormatter {
  constructor(private readonly problemDetailsFactory: ProblemDetailsFactory) {}

  format(exception: unknown, context: { path: string; method: string }) {
    const request: Rfc9457Request = {
      url: context.path,
      method: context.method,
    };
    const { status, body } = this.problemDetailsFactory.create(exception, request);
    return { extensions: { problem: body, httpStatus: status } };
  }
}
```

The `create` method signature is:

```typescript
create(exception: unknown, request: Rfc9457Request): { status: number; body: ProblemDetail }
```

- `status` is the definitive HTTP status code to use for the transport layer.
- `body` is the RFC 9457 Problem Details object to serialize.

The factory applies the full resolution chain (mapper → decorator → validation → default → fallback) and all normalization rules (`type`, `instance`, `title`) regardless of how it is called.

### Custom exception filter

You can build your own filter on top of `ProblemDetailsFactory` if you need to intercept specific exception types before the global filter sees them:

```typescript
import { Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ProblemDetailsFactory } from '@camcima/nestjs-rfc9457';

@Catch(MySpecialException)
export class MySpecialExceptionFilter extends BaseExceptionFilter {
  constructor(private readonly factory: ProblemDetailsFactory) {
    super();
  }

  catch(exception: MySpecialException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const { status, body } = this.factory.create(exception, request);
    response.status(status).json(body);
  }
}
```

---

## API Reference

| Export                                        | Kind             | Description                                                                 |
| --------------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `Rfc9457Module`                               | Class            | Dynamic module. Use `forRoot(options?)` or `forRootAsync(options)`          |
| `ProblemDetailsFactory`                       | Injectable class | Core resolver; injectable for use outside the HTTP filter                   |
| `Rfc9457ExceptionFilter`                      | Injectable class | Global exception filter; registered automatically by the module             |
| `ProblemType`                                 | Decorator        | Class decorator that attaches problem type metadata to exception classes    |
| `ProblemDetail`                               | Interface        | RFC 9457 response body shape with index signature for extension members     |
| `ProblemTypeMetadata`                         | Interface        | Decorator options (`type`, `title`, `status`)                               |
| `Rfc9457ModuleOptions`                        | Interface        | Options accepted by `forRoot()`                                             |
| `Rfc9457OptionsFactory`                       | Interface        | Implement for `useClass` / `useExisting` async patterns                     |
| `Rfc9457AsyncModuleOptions`                   | Interface        | Options accepted by `forRootAsync()`                                        |
| `InstanceStrategy`                            | Type             | Union type for `instanceStrategy` option                                    |
| `Rfc9457Request`                              | Interface        | Minimal request context compatible with Express and Fastify                 |
| `Rfc9457ValidationException`                  | Class            | Exception wrapping structured `ValidationError[]`; thrown by Tier 2 factory |
| `createRfc9457ValidationPipeExceptionFactory` | Function         | Returns an `exceptionFactory` for `ValidationPipe` to enable Tier 2 errors  |
| `RFC9457_MODULE_OPTIONS`                      | Symbol           | DI token for the module options                                             |
| `PROBLEM_CONTENT_TYPE`                        | Constant         | `'application/problem+json'`                                                |

**Swagger subpath** (`@camcima/nestjs-rfc9457/swagger`):

| Export                               | Kind      | Description                                                                           |
| ------------------------------------ | --------- | ------------------------------------------------------------------------------------- |
| `ProblemDetailDto`                   | Class     | Swagger DTO for the five standard RFC 9457 fields                                     |
| `ValidationProblemDetailDto`         | Class     | Extends `ProblemDetailDto` with `errors: ValidationErrorDto[]`                        |
| `ValidationErrorDto`                 | Class     | Swagger DTO for a structured validation error (`property`, `constraints`, `children`) |
| `applyProblemDetailResponses`        | Function  | Auto-applies `@ApiResponse` decorators to all controllers via `DiscoveryService`      |
| `ApplyProblemDetailResponsesOptions` | Interface | Options for `applyProblemDetailResponses`                                             |

---

## Example Responses

### Basic 404 (no `typeBaseUri`)

```typescript
throw new NotFoundException('User 42 not found');
```

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "User 42 not found"
}
```

### Basic 404 (with `typeBaseUri` and `instanceStrategy: 'request-uri'`)

```typescript
Rfc9457Module.forRoot({
  typeBaseUri: 'https://api.example.com/problems',
  instanceStrategy: 'request-uri',
});

throw new NotFoundException('User 42 not found');
// request path: /api/users/42
```

```json
{
  "type": "https://api.example.com/problems/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "User 42 not found",
  "instance": "/api/users/42"
}
```

### Validation error (Tier 2 structured)

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
      "property": "address",
      "children": [
        {
          "property": "zip",
          "constraints": {
            "isPostalCode": "zip must be a postal code"
          }
        }
      ]
    }
  ]
}
```

### Custom problem type with `@ProblemType()`

```typescript
@ProblemType({
  type: 'https://api.example.com/problems/insufficient-funds',
  title: 'Insufficient Funds',
  status: 422,
})
export class InsufficientFundsException extends HttpException {
  /* ... */
}

throw new InsufficientFundsException(50, 100);
```

```json
{
  "type": "https://api.example.com/problems/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 422,
  "detail": "Balance 50 is less than required 100"
}
```

### Catch-all 500 (with `catchAllExceptions: true`)

```typescript
throw new Error('Connection refused');
```

```json
{
  "type": "about:blank",
  "title": "Internal Server Error",
  "status": 500
}
```

Internal error messages are never included in the response to avoid leaking sensitive information.

---

## Examples

See the [nestjs-rfc9457-examples](https://github.com/camcima/nestjs-rfc9457-examples) repository for complete working NestJS applications demonstrating all features, including runnable demo scripts.

---

## Security

### CI

| Tool            | Purpose                                                  | Trigger                   |
| --------------- | -------------------------------------------------------- | ------------------------- |
| **CodeQL**      | Static analysis for security vulnerabilities             | Push, PR, weekly schedule |
| **OSV-Scanner** | Dependency vulnerability scanning (production deps only) | Push, PR                  |
| **Dependabot**  | Automated dependency and GitHub Actions updates          | Weekly PRs                |
| **Codecov**     | Test coverage tracking                                   | Push, PR                  |

### Local (via Lefthook)

| Hook         | Tool                                             | Purpose                      |
| ------------ | ------------------------------------------------ | ---------------------------- |
| `pre-commit` | ESLint + Prettier                                | Code quality on staged files |
| `pre-push`   | [Gitleaks](https://github.com/gitleaks/gitleaks) | Secret scanning before push  |

Gitleaks must be [installed locally](https://github.com/gitleaks/gitleaks#installing). The pre-push hook will skip if Gitleaks is not available.

### Manual local checks

```bash
# Dependency audit (production only)
pnpm run audit:deps

# Secret scanning
pnpm run audit:secrets

# Full pnpm audit (all dependencies)
pnpm audit
```

---

## Contributing

Contributions are welcome. Please open an issue before submitting a pull request for significant changes.

```bash
# Clone the repository
git clone https://github.com/camcima/nestjs-rfc9457.git
cd nestjs-rfc9457

# Install dependencies
pnpm install

# Run unit tests
pnpm run test:unit

# Run e2e tests
pnpm run test:e2e

# Run all tests with coverage
pnpm run test:cov

# Build
pnpm run build
```

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint, and [Lefthook](https://github.com/evilmartians/lefthook) for pre-commit hooks (lint + format on staged files).

---

## License

[MIT](./LICENSE)
