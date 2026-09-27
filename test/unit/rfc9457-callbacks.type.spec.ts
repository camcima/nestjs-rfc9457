import { ProblemDetail, Rfc9457ModuleOptions, Rfc9457Request } from '../../src/rfc9457.interfaces';

// Compile-time contract, checked by `tsc --noEmit -p tsconfig.json`. The runtime
// assertions only keep Vitest from reporting an empty test.
describe('observational callback typing', () => {
  it('passes the resolved problem to observers as read-only', () => {
    const options: Rfc9457ModuleOptions = {
      onUnhandled: (_exception, _request, problem) => {
        // @ts-expect-error the resolved problem is read-only for observers
        problem.detail = 'changed';
      },
      responseHeaders: (problem) => {
        // @ts-expect-error the resolved problem is read-only for observers
        problem.status = 200;
        return undefined;
      },
    };
    expect(options.onUnhandled).toBeTypeOf('function');
  });

  it('still accepts callbacks declared against the mutable ProblemDetail type', () => {
    const onUnhandled = (_e: unknown, _r: Rfc9457Request, _p: ProblemDetail): void => undefined;
    const responseHeaders = (_p: ProblemDetail): Record<string, string> | undefined => undefined;
    const options: Rfc9457ModuleOptions = { onUnhandled, responseHeaders };
    expect(options.responseHeaders).toBe(responseHeaders);
  });
});
