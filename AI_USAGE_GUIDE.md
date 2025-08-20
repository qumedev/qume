# AI Usage Guide for Qume & Qume-React

This guide is specifically designed for AI agents to understand and effectively use the Qume ecosystem for building reactive, event-driven applications with TypeScript and React.

## Table of Contents
1. [Quick Reference](#quick-reference)
2. [Core Concepts](#core-concepts)
3. [Essential Patterns](#essential-patterns)
4. [React Integration](#react-integration)
5. [Common Use Cases](#common-use-cases)
6. [Testing Patterns](#testing-patterns)
7. [Troubleshooting](#troubleshooting)

## Quick Reference

### Installation
```bash
npm install qume qume-react
```

### Basic Setup Template
```typescript
import { scope, runMain } from 'qume'
import { QumeProvider, useStore } from 'qume-react'

// 1. Define events
type AppEvent = 
  | { type: 'TODO_CREATED', id: string, title: string }
  | { type: 'TODO_COMPLETED', id: string }

// 2. Create scope
const { query, action, store } = scope<AppEvent>()

// 3. Build store
const todoStore = store({
  // Actions
  create: action((title: string) => ({ 
    type: 'TODO_CREATED', 
    id: crypto.randomUUID(), 
    title 
  })),
  complete: action((id: string) => ({ type: 'TODO_COMPLETED', id })),
  
  // Queries
  todos: query('TODO_CREATED').by.id,
  activeTodos: query('TODO_CREATED')
    .by.id
    .join(query('TODO_COMPLETED').by.id.optional())
    .map(([todo, completion]) => completion ? undefined : todo)
})

// 4. Setup React
const main = runMain({ todos: todoStore })

function App() {
  return (
    <QumeProvider main={main}>
      <TodoApp />
    </QumeProvider>
  )
}

function TodoApp() {
  const [{ todos, activeTodos }, { create, complete }] = useStore(todoStore)
  
  return (
    <div>
      <button onClick={() => create('New Todo')}>Add</button>
      {Object.values(activeTodos).map(todo => (
        <div key={todo.id}>
          {todo.title}
          <button onClick={() => complete(todo.id)}>Complete</button>
        </div>
      ))}
    </div>
  )
}
```

## Core Concepts

### 1. Events First
All state changes start with events. Events are typed objects with a `type` field:

```typescript
type UserEvent = 
  | { type: 'USER_LOGGED_IN', user: User }
  | { type: 'USER_LOGGED_OUT' }
  | { type: 'PROFILE_UPDATED', id: string, data: UserData }
```

### 2. Actions Emit Events
Actions are functions that create and emit events:

```typescript
// Simple action
const login = action((user: User) => ({ type: 'USER_LOGGED_IN', user }))

// Async action with API calls
const fetchUser = action((id: string) => id)
  .evalMap(async (id) => {
    const user = await api.getUser(id)
    return { type: 'USER_FETCHED', id, user }
  })
  .internal()
```

### 3. Queries Transform Events to State
Queries filter and transform event streams into application state:

```typescript
// Basic grouping
const users = query('USER_LOGGED_IN').by.id

// Data transformation
const userNames = query('USER_LOGGED_IN').select.name

// Complex state derivation
const activeUsers = query('USER_LOGGED_IN')
  .by.id
  .join(query('USER_LOGGED_OUT').by.id.optional())
  .map(([login, logout]) => logout ? undefined : login.user)
```

### 4. Stores Organize Functionality
Stores combine related actions and queries:

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

## Essential Patterns

### 1. CRUD Operations
```typescript
const itemStore = store({
  // Actions
  create: action((data: ItemData) => ({ 
    type: 'ITEM_CREATED', 
    id: crypto.randomUUID(),
    ...data 
  })),
  update: action((id: string, data: Partial<ItemData>) => ({ 
    type: 'ITEM_UPDATED', 
    id, 
    data 
  })),
  delete: action((id: string) => ({ type: 'ITEM_DELETED', id })),
  
  // State
  items: query('ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_DELETED')
    .by.id
    .reduce((existing, event) => {
      switch(event.type) {
        case 'ITEM_CREATED':
          return event
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

### 2. Async Data Fetching
```typescript
const dataStore = store({
  fetch: action((id: string) => ({ type: 'FETCH_REQUESTED', id }))
    .evalMap(async ({ id }) => {
      try {
        const data = await api.getData(id)
        return { type: 'FETCH_SUCCESS', id, data }
      } catch (error) {
        return { type: 'FETCH_ERROR', id, error: error.message }
      }
    })
    .internal(),
  
  // State queries
  data: query('FETCH_SUCCESS').by.id.select.data,
  errors: query('FETCH_ERROR').by.id.select.error,
  loading: query('FETCH_REQUESTED').by.id.as(true)
    .join(query('FETCH_SUCCESS', 'FETCH_ERROR').by.id.optional())
    .map(([loading, finished]) => !finished)
})
```

### 3. Form Handling
```typescript
const formStore = store({
  updateField: action((field: string, value: any) => ({ 
    type: 'FIELD_UPDATED', 
    field, 
    value 
  })),
  
  submit: action((data: FormData) => {
    const errors = validate(data)
    return errors.length > 0
      ? { type: 'VALIDATION_ERROR', errors }
      : { type: 'FORM_SUBMITTED', data }
  }),
  
  clear: action(() => ({ type: 'FORM_CLEARED' })),
  
  // State
  formData: query('FIELD_UPDATED').by.field.select.value,
  errors: query('VALIDATION_ERROR').select.errors.latest(),
  isValid: query('VALIDATION_ERROR', 'FORM_SUBMITTED')
    .map(e => e.type === 'FORM_SUBMITTED')
    .latest()
})
```

### 4. Real-time Updates
```typescript
const chatStore = store({
  sendMessage: action((roomId: string, message: string) => ({
    type: 'MESSAGE_SENT',
    id: crypto.randomUUID(),
    roomId,
    message,
    timestamp: Date.now()
  })),
  
  joinRoom: action((roomId: string, userId: string) => ({
    type: 'USER_JOINED',
    roomId,
    userId
  })),
  
  // Real-time state
  messages: query('MESSAGE_SENT').by.roomId,
  activeUsers: query('USER_JOINED')
    .by.roomId
    .join(query('USER_LEFT').by.roomId.optional())
    .map(([join, leave]) => leave ? undefined : join.userId)
})
```

## React Integration

### 1. Provider Setup
Always wrap your app with `QumeProvider`:

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
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/todos" element={<TodoList />} />
        </Routes>
      </Router>
    </QumeProvider>
  )
}
```

### 2. Hook Usage Patterns

#### useStore - Primary Hook
Use for components that need both state and actions:

```typescript
function TodoManager() {
  const [{ todos, loading }, { create, complete, fetch }] = useStore(todoStore)
  
  useEffect(() => { fetch() }, [])
  
  if (loading.todos) return <div>Loading...</div>
  
  return (
    <div>
      <button onClick={() => create('New Todo')}>Add</button>
      {Object.values(todos).map(todo => (
        <TodoItem key={todo.id} todo={todo} onComplete={() => complete(todo.id)} />
      ))}
    </div>
  )
}
```

#### useStoreValues - Read-Only Components
Use for display-only components:

```typescript
function TodoStats() {
  const { todos, activeTodos, completedTodos } = useStoreValues(todoStore)
  
  const totalCount = Object.keys(todos).length
  const progress = totalCount > 0 ? Math.round((Object.keys(completedTodos).length / totalCount) * 100) : 0
  
  return (
    <div>
      <div>Total: {totalCount}</div>
      <div>Progress: {progress}%</div>
    </div>
  )
}
```

#### useStoreActions - Action-Only Components
Use for components that only trigger actions:

```typescript
function QuickAddForm() {
  const [title, setTitle] = useState('')
  const { create } = useStoreActions(todoStore)
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (title.trim()) {
      await create(title.trim())
      setTitle('')
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <button type="submit">Add</button>
    </form>
  )
}
```

#### useQuery - Specific Data Subscriptions
Use for fine-grained data access:

```typescript
function UrgentTodoCount() {
  const urgentTodos = useQuery(
    todoStore.todos.filter(todo => todo.priority === 'urgent')
  )
  
  const count = Object.keys(urgentTodos || {}).length
  
  return (
    <div>
      {count > 0 && <span className="badge">🚨 {count} urgent</span>}
    </div>
  )
}
```

#### useAction - Single Action Access
Use for components that need one specific action:

```typescript
function SaveButton({ todo }) {
  const [saving, setSaving] = useState(false)
  const saveTodo = useAction(todoStore.save)
  
  const handleSave = async () => {
    setSaving(true)
    try {
      await saveTodo(todo)
      toast.success('Saved!')
    } catch (error) {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <button onClick={handleSave} disabled={saving}>
      {saving ? 'Saving...' : 'Save'}
    </button>
  )
}
```

#### usePublisher - External Events
Use for bridging external events into qume:

```typescript
function WebSocketBridge() {
  const publish = usePublisher()
  
  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080')
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      publish(data) // Forward to qume
    }
    
    socket.onopen = () => publish({ type: 'WEBSOCKET_CONNECTED' })
    socket.onclose = () => publish({ type: 'WEBSOCKET_DISCONNECTED' })
    
    return () => socket.close()
  }, [publish])
  
  return null
}
```

## Common Use Cases

### 1. Todo Application
```typescript
type TodoEvent = 
  | { type: 'TODO_CREATED', id: string, title: string }
  | { type: 'TODO_COMPLETED', id: string }
  | { type: 'TODO_DELETED', id: string }

const { query, action, store } = scope<TodoEvent>()

const todoStore = store({
  create: action((title: string) => ({ 
    type: 'TODO_CREATED', 
    id: crypto.randomUUID(), 
    title 
  })),
  complete: action((id: string) => ({ type: 'TODO_COMPLETED', id })),
  delete: action((id: string) => ({ type: 'TODO_DELETED', id })),
  
  todos: query('TODO_CREATED').by.id,
  activeTodos: query('TODO_CREATED')
    .by.id
    .join(query('TODO_COMPLETED', 'TODO_DELETED').by.id.optional())
    .map(([todo, action]) => action ? undefined : todo),
  completedTodos: query('TODO_CREATED')
    .by.id
    .join(query('TODO_COMPLETED').by.id)
    .map(([todo, completion]) => ({ ...todo, completedAt: completion.timestamp }))
})
```

### 2. User Authentication
```typescript
type AuthEvent = 
  | { type: 'LOGIN_REQUESTED', email: string, password: string }
  | { type: 'LOGIN_SUCCESS', user: User, token: string }
  | { type: 'LOGIN_FAILED', error: string }
  | { type: 'LOGOUT' }

const authStore = store({
  login: action((email: string, password: string) => ({ type: 'LOGIN_REQUESTED', email, password }))
    .evalMap(async ({ email, password }) => {
      try {
        const { user, token } = await auth.login(email, password)
        localStorage.setItem('token', token)
        return { type: 'LOGIN_SUCCESS', user, token }
      } catch (error) {
        return { type: 'LOGIN_FAILED', error: error.message }
      }
    })
    .internal(),
  
  logout: action(() => {
    localStorage.removeItem('token')
    return { type: 'LOGOUT' }
  }),
  
  currentUser: query('LOGIN_SUCCESS').select.user
    .join(query('LOGOUT').optional())
    .map(([user, logout]) => logout ? undefined : user)
    .latest(),
    
  isAuthenticated: query('LOGIN_SUCCESS', 'LOGOUT')
    .map(e => e.type === 'LOGIN_SUCCESS')
    .latest(),
    
  loginError: query('LOGIN_FAILED').select.error.latest()
})
```

### 3. Shopping Cart
```typescript
type CartEvent = 
  | { type: 'ITEM_ADDED', productId: string, quantity: number }
  | { type: 'ITEM_REMOVED', productId: string }
  | { type: 'QUANTITY_UPDATED', productId: string, quantity: number }
  | { type: 'CART_CLEARED' }

const cartStore = store({
  addItem: action((productId: string, quantity: number = 1) => ({ 
    type: 'ITEM_ADDED', 
    productId, 
    quantity 
  })),
  
  removeItem: action((productId: string) => ({ type: 'ITEM_REMOVED', productId })),
  
  updateQuantity: action((productId: string, quantity: number) => ({ 
    type: 'QUANTITY_UPDATED', 
    productId, 
    quantity 
  })),
  
  clear: action(() => ({ type: 'CART_CLEARED' })),
  
  items: query('ITEM_ADDED', 'ITEM_REMOVED', 'QUANTITY_UPDATED', 'CART_CLEARED')
    .by.productId
    .reduce((existing, event) => {
      switch(event.type) {
        case 'ITEM_ADDED':
          return existing 
            ? { ...existing, quantity: existing.quantity + event.quantity }
            : { productId: event.productId, quantity: event.quantity }
        case 'QUANTITY_UPDATED':
          return existing ? { ...existing, quantity: event.quantity } : undefined
        case 'ITEM_REMOVED':
        case 'CART_CLEARED':
          return undefined
        default:
          return existing
      }
    }),
    
  totalItems: query('ITEM_ADDED', 'ITEM_REMOVED', 'QUANTITY_UPDATED', 'CART_CLEARED')
    .by.productId
    .reduce((existing, event) => {
      // Same logic as items but sum quantities
    })
    .map(items => Object.values(items).reduce((sum, item) => sum + (item?.quantity || 0), 0))
})
```

## Testing Patterns

### 1. Query Testing
```typescript
import { QueryTailImpl } from 'qume'

describe('todoStore queries', () => {
  it('should handle todo creation and completion', async () => {
    const events = [
      { type: 'TODO_CREATED', id: '1', title: 'Test Todo' },
      { type: 'TODO_COMPLETED', id: '1' }
    ]
    
    const todos = await QueryTailImpl.runRecord(todoStore.todos, events)
    const activeTodos = await QueryTailImpl.runRecord(todoStore.activeTodos, events)
    
    expect(todos['1']).toEqual({ type: 'TODO_CREATED', id: '1', title: 'Test Todo' })
    expect(activeTodos['1']).toBeUndefined() // Should be filtered out
  })
})
```

### 2. Action Testing
```typescript
import { ActionSymbol } from 'qume'

describe('todoStore actions', () => {
  it('should create todo with correct structure', async () => {
    const result = await QueryTailImpl.runQuery(
      todoStore.create,
      { type: ActionSymbol, value: ['Test Todo'], isAction: true }
    )
    
    expect(result).toEqual({
      type: 'TODO_CREATED',
      id: expect.any(String),
      title: 'Test Todo'
    })
  })
})
```

### 3. Integration Testing
```typescript
describe('todo integration', () => {
  it('should handle complete workflow', async () => {
    const main = runMain({ todos: todoStore })
    
    // Create todo
    await main.actions(todoStore).create('Integration Test')
    
    // Wait for processing
    await main.inprogress
    
    // Read current state
    const todos = await main.readStore(todoStore)
    const todoId = Object.keys(todos.todos)[0]
    
    expect(todos.todos[todoId].title).toBe('Integration Test')
    
    // Complete todo
    await main.actions(todoStore).complete(todoId)
    await main.inprogress
    
    // Verify completion
    const updatedState = await main.readStore(todoStore)
    expect(updatedState.activeTodos[todoId]).toBeUndefined()
  })
})
```

### 4. React Component Testing
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QumeProvider } from 'qume-react'
import { runMain } from 'qume'

describe('TodoApp', () => {
  it('should add and complete todos', async () => {
    const main = runMain({ todos: todoStore })
    
    render(
      <QumeProvider main={main}>
        <TodoApp />
      </QumeProvider>
    )
    
    // Add todo
    fireEvent.click(screen.getByText('Add Todo'))
    
    // Wait for todo to appear
    await waitFor(() => {
      expect(screen.getByText(/New Todo/)).toBeInTheDocument()
    })
    
    // Complete todo
    fireEvent.click(screen.getByText('Complete'))
    
    // Verify todo is removed from active list
    await waitFor(() => {
      expect(screen.queryByText(/New Todo/)).not.toBeInTheDocument()
    })
  })
})
```

## Troubleshooting

### Common Issues

#### 1. "QueryTail is not in the store" Error
```typescript
// ❌ Wrong - query not inside store
const orphanQuery = query('SOME_EVENT').by.id
const main = runMain({ myStore })
const result = await main.readQuery(orphanQuery) // Error!

// ✅ Correct - query inside store
const myStore = store({
  data: query('SOME_EVENT').by.id
})
const main = runMain({ myStore })
const result = await main.readQuery(myStore.data) // Works!
```

#### 2. Actions Not Triggering Updates
```typescript
// ❌ Wrong - action not connected to store
const createTodo = action((title: string) => ({ type: 'TODO_CREATED', title }))

// ✅ Correct - action inside store
const todoStore = store({
  create: action((title: string) => ({ type: 'TODO_CREATED', title }))
})
```

#### 3. React Components Not Re-rendering
```typescript
// ❌ Wrong - reading outside React context
function TodoList() {
  const [todos, setTodos] = useState([])
  
  useEffect(() => {
    main.readStore(todoStore).then(data => setTodos(data.todos))
  }, [])
  
  // Won't update when store changes
}

// ✅ Correct - using qume-react hooks
function TodoList() {
  const [{ todos }] = useStore(todoStore)
  
  // Automatically updates when store changes
}
```

#### 4. TypeScript Errors with Event Types
```typescript
// ❌ Wrong - events not properly typed
const events = ['TODO_CREATED', 'TODO_COMPLETED'] // string[]

// ✅ Correct - proper event type union
type TodoEvent = 
  | { type: 'TODO_CREATED', id: string, title: string }
  | { type: 'TODO_COMPLETED', id: string }
  
const { query } = scope<TodoEvent>()
```

### Performance Tips

1. **Use Specific Event Types**: Only query the events you need
2. **Apply Filters Early**: Filter before expensive transformations
3. **Split Components**: Create focused components for better re-rendering
4. **Use Granular Hooks**: Use `useQuery` or `useStoreValues` when you don't need actions
5. **Batch Operations**: Multiple actions in sequence are automatically batched

### Best Practices for AI Agents

1. **Always Define Event Types First**: Start with the event union type
2. **Use Descriptive Names**: Make actions and queries self-documenting
3. **Keep Stores Focused**: One domain per store
4. **Test Query Logic**: Use `QueryTailImpl.runRecord` for testing
5. **Handle Async Errors**: Always catch errors in `evalMap`
6. **Use TypeScript**: Leverage full type inference
7. **Follow Naming Conventions**: `actionName` for actions, `dataName` for queries

This guide provides everything an AI agent needs to effectively build applications with Qume and Qume-React. The patterns and examples are production-ready and demonstrate best practices for reactive, event-driven development.