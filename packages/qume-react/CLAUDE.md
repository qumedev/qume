# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the qume-react package.

## Project Overview

Qume-React is the official React integration library for Qume, providing React hooks and context providers for reactive state management with event-driven architecture. It enables seamless integration of Qume stores into React applications with automatic re-rendering on state changes.

## Package Structure

```
packages/qume-react/
├── src/
│   ├── index.tsx              # Main hooks and provider implementation
│   └── __tests__/
│       ├── index.test.tsx     # Basic hook tests
│       └── store.test.tsx     # Store integration tests
├── package.json
├── tsconfig.json
└── README.md
```

## Core API

### Provider Component

**`QumeProvider`**: Context provider that makes Qume MainStore available to child components.

```typescript
import { QumeProvider } from 'qume-react'
import { runMain } from 'qume'

const main = runMain({ todoStore })

function App() {
  return (
    <QumeProvider main={main}>
      <YourComponents />
    </QumeProvider>
  )
}
```

### Primary Hooks

**`useStore(store)`**: Main hook for accessing store state and actions. Returns `[values, actions]` tuple.

```typescript
import { useStore } from 'qume-react'

function TodoComponent() {
  const [storeValues, actions] = useStore(todoStore)
  
  // Access state
  const todos = storeValues.todos || {}
  const activeTodos = storeValues.active || {}
  
  // Use actions
  const handleCreate = () => actions.create('New Todo')
  const handleComplete = (id) => actions.complete(id)
  
  return (
    <div>
      {Object.values(activeTodos).map(todo => (
        <div key={todo.id}>
          {todo.title}
          <button onClick={() => handleComplete(todo.id)}>Done</button>
        </div>
      ))}
      <button onClick={handleCreate}>Add Todo</button>
    </div>
  )
}
```

### Granular Hooks

**`useStoreValues(store)`**: Access only the state values from a store.

```typescript
function ReadOnlyComponent() {
  const values = useStoreValues(todoStore)
  return <div>Todo count: {Object.keys(values.todos || {}).length}</div>
}
```

**`useStoreActions(store)`**: Access only the actions from a store.

```typescript
function ActionComponent() {
  const actions = useStoreActions(todoStore)
  return <button onClick={() => actions.create('Quick Todo')}>Add</button>
}
```

**`useQuery(query)`**: Access individual query results directly.

```typescript
function TodoCount() {
  const todos = useQuery(todoStore.todos)
  return <span>{Object.keys(todos || {}).length} todos</span>
}
```

**`useAction(action)`**: Access individual action functions.

```typescript
function CreateButton() {
  const createTodo = useAction(todoStore.create)
  return <button onClick={() => createTodo('New Todo')}>Create</button>
}
```

**`usePublisher()`**: Direct event publishing for custom events.

```typescript
function CustomEventComponent() {
  const publisher = usePublisher()
  
  const handleCustomAction = () => {
    publisher({ type: 'CUSTOM_EVENT', data: 'some data' })
  }
  
  return <button onClick={handleCustomAction}>Custom Action</button>
}
```

## Usage Patterns

### Basic Store Integration

```typescript
// 1. Define your store
const todoStore = store({
  create: action((title: string) => ({ 
    type: 'TODO_CREATED', 
    id: Math.random().toString(36), 
    title 
  })),
  complete: action((id: string) => ({ type: 'TODO_COMPLETED', id })),
  
  todos: query('TODO_CREATED').by.id,
  active: query('TODO_CREATED')
    .by.id
    .join(query('TODO_COMPLETED').by.id.optional())
    .map(([todo, completion]) => completion ? undefined : todo)
})

// 2. Setup provider
const main = runMain({ todoStore })

function App() {
  return (
    <QumeProvider main={main}>
      <TodoApp />
    </QumeProvider>
  )
}

// 3. Use in components
function TodoApp() {
  const [{ todos, active }, { create, complete }] = useStore(todoStore)
  
  return (
    <div>
      {Object.values(active).map(todo => (
        <TodoItem 
          key={todo.id} 
          todo={todo} 
          onComplete={() => complete(todo.id)} 
        />
      ))}
      <button onClick={() => create('New Todo')}>Add Todo</button>
    </div>
  )
}
```

### Multi-Store Applications

```typescript
const main = runMain({
  todos: todoStore,
  users: userStore,
  notifications: notificationStore
})

function Dashboard() {
  const [{ currentUser }] = useStore(userStore)
  const [{ todos }] = useStore(todoStore)
  const [{ notifications }] = useStore(notificationStore)
  
  return (
    <div>
      <h1>Welcome {currentUser?.name}</h1>
      <div>You have {Object.keys(todos).length} todos</div>
      <div>You have {Object.keys(notifications).length} notifications</div>
    </div>
  )
}
```

### Async Actions with React

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
  loading: query('FETCH_START').by.id.as(true)
    .join(query('FETCH_SUCCESS', 'FETCH_ERROR').by.id.optional())
    .map(([loading, finished]) => !finished)
})

function DataComponent({ id }: { id: string }) {
  const [{ data, errors, loading }, { fetch }] = useStore(dataStore)
  
  useEffect(() => {
    fetch(id)
  }, [id])
  
  if (loading[id]) return <div>Loading...</div>
  if (errors[id]) return <div>Error: {errors[id]}</div>
  if (data[id]) return <div>Data: {JSON.stringify(data[id])}</div>
  
  return <div>No data</div>
}
```

### Form Handling Pattern

```typescript
const formStore = store({
  updateField: action((field: string, value: any) => ({ field, value }))
    .internal('FIELD_UPDATED'),
  
  submit: action()
    .map(() => ({ type: 'FORM_SUBMITTED' }))
    .internal(),
  
  formData: query('FIELD_UPDATED').by.field.select.value,
  
  isValid: query('FIELD_UPDATED')
    .by.field
    .select.value
    .map(data => validateForm(data))
})

function FormComponent() {
  const [{ formData, isValid }, { updateField, submit }] = useStore(formStore)
  
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }}>
      <input 
        value={formData.name || ''} 
        onChange={(e) => updateField('name', e.target.value)} 
      />
      <input 
        value={formData.email || ''} 
        onChange={(e) => updateField('email', e.target.value)} 
      />
      <button type="submit" disabled={!isValid}>
        Submit
      </button>
    </form>
  )
}
```

## Testing Patterns

### Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { QumeProvider } from 'qume-react'
import { runMain } from 'qume'

describe('TodoComponent', () => {
  it('should render and interact with todos', async () => {
    const main = runMain({ todoStore })
    
    render(
      <QumeProvider main={main}>
        <TodoComponent />
      </QumeProvider>
    )
    
    // Test initial state
    expect(screen.getByText('Add Todo')).toBeInTheDocument()
    
    // Test action
    fireEvent.click(screen.getByText('Add Todo'))
    
    // Wait for state update
    await waitFor(() => {
      expect(screen.getByText('New Todo')).toBeInTheDocument()
    })
  })
})
```

### Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react'
import { QumeProvider, useStore } from 'qume-react'

describe('useStore', () => {
  it('should provide store values and actions', async () => {
    const main = runMain({ todoStore })
    
    const wrapper = ({ children }) => (
      <QumeProvider main={main}>{children}</QumeProvider>
    )
    
    const { result } = renderHook(() => useStore(todoStore), { wrapper })
    
    // Test initial state
    expect(result.current[0].todos).toEqual({})
    
    // Test action
    await act(async () => {
      await result.current[1].create('Test Todo')
    })
    
    // Verify state update
    expect(Object.keys(result.current[0].todos)).toHaveLength(1)
  })
})
```

## Performance Considerations

### Memoization

```typescript
// Memoize expensive computations
function TodoStats() {
  const [{ todos }] = useStore(todoStore)
  
  const stats = useMemo(() => {
    const todoList = Object.values(todos)
    return {
      total: todoList.length,
      completed: todoList.filter(t => t.completed).length,
      active: todoList.filter(t => !t.completed).length
    }
  }, [todos])
  
  return <div>Total: {stats.total}, Active: {stats.active}</div>
}
```

### Selective Subscriptions

```typescript
// Use granular hooks for better performance
function TodoCount() {
  const todos = useQuery(todoStore.todos) // Only subscribes to todos
  return <span>{Object.keys(todos || {}).length}</span>
}

function CreateButton() {
  const createTodo = useAction(todoStore.create) // No state subscription
  return <button onClick={() => createTodo('New')}>Create</button>
}
```

### Component Splitting

```typescript
// Split components to minimize re-renders
function TodoApp() {
  return (
    <div>
      <TodoList />      {/* Only re-renders when todos change */}
      <TodoStats />     {/* Only re-renders when stats change */}
      <CreateForm />    {/* Separate component for form state */}
    </div>
  )
}
```

## Common Patterns

### Conditional Rendering

```typescript
function ConditionalComponent() {
  const [{ currentUser }] = useStore(userStore)
  const [{ todos }] = useStore(todoStore)
  
  if (!currentUser) {
    return <LoginForm />
  }
  
  if (Object.keys(todos).length === 0) {
    return <EmptyState />
  }
  
  return <TodoList />
}
```

### Loading States

```typescript
function DataWithLoading() {
  const [{ data, loading, errors }, { fetchData }] = useStore(dataStore)
  
  useEffect(() => {
    fetchData('some-id')
  }, [])
  
  if (loading['some-id']) return <Spinner />
  if (errors['some-id']) return <ErrorMessage error={errors['some-id']} />
  if (data['some-id']) return <DataDisplay data={data['some-id']} />
  
  return <EmptyState />
}
```

### Event Publishing

```typescript
function CustomEventComponent() {
  const publisher = usePublisher()
  
  const handleCustomAction = useCallback(() => {
    publisher({
      type: 'ANALYTICS_EVENT',
      action: 'button_click',
      timestamp: Date.now()
    })
  }, [publisher])
  
  return <button onClick={handleCustomAction}>Track Click</button>
}
```

## TypeScript Integration

### Typed Hooks

```typescript
// Hooks are fully typed based on store definition
type TodoStoreType = typeof todoStore

function TypedComponent() {
  const [values, actions] = useStore(todoStore)
  
  // values is typed as QueryObjValues<TodoStoreType>
  // actions is typed as QueryObjActions<TodoStoreType>
  
  // TypeScript knows the shape of your data
  values.todos    // Record<string, TodoCreated>
  values.active   // Record<string, Todo | undefined>
  
  actions.create  // (title: string) => Promise<...>
  actions.complete // (id: string) => Promise<...>
}
```

## Best Practices

1. **Use QumeProvider at root level** - Wrap your entire app or major sections
2. **Prefer useStore for simplicity** - Use granular hooks only when needed for performance
3. **Memoize expensive computations** - Use useMemo for derived state calculations
4. **Split components appropriately** - Separate concerns to minimize re-renders
5. **Handle loading/error states** - Always account for async operations
6. **Use TypeScript** - Leverage full type safety throughout your application
7. **Test components with provider** - Always wrap test components in QumeProvider
8. **Avoid deep nesting** - Keep store structure flat for better performance


This comprehensive guide covers all aspects of using qume-react for building reactive React applications with Qume's event-driven state management.
