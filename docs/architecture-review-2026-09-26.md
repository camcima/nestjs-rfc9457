# Architecture review — September 26, 2026

## Summary

The library has sound architectural boundaries: the factory owns problem resolution and normalization, the filter handles HTTP transport, and Swagger integration has a separate entry point. The review found five reproducible correctness issues and one documentation error.

The main improvement is testing contracts across these boundaries: adapter-generated errors, extension serialization, callback isolation, and runtime responses against OpenAPI schemas.

## Findings

### 1. Medium — Catch-all mode changes Express client errors into 500s

**Location:** [`src/problem-details.factory.ts:124`](../src/problem-details.factory.ts#L124)

Express's body parser throws HTTP errors that do not extend Nest's `HttpException`. The factory treats these as unknown failures.

An oversized request produced the following results:

| Adapter | Catch-all disabled | Catch-all enabled |
| ------- | ------------------ | ----------------- |
| Express | 413                | 500               |
| Fastify | 413                | 413               |

This changes HTTP semantics and distorts operational metrics.

**Recommendation:** Preserve recognized adapter-generated HTTP error statuses, with appropriate status validation and detail suppression. Add an integration test for oversized requests on both adapters.

### 2. Medium — A valid extension can change the response media type

**Location:** [`src/rfc9457.exception-filter.ts:253`](../src/rfc9457.exception-filter.ts#L253)

This exception produces `application/json` on both adapters:

```typescript
throw new ProblemDetailException({
  status: 400,
  statusCode: 400,
});
```

Nest's adapters inspect `body.statusCode` and overwrite the previously assigned content type. This is particularly easy to trigger when a mapper spreads an existing Nest response.

**Recommendation:** Use a response-writing path that preserves `application/problem+json` regardless of extension names. Explicit serialization before calling the adapter is one approach to verify. Cover the `statusCode` extension in both adapter integration suites.

### 3. Medium — Invalid headers escape the error-handling safeguards

**Location:** [`src/rfc9457.exception-filter.ts:245`](../src/rfc9457.exception-filter.ts#L245)

The `responseHeaders` callback invocation is protected, but applying its returned headers is not. Headers supplied by `ProblemDetailException` reach the same unprotected write path.

A header such as the following causes the intended 400 problem response to become a framework-generated 500:

```typescript
{ 'X-Trace': 'bad\nvalue' }
```

This was reproduced on both adapters. Fastify also returned the header-validation error message.

**Recommendation:** Validate header names and values before applying them, log rejected entries, and preserve the original problem response. Verify invalid names and values through both adapters, since validation can occur at different stages of response writing.

### 4. Medium — Observability callbacks can modify the finalized response

**Locations:** [`src/rfc9457.exception-filter.ts:139`](../src/rfc9457.exception-filter.ts#L139), [`src/rfc9457.interfaces.ts:108`](../src/rfc9457.interfaces.ts#L108)

`onUnhandled` receives the actual mutable response object, despite documentation saying mutations have no effect. `responseHeaders` also receives that object.

A callback that modifies the body and then throws was reproduced with these results:

- HTTP status **500**, but body status **200**.
- Internal exception text in `detail`, despite `suppress5xxDetail: true`.

The exception handler catches the callback failure but retains its mutations. This requires application callback code to mutate the body; it is not evidence of a remotely exploitable vulnerability by itself.

**Recommendation:** Pass an isolated snapshot to observational callbacks and expose a readonly type. Verify that callback mutations and failures cannot change the response's status or restore suppressed details. Account for nested extension values when defining the isolation guarantee.

### 5. Medium — The validation schema rejects legitimate runtime output

**Location:** [`src/swagger/problem-detail.dto.ts:46`](../src/swagger/problem-detail.dto.ts#L46)

`ValidationErrorDto` requires `property`, but the factory correctly preserves errors containing only constraints.

For example, class-validator's `forbidUnknownValues` can produce:

```json
{
  "constraints": {
    "unknownValue": "an unknown value was passed to the validate function"
  }
}
```

The factory includes this entry in the response's `errors` array without a `property` member. That response violates the generated OpenAPI schema.

**Recommendation:** Make `property` optional and verify actual validation responses against the generated schema, including unknown-value validation failures.

### 6. Low — The documented RFC status restriction is incorrect

**Location:** [`README.md:368`](../README.md#L368)

The README calls problem details on 3xx responses nonconformant. RFC 9457 explicitly permits their use with any HTTP status, while identifying 4xx and 5xx as the most natural fit. See [RFC 9457 §1](https://www.rfc-editor.org/rfc/rfc9457.html#section-1).

Restricting this library to 400–599 is a reasonable product decision.

**Recommendation:** Document the restriction as library policy and correct the corresponding implementation comments and earlier review claims. Correcting the explanation does not require changing runtime behavior.

## Architecture assessment

Preserve the existing boundaries and strengths:

- The factory centralizes resolution and normalization.
- The filter handles transport concerns through Nest's adapters.
- Swagger integration has a separate entry point.
- Optional integrations stay out of runtime dependencies.
- Express/Fastify coverage and older-peer CI checks help protect compatibility.

The findings call for targeted fixes and integration tests. They do not indicate a need to restructure the library.

## Verification

The review used Node.js **22.22.2** and TypeScript **6.0.3**, with the locally installed dependencies.

- **243 tests passed** across 12 test files.
- Build, lint, and formatting checks passed.
- Source and test type-checking passed with `tsc --noEmit --incremental false -p tsconfig.json`.
- Temporary reproductions confirmed oversized-request handling and extension media types through real Express and Fastify applications.
- Malformed-header failures were confirmed through both adapters.
- Direct filter/factory reproductions confirmed callback mutation and validation output; the generated Swagger schema confirmed the required-field mismatch.
- RFC claims were checked against the published RFC 9457 text.

The older-peer CI configuration was inspected, but that dependency matrix was not rerun locally during this review. The fixes proposed above have not been implemented or validated. No library source or test files were changed by the review.
