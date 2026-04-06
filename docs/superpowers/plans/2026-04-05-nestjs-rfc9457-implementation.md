# @camcima/nestjs-rfc9457 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a NestJS library that converts HTTP error responses into RFC 9457 Problem Details (`application/problem+json`) format with zero-config defaults and an opt-in customization layer.

**Architecture:** Composable pipeline — `ProblemDetailsFactory` (injectable service) resolves exceptions to problem details, `Rfc9457ExceptionFilter` (extends `BaseExceptionFilter`) catches exceptions and delegates to the factory, `@ProblemType()` decorator stores metadata templates on exception classes, `Rfc9457Module` wires it all together via `forRoot()`/`forRootAsync()`.

**Tech Stack:** TypeScript, NestJS 10+/11+, Jest, Express + Fastify adapters, Lefthook, commitlint, release-it, GitHub Actions CI

**Spec:** `docs/superpowers/specs/2026-04-05-nestjs-rfc9457-design.md`

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `.gitignore`
- Create: `LICENSE`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@camcima/nestjs-rfc9457",
  "version": "0.0.1",
  "description": "NestJS library for RFC 9457 Problem Details responses",
  "author": "Carlos Cima",
  "license": "MIT",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist"
  ],
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "lint": "eslint 'src/**/*.ts' 'test/**/*.ts'",
    "format": "prettier --check 'src/**/*.ts' 'test/**/*.ts'",
    "format:fix": "prettier --write 'src/**/*.ts' 'test/**/*.ts'",
    "test": "jest",
    "test:unit": "jest --testPathPattern=test/unit",
    "test:e2e": "jest --testPathPattern=test/e2e",
    "test:cov": "jest --coverage",
    "prepublishOnly": "npm run build",
    "release": "release-it"
  },
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
  },
  "devDependencies": {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/platform-fastify": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@release-it/conventional-changelog": "^9.0.0",
    "@types/jest": "^29.0.0",
    "@types/supertest": "^6.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "class-transformer": "^0.5.0",
    "class-validator": "^0.14.0",
    "eslint": "^8.0.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-prettier": "^5.0.0",
    "fastify": "^4.0.0",
    "jest": "^29.0.0",
    "lefthook": "^1.0.0",
    "prettier": "^3.0.0",
    "reflect-metadata": "^0.2.0",
    "release-it": "^18.0.0",
    "rxjs": "^7.0.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/camcima/nestjs-rfc9457.git"
  },
  "keywords": [
    "nestjs",
    "rfc9457",
    "rfc7807",
    "problem-details",
    "error-handling",
    "api"
  ]
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": ".",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Create `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["test", "dist", "node_modules"]
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
coverage/
*.js.map
*.d.ts.map
.idea/
.vscode/
*.swp
*.swo
.DS_Store
```

- [ ] **Step 5: Create `LICENSE`**

MIT license with `Copyright (c) 2026 Carlos Cima`.

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: Clean install with no errors. `node_modules/` created.

- [ ] **Step 7: Verify build compiles (empty project)**

Create a placeholder `src/index.ts` with `export {};` so tsc doesn't fail on empty input.

Run: `npm run build`
Expected: `dist/index.js` and `dist/index.d.ts` created.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.build.json .gitignore LICENSE src/index.ts
git commit -m "chore: scaffold project with package.json, tsconfig, and gitignore"
```

---

### Task 2: Dev tooling configuration

**Files:**
- Create: `.eslintrc.js`
- Create: `.prettierrc`
- Create: `jest.config.ts`

- [ ] **Step 1: Create `.eslintrc.js`**

```js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'dist', 'coverage', 'commitlint.config.js'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true
}
```

- [ ] **Step 3: Create `jest.config.ts`**

```typescript
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
};

export default config;
```

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: No errors (only `src/index.ts` with `export {}` exists).

- [ ] **Step 5: Verify format passes**

Run: `npm run format`
Expected: All files pass the check.

- [ ] **Step 6: Verify tests run (no tests yet)**

Run: `npm test -- --passWithNoTests`
Expected: "No tests found" with exit code 0.

- [ ] **Step 7: Commit**

```bash
git add .eslintrc.js .prettierrc jest.config.ts
git commit -m "chore: configure eslint, prettier, and jest"
```

---

### Task 3: CI/CD pipeline and release tooling

**Files:**
- Create: `lefthook.yml`
- Create: `commitlint.config.js`
- Create: `.release-it.json`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `lefthook.yml`**

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{ts,js}"
      run: npx eslint {staged_files}
    format:
      glob: "*.{ts,js,json,md,yml,yaml}"
      run: npx prettier --check {staged_files}

commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}
```

- [ ] **Step 2: Create `commitlint.config.js`**

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
};
```

- [ ] **Step 3: Create `.release-it.json`**

```json
{
  "git": {
    "commitMessage": "chore: release v${version}",
    "tagName": "v${version}"
  },
  "npm": {
    "publish": true,
    "publishArgs": ["--access public"]
  },
  "github": {
    "release": true
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": "angular",
      "infile": "CHANGELOG.md"
    }
  }
}
```

- [ ] **Step 4: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run format

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run test:cov

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
```

- [ ] **Step 5: Install lefthook hooks**

Run: `npx lefthook install`
Expected: Lefthook hooks installed in `.git/hooks/`.

- [ ] **Step 6: Commit**

```bash
git add lefthook.yml commitlint.config.js .release-it.json .github/workflows/ci.yml
git commit -m "chore: add lefthook, commitlint, release-it, and CI pipeline"
```

---

### Task 4: Interfaces and constants

**Files:**
- Create: `src/rfc9457.interfaces.ts`
- Create: `src/rfc9457.constants.ts`

- [ ] **Step 1: Create `src/rfc9457.interfaces.ts`**

```typescript
import { Type } from '@nestjs/common';

/**
 * Minimal request context used by the factory and callbacks.
 * Compatible with both Express and Fastify request objects.
 */
export interface Rfc9457Request {
  url: string;
  method: string;
  [key: string]: unknown;
}

/**
 * RFC 9457 Problem Details response body.
 * The index signature allows extension members for problem-type-specific data.
 */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

/**
 * Metadata template for the @ProblemType() decorator.
 * All fields are optional — the factory fills missing values from the
 * exception and request context at runtime.
 *
 * This is intentionally separate from ProblemDetail: it defines a
 * problem type template (the five core fields only), not a final
 * response with arbitrary extension members.
 */
export interface ProblemTypeMetadata {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}

export type InstanceStrategy =
  | 'request-uri'
  | 'uuid'
  | 'none'
  | ((request: Rfc9457Request, exception: unknown) => string | undefined);

export interface Rfc9457ModuleOptions {
  typeBaseUri?: string;
  instanceStrategy?: InstanceStrategy;
  catchAllExceptions?: boolean;
  exceptionMapper?: (exception: unknown, request: Rfc9457Request) => ProblemDetail | null;
  validationExceptionMapper?: (messages: string[], request: Rfc9457Request) => ProblemDetail;
}

export interface Rfc9457OptionsFactory {
  createRfc9457Options(): Promise<Rfc9457ModuleOptions> | Rfc9457ModuleOptions;
}

export interface Rfc9457AsyncModuleOptions {
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<Rfc9457ModuleOptions> | Rfc9457ModuleOptions;
  inject?: any[];
  useClass?: Type<Rfc9457OptionsFactory>;
  useExisting?: Type<Rfc9457OptionsFactory>;
}
```

- [ ] **Step 2: Create `src/rfc9457.constants.ts`**

```typescript
export const RFC9457_MODULE_OPTIONS = Symbol('RFC9457_MODULE_OPTIONS');
export const PROBLEM_TYPE_METADATA_KEY = Symbol('RFC9457_PROBLEM_TYPE');
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
```

- [ ] **Step 3: Verify build still compiles**

Update `src/index.ts` temporarily to export the new files:

```typescript
export * from './rfc9457.interfaces';
export * from './rfc9457.constants';
```

Run: `npm run build`
Expected: Compiles cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/rfc9457.interfaces.ts src/rfc9457.constants.ts src/index.ts
git commit -m "feat: add core interfaces and constants"
```

---

### Task 5: Slug utility

**Files:**
- Create: `test/unit/slug.spec.ts`
- Create: `src/utils/slug.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { toSlug } from '../../src/utils/slug';

describe('toSlug', () => {
  it('converts "Not Found" to "not-found"', () => {
    expect(toSlug('Not Found')).toBe('not-found');
  });

  it('converts "Internal Server Error" to "internal-server-error"', () => {
    expect(toSlug('Internal Server Error')).toBe('internal-server-error');
  });

  it('converts "Unprocessable Entity" to "unprocessable-entity"', () => {
    expect(toSlug('Unprocessable Entity')).toBe('unprocessable-entity');
  });

  it('converts "OK" to "ok"', () => {
    expect(toSlug('OK')).toBe('ok');
  });

  it('handles single word', () => {
    expect(toSlug('Forbidden')).toBe('forbidden');
  });

  it('trims whitespace', () => {
    expect(toSlug('  Not Found  ')).toBe('not-found');
  });

  it('collapses multiple spaces', () => {
    expect(toSlug('Internal  Server   Error')).toBe('internal-server-error');
  });

  it('strips punctuation', () => {
    expect(toSlug("I'm a Teapot")).toBe('im-a-teapot');
  });

  it('handles empty string', () => {
    expect(toSlug('')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest test/unit/slug.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
export function toSlug(phrase: string): string {
  return phrase
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // strip punctuation
    .replace(/\s+/g, '-')           // spaces to hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .replace(/^-|-$/g, '');          // trim leading/trailing hyphens
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest test/unit/slug.spec.ts`
Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/slug.ts test/unit/slug.spec.ts
git commit -m "feat: add toSlug utility for HTTP status phrase conversion"
```

---

### Task 6: @ProblemType decorator

**Files:**
- Create: `test/unit/problem-type.decorator.spec.ts`
- Create: `src/problem-type.decorator.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest test/unit/problem-type.decorator.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
import 'reflect-metadata';
import { PROBLEM_TYPE_METADATA_KEY } from './rfc9457.constants';
import { ProblemTypeMetadata } from './rfc9457.interfaces';

export function ProblemType(metadata: ProblemTypeMetadata): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(PROBLEM_TYPE_METADATA_KEY, metadata, target);
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest test/unit/problem-type.decorator.spec.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/problem-type.decorator.ts test/unit/problem-type.decorator.spec.ts
git commit -m "feat: add @ProblemType() class decorator with prototype chain inheritance"
```

---

### Task 7: Validation exception and factory helper

**Files:**
- Create: `test/unit/validation.spec.ts`
- Create: `src/validation/rfc9457-validation.exception.ts`
- Create: `src/validation/rfc9457-validation-pipe-exception.factory.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { Rfc9457ValidationException } from '../../src/validation/rfc9457-validation.exception';
import { createRfc9457ValidationPipeExceptionFactory } from '../../src/validation/rfc9457-validation-pipe-exception.factory';

describe('Rfc9457ValidationException', () => {
  it('extends BadRequestException', () => {
    const errors: ValidationError[] = [];
    const exception = new Rfc9457ValidationException(errors);
    expect(exception).toBeInstanceOf(BadRequestException);
  });

  it('preserves validation errors', () => {
    const errors: ValidationError[] = [
      Object.assign(new ValidationError(), {
        property: 'email',
        constraints: { isEmail: 'email must be an email' },
      }),
    ];
    const exception = new Rfc9457ValidationException(errors);
    expect(exception.validationErrors).toBe(errors);
    expect(exception.validationErrors).toHaveLength(1);
    expect(exception.validationErrors[0].property).toBe('email');
  });

  it('has status 400', () => {
    const exception = new Rfc9457ValidationException([]);
    expect(exception.getStatus()).toBe(400);
  });
});

describe('createRfc9457ValidationPipeExceptionFactory', () => {
  it('returns a function', () => {
    const factory = createRfc9457ValidationPipeExceptionFactory();
    expect(typeof factory).toBe('function');
  });

  it('returned function produces Rfc9457ValidationException', () => {
    const factory = createRfc9457ValidationPipeExceptionFactory();
    const errors: ValidationError[] = [
      Object.assign(new ValidationError(), {
        property: 'age',
        constraints: { min: 'age must not be less than 0' },
      }),
    ];
    const result = factory(errors);
    expect(result).toBeInstanceOf(Rfc9457ValidationException);
    expect(result.validationErrors).toBe(errors);
  });

  it('handles empty error arrays', () => {
    const factory = createRfc9457ValidationPipeExceptionFactory();
    const result = factory([]);
    expect(result).toBeInstanceOf(Rfc9457ValidationException);
    expect(result.validationErrors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest test/unit/validation.spec.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `Rfc9457ValidationException`**

```typescript
import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export class Rfc9457ValidationException extends BadRequestException {
  constructor(public readonly validationErrors: ValidationError[]) {
    super('Request validation failed');
  }
}
```

- [ ] **Step 4: Write `createRfc9457ValidationPipeExceptionFactory`**

```typescript
import { ValidationError } from 'class-validator';
import { Rfc9457ValidationException } from './rfc9457-validation.exception';

export function createRfc9457ValidationPipeExceptionFactory(): (
  errors: ValidationError[],
) => Rfc9457ValidationException {
  return (errors: ValidationError[]): Rfc9457ValidationException => {
    return new Rfc9457ValidationException(errors);
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest test/unit/validation.spec.ts`
Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/validation/ test/unit/validation.spec.ts
git commit -m "feat: add Rfc9457ValidationException and ValidationPipe factory helper"
```

---

### Task 8: ProblemDetailsFactory — core resolution

**Files:**
- Create: `test/unit/problem-details.factory.spec.ts`
- Create: `src/problem-details.factory.ts`

This is the largest task. The factory is built incrementally through TDD cycles, grouped by behavior.

- [ ] **Step 1: Write tests for default HttpException mapping**

```typescript
import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ProblemDetailsFactory } from '../../src/problem-details.factory';
import { Rfc9457ModuleOptions } from '../../src/rfc9457.interfaces';

function createFactory(options: Rfc9457ModuleOptions = {}): ProblemDetailsFactory {
  return new ProblemDetailsFactory(options);
}

import { Rfc9457Request } from '../../src/rfc9457.interfaces';

const mockRequest: Rfc9457Request = { url: '/api/users/42', method: 'GET' };

describe('ProblemDetailsFactory', () => {
  describe('default HttpException mapping', () => {
    it('maps a 404 with custom string detail', () => {
      const factory = createFactory();
      const { status, body } = factory.create(
        new NotFoundException('User 42 not found'),
        mockRequest,
      );
      expect(status).toBe(404);
      expect(body).toEqual({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'User 42 not found',
      });
    });

    it('omits detail for default boilerplate message (no custom detail)', () => {
      const factory = createFactory();
      const { status, body } = factory.create(new ForbiddenException(), mockRequest);
      expect(status).toBe(403);
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Forbidden');
      expect(body.status).toBe(403);
      expect(body.detail).toBeUndefined();
    });

    it('maps a 400 with object response — extracts message string as detail', () => {
      const factory = createFactory();
      const exception = new BadRequestException({ message: 'Invalid email format', code: 'E001' });
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(400);
      expect(body.detail).toBe('Invalid email format');
    });

    it('omits detail when object response message is not a string', () => {
      const factory = createFactory();
      const exception = new HttpException({ message: 12345 }, 400);
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(400);
      expect(body.detail).toBeUndefined();
    });

    it('maps a 500 HttpException', () => {
      const factory = createFactory();
      const { status, body } = factory.create(
        new InternalServerErrorException('DB connection failed'),
        mockRequest,
      );
      expect(status).toBe(500);
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Internal Server Error');
      expect(body.status).toBe(500);
      expect(body.detail).toBe('DB connection failed');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest test/unit/problem-details.factory.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write initial ProblemDetailsFactory implementation**

```typescript
import { HttpException, Inject, Injectable } from '@nestjs/common';
import * as http from 'http';
import { randomUUID } from 'crypto';
import { ProblemDetail, ProblemTypeMetadata, Rfc9457ModuleOptions, Rfc9457Request } from './rfc9457.interfaces';
import { PROBLEM_TYPE_METADATA_KEY, RFC9457_MODULE_OPTIONS } from './rfc9457.constants';
import { Rfc9457ValidationException } from './validation/rfc9457-validation.exception';
import { toSlug } from './utils/slug';

@Injectable()
export class ProblemDetailsFactory {
  constructor(
    @Inject(RFC9457_MODULE_OPTIONS) private readonly options: Rfc9457ModuleOptions,
  ) {}

  create(exception: unknown, request: Rfc9457Request): { status: number; body: ProblemDetail } {
    let result: ProblemDetail | null = null;

    // Step 1: exceptionMapper callback
    if (this.options.exceptionMapper) {
      result = this.options.exceptionMapper(exception, request);
    }

    // Step 2: @ProblemType() decorator metadata
    if (!result && exception != null && typeof exception === 'object') {
      const constructor = (exception as object).constructor;
      if (constructor) {
        const metadata: ProblemTypeMetadata | undefined = Reflect.getMetadata(
          PROBLEM_TYPE_METADATA_KEY,
          constructor,
        );
        if (metadata) {
          result = { ...metadata };
          if (result.detail === undefined) {
            result.detail = this.extractDetail(exception);
          }
        }
      }
    }

    // Step 3: Validation handling
    if (!result) {
      result = this.handleValidation(exception, request);
    }

    // Step 4: Default HttpException handling
    if (!result && exception instanceof HttpException) {
      const exceptionStatus = exception.getStatus();
      result = {
        status: exceptionStatus,
        title: http.STATUS_CODES[exceptionStatus] || 'Unknown Error',
      };
      const detail = this.extractDetail(exception);
      if (detail !== undefined) {
        result.detail = detail;
      }
    }

    // Step 5: Unknown exception fallback (catch-all mode only)
    // This path should only be reachable when catchAllExceptions is true.
    // The filter prevents non-HttpException from reaching the factory otherwise,
    // but the factory enforces this as a defensive check.
    if (!result) {
      if (!this.options.catchAllExceptions) {
        // Should not happen in normal flow — the filter guards this.
        // Defensive fallback: produce a generic 500 anyway.
        result = {
          status: 500,
          title: 'Internal Server Error',
        };
      } else {
        result = {
          status: 500,
          title: 'Internal Server Error',
          // detail intentionally omitted — do not leak internal error info
        };
      }
    }

    // Resolve definitive transport status
    const httpStatus = this.resolveStatus(result, exception);

    // Normalize type
    result.type = this.normalizeType(result, httpStatus);

    // Set title if missing
    if (!result.title) {
      result.title = http.STATUS_CODES[httpStatus] || 'Unknown Error';
    }

    // Set advisory status in body
    result.status = httpStatus;

    // Apply instance strategy
    const instance = this.resolveInstance(request, exception);
    if (instance !== undefined) {
      result.instance = instance;
    }

    return { status: httpStatus, body: result };
  }

  private resolveStatus(result: ProblemDetail, exception: unknown): number {
    if (
      result.status !== undefined &&
      typeof result.status === 'number' &&
      result.status >= 100 &&
      result.status < 600
    ) {
      return result.status;
    }
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return 500;
  }

  private normalizeType(result: ProblemDetail, status: number): string {
    if (result.type) {
      if (result.type.includes('://') || result.type.startsWith('about:')) {
        return result.type;
      }
      if (this.options.typeBaseUri) {
        const baseUri = this.options.typeBaseUri.replace(/\/+$/, '');
        return `${baseUri}/${result.type}`;
      }
      return result.type;
    }
    if (this.options.typeBaseUri) {
      const phrase = http.STATUS_CODES[status] || 'Unknown Error';
      const slug = toSlug(phrase);
      const baseUri = this.options.typeBaseUri.replace(/\/+$/, '');
      return `${baseUri}/${slug}`;
    }
    return 'about:blank';
  }

  private resolveInstance(request: Rfc9457Request, exception: unknown): string | undefined {
    const strategy = this.options.instanceStrategy || 'none';
    if (strategy === 'none') return undefined;
    if (strategy === 'request-uri') return request.url;
    if (strategy === 'uuid') return `urn:uuid:${randomUUID()}`;
    if (typeof strategy === 'function') return strategy(request, exception);
    return undefined;
  }

  private extractDetail(exception: unknown): string | undefined {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const status = exception.getStatus();
      const defaultPhrase = http.STATUS_CODES[status];

      if (typeof response === 'string') {
        // Omit if it's just the default HTTP status phrase (boilerplate)
        return response === defaultPhrase ? undefined : response;
      }
      if (typeof response === 'object' && response !== null) {
        const msg = (response as any).message;
        if (typeof msg === 'string' && msg.length > 0) {
          return msg === defaultPhrase ? undefined : msg;
        }
      }
      return undefined;
    }
    if (exception instanceof Error) {
      return exception.message || undefined;
    }
    return undefined;
  }

  private handleValidation(exception: unknown, request: Rfc9457Request): ProblemDetail | null {
    if (exception instanceof Rfc9457ValidationException) {
      return {
        status: 400,
        title: 'Bad Request',
        detail: 'Request validation failed',
        errors: exception.validationErrors.map((err) => this.flattenValidationError(err)),
      };
    }

    if (this.isDefaultValidationException(exception)) {
      const response = (exception as HttpException).getResponse() as any;
      const messages: string[] = response.message;
      if (this.options.validationExceptionMapper) {
        return this.options.validationExceptionMapper(messages, request);
      }
      return {
        status: 400,
        title: 'Bad Request',
        detail: 'Request validation failed',
        errors: messages,
      };
    }

    return null;
  }

  private isDefaultValidationException(exception: unknown): boolean {
    if (!(exception instanceof HttpException)) return false;
    if (exception.getStatus() !== 400) return false;
    const response = exception.getResponse();
    if (typeof response !== 'object' || response === null) return false;
    const msg = (response as any).message;
    return Array.isArray(msg) && msg.length > 0 && msg.every((m: any) => typeof m === 'string');
  }

  private flattenValidationError(error: any): any {
    const result: any = { property: error.property };
    if (error.constraints) {
      result.constraints = error.constraints;
    }
    if (error.children && error.children.length > 0) {
      result.children = error.children.map((child: any) => this.flattenValidationError(child));
    }
    return result;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest test/unit/problem-details.factory.spec.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Write tests for RFC-sensitive invariants**

Append to the test file inside the outer `describe('ProblemDetailsFactory', ...)`:

```typescript
  describe('RFC-sensitive invariants', () => {
    it('defaults type to about:blank when not set', () => {
      const factory = createFactory();
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.type).toBe('about:blank');
    });

    it('uses HTTP reason phrase as title when type is about:blank', () => {
      const factory = createFactory();
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.title).toBe('Not Found');
    });

    it('body.status matches returned transport status', () => {
      const factory = createFactory();
      const { status, body } = factory.create(new ForbiddenException(), mockRequest);
      expect(body.status).toBe(status);
      expect(status).toBe(403);
    });

    it('extension members from exceptionMapper do not overwrite core fields', () => {
      const factory = createFactory({
        exceptionMapper: () => ({
          status: 422,
          title: 'Custom Title',
          detail: 'Custom detail',
          customField: 'custom-value',
        }),
      });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Custom Title');
      expect(body.status).toBe(422);
      expect(body.detail).toBe('Custom detail');
      expect(body.customField).toBe('custom-value');
    });
  });
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest test/unit/problem-details.factory.spec.ts`
Expected: All 9 tests PASS (previous 5 + new 4).

- [ ] **Step 7: Write tests for detail derivation rules**

```typescript
  describe('detail derivation', () => {
    it('uses string response as detail', () => {
      const factory = createFactory();
      const exception = new HttpException('Raw string error', 400);
      const { body } = factory.create(exception, mockRequest);
      expect(body.detail).toBe('Raw string error');
    });

    it('extracts message string from object response', () => {
      const factory = createFactory();
      const exception = new HttpException({ message: 'Structured error' }, 400);
      const { body } = factory.create(exception, mockRequest);
      expect(body.detail).toBe('Structured error');
    });

    it('omits detail when object response has no string message', () => {
      const factory = createFactory();
      const exception = new HttpException({ error: 'no message key' }, 400);
      const { body } = factory.create(exception, mockRequest);
      expect(body.detail).toBeUndefined();
    });

    it('omits detail when message is an empty string', () => {
      const factory = createFactory();
      const exception = new HttpException({ message: '' }, 400);
      const { body } = factory.create(exception, mockRequest);
      expect(body.detail).toBeUndefined();
    });
  });
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx jest test/unit/problem-details.factory.spec.ts`
Expected: All 13 tests PASS.

- [ ] **Step 9: Write tests for typeBaseUri and slug generation**

```typescript
  describe('typeBaseUri', () => {
    it('generates type URI with slug when typeBaseUri is configured', () => {
      const factory = createFactory({ typeBaseUri: 'https://api.example.com/problems' });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.type).toBe('https://api.example.com/problems/not-found');
    });

    it('strips trailing slash from typeBaseUri', () => {
      const factory = createFactory({ typeBaseUri: 'https://api.example.com/problems/' });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.type).toBe('https://api.example.com/problems/not-found');
    });

    it('passes through user-supplied absolute URI from mapper', () => {
      const factory = createFactory({
        typeBaseUri: 'https://api.example.com/problems',
        exceptionMapper: () => ({
          type: 'https://custom.example.com/my-type',
          status: 400,
        }),
      });
      const { body } = factory.create(new BadRequestException(), mockRequest);
      expect(body.type).toBe('https://custom.example.com/my-type');
    });

    it('passes through about:blank from mapper', () => {
      const factory = createFactory({
        typeBaseUri: 'https://api.example.com/problems',
        exceptionMapper: () => ({
          type: 'about:blank',
          status: 400,
        }),
      });
      const { body } = factory.create(new BadRequestException(), mockRequest);
      expect(body.type).toBe('about:blank');
    });

    it('expands bare slug with typeBaseUri', () => {
      const factory = createFactory({
        typeBaseUri: 'https://api.example.com/problems',
        exceptionMapper: () => ({
          type: 'custom-problem',
          status: 400,
        }),
      });
      const { body } = factory.create(new BadRequestException(), mockRequest);
      expect(body.type).toBe('https://api.example.com/problems/custom-problem');
    });

    it('generates internal-server-error slug for 500', () => {
      const factory = createFactory({ typeBaseUri: 'https://api.example.com/problems' });
      const { body } = factory.create(new InternalServerErrorException(), mockRequest);
      expect(body.type).toBe('https://api.example.com/problems/internal-server-error');
    });
  });
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx jest test/unit/problem-details.factory.spec.ts`
Expected: All 19 tests PASS.

- [ ] **Step 11: Write tests for instanceStrategy**

```typescript
  describe('instanceStrategy', () => {
    it('omits instance by default (none)', () => {
      const factory = createFactory();
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.instance).toBeUndefined();
    });

    it('uses request URL path for request-uri strategy', () => {
      const factory = createFactory({ instanceStrategy: 'request-uri' });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.instance).toBe('/api/users/42');
    });

    it('generates urn:uuid for uuid strategy', () => {
      const factory = createFactory({ instanceStrategy: 'uuid' });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.instance).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('calls custom function with request and exception', () => {
      const customFn = jest.fn().mockReturnValue('custom-instance-id');
      const factory = createFactory({ instanceStrategy: customFn });
      const exception = new NotFoundException();
      const { body } = factory.create(exception, mockRequest);
      expect(body.instance).toBe('custom-instance-id');
      expect(customFn).toHaveBeenCalledWith(mockRequest, exception);
    });

    it('omits instance when custom function returns undefined', () => {
      const factory = createFactory({ instanceStrategy: () => undefined });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.instance).toBeUndefined();
    });
  });
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `npx jest test/unit/problem-details.factory.spec.ts`
Expected: All 24 tests PASS.

- [ ] **Step 13: Write tests for exceptionMapper**

```typescript
  describe('exceptionMapper', () => {
    it('uses mapper result when it returns a ProblemDetail', () => {
      const factory = createFactory({
        exceptionMapper: (exception) => ({
          type: 'https://example.com/custom',
          title: 'Custom Problem',
          status: 422,
          detail: 'Mapper handled this',
        }),
      });
      const { status, body } = factory.create(new BadRequestException(), mockRequest);
      expect(status).toBe(422);
      expect(body.type).toBe('https://example.com/custom');
      expect(body.title).toBe('Custom Problem');
      expect(body.detail).toBe('Mapper handled this');
    });

    it('falls through to next step when mapper returns null', () => {
      const factory = createFactory({
        exceptionMapper: () => null,
      });
      const { status, body } = factory.create(new NotFoundException('test'), mockRequest);
      expect(status).toBe(404);
      expect(body.title).toBe('Not Found');
    });

    it('handles partial mapper output without status — infers from exception', () => {
      const factory = createFactory({
        exceptionMapper: () => ({
          title: 'Partial Response',
          detail: 'No status provided',
        }),
      });
      const { status, body } = factory.create(new ForbiddenException(), mockRequest);
      expect(status).toBe(403);
      expect(body.status).toBe(403);
      expect(body.title).toBe('Partial Response');
    });

    it('handles mapper with extension members', () => {
      const factory = createFactory({
        exceptionMapper: () => ({
          status: 409,
          title: 'Conflict',
          retryAfter: 30,
          conflictingResource: '/api/items/5',
        }),
      });
      const { body } = factory.create(new HttpException('conflict', 409), mockRequest);
      expect(body.retryAfter).toBe(30);
      expect(body.conflictingResource).toBe('/api/items/5');
    });
  });
```

- [ ] **Step 14: Run tests to verify they pass**

Run: `npx jest test/unit/problem-details.factory.spec.ts`
Expected: All 28 tests PASS.

- [ ] **Step 15: Write tests for @ProblemType decorator resolution**

```typescript
  describe('@ProblemType decorator resolution', () => {
    it('uses decorator metadata as template and fills detail from exception', () => {
      const { ProblemType } = require('../../src/problem-type.decorator');

      @ProblemType({
        type: 'https://example.com/insufficient-funds',
        title: 'Insufficient Funds',
        status: 422,
      })
      class InsufficientFundsException extends HttpException {
        constructor() {
          super('Balance too low', 422);
        }
      }

      const factory = createFactory();
      const { status, body } = factory.create(new InsufficientFundsException(), mockRequest);
      expect(status).toBe(422);
      expect(body.type).toBe('https://example.com/insufficient-funds');
      expect(body.title).toBe('Insufficient Funds');
      expect(body.detail).toBe('Balance too low');
    });

    it('inherits parent metadata when child is undecorated', () => {
      const { ProblemType } = require('../../src/problem-type.decorator');

      @ProblemType({ type: 'https://example.com/base-error', status: 400 })
      class BaseException extends HttpException {
        constructor(msg: string) {
          super(msg, 400);
        }
      }

      class SpecificException extends BaseException {
        constructor() {
          super('Specific error occurred');
        }
      }

      const factory = createFactory();
      const { body } = factory.create(new SpecificException(), mockRequest);
      expect(body.type).toBe('https://example.com/base-error');
      expect(body.detail).toBe('Specific error occurred');
    });

    it('child decorator fully overrides parent', () => {
      const { ProblemType } = require('../../src/problem-type.decorator');

      @ProblemType({ type: 'https://example.com/parent', title: 'Parent', status: 400 })
      class ParentException extends HttpException {
        constructor() {
          super('parent', 400);
        }
      }

      @ProblemType({ type: 'https://example.com/child', status: 422 })
      class ChildException extends ParentException {
        constructor() {
          super();
        }
      }

      const factory = createFactory();
      const { status, body } = factory.create(new ChildException(), mockRequest);
      expect(status).toBe(422);
      expect(body.type).toBe('https://example.com/child');
      expect(body.title).not.toBe('Parent');
    });

    it('decorated template with missing status infers from HttpException', () => {
      const { ProblemType } = require('../../src/problem-type.decorator');

      @ProblemType({ type: 'https://example.com/no-status', title: 'No Status' })
      class NoStatusException extends HttpException {
        constructor() {
          super('no status', 418);
        }
      }

      const factory = createFactory();
      const { status } = factory.create(new NoStatusException(), mockRequest);
      expect(status).toBe(418);
    });
  });
```

- [ ] **Step 16: Run tests to verify they pass**

Run: `npx jest test/unit/problem-details.factory.spec.ts`
Expected: All 32 tests PASS.

- [ ] **Step 17: Write tests for validation handling**

```typescript
  describe('validation handling', () => {
    it('maps Tier 1 validation (flattened string array) to problem details', () => {
      const factory = createFactory();
      const exception = new BadRequestException({
        message: ['email must be an email', 'age must not be less than 0'],
        error: 'Bad Request',
      });
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(400);
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Bad Request');
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toEqual(['email must be an email', 'age must not be less than 0']);
    });

    it('maps Tier 2 validation (Rfc9457ValidationException) to structured output', () => {
      const { ValidationError } = require('class-validator');
      const factory = createFactory();
      const errors = [
        Object.assign(new ValidationError(), {
          property: 'email',
          constraints: { isEmail: 'email must be an email' },
        }),
        Object.assign(new ValidationError(), {
          property: 'age',
          constraints: { min: 'age must not be less than 0' },
        }),
      ];
      const exception = new Rfc9457ValidationException(errors);
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(400);
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toEqual([
        { property: 'email', constraints: { isEmail: 'email must be an email' } },
        { property: 'age', constraints: { min: 'age must not be less than 0' } },
      ]);
    });

    it('preserves nested children arrays in Tier 2 (not flattened to dotted paths)', () => {
      const { ValidationError } = require('class-validator');
      const factory = createFactory();
      const childError = Object.assign(new ValidationError(), {
        property: 'zip',
        constraints: { isPostalCode: 'zip must be a postal code' },
        children: [],
      });
      const parentError = Object.assign(new ValidationError(), {
        property: 'address',
        children: [childError],
      });
      const exception = new Rfc9457ValidationException([parentError]);
      const { body } = factory.create(exception, mockRequest);
      // Nested errors use children arrays, preserving the class-validator tree structure.
      // This is intentional: we do NOT flatten to dotted paths like "address.zip".
      expect(body.errors).toEqual([
        {
          property: 'address',
          children: [
            { property: 'zip', constraints: { isPostalCode: 'zip must be a postal code' } },
          ],
        },
      ]);
    });

    it('uses custom validationExceptionMapper for Tier 1', () => {
      const factory = createFactory({
        validationExceptionMapper: (messages) => ({
          status: 400,
          title: 'Validation Failed',
          detail: messages.join('; '),
        }),
      });
      const exception = new BadRequestException({
        message: ['field1 error', 'field2 error'],
        error: 'Bad Request',
      });
      const { body } = factory.create(exception, mockRequest);
      expect(body.title).toBe('Validation Failed');
      expect(body.detail).toBe('field1 error; field2 error');
      expect(body.errors).toBeUndefined();
    });

    it('exceptionMapper overrides Tier 2 validation', () => {
      const factory = createFactory({
        exceptionMapper: (exception) => {
          if (exception instanceof Rfc9457ValidationException) {
            return { status: 400, title: 'Mapper Wins', detail: 'Overridden' };
          }
          return null;
        },
      });
      const exception = new Rfc9457ValidationException([]);
      const { body } = factory.create(exception, mockRequest);
      expect(body.title).toBe('Mapper Wins');
    });
  });
```

Add import at top of test file:

```typescript
import { Rfc9457ValidationException } from '../../src/validation/rfc9457-validation.exception';
```

- [ ] **Step 18: Run tests to verify they pass**

Run: `npx jest test/unit/problem-details.factory.spec.ts`
Expected: All 37 tests PASS.

- [ ] **Step 19: Write tests for unknown exception fallback and non-leakage**

```typescript
  describe('unknown exception fallback', () => {
    it('produces generic 500 for non-HttpException (catch-all mode)', () => {
      const factory = createFactory({ catchAllExceptions: true });
      const { status, body } = factory.create(new TypeError('Oops'), mockRequest);
      expect(status).toBe(500);
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Internal Server Error');
      expect(body.detail).toBeUndefined();
      expect(body.instance).toBeUndefined();
    });

    it('does not leak stack trace or error message in catch-all fallback', () => {
      const factory = createFactory({ catchAllExceptions: true });
      const error = new Error('secret database password exposed');
      const { body } = factory.create(error, mockRequest);
      expect(JSON.stringify(body)).not.toContain('secret');
      expect(JSON.stringify(body)).not.toContain('password');
      expect(body.detail).toBeUndefined();
    });

    it('handles arbitrary object thrown', () => {
      const factory = createFactory({ catchAllExceptions: true });
      const { status, body } = factory.create({ weird: 'object' }, mockRequest);
      expect(status).toBe(500);
      expect(body.title).toBe('Internal Server Error');
      expect(body.detail).toBeUndefined();
    });

    it('handles string thrown', () => {
      const factory = createFactory({ catchAllExceptions: true });
      const { status, body } = factory.create('string error', mockRequest);
      expect(status).toBe(500);
      expect(body.title).toBe('Internal Server Error');
      expect(body.detail).toBeUndefined();
    });

    it('handles null thrown', () => {
      const factory = createFactory({ catchAllExceptions: true });
      const { status, body } = factory.create(null, mockRequest);
      expect(status).toBe(500);
      expect(body.title).toBe('Internal Server Error');
    });

    it('uses typeBaseUri slug for unknown exception in catch-all', () => {
      const factory = createFactory({
        catchAllExceptions: true,
        typeBaseUri: 'https://api.example.com/problems',
      });
      const { body } = factory.create(new Error('fail'), mockRequest);
      expect(body.type).toBe('https://api.example.com/problems/internal-server-error');
    });
  });
```

- [ ] **Step 20: Run tests to verify they pass**

Run: `npx jest test/unit/problem-details.factory.spec.ts`
Expected: All 43 tests PASS.

- [ ] **Step 21: Write tests for precedence verification**

```typescript
  describe('precedence order', () => {
    it('exceptionMapper wins over @ProblemType decorator', () => {
      const { ProblemType } = require('../../src/problem-type.decorator');

      @ProblemType({ type: 'https://example.com/decorated', status: 400 })
      class DecoratedException extends HttpException {
        constructor() {
          super('decorated', 400);
        }
      }

      const factory = createFactory({
        exceptionMapper: () => ({
          type: 'https://example.com/mapper-wins',
          status: 409,
          title: 'Mapper Priority',
        }),
      });
      const { status, body } = factory.create(new DecoratedException(), mockRequest);
      expect(status).toBe(409);
      expect(body.type).toBe('https://example.com/mapper-wins');
    });

    it('@ProblemType decorator wins over default HttpException mapping', () => {
      const { ProblemType } = require('../../src/problem-type.decorator');

      @ProblemType({ type: 'https://example.com/custom-404', title: 'Custom Not Found' })
      class CustomNotFoundException extends HttpException {
        constructor() {
          super('custom', 404);
        }
      }

      const factory = createFactory();
      const { body } = factory.create(new CustomNotFoundException(), mockRequest);
      expect(body.type).toBe('https://example.com/custom-404');
      expect(body.title).toBe('Custom Not Found');
    });

    it('@ProblemType decorator wins over validation handling', () => {
      const { ProblemType } = require('../../src/problem-type.decorator');

      @ProblemType({ type: 'https://example.com/custom-validation', status: 400 })
      class CustomValidationException extends BadRequestException {
        constructor() {
          super({ message: ['error1', 'error2'], error: 'Bad Request' });
        }
      }

      const factory = createFactory();
      const { body } = factory.create(new CustomValidationException(), mockRequest);
      expect(body.type).toBe('https://example.com/custom-validation');
      expect(body.errors).toBeUndefined();
    });
  });
```

- [ ] **Step 22: Run tests to verify they pass**

Run: `npx jest test/unit/problem-details.factory.spec.ts`
Expected: All 46 tests PASS.

- [ ] **Step 23: Commit**

```bash
git add src/problem-details.factory.ts test/unit/problem-details.factory.spec.ts
git commit -m "feat: add ProblemDetailsFactory with full resolution pipeline"
```

---

### Task 9: Rfc9457ExceptionFilter

**Files:**
- Create: `test/unit/rfc9457.exception-filter.spec.ts`
- Create: `src/rfc9457.exception-filter.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { ArgumentsHost, HttpException, NotFoundException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Rfc9457ExceptionFilter } from '../../src/rfc9457.exception-filter';
import { ProblemDetailsFactory } from '../../src/problem-details.factory';
import { Rfc9457ModuleOptions } from '../../src/rfc9457.interfaces';

function createMocks(options: Rfc9457ModuleOptions = {}) {
  const mockResponse = {};
  const mockRequest = { url: '/test', method: 'GET' };

  const mockHttpAdapter = {
    setHeader: jest.fn(),
    reply: jest.fn(),
  };

  const adapterHost = { httpAdapter: mockHttpAdapter } as unknown as HttpAdapterHost;
  const factory = new ProblemDetailsFactory(options);
  const filter = new Rfc9457ExceptionFilter(factory, options, adapterHost);

  const mockHost = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
  } as unknown as ArgumentsHost;

  return { filter, mockHost, mockHttpAdapter, mockResponse, mockRequest };
}

describe('Rfc9457ExceptionFilter', () => {
  it('writes problem details response for HttpException', () => {
    const { filter, mockHost, mockHttpAdapter, mockResponse } = createMocks();
    filter.catch(new NotFoundException('Not here'), mockHost);
    expect(mockHttpAdapter.setHeader).toHaveBeenCalledWith(
      mockResponse,
      'Content-Type',
      'application/problem+json',
    );
    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Not here',
      }),
      404,
    );
  });

  it('delegates to super.catch() for non-HttpException when catchAllExceptions is false', () => {
    const { filter, mockHost, mockHttpAdapter } = createMocks({ catchAllExceptions: false });
    // BaseExceptionFilter.catch will throw because there is no real HTTP adapter,
    // but we can verify that our filter does NOT call reply.
    try {
      filter.catch(new TypeError('unexpected'), mockHost);
    } catch {
      // Expected: BaseExceptionFilter.catch fails in test environment
    }
    expect(mockHttpAdapter.reply).not.toHaveBeenCalled();
  });

  it('handles non-HttpException when catchAllExceptions is true', () => {
    const { filter, mockHost, mockHttpAdapter, mockResponse } = createMocks({
      catchAllExceptions: true,
    });
    filter.catch(new TypeError('unexpected'), mockHost);
    expect(mockHttpAdapter.setHeader).toHaveBeenCalledWith(
      mockResponse,
      'Content-Type',
      'application/problem+json',
    );
    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
      }),
      500,
    );
  });

  it('response body does not contain stack trace for catch-all exceptions', () => {
    const { filter, mockHost, mockHttpAdapter } = createMocks({ catchAllExceptions: true });
    filter.catch(new Error('secret info'), mockHost);
    const responseBody = mockHttpAdapter.reply.mock.calls[0][1];
    expect(JSON.stringify(responseBody)).not.toContain('secret');
    expect(responseBody.detail).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest test/unit/rfc9457.exception-filter.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
import { ArgumentsHost, Catch, HttpException, Inject } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { ProblemDetailsFactory } from './problem-details.factory';
import { RFC9457_MODULE_OPTIONS, PROBLEM_CONTENT_TYPE } from './rfc9457.constants';
import { Rfc9457ModuleOptions } from './rfc9457.interfaces';

@Catch()
export class Rfc9457ExceptionFilter extends BaseExceptionFilter {
  constructor(
    private readonly factory: ProblemDetailsFactory,
    @Inject(RFC9457_MODULE_OPTIONS) private readonly options: Rfc9457ModuleOptions,
    adapterHost: HttpAdapterHost,
  ) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof HttpException) && !this.options.catchAllExceptions) {
      super.catch(exception, host);
      return;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    const { status, body } = this.factory.create(exception, request);
    const httpAdapter = (this as any).httpAdapterHost?.httpAdapter || (this as any).applicationRef;
    httpAdapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
    httpAdapter.reply(response, body, status);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest test/unit/rfc9457.exception-filter.spec.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rfc9457.exception-filter.ts test/unit/rfc9457.exception-filter.spec.ts
git commit -m "feat: add Rfc9457ExceptionFilter extending BaseExceptionFilter"
```

---

### Task 10: Rfc9457Module

**Files:**
- Create: `test/unit/rfc9457.module.spec.ts`
- Create: `src/rfc9457.module.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { Test } from '@nestjs/testing';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { Rfc9457Module } from '../../src/rfc9457.module';
import { ProblemDetailsFactory } from '../../src/problem-details.factory';
import { RFC9457_MODULE_OPTIONS } from '../../src/rfc9457.constants';
import { Rfc9457ModuleOptions, Rfc9457OptionsFactory } from '../../src/rfc9457.interfaces';
import { Rfc9457ExceptionFilter } from '../../src/rfc9457.exception-filter';
import { Injectable } from '@nestjs/common';

const mockAdapterHost = {
  httpAdapter: {
    setHeader: jest.fn(),
    reply: jest.fn(),
  },
};

describe('Rfc9457Module', () => {
  describe('forRoot()', () => {
    it('registers ProblemDetailsFactory as a provider', async () => {
      const module = await Test.createTestingModule({
        imports: [Rfc9457Module.forRoot()],
      })
        .overrideProvider(HttpAdapterHost)
        .useValue(mockAdapterHost)
        .compile();

      const factory = module.get(ProblemDetailsFactory);
      expect(factory).toBeInstanceOf(ProblemDetailsFactory);
    });

    it('registers module options with defaults', async () => {
      const module = await Test.createTestingModule({
        imports: [Rfc9457Module.forRoot()],
      })
        .overrideProvider(HttpAdapterHost)
        .useValue(mockAdapterHost)
        .compile();

      const options = module.get(RFC9457_MODULE_OPTIONS);
      expect(options).toEqual({});
    });

    it('passes custom options through', async () => {
      const module = await Test.createTestingModule({
        imports: [
          Rfc9457Module.forRoot({
            typeBaseUri: 'https://example.com/problems',
            catchAllExceptions: true,
          }),
        ],
      })
        .overrideProvider(HttpAdapterHost)
        .useValue(mockAdapterHost)
        .compile();

      const options: Rfc9457ModuleOptions = module.get(RFC9457_MODULE_OPTIONS);
      expect(options.typeBaseUri).toBe('https://example.com/problems');
      expect(options.catchAllExceptions).toBe(true);
    });
  });

  describe('forRootAsync()', () => {
    it('supports useFactory', async () => {
      const module = await Test.createTestingModule({
        imports: [
          Rfc9457Module.forRootAsync({
            useFactory: () => ({
              typeBaseUri: 'https://example.com/async',
            }),
          }),
        ],
      })
        .overrideProvider(HttpAdapterHost)
        .useValue(mockAdapterHost)
        .compile();

      const options: Rfc9457ModuleOptions = module.get(RFC9457_MODULE_OPTIONS);
      expect(options.typeBaseUri).toBe('https://example.com/async');
    });

    it('supports useClass', async () => {
      @Injectable()
      class TestOptionsFactory implements Rfc9457OptionsFactory {
        createRfc9457Options(): Rfc9457ModuleOptions {
          return { instanceStrategy: 'uuid' };
        }
      }

      const module = await Test.createTestingModule({
        imports: [
          Rfc9457Module.forRootAsync({
            useClass: TestOptionsFactory,
          }),
        ],
      })
        .overrideProvider(HttpAdapterHost)
        .useValue(mockAdapterHost)
        .compile();

      const options: Rfc9457ModuleOptions = module.get(RFC9457_MODULE_OPTIONS);
      expect(options.instanceStrategy).toBe('uuid');
    });

    it('supports useExisting', async () => {
      @Injectable()
      class ExistingOptionsFactory implements Rfc9457OptionsFactory {
        createRfc9457Options(): Rfc9457ModuleOptions {
          return { catchAllExceptions: true };
        }
      }

      const module = await Test.createTestingModule({
        imports: [
          Rfc9457Module.forRootAsync({
            useExisting: ExistingOptionsFactory,
          }),
        ],
        providers: [ExistingOptionsFactory],
      })
        .overrideProvider(HttpAdapterHost)
        .useValue(mockAdapterHost)
        .compile();

      const options: Rfc9457ModuleOptions = module.get(RFC9457_MODULE_OPTIONS);
      expect(options.catchAllExceptions).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest test/unit/rfc9457.module.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ProblemDetailsFactory } from './problem-details.factory';
import { Rfc9457ExceptionFilter } from './rfc9457.exception-filter';
import { RFC9457_MODULE_OPTIONS } from './rfc9457.constants';
import {
  Rfc9457AsyncModuleOptions,
  Rfc9457ModuleOptions,
  Rfc9457OptionsFactory,
} from './rfc9457.interfaces';

@Module({})
export class Rfc9457Module {
  static forRoot(options: Rfc9457ModuleOptions = {}): DynamicModule {
    return {
      module: Rfc9457Module,
      global: true,
      providers: [
        {
          provide: RFC9457_MODULE_OPTIONS,
          useValue: options,
        },
        ProblemDetailsFactory,
        Rfc9457ExceptionFilter,
        {
          provide: APP_FILTER,
          useExisting: Rfc9457ExceptionFilter,
        },
      ],
      exports: [ProblemDetailsFactory, RFC9457_MODULE_OPTIONS],
    };
  }

  static forRootAsync(options: Rfc9457AsyncModuleOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);
    return {
      module: Rfc9457Module,
      global: true,
      imports: options.imports || [],
      providers: [
        ...asyncProviders,
        ProblemDetailsFactory,
        Rfc9457ExceptionFilter,
        {
          provide: APP_FILTER,
          useExisting: Rfc9457ExceptionFilter,
        },
      ],
      exports: [ProblemDetailsFactory, RFC9457_MODULE_OPTIONS],
    };
  }

  private static createAsyncProviders(options: Rfc9457AsyncModuleOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: RFC9457_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }
    if (options.useClass) {
      return [
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: RFC9457_MODULE_OPTIONS,
          useFactory: (factory: Rfc9457OptionsFactory) => factory.createRfc9457Options(),
          inject: [options.useClass],
        },
      ];
    }
    if (options.useExisting) {
      return [
        {
          provide: RFC9457_MODULE_OPTIONS,
          useFactory: (factory: Rfc9457OptionsFactory) => factory.createRfc9457Options(),
          inject: [options.useExisting],
        },
      ];
    }
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest test/unit/rfc9457.module.spec.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rfc9457.module.ts test/unit/rfc9457.module.spec.ts
git commit -m "feat: add Rfc9457Module with forRoot and forRootAsync"
```

---

### Task 11: Barrel export and build verification

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Write the barrel export**

```typescript
export { Rfc9457Module } from './rfc9457.module';
export { ProblemDetailsFactory } from './problem-details.factory';
export { Rfc9457ExceptionFilter } from './rfc9457.exception-filter';
export { ProblemType } from './problem-type.decorator';
export {
  ProblemDetail,
  ProblemTypeMetadata,
  Rfc9457ModuleOptions,
  Rfc9457OptionsFactory,
  Rfc9457AsyncModuleOptions,
  InstanceStrategy,
  Rfc9457Request,
} from './rfc9457.interfaces';
export { RFC9457_MODULE_OPTIONS, PROBLEM_CONTENT_TYPE } from './rfc9457.constants';
export { Rfc9457ValidationException } from './validation/rfc9457-validation.exception';
export { createRfc9457ValidationPipeExceptionFactory } from './validation/rfc9457-validation-pipe-exception.factory';
```

- [ ] **Step 2: Verify build compiles cleanly**

Run: `npm run build`
Expected: `dist/` contains compiled JS and `.d.ts` files. No errors.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 4: Verify all unit tests pass**

Run: `npm run test:unit`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: configure public API barrel export"
```

---

### Task 12: E2E tests

**Files:**
- Create: `test/e2e/test-app/app.module.ts`
- Create: `test/e2e/test-app/app.controller.ts`
- Create: `test/e2e/test-app/test.exceptions.ts`
- Create: `test/e2e/test-app/test.dto.ts`
- Create: `test/e2e/express.e2e-spec.ts`
- Create: `test/e2e/fastify.e2e-spec.ts`

- [ ] **Step 1: Create test app exceptions**

`test/e2e/test-app/test.exceptions.ts`:

```typescript
import { HttpException } from '@nestjs/common';
import { ProblemType } from '../../../src/problem-type.decorator';

@ProblemType({
  type: 'https://example.com/problems/insufficient-funds',
  title: 'Insufficient Funds',
  status: 422,
})
export class InsufficientFundsException extends HttpException {
  constructor(balance: number, required: number) {
    super(`Balance ${balance} is less than required ${required}`, 422);
  }
}
```

- [ ] **Step 2: Create test DTO**

`test/e2e/test-app/test.dto.ts`:

```typescript
import { IsEmail, IsInt, Min } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsInt()
  @Min(0)
  age!: number;
}
```

- [ ] **Step 3: Create test app controller**

`test/e2e/test-app/app.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { InsufficientFundsException } from './test.exceptions';
import { CreateUserDto } from './test.dto';
import { createRfc9457ValidationPipeExceptionFactory } from '../../../src/validation/rfc9457-validation-pipe-exception.factory';

@Controller('test')
export class AppController {
  @Get('not-found')
  notFound(): never {
    throw new NotFoundException('Resource not found');
  }

  @Get('custom-exception')
  customException(): never {
    throw new InsufficientFundsException(50, 100);
  }

  @Post('validate-default')
  @UsePipes(new ValidationPipe())
  validateDefault(@Body() _dto: CreateUserDto): string {
    return 'ok';
  }

  @Post('validate-enhanced')
  @UsePipes(
    new ValidationPipe({
      exceptionFactory: createRfc9457ValidationPipeExceptionFactory(),
    }),
  )
  validateEnhanced(@Body() _dto: CreateUserDto): string {
    return 'ok';
  }

  @Get('unhandled')
  unhandled(): never {
    throw new Error('Unexpected internal error');
  }
}
```

- [ ] **Step 4: Create test app module**

`test/e2e/test-app/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { Rfc9457Module } from '../../../src/rfc9457.module';
import { AppController } from './app.controller';

@Module({
  imports: [Rfc9457Module.forRoot()],
  controllers: [AppController],
})
export class DefaultAppModule {}

@Module({
  imports: [
    Rfc9457Module.forRoot({
      instanceStrategy: 'request-uri',
      typeBaseUri: 'https://api.example.com/problems',
    }),
  ],
  controllers: [AppController],
})
export class ConfiguredAppModule {}

@Module({
  imports: [
    Rfc9457Module.forRoot({
      catchAllExceptions: true,
    }),
  ],
  controllers: [AppController],
})
export class CatchAllAppModule {}

@Module({
  imports: [
    Rfc9457Module.forRoot({
      exceptionMapper: (exception) => {
        if (exception instanceof Error && exception.message.includes('Insufficient')) {
          return {
            type: 'https://api.example.com/problems/mapper-override',
            status: 422,
            title: 'Mapper Override',
            detail: exception.message,
          };
        }
        return null;
      },
    }),
  ],
  controllers: [AppController],
})
export class MapperAppModule {}
```

- [ ] **Step 5: Write Express E2E tests**

`test/e2e/express.e2e-spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import {
  DefaultAppModule,
  ConfiguredAppModule,
  CatchAllAppModule,
  MapperAppModule,
} from './test-app/app.module';

describe('Express E2E', () => {
  describe('default configuration', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [DefaultAppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns problem details for NotFoundException', async () => {
      const { body, headers } = await request(app.getHttpServer())
        .get('/test/not-found')
        .expect(404);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body).toEqual({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Resource not found',
      });
    });

    it('returns problem details for @ProblemType decorated exception', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/test/custom-exception')
        .expect(422);

      expect(body).toEqual({
        type: 'https://example.com/problems/insufficient-funds',
        title: 'Insufficient Funds',
        status: 422,
        detail: 'Balance 50 is less than required 100',
      });
    });

    it('returns Tier 1 validation errors (flat string array)', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/test/validate-default')
        .send({ email: 'not-an-email', age: -5 })
        .expect(400);

      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Bad Request');
      expect(body.status).toBe(400);
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toBeInstanceOf(Array);
      expect(body.errors.length).toBeGreaterThan(0);
      expect(body.errors.every((e: unknown) => typeof e === 'string')).toBe(true);
    });

    it('returns Tier 2 validation errors (structured)', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/test/validate-enhanced')
        .send({ email: 'not-an-email', age: -5 })
        .expect(400);

      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Bad Request');
      expect(body.status).toBe(400);
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toBeInstanceOf(Array);
      expect(body.errors[0]).toHaveProperty('property');
      expect(body.errors[0]).toHaveProperty('constraints');
    });

    it('does not catch unhandled exceptions by default', async () => {
      // Default NestJS error handler returns its own format
      const { body } = await request(app.getHttpServer())
        .get('/test/unhandled')
        .expect(500);

      // Should NOT be problem+json format — it fell through to Nest's default
      expect(body.type).toBeUndefined();
    });
  });

  describe('configured with instanceStrategy and typeBaseUri', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ConfiguredAppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('includes instance from request-uri strategy', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/test/not-found')
        .expect(404);

      expect(body.instance).toBe('/test/not-found');
    });

    it('generates type URI with typeBaseUri', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/test/not-found')
        .expect(404);

      expect(body.type).toBe('https://api.example.com/problems/not-found');
    });
  });

  describe('configured with catchAllExceptions', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [CatchAllAppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('catches unhandled exceptions as 500 problem details', async () => {
      const { body, headers } = await request(app.getHttpServer())
        .get('/test/unhandled')
        .expect(500);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body).toEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
      });
      expect(body.detail).toBeUndefined();
    });
  });

  describe('configured with exceptionMapper', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MapperAppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('exceptionMapper overrides decorated exception', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/test/custom-exception')
        .expect(422);

      expect(body.type).toBe('https://api.example.com/problems/mapper-override');
      expect(body.title).toBe('Mapper Override');
    });

    it('falls through to default handling when mapper returns null', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/test/not-found')
        .expect(404);

      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Not Found');
    });
  });
});
```

- [ ] **Step 6: Write Fastify E2E tests**

`test/e2e/fastify.e2e-spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { DefaultAppModule, ConfiguredAppModule, CatchAllAppModule } from './test-app/app.module';

describe('Fastify E2E', () => {
  describe('default configuration', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [DefaultAppModule],
      }).compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns problem details for NotFoundException', async () => {
      const { body, headers } = await request(app.getHttpServer())
        .get('/test/not-found')
        .expect(404);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body).toEqual({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Resource not found',
      });
    });

    it('returns problem details for @ProblemType decorated exception', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/test/custom-exception')
        .expect(422);

      expect(body.type).toBe('https://example.com/problems/insufficient-funds');
      expect(body.title).toBe('Insufficient Funds');
      expect(body.status).toBe(422);
    });

    it('returns Tier 1 validation errors', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/test/validate-default')
        .send({ email: 'bad', age: -1 })
        .expect(400);

      expect(body.type).toBe('about:blank');
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toBeInstanceOf(Array);
    });

    it('returns Tier 2 validation errors', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/test/validate-enhanced')
        .send({ email: 'bad', age: -1 })
        .expect(400);

      expect(body.errors[0]).toHaveProperty('property');
      expect(body.errors[0]).toHaveProperty('constraints');
    });
  });

  describe('configured with instanceStrategy and typeBaseUri', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ConfiguredAppModule],
      }).compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('request-uri instance strategy works with Fastify', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/test/not-found')
        .expect(404);

      expect(body.instance).toBe('/test/not-found');
    });
  });

  describe('configured with catchAllExceptions', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [CatchAllAppModule],
      }).compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('catches unhandled exceptions as 500 problem details on Fastify', async () => {
      const { body, headers } = await request(app.getHttpServer())
        .get('/test/unhandled')
        .expect(500);

      expect(headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Internal Server Error');
      expect(body.status).toBe(500);
      expect(body.detail).toBeUndefined();
    });
  });
});
```

- [ ] **Step 7: Run all E2E tests**

Run: `npm run test:e2e`
Expected: All E2E tests PASS on both Express and Fastify.

- [ ] **Step 8: Run full test suite**

Run: `npm test`
Expected: All unit + E2E tests PASS.

- [ ] **Step 9: Commit**

```bash
git add test/e2e/
git commit -m "test: add E2E tests for Express and Fastify adapters"
```

---

### Task 13: README documentation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

The README must follow this structure (from the spec). Write the full content:

1. **Header** — `@camcima/nestjs-rfc9457` with badges:
   - npm version: `https://img.shields.io/npm/v/@camcima/nestjs-rfc9457`
   - CI status: `https://github.com/camcima/nestjs-rfc9457/actions/workflows/ci.yml/badge.svg`
   - License: `https://img.shields.io/npm/l/@camcima/nestjs-rfc9457`
   - Downloads: `https://img.shields.io/npm/dm/@camcima/nestjs-rfc9457`

2. **What is RFC 9457?** — Brief explanation with link to RFC, example JSON response.

3. **Features** — Bullet list:
   - Automatic `application/problem+json` responses for all HTTP exceptions
   - RFC 9457 compliant (`type`, `title`, `status`, `detail`, `instance`)
   - Zero-config defaults with `about:blank` type
   - Configurable `typeBaseUri` for custom problem type URIs
   - Configurable `instanceStrategy` (request path, UUID, custom callback)
   - `@ProblemType()` decorator for custom exception classes
   - Built-in validation error mapping (Tier 1: automatic, Tier 2: structured)
   - Custom `exceptionMapper` callback for full control
   - Optional catch-all for non-HTTP exceptions
   - Works with both Express and Fastify adapters
   - `ProblemDetailsFactory` exported for reuse in GraphQL/microservices
   - `forRoot()` and `forRootAsync()` dynamic module configuration
   - Zero runtime dependencies

4. **Installation** — npm/yarn/pnpm commands, peer dependency notes.

5. **Quick Start** — Explicitly state the module is **global** (imported once in `AppModule`, applies everywhere). Show before/after example:
   - Before: `{ "statusCode": 404, "message": "Not Found" }`
   - After: `{ "type": "about:blank", "title": "Not Found", "status": 404, "detail": "..." }`

6. **Configuration** — `Rfc9457ModuleOptions` reference with all options documented.

7. **Async Configuration** — `forRootAsync()` with `ConfigService` example.

8. **Custom Exception Types** — `@ProblemType()` examples, inheritance behavior.

9. **Validation Integration** — Tier 1 (automatic) and Tier 2 (enhanced) with examples.

10. **Advanced Usage** — `ProblemDetailsFactory` direct usage.

11. **API Reference** — Table of exports.

12. **Example Responses** — 4 annotated JSON examples.

13. **Contributing** — Clone, install, test, PR.

14. **License** — MIT.

- [ ] **Step 2: Verify lint and format pass**

Run: `npm run lint && npm run format`
Expected: All pass.

- [ ] **Step 3: Run full test suite one final time**

Run: `npm run test:cov`
Expected: All tests pass with coverage output.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add comprehensive README with API reference and examples"
```
