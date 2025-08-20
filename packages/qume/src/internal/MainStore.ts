
import * as _ from "lodash"
import { QueryTail } from './QueryTail';
import { QueryObj, HasType, KSingle, ActionInput, ValueOrRecord, InputValue, ValueOptOrRecord, QueryObjActions, QueryObjValues, ActionInputValueFunc } from './scope';
import { EventSource, LoopbackEventSource, StoreExecutor, ListenerFunc, ListenerStoreFunc } from './StoreExecutor'



export class MainStore<S> {
  private executors: StoreExecutor<any>[];
  private eventSource: EventSource<any>;
  private storeCounter: number = 0;

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

  public get inprogress(): Promise<void> {
    return _.reduce(this.executors, (acc, ex) => acc.then(() => ex.inprogress), Promise.resolve())
  }
  public storeInprogress(store: QueryObj<any, any>): Promise<void> { return this.getExecutor(store).inprogress }
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
  public readStore<S extends HasType, R>(st: QueryObj<S, R>): Promise<QueryObjValues<R>> {

    return this.getExecutor(st).readStore()
  }

  public action<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>): ActionInputValueFunc<QueryTail<S, I, K, A>> {

    if (!qt.store) throw new Error("QueryTail is not in the store")

    return this.getExecutor(qt.store).action(qt)
  }

  public actions<S extends HasType, R>(st: QueryObj<S, R>): QueryObjActions<R> {

    return this.getExecutor(st).actions()
  }

  public listenStore<S extends HasType, R>(st: QueryObj<S, R>, cb: ListenerStoreFunc<R>): void {
    this.getExecutor(st).listenStore(cb);
  }

  public unlistenStore<S extends HasType, R>(st: QueryObj<S, R>, cb: ListenerStoreFunc<R>): void {
    this.getExecutor(st).unlistenStore(cb);
  }

}

export function runMain<T extends Record<string, any>>(items: T) {
  return new MainStore(items as any);
}

