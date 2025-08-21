# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Apollo Client Overview

Apollo Client is a comprehensive caching GraphQL client for TypeScript/JavaScript. The project is maintained at version 4.x.x and uses a monorepo structure with npm workspaces.

## Common Development Commands

### Build Commands

- `npm run build` - Build the entire project
- `npm run build -w codegen` - Build specific workspace (e.g., codegen)

### Testing Commands

- `npm test` - Run all tests with Jest
- `npm run test:type-benches` - Run type benchmarks
- `npm run test:memory` - Run memory tests

### Code Quality Commands

- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run ESLint with extended rules
- `npm run format` - Format code with Prettier
- `npm run check:format` - Check if code is formatted correctly
- `npm run knip` - Check for unused files/exports
- `npm run madge` - Check for circular dependencies

### Documentation & API

- `npm run extract-api` - Generate API documentation
- `npm run typedoc` - Generate TypeDoc documentation
- `npm run docmodel` - Generate API documentation model

### Release & Publishing

- `npx changeset` - Create a changeset for your changes

## High-Level Architecture

### Core Modules

1. **Core (`src/core/`)** - Main Apollo Client implementation

   - `ApolloClient.ts` - Main client class
   - `ObservableQuery.ts` - Observable query implementation
   - `QueryManager.ts` - Query lifecycle management

2. **Cache (`src/cache/`)** - Caching layer

   - `inmemory/` - InMemoryCache implementation (default cache)
   - `core/` - Base cache abstractions

3. **Link (`src/link/`)** - Network layer abstraction

   - `http/` - HTTP link for GraphQL over HTTP
   - `batch/` - Batch link for combining queries
   - `error/` - Error handling link
   - `schema/` - Schema link for local execution
   - `ws/` - WebSocket link for subscriptions

4. **React Integration (`src/react/`)** - React hooks and components

   - `hooks/` - React hooks (useQuery, useMutation, etc.)
   - `ssr/` - Server-side rendering support
   - `context/` - React context providers

5. **Utilities (`src/utilities/`)** - Shared utilities

   - `graphql/` - GraphQL document utilities
   - `internal/` - Internal utilities
   - `invariant/` - Error handling utilities

6. **Testing (`src/testing/`)** - Testing utilities

   - `core/` - Core testing utilities
   - `react/` - React testing utilities (MockedProvider)

7. **Masking (`src/masking/`)** - Data masking for fragment colocation

8. **Local State (`src/local-state/`)** - Local state management

### TypeScript Configuration

- Uses TypeScript 5.7.3 with strict mode enabled
- Module resolution: NodeNext
- Target: ESNext
- Separate tsconfig files for different purposes:
  - `tsconfig.json` - Main configuration
  - `tsconfig.build.json` - Build configuration
  - `tsconfig.tests.json` - Test configuration

### Testing Infrastructure

- Jest with ts-jest for testing
- Custom test environment extending jsdom
- React Testing Library for React component tests
- Multiple React version testing (17, 18, 19)
- Coverage reporting with lcov

### Build System

- Uses custom build script (`config/build.ts`)
- API Extractor for API documentation
- Size limit checking for bundle size
- Source map verification
- Publint for package publishing validation

### Code Organization Patterns

1. **Exports** - All public exports go through index files
2. **Internal APIs** - Use `@apollo/client/*/internal` paths
3. **Environment-specific builds** - Production/development variants
4. **Type safety** - Heavy use of TypeScript generics and type inference
5. **Reactive programming** - Uses RxJS for observables
6. **Immutability** - Emphasizes immutable data structures

### Contributing Guidelines

- All changes require a changeset (`npx changeset`)
- PRs should include tests for bug fixes
- Follow existing code style (enforced by ESLint/Prettier)
- Large features need design discussion first
- Code review required from core contributors

### Important Notes

- This is a monorepo with workspaces: main package, codegen, and codemods
- The project is currently at version 4.x.x (release candidate)
- Supports multiple peer dependencies (React 17/18/19, GraphQL 16)
- Uses patch-package for dependency patches
- Has extensive CI checks that must pass before merging

## Additional Instructions

@.claude/documentation.md
@.claude/hooks.md
