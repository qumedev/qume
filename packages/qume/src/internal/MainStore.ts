
import * as _ from "lodash"
import { QueryTail } from './QueryTail';
import { QueryObj, HasType, KSingle, ActionInput, ValueOrRecord, InputValue, ValueOptOrRecord, QueryObjActions, QueryObjValues, ActionInputValueFunc } from './scope';
import { EventSource, LoopbackEventSource, StoreExecutor, ListenerFunc, ListenerStoreFunc } from './StoreExecutor'



/**
 * MainStore orchestrates multiple stores, manages event routing between them, and provides the main API 
 * for reading, listening, and executing actions across the entire qume application.
 * 
 * @template S - The union type of all events in the system
 * 
 * @example
 * // Complete application setup
 * const main = new MainStore({
 *   todos: todoStore,
 *   users: userStore
 * })
 * 
 * const todos = await main.readStore(todoStore)
 * const createTodo = main.action(todoStore.create)
 * await createTodo('Buy groceries')
 * 
 * main.listenStore(todoStore, (values) => {
 *   console.log('Store updated:', values)
 * })
 */
export class MainStore<S> {
  private executors: StoreExecutor<any>[];
  private eventSource: EventSource<any>;
  private storeCounter: number = 0;

  /**
   * Creates a new MainStore instance that manages the provided stores.
   * 
   * @param stores - Record of store names to QueryObj store definitions
   */
  constructor(stores: Record<string, QueryObj<any, any>>) {
    this.eventSource = new LoopbackEventSource()
    this.executors = _.map(stores, (store, name) => new StoreExecutor(store, name, this.eventSource));
  }
  allExecutors(): StoreExecutor<any>[] { return this.executors }
  getExecutor<S extends HasType, R>(store: QueryObj<S, R>) {
    let executor = _.find(this.executors, ex => ex.store === store)

    if (!executor) {
      // Dynamically create and register a new executor for this store
      const storeName = `store_${this.storeCounter++}`
      executor = new StoreExecutor(store, storeName, this.eventSource)
      this.executors.push(executor);
    }

    return executor;
  }

  /**
   * Promise that resolves when all async operations across all stores are complete.
   * 
   * @returns Promise that resolves when all stores finish processing
   * 
   * @example
   * // Use in tests to ensure deterministic state
   * await main.action(todoStore.create)('Test todo')
   * await main.inprogress
   * const todos = await main.readStore(todoStore)
   * expect(Object.keys(todos.todos)).toHaveLength(1)
   */
  public get inprogress(): Promise<void> {
    return _.reduce(this.executors, (acc, ex) => acc.then(() => ex.inprogress), Promise.resolve())
  }

  /**
   * Promise that resolves when all async operations in a specific store are complete.
   */
  public storeInprogress(store: QueryObj<any, any>): Promise<void> { return this.getExecutor(store).inprogress }

  /**
   * Publishes an event into the system, which will be processed by all relevant stores.
   * 
   * @param event - The event to publish, must have a 'type' field
   * 
   * @example
   * // Publish events from external sources
   * websocket.on('message', (data) => {
   *   main.publish(JSON.parse(data))
   * })
   */
  public publish(event: any): void { this.eventSource.publish(event) }

  public listenQuery<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>, cb: ListenerFunc<K, A>): void {
    if (!qt.store) throw new Error("QueryTail is not in the store")

    this.getExecutor(qt.store).listenQuery(qt, cb)
  }

  public unlisten<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>, cb: ListenerFunc<K, A>): void {
    if (!qt.store) throw new Error("QueryTail is not in the store")
    this.getExecutor(qt.store).unlisten(cb)
  }

  public readQuery<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>): Promise<ValueOptOrRecord<K, A>> {
    if (!qt.store) throw new Error("QueryTail is not in the store")

    return this.getExecutor(qt.store).readQuery(qt)
  }

  public readKeys<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>): Promise<K[]> {
    if (!qt.store) throw new Error("QueryTail is not in the store")

    return this.getExecutor(qt.store).readKeys(qt)
  }
  /**
   * Reads the current state of all queries in a store as a snapshot.
   * 
   * @param st - The store to read from
   * @returns Promise resolving to object with current values for all store queries
   * 
   * @example
   * // Read current store state
   * const todoData = await main.readStore(todoStore)
   * console.log('All todos:', todoData.todos)
   */
  public readStore<S extends HasType, R>(st: QueryObj<S, R>): Promise<QueryObjValues<R>> {

    return this.getExecutor(st).readStore()
  }

  /**
   * Gets an action function for a specific QueryTail action.
   * 
   * @param qt - The QueryTail representing the action
   * @returns Function that executes the action when called
   * 
   * @example
   * // Get and execute action
   * const createTodo = main.action(todoStore.create)
   * await createTodo('Buy groceries')
   */
  public action<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>): ActionInputValueFunc<QueryTail<S, I, K, A>> {

    if (!qt.store) throw new Error("QueryTail is not in the store")

    return this.getExecutor(qt.store).action(qt)
  }

  /**
   * Gets all action functions for a store as an object.
   * 
   * @param st - The store to get actions from
   * @returns Object containing all action functions from the store
   * 
   * @example
   * // Get and use multiple actions
   * const { create, complete, delete: deleteTodo } = main.actions(todoStore)
   * await create('Buy milk')
   * await complete('todo123')
   */
  public actions<S extends HasType, R>(st: QueryObj<S, R>): QueryObjActions<R> {

    return this.getExecutor(st).actions()
  }

  /**
   * Registers a listener function that will be called whenever the store's state changes.
   * 
   * @param st - The store to listen to
   * @param cb - Callback function that receives updated store values
   * 
   * @example
   * // Listen to store changes
   * main.listenStore(todoStore, (values) => {
   *   console.log('Todos updated:', values.todos)
   * })
   */
  public listenStore<S extends HasType, R>(st: QueryObj<S, R>, cb: ListenerStoreFunc<R>): void {
    this.getExecutor(st).listenStore(cb);
  }

  /**
   * Removes a previously registered store listener.
   * 
   * @param st - The store to stop listening to
   * @param cb - The exact same callback function that was passed to listenStore
   */
  public unlistenStore<S extends HasType, R>(st: QueryObj<S, R>, cb: ListenerStoreFunc<R>): void {
    this.getExecutor(st).unlistenStore(cb);
  }

}

/**
 * Creates and initializes a MainStore instance with the provided stores.
 * This is the recommended way to bootstrap a qume application.
 * 
 * @template T - Type of the stores record
 * @param items - Record of store names to store objects
 * @returns MainStore instance ready for use
 * 
 * @example
 * // Complete application setup with React integration
 * const main = runMain({
 *   todos: todoStore,
 *   users: userStore
 * })
 * 
 * function App() {
 *   return (
 *     <QumeProvider main={main}>
 *       <TodoApp />
 *     </QumeProvider>
 *   )
 * }
 */
export function runMain<T extends Record<string, any>>(items: T) {
  return new MainStore(items as any);
}

