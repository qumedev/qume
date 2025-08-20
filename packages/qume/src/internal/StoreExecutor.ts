
import * as _ from "lodash"
import { QueryTail } from './QueryTail';
import { QueryTailImpl } from './QueryTailImpl';
import { QueryObj, HasType, QueryRecord, KSingle, ActionSymbol, ActionInput, ValueOrRecord, InputValue, ValueOptOrRecord, QueryObjValues, QueryObjActions, ActionInputValueFunc } from './scope';
import { Context, InMemoryStorage, Storage } from './Context';
import { Reader } from './Reader';
import { State } from './State';
import { singlePack, fullPackFromArray, Pack, mergePack } from './Pack';

export type PackSubscriber<S> = (data: { events: S[], noEffect: false }) => void
export type ListenerFunc<K, V> = (value: ValueOptOrRecord<K, V>) => void
export type ListenerStoreFunc<R> = (value: QueryObjValues<R>) => void

export interface EventSource<S extends HasType> {
  publish: (events: S | S[], self?: PackSubscriber<S>) => void,
  subscribe: (subs: PackSubscriber<S>) => void,
}

class StorageListener<A> {

  constructor(
    readonly reader: Reader<Storage, A>,
    readonly storage: Storage,
    readonly handler: (v: A) => void
  ) { }

  public fire(): void {
    this.reader.run(this.storage).then(value => { this.handler(value) })
  }
}

export class LoopbackEventSource<S extends HasType> implements EventSource<S> {

  private _subscribers: PackSubscriber<S>[] = [];

  publish(events: S | S[], self?: PackSubscriber<S>) {
    if (!_.isArray(events)) events = [events]

    _.forEach(
      this._subscribers.filter(s => !self || s != self),
      subs => subs({ events: events as S[], noEffect: false })
    )
  }
  subscribe(subs: PackSubscriber<S>): void {

    this._subscribers = [...this._subscribers, ...[subs]]
  }
}

export class StoreExecutor<S extends HasType> {

  private _store: QueryObj<S, {}>
  private _storeName: string // TODO: probably it is not needed, because we were trying to merge stores in one object
  private _storage: Storage
  private _eventSource: EventSource<S>;
  private _seq: number
  private _current: Record<string, Promise<void>>
  private _storageListeners: Record<string, StorageListener<any>[]> = {}
  private _storeListeners: Map<ListenerStoreFunc<any>, ListenerFunc<any, any>[]> = new Map();

  constructor(
    store: QueryObj<S, {}>,
    storeName: string = "",
    source: EventSource<S> = new LoopbackEventSource(),
    storage: Storage = new InMemoryStorage()
  ) {
    this._store = store
    this._storeName = storeName
    this._storage = storage
    this._eventSource = source
    this._seq = 0
    this._current = _.reduce(store, (acc, _v, k) => ({ ...acc, [k]: Promise.resolve(undefined) }), {})
    this._eventSource.subscribe(this.processForAll)
    // this._storage.listen(() => this.fireStorageListeners())
  }

  public get storage(): Storage { return this._storage }
  // public get context(): Context<S> { return new Context(this._storage) }
  public get store(): QueryObj<S, {}> { return this._store; }

  public get inprogress(): Promise<void> {
    return _.reduce(this._current, (acc, promise) => acc.then(() => promise), Promise.resolve<any>(undefined))
  }

  public publish(event: S): void {
    this.processForAll({ events: [event], noEffect: false })
    this._eventSource.publish(event, this.processForAll)
  }

  public listenQuery<I, K, A>(qt: QueryTail<S, I, K, A>, cb: ListenerFunc<K, A>): void {
    if (!qt.storekey) throw new Error("QueryTail is not in the store")

    const storageListener = new StorageListener(QueryTailImpl.readQuery(qt), this._storage, cb)

    // if we trigger right away, all subs will receive null first
    // user needs to make sure listeners iniated before the first event is processed
    // but when it is impossible to initialize listener before - we have to fire
    storageListener.fire()

    // add to _storageListeners by key collecting as an array
    this._storageListeners[qt.storekey] = [...(this._storageListeners[qt.storekey] || []), storageListener]
  }


  public listenStore<R>(cb: ListenerStoreFunc<R>): void {
    const self = this;
    let currentValues = {} as QueryObjValues<R>;

    // Create listeners for each field that update shared state
    const listeners = _.map(this._store, (qt: QueryTail<S, any, any, any>, key) => {
      const listener: ListenerFunc<any, any> = value => { 
        currentValues = { ...currentValues, [key]: value };
        cb(currentValues);
      }

      self.listenQuery(qt, listener)
      return listener
    })

    this._storeListeners.set(cb, listeners);
  }

  public unlistenStore<R>(cb: ListenerStoreFunc<R>): void {
    const listeners = this._storeListeners.get(cb);
    if (listeners) {
      // Unlisten from all individual query listeners
      listeners.forEach(listener => this.unlisten(listener));
      this._storeListeners.delete(cb);
    }
  }

  public unlisten<A>(cb: (v: A) => void): void {
    // dropping storageListener by handler
    _.forEach(this._storageListeners, (storageListeners, key) => {
      this._storageListeners[key] = _.filter(storageListeners, l => l.handler != cb)
    })
  }

  public readQuery<I, K, A>(qt: QueryTail<S, I, K, A>): Promise<ValueOptOrRecord<K, A>> {
    return QueryTailImpl.readQuery(qt).run(this._storage)
  }

  public readKeys<I, K, A>(qt: QueryTail<S, I, K, A>): Promise<K[]> {
    return QueryTailImpl.readKeys(qt).run(this._storage)
  }

  public action<I, K, A>(qt: QueryTail<S, I, K, A>): ActionInputValueFunc<QueryTail<S, I, K, A>> {
    const func = (...args: any[]) => {
      this._seq = this._seq + 1
      const pack = singlePack<KSingle, S>('', { type: ActionSymbol, value: args } as any as S, this._seq)

      return this.processForOne(qt, pack)
    }

    return func as ActionInputValueFunc<QueryTail<S, I, K, A>>
  }

  public actions<R>(): QueryObjActions<R> {
    const self = this

    return (
      _.chain(this._store)
        .pickBy((qt: QueryTail<S, any, any, any>) => qt.isAction)
        .mapValues((qt: QueryTail<S, any, any, any>) => self.action(qt))
        .value()
    ) as QueryObjActions<R>
  }

  public async readStore<R>(): Promise<QueryObjValues<R>> {
    const self = this

    const readPromises = _.mapValues(this._store,
      (qt: QueryTail<S, any, any, any>) => QueryTailImpl.readQuery(qt).run(self._storage)
    )

    const readResults = await Promise.all(_.values(readPromises))
    return _.zipObject(_.keys(this._store), readResults) as QueryObjValues<R>
  }


  private processForAll: PackSubscriber<S> =
    ({ events, noEffect }) => {
      if (_.isEmpty(events)) return;

      this._seq = this._seq + 1
      const pack = fullPackFromArray<KSingle, S>('', events, this._seq, false, noEffect)

      this._current = _.reduce(this._store, (acc, qt, k) => {
        return { ...acc, [k]: this.processForOne(qt, pack) }
      }, {})
    }


  private async processForOne<I, K, A>(
    qt: QueryTail<S, I, K, A>,
    pack: Pack<KSingle, S>,
  ): Promise<ValueOrRecord<K, A>> {
    if (!qt.storekey) throw new Error("QueryTail is not in the store")
    const storekey = qt.storekey
    const promise = this._current[storekey] || Promise.resolve(undefined)


    await promise;
    const [ctx, respack] = await Context.setInlet<KSingle, S>(pack)
      .asF(QueryTailImpl.exec(qt))
      .run(new Context<S>(this._storage).withOutletAsync(p => { this.publish(p); }))

    const outletInEvents = _.flatMap(ctx.outletIn, v => v.deleted ? [] : [v.value])
    const outletOutEvents = _.flatMap(ctx.outletOut, v => v.deleted ? [] : [v.value])

    const refreshEvents = _.filter(outletInEvents, event => event.type === '_$REFRESH')
    const inEvents = _.filter(outletInEvents, event => event.type !== '_$REFRESH')
    // Process refresh events by clearing storage after current operations complete
    if (!_.isEmpty(refreshEvents)) {
      this._current = _.reduce(this._store, (acc, _qt, k) => {
        return { ...acc, [k]: acc[k].then(() => this._storage.dropValueByPrefix(k)) }
      }, this._current)
    }

    this.processForAll({ events: inEvents, noEffect: false });
    this._eventSource.publish(outletOutEvents, this.processForAll);

    if (respack.length > 0) {
      this.fireStorageListeners(storekey);
    }

    const record = _.chain(respack)
      .flatMap(entry => entry.deleted ? [] : [[entry.key as string, entry.value]])
      .fromPairs()
      .value()

    return (_.isEqual(_.keys(record), ['']) ? record[''] : record) as ValueOrRecord<K, A>;
  }


  private fireStorageListeners(storekey: string): void {
    _.forEach(this._storageListeners[storekey], listener => listener.fire())
  }


}
