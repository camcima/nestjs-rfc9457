import { Rfc9457Request } from '../../src/rfc9457.interfaces';

// Simulates an interface-typed request (like Express's `Request`). Interface types
// do NOT receive an implicit index signature, so this is assignable to
// Rfc9457Request only because the index signature has been removed.
interface FakeFrameworkRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  get(name: string): string | undefined;
}

describe('Rfc9457Request assignability', () => {
  it('accepts an interface-typed request object without an index signature', () => {
    const frameworkReq: FakeFrameworkRequest = {
      url: '/api/x',
      method: 'GET',
      headers: {},
      get: () => undefined,
    };
    const req: Rfc9457Request = frameworkReq;
    expect(req.url).toBe('/api/x');
    expect(req.method).toBe('GET');
  });
});
