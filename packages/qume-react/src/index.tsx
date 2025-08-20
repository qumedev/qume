import React, { useContext, useState, createContext, useEffect, useCallback, useMemo } from 'react'
import { HasType, InputValue, QueryObj, QueryTail, QueryObjActions, ValueOptOrRecord, ValueOrRecord, QueryObjValues } from 'qume';
import { MainStore } from 'qume';




// export class WebsocketEventSource {
//
//   public static make<S>(url: string): EventSource<S> {
//
//     // Initialize WebSocket with buffering and 1s reconnection delay
//     const ws = new WebsocketBuilder(url)
//       .withBuffer(new ArrayQueue())           // buffer messages when disconnected
//       .withBackoff(new ConstantBackoff(1000)) // retry every 1s
//       .build();
//
//     // Add event listeners
//     ws.addEventListener(WebsocketEvent.open, () => console.log("opened!"));
//     ws.addEventListener(WebsocketEvent.close, () => console.log("closed!"));
//
//     return {
//       publish: (event: S) => ws.send(JSON.stringify(event)),
//       subscribe: (cb) => ws.addEventListener(
//         WebsocketEvent.message,
//         (_i: Websocket, ev: MessageEvent) => { cb(JSON.parse(ev.data)) }
//       ),
//     }
//   }
// }



/**
 * Type definition for the Qume React context.
 * @template S - The union type of all events in your system
 */
export type QumeContextType<S extends HasType> = {
  main: MainStore<S>,
};

const QumeContext = createContext<QumeContextType<any>>({
  main: new MainStore({}),
})

/**
 * React context provider that makes a Qume MainStore available to all child components.
 * 
 * @param props.main - The MainStore instance to provide to child components
 * @param props.children - React child components that will have access to the store
 * 
 * @example
 * // Setup at app root
 * const main = runMain({ todos: todoStore, users: userStore })
 * 
 * function App() {
 *   return (
 *     <QumeProvider main={main}>
 *       <TodoList />
 *       <UserProfile />
 *     </QumeProvider>
 *   )
 * }
 */
export const QumeProvider: React.FC<{
  main: MainStore<any>,
  children: React.ReactNode
}> = ({ main, children }) => {

  return (
    <QumeContext.Provider value={{ main }}>
      {children}
    </QumeContext.Provider>
  )
}


/**
 * Primary React hook for accessing both state values and actions from a qume store.
 * Returns a tuple with [values, actions] similar to useState but for entire stores.
 * 
 * @template R - The store type
 * @param st - The store object to connect to
 * @returns Tuple containing [storeValues, storeActions]
 * 
 * @example
 * // Complete todo app with real-time updates
 * function TodoApp() {
 *   const [{ todos, activeTodos, loading }, { create, complete, fetchTodos }] = useStore(todoStore)
 *   
 *   useEffect(() => { fetchTodos() }, [])
 *   
 *   if (loading.todos) return <div>Loading...</div>
 *   
 *   return (
 *     <div>
 *       <button onClick={() => create(prompt('Todo title:'))}>Add Todo</button>
 *       {Object.values(activeTodos).map(todo => (
 *         <div key={todo.id}>
 *           <span>{todo.title}</span>
 *           <button onClick={() => complete(todo.id)}>Complete</button>
 *         </div>
 *       ))}
 *     </div>
 *   )
 * }
 */
export function useStore<R>(
  st: R
): [QueryObjValues<R>, QueryObjActions<R>] {
  const values = useStoreValues(st);
  const actions = useStoreActions(st);

  return useMemo(() => [values, actions], [values, actions]);
}

/**
 * React hook that provides access to only the action functions from a qume store.
 * Use this when you only need to trigger actions and don't need to read state values.
 * 
 * @template S - The event type
 * @template R - The store type
 * @param st - The store object to get actions from
 * @returns Object containing all action functions from the store
 * 
 * @example
 * // Form component that only needs actions
 * function TodoForm() {
 *   const [title, setTitle] = useState('')
 *   const { create } = useStoreActions(todoStore)
 *   
 *   const handleSubmit = async (e) => {
 *     e.preventDefault()
 *     if (title.trim()) {
 *       await create(title.trim())
 *       setTitle('')
 *     }
 *   }
 *   
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input value={title} onChange={(e) => setTitle(e.target.value)} />
 *       <button type="submit">Add</button>
 *     </form>
 *   )
 * }
 */
export function useStoreActions<S extends HasType, R>(
  st: R
): QueryObjActions<R> {
  const ctx = useContext(QumeContext)

  return useMemo(() => ctx.main.actions(st as QueryObj<S, R>), [st]);
}

/**
 * React hook that provides access to only the state values from a qume store.
 * Use this when you only need to read data and don't need action functions.
 * 
 * @template S - The event type
 * @template R - The store type
 * @param st - The store object to read values from
 * @returns Object containing all current values from store queries
 * 
 * @example
 * // Read-only stats component
 * function TodoStats() {
 *   const { todos, activeTodos, completedTodos } = useStoreValues(todoStore)
 *   
 *   const totalCount = Object.keys(todos).length
 *   const activeCount = Object.keys(activeTodos).length
 *   const progress = totalCount > 0 ? Math.round((Object.keys(completedTodos).length / totalCount) * 100) : 0
 *   
 *   return (
 *     <div>
 *       <div>Total: {totalCount}</div>
 *       <div>Active: {activeCount}</div>
 *       <div>Progress: {progress}%</div>
 *     </div>
 *   )
 * }
 */
export function useStoreValues<S extends HasType, R>(
  st: R
): QueryObjValues<R> {
  const ctx = useContext(QumeContext)
  const [value, setValue] = useState<QueryObjValues<R>>({} as QueryObjValues<R>)

  useEffect(() => {
    ctx.main.listenStore(st as QueryObj<S, R>, setValue)

    return function () {
      ctx.main.unlistenStore(st as QueryObj<S, R>, setValue)
    }
  }, [])

  return value
}


/**
 * React hook for subscribing to a specific QueryTail rather than an entire store.
 * Use this for fine-grained subscriptions when you only need data from a single query.
 * 
 * @template S - The event type
 * @template I - The input type
 * @template K - The key type
 * @template A - The value type
 * @param qt - The QueryTail to subscribe to
 * @returns The current value(s) from the query, or undefined if no data
 * 
 * @example
 * // Subscribe to filtered urgent todos
 * function UrgentTodoCount() {
 *   const urgentTodos = useQuery(
 *     todoStore.todos.filter(todo => todo.priority === 'urgent')
 *   )
 *   
 *   const count = Object.keys(urgentTodos || {}).length
 *   
 *   return (
 *     <div>
 *       {count > 0 && <span className="badge">🚨 {count} urgent</span>}
 *     </div>
 *   )
 * }
 */
export function useQuery<S extends HasType, I, K, A>(
  qt: QueryTail<S, I, K, A>
): ValueOptOrRecord<K, A> | undefined {
  const ctx = useContext(QumeContext)
  const [value, setValue] = useState<ValueOptOrRecord<K, A> | undefined>(undefined)

  useEffect(() => {
    ctx.main.listenQuery(qt, setValue)

    return function () {
      ctx.main.unlisten(qt, setValue)
    }
  }, [])

  return value
}

/**
 * React hook for getting a single action function from a QueryTail.
 * Use this when you need a specific action but don't want to subscribe to store state.
 * 
 * @template S - The event type
 * @template I - The input type
 * @template K - The key type
 * @template R - The return type
 * @param qt - The QueryTail representing the action
 * @returns Function that executes the action when called
 * 
 * @example
 * // Action with async handling
 * function SaveTodoButton({ todo }) {
 *   const [saving, setSaving] = useState(false)
 *   const saveTodo = useAction(todoStore.save)
 *   
 *   const handleSave = async () => {
 *     setSaving(true)
 *     try {
 *       await saveTodo(todo)
 *       toast.success('Todo saved!')
 *     } catch (error) {
 *       toast.error('Failed to save')
 *     } finally {
 *       setSaving(false)
 *     }
 *   }
 *   
 *   return (
 *     <button onClick={handleSave} disabled={saving}>
 *       {saving ? 'Saving...' : 'Save'}
 *     </button>
 *   )
 * }
 */
export function useAction<S extends HasType, I, K, R>(
  qt: QueryTail<S, I, K, R>
): (value?: InputValue<I>) => Promise<ValueOrRecord<K, R>> {
  const ctx = useContext(QumeContext)
  return useCallback((value?: InputValue<I>) => {
    return ctx.main.action(qt)(value as any)
  }, [ctx.main, qt])
}

/**
 * React hook for getting direct access to the event publisher function.
 * Use this when you need to publish events that aren't tied to store actions.
 * 
 * @template S - The event union type
 * @returns Function that publishes events into the qume system
 * 
 * @example
 * // Bridge external WebSocket events into qume
 * function WebSocketBridge() {
 *   const publish = usePublisher()
 *   
 *   useEffect(() => {
 *     const socket = new WebSocket('ws://localhost:8080')
 *     
 *     socket.onmessage = (event) => {
 *       const data = JSON.parse(event.data)
 *       publish(data) // Forward WebSocket events to qume
 *     }
 *     
 *     socket.onopen = () => publish({ type: 'WEBSOCKET_CONNECTED' })
 *     socket.onclose = () => publish({ type: 'WEBSOCKET_DISCONNECTED' })
 *     
 *     return () => socket.close()
 *   }, [publish])
 *   
 *   return null
 * }
 */
export function usePublisher<S extends HasType>(): (event: S) => void {
  const ctx = useContext(QumeContext)
  return useCallback<(event: S) => void>(event => {
    ctx.main.publish(event)
  }, [ctx.main])
}

