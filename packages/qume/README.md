# Qume

A reactive state management library for TypeScript that transforms events into reactive application state through composable queries.

## Overview

Qume follows an event-driven architecture where events flow through reactive queries to build application state. Instead of writing reducers and managing subscriptions manually, you describe relationships declaratively and Qume handles all the reactive updates automatically.

## Installation

```bash
npm install qume
```

For React integration:

```bash
npm install qume qume-react
```

## Quick Start

```typescript
import { scope } from 'qume'

// Define your events
type TodoEvent = 
  | { type: 'TODO_CREATED', id: string, title: string }
  | { type: 'TODO_COMPLETED', id: string }

const { query, store, action } = scope<TodoEvent>()

// Create your store
const todoStore = store({
  // Actions emit events
  create: action((title: string) => ({ 
    type: 'TODO_CREATED', 
    id: Math.random().toString(36), 
    title 
  })),
  complete: action((id: string) => ({ type: 'TODO_COMPLETED', id })),
  
  // Queries transform events into state
  todos: query('TODO_CREATED').by.id,
  completed: query('TODO_COMPLETED').by.id,
  active: query('TODO_CREATED')
    .by.id
    .join(query('TODO_COMPLETED').by.id.optional())
    .map(([todo, completion]) => completion ? undefined : todo)
})

// Use with React
import { QumeProvider, useStore } from 'qume-react'
import { runMain } from 'qume'

const main = runMain({ todos: todoStore })

function App() {
  return (
    <QumeProvider main={main}>
      <TodoList />
    </QumeProvider>
  )
}

function TodoList() {
  const [state, actions] = useStore(todoStore)
  
  return (
    <div>
      {Object.values(state.active).map(todo => (
        <div key={todo.id}>
          {todo.title}
          <button onClick={() => actions.complete(todo.id)}>
            Complete
          </button>
        </div>
      ))}
      <button onClick={() => actions.create('New Todo')}>
        Add Todo
      </button>
    </div>
  )
}
```

## Core Architecture

### Events
Events are typed objects that describe what happened in your application:

```typescript
type UserEvent = 
  | { type: 'USER_LOGGED_IN', user: { id: string, name: string } }
  | { type: 'USER_LOGGED_OUT' }
  | { type: 'PROFILE_UPDATED', id: string, data: UserData }
```

### Scope
A scope creates type-safe factory functions for your event domain:

```typescript
const { query, store, action, join } = scope<UserEvent>()
```

### Actions
Actions are functions that emit events into the system:

```typescript
// Simple action
const logout = action(() => ({ type: 'USER_LOGGED_OUT' }))

// Action with parameters
const updateProfile = action((id: string, data: UserData) => ({
  type: 'PROFILE_UPDATED', 
  id, 
  data
}))

// Async action with side effects
const fetchUser = action((id: string) => id)
  .evalMap(async (id) => {
    const user = await api.getUser(id)
    return { type: 'USER_LOADED', user }
  })
```

### Queries
Queries transform event streams into reactive state:

```typescript
// Basic query - listen to specific event types
const users = query('USER_LOGGED_IN').by.id

// Transform data
const userNames = query('USER_LOGGED_IN').select.name

// Filter events
const adminUsers = query('USER_LOGGED_IN')
  .filter(event => event.user.role === 'admin')
  .by.id

// Combine multiple sources
const activeUsers = query('USER_LOGGED_IN')
  .by.id
  .join(query('USER_LOGGED_OUT').by.id.optional())
  .map(([login, logout]) => logout ? undefined : login.user)
```

### Stores
Stores collect related actions and queries:

```typescript
const userStore = store({
  // Actions
  login: action((user: User) => ({ type: 'USER_LOGGED_IN', user })),
  logout: action(() => ({ type: 'USER_LOGGED_OUT' })),
  
  // State queries
  currentUser: query('USER_LOGGED_IN').map(e => e.user).latest(),
  isLoggedIn: query('USER_LOGGED_IN', 'USER_LOGGED_OUT')
    .map(e => e.type === 'USER_LOGGED_IN')
    .latest()
})
```

## Query Methods Reference

### Data Organization
- **`.by.property`**: Group events by property value → `Record<string, Event>`
- **`.byKey(fn)`**: Group by custom key function
- **`.byId()`**: Shorthand for `.by.id`

### Data Selection
- **`.select.property`**: Extract property from events → `Record<string, PropertyType>`
- **`.selectKey(fn)`**: Extract using custom function

### Transformations
- **`.map(fn)`**: Transform each value synchronously
- **`.evalMap(fn)`**: Transform each value asynchronously (for API calls)
- **`.filter(fn)`**: Keep only values that pass the test
- **`.reduce(fn)`**: Accumulate values over time

### State Management
- **`.latest()`**: Keep only the most recent value
- **`.once()`**: Only let each key through once (prevent duplicates)
- **`.optional()`**: Convert missing values to `undefined` instead of filtering out

### Combining Queries
- **`join({ field1: query1, field2: query2 })`**: Combine multiple queries
- **`.flatten()`**: Convert arrays to individual elements

### Event Routing
- **`.internal()`**: Emit generated events back into the system
- **`.external()`**: Send events to external systems

## Common Patterns

### Counter Pattern
```typescript
const counterStore = store({
  increment: action().internal('INCREMENT'),
  decrement: action().internal('DECREMENT'),
  reset: action().internal('RESET'),
  
  count: query('INCREMENT', 'DECREMENT', 'RESET')
    .map(event => {
      switch(event.type) {
        case 'INCREMENT': return 1
        case 'DECREMENT': return -1  
        case 'RESET': return 0
      }
    })
    .reduce((sum, change) => event.type === 'RESET' ? 0 : sum + change)
})
```

### CRUD Pattern
```typescript
const crudStore = store({
  create: action((data: ItemData) => ({ 
    type: 'ITEM_CREATED', 
    id: uuid(), 
    ...data 
  })),
  update: action((id: string, data: Partial<ItemData>) => ({ 
    type: 'ITEM_UPDATED', 
    id, 
    data 
  })),
  delete: action((id: string) => ({ type: 'ITEM_DELETED', id })),
  
  items: query('ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_DELETED')
    .by.id
    .reduce((existing, event) => {
      switch(event.type) {
        case 'ITEM_CREATED':
          return { id: event.id, ...event }
        case 'ITEM_UPDATED':
          return existing ? { ...existing, ...event.data } : undefined
        case 'ITEM_DELETED':
          return undefined
        default:
          return existing
      }
    })
})
```

### Data Fetching Pattern
```typescript
const dataStore = store({
  fetch: action((id: string) => id)
    .evalMap(async (id) => {
      try {
        const data = await api.get(id)
        return { type: 'FETCH_SUCCESS', id, data }
      } catch (error) {
        return { type: 'FETCH_ERROR', id, error: error.message }
      }
    })
    .internal(),
  
  data: query('FETCH_SUCCESS').by.id.select.data,
  errors: query('FETCH_ERROR').by.id.select.error,
  loading: query('FETCH_START')
    .by.id
    .join(query('FETCH_SUCCESS', 'FETCH_ERROR').by.id.optional())
    .map(([start, end]) => !end)
})
```

### Form Validation Pattern
```typescript
const formStore = store({
  submit: action((formData: FormData) => {
    const errors = validate(formData)
    return errors.length > 0 
      ? { type: 'VALIDATION_ERROR', errors }
      : { type: 'FORM_VALID', data: formData }
  }).internal(),
  
  clear: action().internal('FORM_CLEARED'),
  
  validData: query('FORM_VALID').select.data.latest(),
  errors: query('VALIDATION_ERROR').select.errors.latest(),
  isValid: query('FORM_VALID', 'VALIDATION_ERROR', 'FORM_CLEARED')
    .map(e => e.type === 'FORM_VALID')
    .latest()
})
```

## React Integration

### Provider Setup
```typescript
import { QumeProvider } from 'qume-react'
import { runMain } from 'qume'

const main = runMain({
  todos: todoStore,
  users: userStore
})

function App() {
  return (
    <QumeProvider main={main}>
      <YourApp />
    </QumeProvider>
  )
}
```

### Hooks
- **`useStore(store)`**: Returns `[values, actions]` tuple
- **`useQuery(query)`**: Access individual query results  
- **`useAction(action)`**: Access individual actions
- **`usePublisher()`**: Direct event publishing

```typescript
function TodoComponent() {
  const [{ todos, active }, { create, complete }] = useStore(todoStore)
  const publisher = usePublisher()
  
  // Direct event publishing
  const handleCustomEvent = () => {
    publisher({ type: 'CUSTOM_EVENT', data: 'some data' })
  }
  
  return (
    <div>
      {/* Use state and actions */}
    </div>
  )
}
```

## Multi-Store Architecture

### Single Main Store
```typescript
const main = runMain({
  todos: todoStore,
  users: userStore,
  notifications: notificationStore
})
```

### Cross-Store Communication
```typescript
// Store A generates events that Store B consumes
const orderStore = store({
  placeOrder: action((order: Order) => order)
    .internal(order => ({ type: 'ORDER_PLACED', order }))
    .external(), // Also emit to other stores
  
  orders: query('ORDER_PLACED').by.orderId
})

const inventoryStore = store({
  // Listen to events from order store
  reserveItems: query('ORDER_PLACED')
    .evalMap(async (event) => {
      await inventory.reserve(event.order.items)
      return { type: 'INVENTORY_RESERVED', orderId: event.order.id }
    })
    .internal(),
    
  reservations: query('INVENTORY_RESERVED').by.orderId
})
```

## Data Reading & Subscriptions

### In React Components
```typescript
function MyComponent() {
  const [{ data }, { fetchData }] = useStore(dataStore)
  
  useEffect(() => {
    fetchData('some-id')
  }, [])
  
  return <div>{data ? JSON.stringify(data) : 'Loading...'}</div>
}
```

### Outside React
```typescript
// Read current state
const currentTodos = await main.readQuery(todoStore.todos)

// Listen to changes  
const unsubscribe = main.listenQuery(todoStore.todos, (todos) => {
  console.log('Todos updated:', todos)
})

// Cleanup
unsubscribe()

// Trigger actions
await main.actions(todoStore).create('New Todo')
```

## Testing

### Query Testing
```typescript
import { QueryTailImpl } from 'qume'

describe('todoStore', () => {
  it('should handle todo creation', async () => {
    const events = [
      { type: 'TODO_CREATED', id: '1', title: 'Test Todo' }
    ]
    
    const result = await QueryTailImpl.runRecord(todoStore.todos, events)
    
    expect(result['1']).toEqual({ 
      type: 'TODO_CREATED',
      id: '1', 
      title: 'Test Todo' 
    })
  })
})
```

### Action Testing
```typescript
import { ActionSymbol } from 'qume'

it('should create todo with action', async () => {
  const result = await QueryTailImpl.runQuery(
    todoStore.create,
    { type: ActionSymbol, value: ['Test Todo'], isAction: true }
  )
  
  expect(result.title).toBe('Test Todo')
})
```

### Integration Testing
```typescript
describe('todo integration', () => {
  it('should complete workflow', async () => {
    const main = runMain({ todos: todoStore })
    
    // Create todo
    await main.actions(todoStore).create('Test Todo')
    
    // Read state
    const todos = await main.readQuery(todoStore.todos)
    const todoId = Object.keys(todos)[0]
    
    expect(todos[todoId].title).toBe('Test Todo')
    
    // Complete todo
    await main.actions(todoStore).complete(todoId)
    
    // Verify completion
    const completed = await main.readQuery(todoStore.completed)
    expect(completed[todoId]).toBeDefined()
  })
})
```

## TypeScript Support

Qume provides full TypeScript support with automatic type inference:

```typescript
type UserEvent = 
  | { type: 'USER_CREATED', id: string, name: string, age: number }
  | { type: 'USER_UPDATED', id: string, data: Partial<UserData> }

const { query, store, action } = scope<UserEvent>()

// All types are inferred automatically
const users = query('USER_CREATED').by.id 
// Type: QueryTail<Record<string, { type: 'USER_CREATED', id: string, name: string, age: number }>>

const names = query('USER_CREATED').select.name
// Type: QueryTail<Record<string, string>>

const ages = query('USER_CREATED').by.id.map(user => user.age)
// Type: QueryTail<Record<string, number>>
```

## Performance Tips

1. **Filter Early**: Apply filters before expensive transformations
2. **Use Specific Events**: Only query the event types you need
3. **Leverage Grouping**: Use `.by.id` or `.byKey()` for efficient updates
4. **Split Components**: Create focused components that subscribe to specific data
5. **Batch Actions**: Multiple actions in sequence are automatically batched

## Architecture Patterns

### Domain-Driven Stores
```typescript
// User domain
const userDomain = scope<UserEvent>()
const userStore = userDomain.store({ /* user logic */ })

// Todo domain  
const todoDomain = scope<TodoEvent>()  
const todoStore = todoDomain.store({ /* todo logic */ })

// App level - combine domains
type AppEvent = UserEvent | TodoEvent
const appScope = scope<AppEvent>()

const appStore = appScope.store({
  // Cross-domain logic
  userTodoCount: appScope.join({
    user: userStore.currentUser,
    todos: todoStore.todos
  }).map(({ todos }) => Object.keys(todos).length)
})
```

### Event Generation Pattern
```typescript
const socialStore = store({
  postTweet: action((content: string) => ({
    type: 'TWEET_POSTED',
    id: uuid(),
    content,
    hashtags: extractHashtags(content)
  })),
  
  // Generate hashtag events from tweets
  hashtagProcessor: query('TWEET_POSTED')
    .filter(tweet => tweet.hashtags.length > 0)
    .evalMap(async (tweet) => 
      tweet.hashtags.map(tag => ({ 
        type: 'HASHTAG_USED', 
        hashtag: tag,
        tweetId: tweet.id
      }))
    )
    .flatten()
    .internal(),
    
  tweets: query('TWEET_POSTED').by.id,
  hashtags: query('HASHTAG_USED').by.hashtag
})
```

## Migration Guide

### From Redux
- **Actions** → Events (plain objects)
- **Action Creators** → Actions (`action()` functions)
- **Reducers** → Queries with `.reduce()`
- **Selectors** → Queries with transformations
- **Store** → Store collections
- **useSelector** → `useStore()` or `useQuery()`
- **useDispatch** → Actions from `useStore()`

### From MobX
- **Observables** → Queries
- **Actions** → Actions (similar concept)  
- **Computed** → Query transformations
- **Reactions** → Query subscriptions
- **Stores** → Store collections

## Advanced Features

### Custom Storage
```typescript
import { Context, Storage } from 'qume'

class CustomStorage implements Storage {
  async get(key: string): Promise<any> {
    // Your storage implementation
  }
  
  async set(key: string, value: any): Promise<void> {
    // Your storage implementation  
  }
}

const context = new Context(new CustomStorage())
const main = runMain(stores, { context })
```

This comprehensive README provides everything an AI agent needs to understand and effectively use the Qume library for building reactive, event-driven applications with full TypeScript support.

