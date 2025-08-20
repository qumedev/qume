# Qume Quick Start Guide

## Basic Pattern

Qume uses **event-sourcing** with **reactive queries**. Instead of direct state mutations, you dispatch facts (events) and derive state through queries.

### 1. Define Facts (Events)

```typescript
// Define fact type constants
export const ITEM_CREATED = 'ITEM_CREATED'
export const ITEM_UPDATED = 'ITEM_UPDATED'

// Define fact interfaces
export interface ItemCreated {
  type: typeof ITEM_CREATED
  id: string
  name: string
}

export interface ItemUpdated {
  type: typeof ITEM_UPDATED
  id: string
  name: string
}

// Union type for all facts
export type ItemFact = ItemCreated | ItemUpdated
```

### 2. Create Store with Scope

```typescript
import { scope } from 'qume'

// Create typed scope
const { query, join, store, action } = scope<ItemFact>()

export const itemStore = store({
  // Actions dispatch facts
  create: action((name: string) => ({
    id: Math.random().toString(36).substring(2),
    name
  })).internal(ITEM_CREATED),

  update: action((id: string, name: string) => ({
    id, name
  })).internal(ITEM_UPDATED),

  // Queries derive state from facts
  items: query(ITEM_CREATED).by.id,
  
  // Complex derived state
  current: join({
    id: query(ITEM_CREATED).by.id.select.id,
    name: query(
      query(ITEM_CREATED).by.id.select.name,
      query(ITEM_UPDATED).by.id.select.name
    )
  })
})
```

### 3. Use with runMain

```typescript
import { runMain } from 'qume'

const mainStore = runMain({ itemStore })
```

## Key Concepts

- **Facts**: Immutable events that represent what happened
- **Actions**: Functions that create and dispatch facts
- **Queries**: Reactive selectors that derive state from facts
- **Store**: Container for actions and queries
- **Scope**: Type-safe factory for creating store components

## Best Practices

1. **Always use `.internal()` for actions**: `action(...).internal(FACT_TYPE)`
2. **Query by id for entities**: `query(FACT_TYPE).by.id`
3. **Use join for complex state**: Combine multiple queries
4. **Keep facts simple**: Single responsibility per fact type
5. **Type everything**: Use TypeScript interfaces for facts