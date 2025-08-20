# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Qume is a custom functional reactive state management library for TypeScript with event-driven architecture. It provides a type-safe query system for handling streams of events and managing state transformations through a declarative API.

## Common Development Commands

```bash
# Development
yarn build        # Compile TypeScript to dist/
yarn dev          # Watch mode compilation  
yarn test         # Run Jest tests
yarn lint         # ESLint code analysis
yarn clean        # Remove build artifacts and dependencies

# Testing specific files
yarn test -- --testNamePattern="simple select"   # Run specific test
yarn test -- src/__tests__/index.test.ts         # Run specific test file
```

## Architecture

### Core Concepts

**Event-Driven State Management**: Events flow through queries that transform, filter, and combine data streams. State is materialized on-demand through storage abstractions.

**Functional Query API**: Declarative query building using method chaining:
- `query(eventType)` - Filter by event type  
- `.by.field` - Group by field value
- `.select.field` - Extract field values
- `.map()`, `.filter()`, `.reduce()` - Transform operations
- `join({})` - Combine multiple queries
- `.internal()` - Emit internal events

### Key Components

**QueryTail** (`src/internal/QueryTail.ts`): Core query execution engine that processes event streams through ETF (Event Transform Functions).

**Context** (`src/internal/Context.ts`): Execution context managing storage, event inlets/outlets, and async publishing. Provides `InMemoryStorage` and pluggable `Storage` interface.

**MainStore** (`src/internal/MainStore.ts`): Orchestrates multiple stores, handles event routing between StoreExecutors, and provides the main API for reading/listening.

**Scope** (`src/internal/scope.ts`): Type-safe API factory that creates `query()`, `join()`, `action()`, and `store()` functions for a specific event type.

### Type System

Events must extend `HasType` interface with a `type` field. The library uses advanced TypeScript generics to maintain type safety:

```typescript
type MyEvent = { type: 'CREATE_TODO', title: string } | { type: 'TODO_CREATED', id: string, title: string }

const { query, store } = scope<MyEvent>()
```

### Storage Architecture

State persistence through path-based key-value storage. Internal events are stored with composite keys (e.g., `"path.field.id"`). Context manages read/write operations with sequence IDs for consistency.

### Event Flow Patterns

1. **Input Events** → **Query Transformations** → **Storage Updates** → **Output Events**
2. **Join Operations**: Combine multiple event streams, only emit when all dependencies are satisfied
3. **Internal Events**: Generated events that feed back into the system for further processing
4. **External Events**: Bridge between different event domains or systems

## Testing Patterns

Tests use type-safe event definitions and async execution:

```typescript
const values = await QueryTail.runRecord(query, eventArray)
const value = await QueryTail.runValue(query, events, key)
```

Key test utilities in `src/__tests__/index.test.ts` demonstrate query composition, store communication, and event flow patterns.
