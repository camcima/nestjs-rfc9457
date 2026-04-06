import 'reflect-metadata';
import { PROBLEM_TYPE_METADATA_KEY } from './rfc9457.constants';
import { ProblemTypeMetadata } from './rfc9457.interfaces';

export function ProblemType(metadata: ProblemTypeMetadata): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(PROBLEM_TYPE_METADATA_KEY, metadata, target);
  };
}
