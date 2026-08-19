# Security Policy

## Supported versions

This library is pre-1.0. Security fixes are released against the latest published
minor; there are no long-term support branches.

| Version | Supported |
| ------- | --------- |
| 0.5.x   | ✅        |
| < 0.5   | ❌        |

## Reporting a vulnerability

Please report suspected vulnerabilities privately via
[GitHub Security Advisories](https://github.com/camcima/nestjs-rfc9457/security/advisories/new).
Do not open a public issue for an undisclosed vulnerability.

Include, where possible:

- affected version(s) and the NestJS adapter in use (Express or Fastify),
- a minimal reproduction (module options plus the exception that triggers it),
- the impact you believe it has.

You can expect an initial response within 7 days.

## Scope

This library shapes HTTP error responses, so the security surface is mainly
**information disclosure** — internal error text, stack traces, or request data
reaching a client that should not see it. Reports in that area are especially
welcome.

Two behaviors are intentional and not vulnerabilities on their own:

- An explicit `HttpException` message is client-facing by design, matching NestJS
  semantics. Set [`suppress5xxDetail: true`](README.md#suppress5xxdetail) to strip
  `detail` from every 5xx response.
- `exceptionMapper`, `validationExceptionMapper`, `responseHeaders`, a custom
  `instanceStrategy`, and `ProblemDetailException` bodies are application-supplied.
  Whatever they place in the response is emitted as written; sanitizing that data
  is the application's responsibility.

Unhandled non-`HttpException` throwables never contribute their message to the
response body — if you find a path where one does, that is a bug worth reporting.

## Supply chain

The library ships **zero runtime dependencies**. CI runs CodeQL, OSV-Scanner, and
`pnpm audit --prod` on every push and pull request, and gitleaks scans for secrets
before push. Dev-dependency advisories are out of scope for consumers (see
`osv-scanner.toml`) since they never reach a published artifact.
