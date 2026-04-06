import 'reflect-metadata';
import { ProblemType } from '../../src/problem-type.decorator';
import { PROBLEM_TYPE_METADATA_KEY } from '../../src/rfc9457.constants';
import { ProblemTypeMetadata } from '../../src/rfc9457.interfaces';

describe('ProblemType decorator', () => {
  it('stores metadata on the class', () => {
    @ProblemType({ type: 'https://example.com/not-found', title: 'Not Found', status: 404 })
    class TestException extends Error {}

    const metadata: ProblemTypeMetadata = Reflect.getMetadata(
      PROBLEM_TYPE_METADATA_KEY,
      TestException,
    );
    expect(metadata).toEqual({
      type: 'https://example.com/not-found',
      title: 'Not Found',
      status: 404,
    });
  });

  it('allows all fields to be optional', () => {
    @ProblemType({ title: 'Custom Error' })
    class PartialException extends Error {}

    const metadata: ProblemTypeMetadata = Reflect.getMetadata(
      PROBLEM_TYPE_METADATA_KEY,
      PartialException,
    );
    expect(metadata).toEqual({ title: 'Custom Error' });
  });

  it('retrieves metadata from parent when child is undecorated', () => {
    @ProblemType({ type: 'https://example.com/parent', status: 400 })
    class ParentException extends Error {}

    class ChildException extends ParentException {}

    const metadata: ProblemTypeMetadata = Reflect.getMetadata(
      PROBLEM_TYPE_METADATA_KEY,
      ChildException,
    );
    expect(metadata).toEqual({ type: 'https://example.com/parent', status: 400 });
  });

  it('child decorator fully overrides parent metadata', () => {
    @ProblemType({ type: 'https://example.com/parent', title: 'Parent', status: 400 })
    class ParentException extends Error {}

    @ProblemType({ type: 'https://example.com/child', status: 422 })
    class ChildException extends ParentException {}

    const metadata: ProblemTypeMetadata = Reflect.getMetadata(
      PROBLEM_TYPE_METADATA_KEY,
      ChildException,
    );
    expect(metadata).toEqual({ type: 'https://example.com/child', status: 422 });
    expect(metadata.title).toBeUndefined();
  });

  it('returns undefined for undecorated class with no decorated parent', () => {
    class PlainException extends Error {}

    const metadata = Reflect.getMetadata(PROBLEM_TYPE_METADATA_KEY, PlainException);
    expect(metadata).toBeUndefined();
  });
});
