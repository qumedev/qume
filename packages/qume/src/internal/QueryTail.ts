import { ETF } from "./etf"
import { KSingle, QueryObj, HasType } from "./scope"

export type IsString<A> = A extends string ? string : never

export type QuerySelectValue<S extends HasType, I, K, R> = {
  [K0 in keyof R]-?: R[K0] extends any ? QueryTail<S, I, K, R[K0]> : never
}

export type QueryByKey<S extends HasType, I, R> = { [K0 in keyof R]: QueryTail<S, I, R[K0], R> }

export interface QueryTail<S extends HasType, I, K, A> {
  readonly __input: I; // COMPILATION ONLY, NO RUNTIME VALUES
  readonly __key: K; // COMPILATION ONLY, NO RUNTIME VALUES
  readonly __value: A; // COMPILATION ONLY, NO RUNTIME VALUES

  readonly etf: ETF<S, K, A>
  readonly prev: QueryTail<S, any, any, any>[]
  readonly store: QueryObj<S, any> | undefined
  readonly storekey: string | undefined
  readonly isAction: boolean

  /** Select specific fields from the value, creating new query tails for each field */
  readonly select: QuerySelectValue<S, I, K, A>

  /** Group by specific fields from the value, creating new query tails keyed by field values */
  readonly by: QueryByKey<S, I, A>


  /** 
   * Create a new QueryTail with a different ETF
   * @param etf The new ETF to use
   */
  withETF<K, R>(etf: ETF<S, K, R>): QueryTail<S, I, K, R>

  /**
   * Cast the value type to a different type without changing the underlying data
   * @param r The new type to cast to
   * @returns A new QueryTail with the casted value type
   */
  as<R>(r: R): QueryTail<S, I, K, R>

  /**
   * Filter events by type and cast to the corresponding event interface
   * @param asType The event type to filter by
   * @returns A new QueryTail filtered to the specified event type
   */
  astype<V extends S['type'], R extends Extract<S, { type: V }>>(asType: V): QueryTail<S, I, K, R>

  /**
   * Transform each value using the provided function
   * @param f Function that transforms value and key to a new value
   * @returns A new QueryTail with transformed values
   */
  map<R>(f: (v: A, k: K) => R): QueryTail<S, I, K, R>

  /**
   * Transform each value to an array and flatten the results
   * @param f Function that transforms value and key to an array of values
   * @returns A new QueryTail with flattened array results
   */
  mapArray<R>(f: (v: A, k: K) => R[]): QueryTail<S, I, K, R>

  /**
   * Change the key using the provided function
   * @param f Function that generates a new key from value and current key
   * @returns A new QueryTail with the new key type
   */
  byKey<K0>(f: (v: A, k: K) => K0): QueryTail<S, I, K0, A>

  /**
   * Add an additional key component using the provided function
   * @param f Function that generates additional key from value and current key
   * @returns A new QueryTail with the enhanced key
   */
  addKey<K0>(f: (v: A, k: K) => K0): QueryTail<S, I, K0, A>

  /**
   * Select events with keys matching the specified pattern
   * @param keyPattern Pattern to match against keys
   * @returns A new QueryTail filtered by key pattern
   */
  selectKey(keyPattern: string | K | K[]): QueryTail<S, I, KSingle, A>

  /**
   * Select events with keys that start with the specified prefix
   * @param keyPattern Prefix pattern to match against keys
   * @returns A new QueryTail filtered by key prefix
   */
  selectPrefixKey(keyPattern: string | K | K[]): QueryTail<S, I, K, A>

  /**
   * Group events by their 'id' field
   * @returns A new QueryTail keyed by string IDs
   */
  byId(): QueryTail<S, I, string, A>

  /**
   * Filter values using the provided predicate function
   * @param f Predicate function that determines if a value should be included
   * @returns A new QueryTail with filtered values
   */
  filter(f: (v: A, k: K) => boolean): QueryTail<S, I, K, A>

  /**
   * Filter out null and undefined values
   * @returns A new QueryTail with non-null values
   */
  notNull<A>(this: QueryTail<S, I, K, A | undefined>): QueryTail<S, I, K, A>

  /**
   * Flatten array values into individual elements
   * @returns A new QueryTail with flattened array elements
   */
  flatten(this: A extends any[] ? QueryTail<S, I, K, A> : never): QueryTail<S, I, K, A extends (infer U)[] ? U : never>

  /**
   * Make the value type optional (allowing undefined)
   * @returns A new QueryTail with optional value type
   */
  optional(): QueryTail<S, I, K, A | undefined>

  /**
   * Reduce multiple values with the same key into a single value
   * @param f Reducer function that combines two values
   * @returns A new QueryTail with reduced values
   */
  reduce(this: QueryTail<S, I, K, A>, f: (v1: A, v2: A) => A): QueryTail<S, I, K, A>

  /**
   * Fold values using an initial value and accumulator function
   * @param initialValue The initial value for the accumulator
   * @param f Accumulator function that combines current state with new value
   * @returns A new QueryTail with folded values
   */
  fold<R>(initialValue: R, f: (acc: R, value: A) => R): QueryTail<S, I, K, R>

  /**
   * Join this query with another query by key, creating tuples of matching values
   * @param other The other QueryTail to attach with
   * @returns A new QueryTail with tuple values [thisValue, otherValue]
   */
  join<B>(other: QueryTail<S, any, K, B>): QueryTail<S, I, K, [A, B]>

  /**
   * Keep only the latest value for each key
   * @returns A new QueryTail with only the most recent values
   */
  latest(this: QueryTail<S, I, K, A>): QueryTail<S, I, K, A>

  /**
   * Add additional fields to the value
   * @param r Object to merge with the current value
   * @returns A new QueryTail with merged value type
   */
  with<R>(r: R): QueryTail<S, I, K, A & R>

  /**
   * Transform values asynchronously using a Promise-returning function
   * @param f Async function that transforms value and key
   * @returns A new QueryTail with async-transformed values
   */
  evalMap<R>(f: (v: A, k: K) => Promise<R>): QueryTail<S, I, K, R>

  /**
   * Execute a side effect asynchronously without changing the value
   * @param f Async function to execute as side effect
   * @returns A new QueryTail with unchanged values
   */
  evalTap<R>(f: (v: A, k: K) => Promise<R>): QueryTail<S, I, K, A>

  /**
   * Transform values using a random number generator
   * @param f Function that transforms value using a random number
   * @returns A new QueryTail with randomly transformed values
   */
  random<R>(f: (v: A, n: number) => R): QueryTail<S, I, K, R>

  /**
   * Emit values only once per key, ignoring subsequent values
   * @returns A new QueryTail that emits each key only once
   */
  once(): QueryTail<S, I, K, A>

  /**
   * Emit events as internal events that can be consumed by other queries
   * @returns A new QueryTail that emits internal events
   */
  internal<R extends A>(): QueryTail<S, I, K, R>

  /**
   * Emit events as internal events with a specific type
   * @param asType Optional type to assign to internal events
   * @returns A new QueryTail that emits typed internal events
   */
  internal<V extends S['type'], R extends Extract<S, { type: V }>>(asType?: V): QueryTail<S, I, K, R>

  /**
   * Emit events as internal events using a transform function
   * @param asType Function to transform values to internal events
   * @returns A new QueryTail that emits transformed internal events
   */
  internal<R extends HasType>(asType?: (a: A) => R): QueryTail<S, I, K, R>

  /**
   * Emit events as external events that leave the current event system
   * @returns A new QueryTail that emits external events
   */
  external<R extends A>(): QueryTail<S, I, K, R>

  /**
   * Emit events as external events with a specific type
   * @param asType Optional type to assign to external events
   * @returns A new QueryTail that emits typed external events
   */
  external<V extends S['type'], R extends Extract<S, { type: V }>>(asType?: V): QueryTail<S, I, K, R>

  /**
   * Emit events as external events using a transform function
   * @param asType Function to transform values to external events
   * @returns A new QueryTail that emits transformed external events
   */
  external<R extends HasType>(asType?: (a: A) => R): QueryTail<S, I, K, R>

  /**
   * Publish events asynchronously with custom subscription management
   * @param f Function that sets up async publishing with callback management
   * @param clear Optional query to trigger cleanup of subscriptions
   * @returns A new QueryTail that manages async event publishing
   */
  publishAsync<C>(
    f: (r: A) => (cb: (r1: S) => void) => (() => void) | void,
    clear?: QueryTail<S, I, K, C>
  ): QueryTail<S, I, KSingle, void>

  /**
   * Pass through values without any side effects or transformations
   * @returns A new QueryTail with no effects applied
   */
  noEffect(): QueryTail<S, I, K, A>

  /**
   * Log values for debugging purposes
   * @param prefix Optional prefix for log messages
   * @param f Optional function to transform values before logging
   * @returns A new QueryTail with logging side effects
   */
  log(prefix?: string, f?: (v: A) => any): QueryTail<S, I, K, A>

  /**
   * Associate this query with a specific store for persistence
   * @param store The store object to associate with
   * @param storekey The key to use for storage
   * @returns A new QueryTail associated with the store
   */
  inStore(store: QueryObj<S, any>, storekey: string): QueryTail<S, I, K, A>

  /**
   * Trigger a refresh of all stored values in the store
   * @returns A new QueryTail that triggers system-wide refresh
   */
  refreshAll(): QueryTail<S, I, K, A>
}
