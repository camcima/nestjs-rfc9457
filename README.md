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
[![Node.js](https://img.shields.io/badge/Node.js-20%20%7C%2022%20%7C%2024-green.svg)](https://nodejs.org/)

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
- `ProblemDetailException` for one-off problems carrying extension members and status-specific response headers
- Configurable `type` URI generation with `typeBaseUri` and automatic kebab-case slug derivation
- Four `instance` strategies: `'request-uri'`, `'uuid'`, `'none'`, or a custom callback
- Optional catch-all mode for non-`HttpException` throwables (produces 500 Problem Details)
- Custom `exceptionMapper` callback for full control over any exception
- `responseHeaders` callback for status companions such as `Retry-After` and `WWW-Authenticate`
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
| `class-validator`  | `^0.14.0 \|\| ^0.15.0`            | No (optional, for Tier 2 validation)   |
| `@nestjs/swagger`  | `^7.0.0 \|\| ^8.0.0 \|\| ^11.0.0` | No (optional, for OpenAPI integration) |

> **Note:** `reflect-metadata` must be imported once at your application's entry point. NestJS's standard bootstrap already does this, so no extra setup is needed in a typical app — the library relies on it for `@ProblemType()` decorator metadata.

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

Import `Rfc9457Module` once in your root `AppModule`. Because the module is **global**, you do not need to import it in any other module — the exception filter applies everywhere in your application automatically. Do not call `forRoot()` in more than one module: each call registers another global exception filter.

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

> **Hybrid applications (WebSockets / microservices):** the filter only handles HTTP contexts. For non-HTTP transports it rethrows the exception untouched so it never corrupts the transport with an HTTP reply — but the rethrow does **not** re-enter Nest's default WS/RPC handlers. If your app uses gateways or microservice listeners, bind transport-scoped exception filters for those contexts.

> **Committed responses:** if an exception is thrown after the response has already been committed (headers sent — e.g. mid-stream), the filter cannot safely write a Problem Details body over it. It logs the exception and ends the response instead of attempting a second write, mirroring `BaseExceptionFilter`'s own behavior.

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
  responseHeaders: (problem, exception, request) => {
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

> **`about:blank` and `title` (RFC 9457 §4.2.1):** when `type` resolves to `"about:blank"`, the RFC says `title` **SHOULD** be the generic HTTP status phrase for that status code. The library fills in that phrase automatically whenever a resolution step (an `HttpException`, `@ProblemType()`, or a mapper) does not itself supply a `title` — but it never rewrites an explicit `title` your `exceptionMapper` or `@ProblemType()` metadata sets. If you set a domain-specific `title` without also setting `type`, the response pairs that title with `"about:blank"`; set a domain-specific `type` URI alongside it (or configure `typeBaseUri`) to keep the two consistent.

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

The query string is stripped before the path is used as `instance`, so query
parameters (which often carry tokens or PII) are never echoed into the response
body. If you need the full URL including the query string, use a custom callback
that returns `request.url`.

Express's `originalUrl` is preferred when present. Inside a mounted router
Express rewrites `req.url` relative to the mount point, so a handler mounted at
`/api` would otherwise report `instance: "/users/42"` for a request the client
sent to `/api/users/42`. Fastify does not define `originalUrl` and its `url` is
already the full path, so nothing changes there.

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
  originalUrl?: string;
}
```

Both Express's `Request` and Fastify's `FastifyRequest` are structurally
assignable to this interface, so you can pass them directly. To read
adapter-specific fields inside a callback, narrow to the concrete request type:

```typescript
instanceStrategy: (request) => {
  const req = request as unknown as import('express').Request;
  return `https://errors.example.com/log?id=${req.headers['x-request-id']}`;
};
```

### `catchAllExceptions`

**Type**: `boolean` | **Default**: `false`

When `false` (default), exceptions that are not `HttpException` instances are passed to NestJS's default error handling via `super.catch()`. When `true`, any throwable — including plain `Error` objects and non-HTTP exceptions — is caught and produces a generic 500 Problem Details response. Internal error information is never exposed in the response body.

```typescript
Rfc9457Module.forRoot({ catchAllExceptions: true });
```

**Observability:** when this branch fires (a non-`HttpException` reaches the filter and no `exceptionMapper` claims it), the library logs the exception at `error` level via NestJS's built-in `Logger` (context `Rfc9457ExceptionFilter`) before sending the generic 500. This keeps unexpected throwables visible in server logs even though the response body is intentionally bland. To redirect or replace this logging, use the [`onUnhandled`](#onunhandled) callback described below.

### `suppress5xxDetail`

**Type**: `boolean` | **Default**: `false`

When `true`, the `detail` member is stripped from every problem response with a 5xx status, regardless of its source — an `HttpException` message, an `exceptionMapper` result, or `@ProblemType()` metadata. This is intentionally blunt: it is an opt-in production-hardening switch guaranteeing that no internal error text reaches clients on a server error, rather than a fine-grained per-field filter.

```typescript
Rfc9457Module.forRoot({ suppress5xxDetail: true });
```

Default is `false` to match NestJS semantics, where an explicit `HttpException` message is client-facing by design. 4xx responses are never affected.

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

### Status invariants

RFC 9457 problem responses are error responses, so **every problem response this library emits carries a 400–599 status**. Two rules enforce that:

1. A `status` supplied by `exceptionMapper`, `@ProblemType()` metadata, or `ProblemDetailException` must be an integer in 400–599. A value outside the range is ignored — the library logs a warning and falls back to `exception.getStatus()` (for an `HttpException`) or `500`.
2. An `HttpException` whose own status is outside 400–599 (e.g. `new HttpException('moved', 302)`) is **not** rendered as a problem document at all. The filter hands it back to NestJS, which sends its standard response at the requested status. A 3xx carrying `application/problem+json` would be non-conformant, and silently rewriting a deliberate redirect into a 500 would be worse.

An `exceptionMapper` still takes precedence: if it claims such an exception and returns a valid error status, that problem response is sent normally.

If you call `ProblemDetailsFactory` directly, rule 2 does not apply — the factory must return something, so a non-error status is clamped to `500` and a warning is logged. Prefer letting the filter make the delegation decision.

### `onUnhandled`

**Type**: `(exception: unknown, request: Rfc9457Request, problem: ProblemDetail) => void` | **Default**: built-in `Logger.error(...)` (context `Rfc9457ExceptionFilter`)

Called when a non-`HttpException` reaches the catch-all branch (i.e. `catchAllExceptions: true` AND the `exceptionMapper` returned `null`). Use this to send unhandled exceptions to a structured sink (Sentry, Datadog, a custom pino child logger) or to suppress the default log entirely.

```typescript
Rfc9457Module.forRoot({
  catchAllExceptions: true,
  instanceStrategy: 'uuid',
  onUnhandled: (exception, request, problem) => {
    // Route to Sentry, Datadog, etc.
    sentry.captureException(exception, {
      tags: { method: request.method, url: request.url },
      // `problem.instance` is the identifier the client sees. Recording it
      // here is what lets a support ticket quoting that URN be traced back
      // to this stack trace.
      extra: { instance: problem.instance },
    });
  },
});
```

The third parameter is the fully resolved problem body that is about to be sent. Treat it as read-only: the response is serialized from the same object as soon as the callback returns, so mutating it changes what the client receives, which is not what this hook is for.

**The filter still sends the generic 500 Problem Details response after invoking `onUnhandled`.** This callback exists purely for observability — it never changes the HTTP response.

When `onUnhandled` is **not** provided, the library calls `Logger.error(...)` with either the exception's `stack` string or a `{ exception }` structured context (for non-`Error` values). When an `instance` was generated for the occurrence, it is appended to the log message (`… [instance: urn:uuid:…]`) so the default logging is correlatable too. The log context is `Rfc9457ExceptionFilter` so it can be filtered or silenced via NestJS's logger configuration.

### `responseHeaders`

**Type**: `(problem: ProblemDetail, exception: unknown, request: Rfc9457Request) => Record<string, string> | undefined` | **Default**: `undefined`

Supplies transport response headers that accompany a problem response. Some statuses are only fully specified by a header: `Retry-After` on 429 and 503, `WWW-Authenticate` on 401. Those belong in the header block, not the body, and this is the channel for them.

```typescript
Rfc9457Module.forRoot({
  responseHeaders: (problem) => {
    if (problem.status === 401) return { 'WWW-Authenticate': 'Bearer realm="api"' };
    if (problem.status === 429 && typeof problem.retryAfterSeconds === 'number') {
      return { 'Retry-After': String(problem.retryAfterSeconds) };
    }
    return undefined;
  },
});
```

Called once per problem response with the resolved body, the originating exception, and the request. Return `undefined` to add nothing.

`Content-Type` is reserved: it is written after these headers and always ends up `application/problem+json`. A throw inside the callback is contained like every other callback — it is logged and the response goes out without the extra headers.

For a header that belongs to one specific occurrence rather than to a global policy, pass it at the throw site instead — see [`ProblemDetailException`](#problemdetailexception-one-off-problems-with-extension-members). Throw-site headers are applied first, and this callback is merged over them, so a global policy can override a throw-site value.

### `validationStatuses`

**Type**: `number[]` | **Default**: `[400]`

The HTTP status codes at which `ValidationPipe` default output is treated as a Tier 1 validation error. Set this when you configure `ValidationPipe({ errorHttpStatusCode })`:

```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({ errorHttpStatusCode: 422 }));

// app.module.ts
Rfc9457Module.forRoot({ validationStatuses: [400, 422] });
```

Detection is an explicit allow-list because the validation response shape is indistinguishable from business `HttpException`s constructed with a message array — NestJS sets the `error` field to the status phrase in both cases (e.g. `new ConflictException(['order already shipped'])` produces `{ message: [...], error: 'Conflict' }`). Declare only statuses your application reserves for validation; business exceptions at other statuses are never misclassified. At undeclared statuses, validation messages are still preserved by joining them into `detail`.

### `validationExceptionMapper`

**Type**: `(messages: string[], request: Rfc9457Request, status: number) => ProblemDetail`

Overrides the default Tier 1 validation error response. Receives the flat string array from the exception's `getResponse().message`, the request, and the HTTP status the exception carried (one of `validationStatuses`). Only applies to Tier 1 (flat string) validation errors — Tier 2 structured errors from `Rfc9457ValidationException` bypass this callback.

```typescript
Rfc9457Module.forRoot({
  validationExceptionMapper: (messages, request, status) => ({
    type: 'https://api.example.com/problems/validation-error',
    title: 'Validation Error',
    status, // echo the detected status — do not hard-code it
    detail: 'One or more fields failed validation',
    violations: messages,
  }),
});
```

### Callback failure policy

The error path is total: a failure inside any user-supplied callback never
replaces the problem-details response.

- `exceptionMapper` throws → the failure is logged (context
  `Rfc9457ExceptionFilter` when the mapper runs in the filter,
  `ProblemDetailsFactory` when it runs in the factory) and resolution
  continues down the standard chain (decorator → validation →
  HttpException → fallback).
- `validationExceptionMapper` throws → logged (context
  `ProblemDetailsFactory`); the response falls back to the default Tier 1
  validation body (`status`, status-phrase `title`,
  `detail: "Request validation failed"`, and the `errors` array) — it does
  not re-enter the resolution chain.
- `instanceStrategy` throws → logged; the `instance` member is omitted.
- `onUnhandled` throws → logged together with the original exception; the
  generic 500 problem response is still sent.

Callback errors are never included in the response body.

`exceptionMapper`, `validationExceptionMapper`, and `instanceStrategy` are
synchronous contracts — their return types don't admit a `Promise`, so an
`async` callback is rejected at compile time. `onUnhandled` returns `void`,
which means an `async` callback type-checks; the filter handles that case
too: if the callback returns a thenable, its rejection is caught, logged
together with the original exception, and never surfaces as an unhandled
rejection. The generic 500 response is sent synchronously either way —
the library does not await the callback.

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

`@ProblemType()` can also decorate plain `Error` subclasses (not extending `HttpException`), but these are only handled by the factory when `catchAllExceptions: true` is set. Because that combination silently produces NestJS's default error body instead of your problem type, the filter logs a warning (once per exception class) naming the class and how to fix it, rather than leaving you to wonder why the decorator had no effect.

### `ProblemDetailException`: one-off problems with extension members

`@ProblemType()` describes a **reusable problem type**. When you need a **one-off problem** — particularly one carrying occurrence-specific extension members — throw a `ProblemDetailException` instead. It takes a complete problem document and passes every member through to the response body:

```typescript
import { ProblemDetailException } from '@camcima/nestjs-rfc9457';

throw new ProblemDetailException({
  type: 'https://api.example.com/problems/insufficient-funds',
  title: 'Insufficient Funds',
  status: 402,
  detail: 'Your balance is too low to cover this transfer.',
  balance: 30,
  cost: 50,
});
```

```json
{
  "type": "https://api.example.com/problems/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 402,
  "detail": "Your balance is too low to cover this transfer.",
  "balance": 30,
  "cost": 50
}
```

`status` is required and must be an error status (400–599); anything else throws a `RangeError` at construction. Normalization still applies: a bare `type` slug is expanded against `typeBaseUri`, a missing `title` is filled from the status phrase, and the configured instance strategy runs.

**Why this exists.** A plain `HttpException` cannot carry extension members. Given `new HttpException({ message: 'Balance too low', balance: 30 }, 402)`, NestJS's response object is read for its `message` only — `balance` is dropped. Since extension members are the whole point of RFC 9457's extensibility, this class is the supported way to emit them from a throw site.

**Combined with `@ProblemType()`.** Decorate a subclass to declare the reusable identity once, then supply per-occurrence data at each throw. Instance members win per-member:

```typescript
@ProblemType({
  type: 'https://api.example.com/problems/payment-error',
  title: 'Payment Error',
  status: 402,
})
export class PaymentProblem extends ProblemDetailException {}

throw new PaymentProblem({ status: 409, detail: 'Already settled', settledAt });
// type and title come from the decorator; status, detail and settledAt from the throw
```

**Response headers.** Pass headers for this occurrence as the second argument:

```typescript
throw new ProblemDetailException(
  { status: 429, title: 'Too Many Requests', retryAfterSeconds: 60 },
  { headers: { 'Retry-After': '60' } },
);
```

Precedence is unchanged: a global [`exceptionMapper`](#exceptionmapper) that claims the exception still wins, and [`suppress5xxDetail`](#suppress5xxdetail) still strips `detail` from a 5xx (extension members are left alone).

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

**Custom status codes.** If you configure `ValidationPipe({ errorHttpStatusCode: 422 })` (or any other 4xx), declare that status in the [`validationStatuses`](#validationstatuses) module option (`validationStatuses: [400, 422]`) and the library produces the same structured validation response at that status, with the matching `title` (e.g. `Unprocessable Entity`). Without the declaration, the messages are still preserved — joined into `detail` — but the `errors` array is not emitted. Detection is an explicit opt-in per status because the validation output shape is indistinguishable from business exceptions constructed with message arrays.

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

**Custom status (e.g. 422).** To use a different status, configure both the pipe and the factory:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    errorHttpStatusCode: 422,
    exceptionFactory: createRfc9457ValidationPipeExceptionFactory({ status: 422 }),
  }),
);
```

`createRfc9457ValidationPipeExceptionFactory` throws a `RangeError` if `status` is outside the 400–599 error range.

> **Breaking change (vs earlier releases (<=0.4.x)):** `Rfc9457ValidationException` now extends `HttpException` rather than `BadRequestException`, so its status is configurable. Code that narrows on `instanceof BadRequestException` no longer matches; narrow on `Rfc9457ValidationException` (or `HttpException`) instead.

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

**Idempotent by design.** `applyProblemDetailResponses` is safe to call more than once. For a given controller and status, only the first call's options are applied — later calls for that same pair are no-ops. This means lazy document factories that run repeatedly (hot reload, multiple `SwaggerModule.setup()` calls for separate specs, etc.) never duplicate `@ApiResponse` metadata, and you don't need to guard the call site with your own "already applied" bookkeeping.

> **Calling it more than once.** Safe: for a given controller class and status,
> the first call's options are applied and later calls are ignored, so lazy
> document factories, hot reload, and multiple `SwaggerModule.setup()` calls do
> not duplicate metadata.
>
> One consequence is worth knowing if you run **two applications in one
> process** (an e2e suite, a monorepo harness) that **share controller
> classes**: the first application to be documented decides the options for that
> class, and a later call with different `validationStatuses` is ignored. This
> is a constraint of `@nestjs/swagger` rather than a caching choice —
> `@ApiResponse` stores its metadata on the class itself, so both applications
> necessarily read the same annotations. Applying per application would not give
> each its own view; it would append a second response object that
> `@nestjs/swagger` merges into one entry with a doubled description. Give each
> application its own controller classes if they must be documented differently.

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

  /**
   * Return false to skip a controller (e.g. health-check controllers).
   * Default: include all controllers.
   */
  filter?: (controller: DiscoveredController) => boolean;
}
```

#### Excluding controllers

Pass a `filter` to skip controllers you don't want documented with the default error responses — for example a health-check endpoint:

```typescript
applyProblemDetailResponses(app, {
  filter: (controller) => controller.metatype?.name !== 'HealthController',
});
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
import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { ProblemDetailsFactory, PROBLEM_CONTENT_TYPE } from '@camcima/nestjs-rfc9457';

@Catch(MySpecialException)
export class MySpecialExceptionFilter extends BaseExceptionFilter {
  constructor(
    private readonly factory: ProblemDetailsFactory,
    private readonly adapterHost: HttpAdapterHost,
  ) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: MySpecialException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const { status, body } = this.factory.create(exception, request);

    // Write through the HTTP adapter so the filter works on Express and
    // Fastify alike, and set the RFC 9457 media type explicitly — the
    // adapter's default is application/json, which would make the response
    // non-conformant even though the body is correct.
    const httpAdapter = this.adapterHost.httpAdapter;
    httpAdapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
    httpAdapter.reply(response, body, status);
  }
}
```

> `Content-Type: application/problem+json` is what tells a client the body is a
> problem document. If you write the response yourself with `res.json(...)` you
> get `application/json` and lose that signal — always set the header, whichever
> mechanism you use.

---

## API Reference

| Export                                         | Kind             | Description                                                                 |
| ---------------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `Rfc9457Module`                                | Class            | Dynamic module. Use `forRoot(options?)` or `forRootAsync(options)`          |
| `ProblemDetailsFactory`                        | Injectable class | Core resolver; injectable for use outside the HTTP filter                   |
| `Rfc9457ExceptionFilter`                       | Injectable class | Global exception filter; registered automatically by the module             |
| `ProblemType`                                  | Decorator        | Class decorator that attaches problem type metadata to exception classes    |
| `ProblemDetailException`                       | Class            | Throw a complete problem document, extension members and headers included   |
| `ProblemDetailExceptionOptions`                | Interface        | Options for `ProblemDetailException` (`headers`)                            |
| `ProblemDetailWithStatus`                      | Type             | `ProblemDetail` with a required `status` — the `ProblemDetailException` arg |
| `ProblemDetail`                                | Interface        | RFC 9457 response body shape with index signature for extension members     |
| `ProblemTypeMetadata`                          | Interface        | Decorator options (`type`, `title`, `status`)                               |
| `Rfc9457ModuleOptions`                         | Interface        | Options accepted by `forRoot()`                                             |
| `Rfc9457OptionsFactory`                        | Interface        | Implement for `useClass` / `useExisting` async patterns                     |
| `Rfc9457AsyncModuleOptions`                    | Interface        | Options accepted by `forRootAsync()`                                        |
| `InstanceStrategy`                             | Type             | Union type for `instanceStrategy` option                                    |
| `Rfc9457Request`                               | Interface        | Minimal request context compatible with Express and Fastify                 |
| `Rfc9457ValidationException`                   | Class            | Exception wrapping structured `ValidationError[]`; thrown by Tier 2 factory |
| `createRfc9457ValidationPipeExceptionFactory`  | Function         | Returns an `exceptionFactory` for `ValidationPipe` to enable Tier 2 errors  |
| `Rfc9457ValidationPipeExceptionFactoryOptions` | Interface        | Options for `createRfc9457ValidationPipeExceptionFactory` (`status`)        |
| `RFC9457_MODULE_OPTIONS`                       | Symbol           | DI token for the module options                                             |
| `PROBLEM_CONTENT_TYPE`                         | Constant         | `'application/problem+json'`                                                |

**Swagger subpath** (`@camcima/nestjs-rfc9457/swagger`):

| Export                               | Kind      | Description                                                                           |
| ------------------------------------ | --------- | ------------------------------------------------------------------------------------- |
| `ProblemDetailDto`                   | Class     | Swagger DTO for the five standard RFC 9457 fields                                     |
| `ValidationProblemDetailDto`         | Class     | Extends `ProblemDetailDto` with `errors: ValidationErrorDto[]`                        |
| `ValidationErrorDto`                 | Class     | Swagger DTO for a structured validation error (`property`, `constraints`, `children`) |
| `applyProblemDetailResponses`        | Function  | Auto-applies `@ApiResponse` decorators to all controllers via `DiscoveryService`      |
| `ApplyProblemDetailResponsesOptions` | Interface | Options for `applyProblemDetailResponses`                                             |
| `DiscoveredController`               | Interface | Structural controller view passed to the `filter` option                              |

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

Vulnerability reports go through [GitHub Security Advisories](https://github.com/camcima/nestjs-rfc9457/security/advisories/new); see [SECURITY.md](SECURITY.md) for scope and what to include.

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

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint, and [Lefthook](https://github.com/evilmartians/lefthook) for pre-commit hooks (lint + format on staged files) plus a pre-push gitleaks scan of the commits being pushed.

[CHANGELOG.md](CHANGELOG.md) is generated from those commit messages when a release is cut, so a pull request no longer needs a hand-written changelog entry — the commit subject is the entry. Entries written by hand before this switch are kept: the generator only prepends the new release section.

---

## License

[MIT](./LICENSE)
