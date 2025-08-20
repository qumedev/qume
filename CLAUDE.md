# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Qume is a monorepo containing a custom functional reactive state management library with React bindings and an Ionic todo app demo. The monorepo uses Turbo for orchestration and Yarn workspaces for dependency management.

## Common Development Commands

```bash
# Root level (runs across all packages)
yarn dev          # Start development mode for all packages
yarn build        # Build all packages
yarn test         # Run tests for all packages
yarn lint         # Lint all packages

# Todo app (apps/todo)
cd apps/todo
yarn dev          # Start Ionic development server (ionic serve --nobrowser)
yarn build        # Build React app for production
yarn test         # Run React tests with Ionic transformations
yarn lint         # ESLint for TypeScript/React files

# Core library (packages/qume)
cd packages/qume
yarn dev          # Watch mode TypeScript compilation
yarn build        # Compile TypeScript to dist/
yarn test         # Run Jest tests
yarn test -- --testNamePattern="simple select"  # Run specific test
yarn test -- src/__tests__/index.test.ts        # Run specific test file

# React bindings (packages/qume-react)
cd packages/qume-react
yarn dev          # Watch mode with tsup
yarn build        # Build ESM/CJS bundles with TypeScript declarations
yarn test         # Run Jest tests in jsdom environment

# Publishing packages (configured for Verdaccio)
cd packages/qume
yarn publish      # Publish core library to Verdaccio
cd ../qume-react
yarn publish      # Publish React bindings to Verdaccio
```

## Architecture

### Monorepo Structure
- **apps/todo**: Ionic React todo application demonstrating qume usage
- **packages/qume**: Core functional reactive state management library
- **packages/qume-react**: React hooks and providers for qume integration
- **packages/test**: Shared ESLint configs and Jest presets
- **packages/tsconfig**: Shared TypeScript configurations

### Qume Library Architecture

**Event-Driven State Management**: The core library implements a functional reactive programming model where events flow through queries that transform, filter, and combine data streams.

**Key Components**:
- **QueryTail**: Core query execution engine processing event streams through ETF (Event Transform Functions)
- **MainStore**: Orchestrates multiple stores and handles event routing between StoreExecutors
- **Context**: Manages storage, event inlets/outlets, and async publishing with pluggable storage interface
- **Scope**: Type-safe API factory creating `query()`, `join()`, `action()`, and `store()` functions

**Type System**: Events must extend `HasType` interface. Advanced TypeScript generics maintain type safety throughout query composition.

### Integration Patterns

**React Integration**: The `qume-react` package provides `QumeProvider` and hooks for consuming qume stores in React components. The todo app demonstrates this pattern with the main store initialized via `runMain()`.

**Ionic App**: Uses Ionic React with React Router, integrating qume through the provider pattern. Demonstrates real-world usage of the state management system.

## Testing Strategy

Tests use type-safe event definitions with async execution patterns:
```typescript
const values = await QueryTail.runRecord(query, eventArray)
const value = await QueryTail.runValue(query, events, key)
```

The core library tests in `packages/qume/src/__tests__/` demonstrate query composition, store communication, and event flow patterns. React components use jsdom environment for testing.