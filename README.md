# Qume

A reactive state management library for TypeScript. Transform events into reactive application state.

[qume.dev](https://qume.dev)

> "But I don't want to go among mad people," Alice remarked.
>
> "Oh, you can't help that," said the Cat: "we're all mad here. I'm mad. You're mad."
>
> "How do you know I'm mad?" said Alice.
>
> "You must be," said the Cat, "or you wouldn't have come here."
>
> --Lewis Carroll, "Alice's Adventures in Wonderland"

**Qume** takes a different approach to state management. Instead of actions and reducers, you work with events flowing through reactive queries. Instead of manual subscriptions, your state updates automatically when events occur.



## Installation

```bash
npm install qume qume-react
```

## Quick Start

[→ Getting Started Guide](https://qume.dev/docs/)

Most state management libraries require extensive setup. With Qume, you describe relationships and let the system handle the rest:

```typescript
// Define your events
type TodoEvent = 
  | { type: 'TODO_CREATED', id: string, title: string }
  | { type: 'TODO_COMPLETED', id: string }

const { query, action, store } = scope<TodoEvent>()

// Create your store
const todoStore = store({
  create: action(title => ({ type: 'TODO_CREATED', id: uuid(), title })),
  complete: action(id => ({ type: 'TODO_COMPLETED', id })),
  
  todos: query('TODO_CREATED').by.id,
  active: query('TODO_CREATED')
    .by.id
    .join(query('TODO_COMPLETED').by.id)
    .map(([todo]) => todo)
})

// Use in React
import { runMain } from 'qume'
import { QumeProvider, useStore } from 'qume-react'

const main = runMain({ todos: todoStore })

function TodoApp() {
  const [state, actions] = useStore(todoStore)
  
  return (
    <div>
      {Object.values(state.active).map(todo => (
        <div key={todo.id}>
          {todo.title}
          <button onClick={() => actions.complete(todo.id)}>Done</button>
        </div>
      ))}
      <button onClick={() => actions.create("New todo")}>Add Todo</button>
    </div>
  )
}

function App() {
  return (
    <QumeProvider main={main}>
      <TodoApp />
    </QumeProvider>
  )
}
```

That's it. You have reactive queries that update automatically. Call `actions.create("Learn Qume")` and your UI updates instantly—no manual dispatching or subscription management needed.

## Core Concepts

Qume is built around three simple ideas: **events define what can happen**, **queries transform events into state**, and **everything is automatically reactive**. Events flow through queries that filter, transform, and combine data streams. Your UI subscribes to query results and updates automatically when relevant events occur. Full TypeScript support ensures type safety throughout your entire application state.


## Why Choose Qume

- **No boilerplate**: Define events, write queries, ship features
- **Reactive by default**: Everything updates automatically
- **Type-safe**: Full TypeScript support with inference
- **Composable**: Small stores combine into complex applications
- **Predictable**: Event-driven architecture makes debugging easy
- **Performant**: Lazy evaluation and efficient updates


## License

Apache-2.0

---

*We're all mad here. The question is: are you mad enough to try Qume?*
