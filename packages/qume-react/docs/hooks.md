# Qume React Hooks

## useStore

The primary hook for connecting React components to qume stores.

### Usage

```typescript
import { useStore } from 'qume-react'
import { myStore } from './store'

const Component = () => {
  const [storeValues, actions] = useStore(myStore)
  
  // Access reactive state
  const items = storeValues.items || {}
  const activeItems = storeValues.active || {}
  
  // Dispatch actions
  const handleCreate = async () => {
    await actions.create('New item')
  }
  
  return <div>...</div>
}
```

### Return Value

`useStore` returns a tuple `[storeValues, actions]`:

- **storeValues**: Object containing all queries from your store
- **actions**: Object containing all actions from your store

### Important Notes

1. **Always provide fallbacks**: Store queries may be `undefined` during initialization
   ```typescript
   const items = storeValues.items || {}
   ```

2. **Actions are async**: Always use `await` when calling actions
   ```typescript
   await actions.create(data)
   ```

3. **Reactive updates**: Components re-render when store state changes

## QumeProvider

Provides qume store context to React components.

### Usage

```typescript
import { runMain } from 'qume'
import { QumeProvider } from 'qume-react'

const mainStore = runMain({ myStore })

const App = () => (
  <QumeProvider main={mainStore}>
    <MyComponents />
  </QumeProvider>
)
```

### Props

- **main**: Main store created with `runMain()`

## Common Patterns

### Multiple Stores

```typescript
const mainStore = runMain({ 
  todos: todoStore,
  users: userStore,
  app: appStore
})

// In components
const [todoValues, todoActions] = useStore(todoStore)
const [userValues, userActions] = useStore(userStore)
```

### Conditional Rendering

```typescript
const Component = () => {
  const [storeValues] = useStore(myStore)
  
  // Handle loading state
  if (!storeValues.items) {
    return <div>Loading...</div>
  }
  
  const itemsArray = Object.values(storeValues.items)
  
  return (
    <div>
      {itemsArray.map(item => <Item key={item.id} item={item} />)}
    </div>
  )
}
```