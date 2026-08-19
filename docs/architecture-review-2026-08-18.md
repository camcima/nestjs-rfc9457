# Architecture Review — `@camcima/nestjs-rfc9457` v0.5.0

**Date:** 2026-08-18
**Scope:** Full `src/` tree, build & packaging config, test suite, CI/CD workflows, README, published `dist/` output.
**Method:** Manual code review of every source file; verification of claims against the built `dist/` artifacts and the README; full test run (`pnpm test`: 11 files, **192/192 passing**).

> Note: this review is aware of the previous remediation cycle (PR #104, `docs/superpowers/plans/2026-07-09-architecture-review-remediation.md`). Items fixed there (callback containment, status range guards, swagger idempotency, `resolveStatus` warning noise) were re-verified and are **not** re-reported. Everything below reflects the code as it stands at `51b3615`.

---

## Executive summary

This is a small, mature, unusually well-engineered library. The separation of concerns is clean (factory = resolution/normalization policy, filter = transport), the error path is total (every user callback is contained, the response is always written), the security posture is deliberate, and the test suite is genuinely strong (unit + e2e on both Express and Fastify, including the committed-headers edge case). The README is exceptional.

No critical runtime bugs were found. The highest-impact findings are in **packaging/DX** (F1, F2 — the published package silently loses all of the library's carefully written JSDoc and ships broken source maps), one **documentation-correctness** bug that leads copiers into RFC non-conformance (F3), and one **design gap** around extension members (F4) — the one place where the library under-delivers on the core value proposition of RFC 9457.

### Findings at a glance

| ID  | Severity | Area          | Summary                                                                    | Status                           |
| --- | -------- | ------------- | -------------------------------------------------------------------------- | -------------------------------- |
| F1  | High     | Packaging/DX  | `removeComments: true` strips all JSDoc from published `.d.ts` files       | Fixed                            |
| F2  | Medium   | Packaging     | Published source maps reference `../src/*`, which is not shipped           | Fixed                            |
| F3  | Medium   | Docs          | README custom-filter example emits `application/json`, not problem+json    | Fixed                            |
| F4  | Medium   | Design        | Extension members on `HttpException` object responses are silently lost    | Fixed (`ProblemDetailException`) |
| F5  | Low      | Correctness   | Non-error `HttpException` statuses (e.g. 302) pass through unguarded       | Fixed (breaking)                 |
| F6  | Low      | Correctness   | `'request-uri'` uses Express `req.url`, which routers can rewrite          | Fixed                            |
| F7  | Low      | Correctness   | Shared `WeakSet` drops legitimate shared (non-cyclic) validation subtrees  | Fixed                            |
| F8  | Low      | DX            | `@ProblemType` on non-`HttpException` is a silent no-op without catch-all  | Fixed (warn once)                |
| F9  | Low      | Observability | `'uuid'` instance strategy produces an uncorrelatable identifier           | Fixed                            |
| F10 | Low      | Compatibility | Claimed peer ranges (Nest 10, swagger 7/8, c-v 0.14) are never CI-tested   | Fixed (claim verified)           |
| F11 | Info     | Design        | Swagger idempotency cache is process-global, not per-app                   | **Withdrawn — see below**        |
| F12 | Info     | Design        | No channel for status-specific response headers (`Retry-After`, etc.)      | Fixed                            |
| F13 | Info     | Packaging     | CJS-only build (fine today; noted for the record)                          | No action (by design)            |
| F14 | High     | Packaging     | Stale `tsbuildinfo` makes `build` emit nothing, silently, with exit code 0 | Fixed                            |

---

## Strengths worth preserving

- **Layering.** `ProblemDetailsFactory` owns the entire resolution chain (mapper → decorator → validation → `HttpException` default → fallback) and all normalization (`type` expansion, `title` fill, status clamping, instance strategy, 5xx-detail suppression). `Rfc9457ExceptionFilter` owns only transport concerns: context-type gating, headers-sent guard, adapter-agnostic reply. The `skipMapper` internal overload cleanly prevents double mapper invocation. This is textbook.
- **Total error path.** Every user-supplied callback — `exceptionMapper`, `validationExceptionMapper`, custom `instanceStrategy`, `onUnhandled` (including async rejection containment via thenable detection) — is wrapped so that a throwing callback degrades to the default behavior instead of replacing the response with a crash. The "Callback failure policy" README section documents this contract explicitly.
- **Security posture.** Unknown exceptions never leak internals (fallback body has no `detail`); `suppress5xxDetail` is a deliberately blunt hardening switch; the `'request-uri'` strategy strips query strings so tokens/PII are never echoed; unhandled exceptions are logged (not silently flattened) so the 500 body stays bland without hiding bugs.
- **Honest handling of an unsolvable ambiguity.** Tier 1 validation detection is shape-indistinguishable from business `HttpException`s built with message arrays; the `validationStatuses` allow-list is the right call, and the trade-off is documented in three places (interface JSDoc, factory comment, README).
- **Adapter-agnostic public API.** The structural `Rfc9457Request` (`url` + `method`) keeps Express/Fastify types out of the published surface, with a documented narrowing escape hatch.
- **Defensive flattening.** `Rfc9457ValidationException.validationErrors: unknown[]` plus salvage-what-you-can flattening with cycle protection means hostile or malformed error shapes cannot break the response path.
- **Engineering hygiene.** SHA-pinned GitHub Actions, Node 20/22/24 matrix, CodeQL, OSV-Scanner, Codecov, commitlint + lefthook, zero runtime dependencies, `sideEffects: false`, `stripInternal` for the internal API surface.

---

## Findings

### F1 — HIGH (packaging/DX): all JSDoc is stripped from the published type declarations

`tsconfig.json:5` sets `"removeComments": true`, and `tsconfig.build.json` does not override it. TypeScript therefore emits `.d.ts` files **without any doc comments** — verified in `dist/rfc9457.interfaces.d.ts`, where `validationStatuses`, `suppress5xxDetail`, `onUnhandled`, etc. appear as bare, undocumented fields.

This matters more here than in most libraries: the option-level JSDoc in `src/rfc9457.interfaces.ts` is some of the best-written API documentation in the codebase (the `validationStatuses` ambiguity explanation, the `onUnhandled` contract, the `suppress5xxDetail` semantics). Consumers hovering these options in an IDE currently see none of it and must context-switch to the README.

**Fix (one line):** add `"removeComments": false` to `tsconfig.build.json`. `stripInternal: true` still removes `@internal` APIs; JS output carrying comments is harmless (and `sideEffects: false` bundler tree-shaking is unaffected).

### F2 — MEDIUM (packaging): published source maps are broken

`sourceMap: true` is on, and `dist/*.js.map` files reference `"sources":["../src/…"]` (verified in `dist/problem-details.factory.js.map`). But `package.json` ships `"files": ["dist"]` — `src/` is not published and `inlineSources` is not set, so every shipped map dangles. Consumers debugging into the library get 404 sources; meanwhile the maps inflate the package for no benefit.

**Fix:** pick one — (a) `"inlineSources": true` (self-contained maps), (b) add `src` to `files`, or (c) disable `sourceMap` in `tsconfig.build.json`. While there, consider `"declarationMap": true` + shipping `src` so consumers' go-to-definition lands on real source.

### F3 — MEDIUM (docs): the README "Custom exception filter" example is not RFC 9457-conformant

`README.md:927` — the example ends with:

```typescript
response.status(status).json(body);
```

This sends `Content-Type: application/json`, dropping the `application/problem+json` media type that is the point of the library (and that the library's own filter carefully sets via the adapter). It is also Express-specific, in a library that otherwise goes out of its way to be adapter-agnostic. Anyone copying this pattern for their `@Catch(MySpecialException)` filter silently loses conformance.

**Fix:** use the exported `PROBLEM_CONTENT_TYPE` and the adapter (or at minimum `res.setHeader(...)`) in the example, and note the Fastify variant.

### F4 — MEDIUM (design gap): extension members on `HttpException` responses are silently dropped

Extension members are RFC 9457's headline feature, but the default `HttpException` path discards them. Given:

```typescript
throw new HttpException({ message: 'Balance too low', balance: 30, cost: 50 }, 402);
```

step 4 of `create()` (`src/problem-details.factory.ts:97–107`) builds the body from scratch and `extractDetail()` (`:225`) reads only `message` — `balance` and `cost` vanish without a trace. Today the only first-class ways to emit extensions are a globally registered `exceptionMapper` or Tier 2 validation `errors`; there is no way for a single handler to throw an ad-hoc problem with occurrence-specific extension data.

**Recommendation:** add a `ProblemDetailException` (constructor takes a `ProblemDetail` partial including extensions; the factory recognizes it before step 4 and merges) — or, more conservatively, document explicitly that non-`message` fields of an `HttpException` object response are intentionally dropped and that the mapper is the escape hatch. The current silent loss is the worst of the options.

### F5 — LOW (correctness edge): the `resolveStatus` fallback is itself unguarded

`src/problem-details.factory.ts:156–177` guards _supplied_ statuses to 400–599 but falls back to `exception.getStatus()` unguarded. Consequences:

- `throw new HttpException('moved', 302)` → a `302` response with `Content-Type: application/problem+json`, `type: about:blank`, `title: Found`. RFC 9457 §2 scopes problem details to _error_ conditions; emitting the format on a 3xx is non-conformant.
- If a mapper supplies an out-of-range status _and_ the exception itself carries a non-error status, the warning fires and then the "fallback" emits another non-error status (`Ignoring supplied problem status 200 … falling back to 302`).

The inline comment shows the first case is known. Still, the guard's promise ("problem details responses must use an error status (400-599)") is not actually kept by its own fallback.

**Recommendation:** clamp the fallback into 400–599 (→ 500) with the same warning, or — if pass-through of non-error `HttpException` statuses is the intended Nest-compatible behavior — skip the problem+json formatting entirely for `status < 400` and delegate to `super.catch()`, then document it.

### F6 — LOW (correctness edge): `'request-uri'` reads Express `req.url`, which routers rewrite

`src/problem-details.factory.ts:209` uses `request.url`. Under Express, mounted routers and some middleware mutate `req.url` relative to the mount point; `req.originalUrl` is the stable client-facing path. In a vanilla Nest app the two coincide, but apps embedding Express sub-routers (or Nest's `app.use()` with path-mounted middleware that re-enters routing) can produce a misleading `instance`. Fastify is unaffected.

**Recommendation:** extend `Rfc9457Request` with `originalUrl?: string` and prefer it when present — a backward-compatible one-liner.

### F7 — LOW (correctness edge): shared `WeakSet` drops legitimate shared validation subtrees

`src/problem-details.factory.ts:259–265` creates one `seen` set for the whole `errors` array and `flattenValidationError` (`:345–350`) never removes entries. That correctly breaks cycles, but also dedupes _DAGs_: a child error object referenced under two different parents is emitted for the first parent and silently dropped (→ `null`) for the second. class-validator itself won't produce this shape, but the input is deliberately `unknown[]` and the flattener is otherwise scrupulously shape-agnostic.

**Recommendation:** if only cycle protection is intended, track the _recursion path_ (add on entry, `seen.delete(error)` on exit) instead of a global visited set.

### F8 — LOW (DX): `@ProblemType` on a non-`HttpException` is a silent no-op without catch-all

The filter's delegation gate (`src/rfc9457.exception-filter.ts:61–63`) runs before decorator metadata is ever consulted, so `@ProblemType()`-decorated plain `Error` subclasses fall through to Nest's default `{"statusCode":500,"message":"Internal server error"}` unless `catchAllExceptions: true`. The README documents this in one sentence, but at runtime nothing signals that carefully authored metadata is being ignored — a classic "why isn't my decorator working?" support ticket.

**Recommendation (either):** log once at `debug`/`warn` when a decorated non-`HttpException` is delegated; or treat the presence of `@ProblemType` metadata as opt-in handling (metadata check before the gate) — arguably the decorator _is_ the user saying "this is a problem-details exception."

### F9 — LOW (observability): the `'uuid'` instance strategy produces an identifier nobody can correlate

`urn:uuid:<v4>` is generated at response time (`src/problem-details.factory.ts:210`) and appears only in the client's response body. It is never logged, and `onUnhandled(exception, request)` fires _before_ the body is built, so even a custom observability hook cannot see it. The spec's intent for `instance` is exactly correlation ("give this ID to support") — which currently cannot work server-side.

**Recommendation:** include the resolved `instance` in the unhandled-exception log line, and/or extend `onUnhandled` with an additive third parameter carrying the built `ProblemDetail`. (An additive parameter is backward-compatible for every existing callback.)

### F10 — LOW (compatibility): claimed peer ranges are never tested

`peerDependencies` accept `@nestjs/common` ^10, `@nestjs/swagger` ^7/^8, `class-validator` ^0.14 — but CI installs only Nest 11.x, swagger 11.x, class-validator 0.15. The compatibility claim is untested; particular risk areas are the `ApiResponse({ content })` option shape across swagger 7→11 and `HttpAdapterHost`/`DiscoveryService` behavior differences in Nest 10.

**Recommendation:** add a small CI job that installs the lowest supported majors (`@nestjs/common@10 @nestjs/core@10 @nestjs/swagger@7 class-validator@0.14`) and runs the e2e suite — or narrow the ranges to what is actually verified.

**Outcome:** the claim was tested and **holds** — the full suite passes against NestJS 10.4.15, `@nestjs/swagger` 7.4.2, `class-validator` 0.14.1 and `reflect-metadata` 0.1.14, so no range needed narrowing. A `peer-compat` CI job now runs it on every push. One wrinkle surfaced while verifying: the repo's `pnpm.overrides` security pins force `path-to-regexp@>=8`, which Express 4 (what NestJS 10 uses) cannot load, so the job drops that block before installing. Those overrides guard this repo's dev tree only and are never published, so removing them for the compat job tests what consumers actually get.

### F11 — WITHDRAWN (design): swagger idempotency cache is process-global

**The original recommendation was wrong, and implementing it made the output worse.**

The observation was accurate: `src/swagger/apply-problem-detail-responses.ts` keys its `appliedStatuses` WeakMap by controller class, so two Nest apps in one process share first-call-wins state, and app B's differing options are silently ignored. The proposed fix — key the cache by application — was implemented and then reverted, because it does not do what it appears to.

`@ApiResponse` stores its metadata **on the class**. Two applications sharing a controller class therefore necessarily read the same annotations; per-application options are not representable. Applying per app does not give each its own view — it appends a second response object to the shared class, which `@nestjs/swagger` merges into a single entry with a doubled description. Measured directly:

```json
{
  "description": "Bad Request\n\nBad Request",
  "content": {
    "application/problem+json": { "schema": { "$ref": ".../ValidationProblemDetailDto" } }
  }
}
```

So the existing global cache was not an oversight — it is the only policy that keeps the emitted spec well-formed, and first-wins is the correct tie-break. What was genuinely missing was the _explanation_: the code and README now state why the cache is class-keyed, what the cross-application consequence is, and that giving each app its own controller classes is the way out. A regression test (`a controller class shared by two applications`) locks in the clean description so the trap cannot be reintroduced.

The secondary note stands and was addressed: granularity is per controller, not per route — every route on a documented controller receives every configured status — now stated in both the JSDoc and the README.

### F12 — INFO (design): no channel for status-specific response headers

Problem responses that conventionally pair with headers — `Retry-After` on 429/503, `WWW-Authenticate` on 401 — cannot carry them: `exceptionMapper` returns a body only, and the filter writes only `Content-Type`. Nest core has the same gap, so this is an _opportunity_, not a defect: an optional `headers?: Record<string, string>` on the mapper result (stripped from the body before sending) would round out the library for rate-limiting and auth use cases.

### F14 — HIGH (packaging): a stale `tsbuildinfo` makes `pnpm run build` emit nothing

_Found while verifying the F2 fix, not present in the original review._

`tsconfig.json` sets `incremental: true`, and `tsconfig.build.json` did not override `tsBuildInfoFile`, so the cache landed in the project root as `tsconfig.build.tsbuildinfo` — **outside** the `dist` directory it describes. The two therefore have independent lifetimes, and deleting one does not invalidate the other:

```
$ rm -rf dist && pnpm run build
> tsc -p tsconfig.build.json
$ ls dist
ls: cannot access 'dist': No such file or directory     # exit code 0, no output, no warning
```

tsc reads the surviving cache, concludes every file is up to date, and emits nothing. This is not hypothetical: it is how the finding was discovered — an `npm pack --dry-run` after a routine clean rebuild produced a 17-file tarball containing `src` and no `dist` whatsoever.

The consequence is a broken publish. `prepublishOnly` runs `pnpm run build`, and `files` publishes `dist`, so a maintainer who cleans `dist` without also deleting the root `tsbuildinfo` — a `git clean` that misses it, a manual `rm -rf dist`, a CI cache that restores the buildinfo but not the output — publishes a package whose entry points do not exist. Every `require('@camcima/nestjs-rfc9457')` fails.

**Fix applied:** `"tsBuildInfoFile": "./dist/.tsbuildinfo"`, giving the cache the same lifetime as the output it describes, so `rm -rf dist` necessarily invalidates it. The file is kept out of the tarball with a `!dist/.tsbuildinfo` entry in `files`. Verified: two consecutive `rm -rf dist && pnpm run build` cycles each emit all 35 files.

### F13 — INFO (packaging): CJS-only build

`module: commonjs` with a single `default` export condition. Entirely reasonable for the NestJS ecosystem today; the `exports` map is already structured so an `import` condition can be added later without a breaking change. No action needed — recorded so the decision is visible.

---

## Test & tooling observations

- **Suite quality is high**: 192 tests; e2e on both adapters; committed-response (`headers already sent`) path; hostile flattener inputs; async `onUnhandled` rejection containment; module async variants (`useFactory`/`useClass`/`useExisting`). The 1,094-line factory spec tracks the factory's actual decision tree.
- `test/placeholder.ts` is dead — vitest only includes `*.{spec,e2e-spec}.ts`. Delete it.
- **No `CHANGELOG.md`** — releases exist only as GitHub Releases. Conventional commits are already enforced by commitlint, so `@release-it/conventional-changelog` would generate one for free. For a published library, an in-repo changelog is worth having.
- **Known local issue:** the lefthook `pre-push` gitleaks hook currently fails on feature-branch pushes (workaround: `git push --no-verify`). Beyond fixing/upgrading gitleaks, note that `gitleaks git` rescans the _entire history_ on every push; once repaired, consider limiting the hook to the outgoing commit range so pushes stay fast.
- Consider adding a `SECURITY.md` so GitHub surfaces a security policy tab; the README's Security section content can simply be referenced.
- CI is otherwise exemplary (SHA-pinned actions, matrix, CodeQL, OSV, Codecov with a well-documented Dependabot carve-out).

---

## Resolution

Every finding above was addressed on branch `fix/architecture-review-2026-08`, except F11 (withdrawn as incorrect — see the finding) and F13 (no action; CJS-only is the right call today).

One further defect (F14) surfaced while verifying the F2 fix — a stale incremental-build cache that makes `pnpm run build` silently emit nothing, which would publish a package with no `dist` — and was fixed as well.

Verification at the end of that work: **240 tests passing** (up from 192), 100% line coverage, clean `lint`, `format` and `build`, and an `npm pack --dry-run` confirming 73 files with both `.js.map` and `.d.ts.map` resolving to shipped sources. New behavior is covered by unit tests and by e2e tests on both the Express and Fastify adapters.

Two changes are behavioral and worth calling out to consumers:

- **F5 is breaking.** An `HttpException` with a status outside 400–599 is no longer rendered as a problem document; it is delegated to NestJS's default handler. Previously `new HttpException('moved', 302)` produced a 302 carrying `application/problem+json`.
- **F9 extends a callback signature.** `onUnhandled` now receives the resolved problem body as a third parameter. Additive — existing two-parameter callbacks keep working unchanged.

The remaining housekeeping from the notes below was also done: `test/placeholder.ts` deleted, `CHANGELOG.md` added (seeded from the tag history), `SECURITY.md` added, and the gitleaks pre-push hook narrowed from a full-history scan to the commit range being pushed.

## Suggested priority order

1. **F1** — one-line fix, largest DX return in the whole review.
2. **F2 + F3** — packaging and doc correctness; both small.
3. **F4** — the one real design decision to make (ad-hoc extensions story); worth a short design note before v1.0 since it may shape the public API.
4. **F10** — cheap insurance against a whole class of consumer bug reports.
5. **F5–F9, F11, F12** — opportunistic; none are urgent.

Overall: this codebase is in the top tier of open-source NestJS libraries I have reviewed — the remaining work is polish around the edges of an already sound core.

_(Priority order above reflects the original review. All of it has since been implemented — see [Resolution](#resolution).)_
