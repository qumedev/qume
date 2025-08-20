import random from "lodash/random"
import * as _ from "lodash"
import { ETF } from "./etf"
import { State } from "./State"
import { Context, Storage } from "./Context"
import { ASK, ask } from "./functions/ask"
import { map } from "./functions/map"
import { filter } from "./functions/filter"
import { External, EXTERNAL, external } from "./functions/external"
import { byKey } from "./functions/byKey"
import { reduce, fold, once, latest } from "./functions/fold"
import { merge } from "./functions/merge"
import { join as joinETF } from "./functions/join"
import { empty } from "./functions/empty"
import { emptyPack, Pack, PackEntry, singlePack } from "./Pack"
import { Reader } from "./Reader"
import { optional } from "./functions/optional"
import { prefixed } from "./functions/prefixed"
import { ActionInput, KSingle, QueryObj, ValueOptOrRecord, ValueOrRecord } from "./scope"
import { QueryTail, QuerySelectValue, QueryByKey } from "./QueryTail"
import { select } from "./functions/select"
import { flatten } from "./functions/flatten"
import { evalMap, evalTap } from "./functions/evalMap"
import { publishAsync } from "./functions/publishAsync"
import { addKey } from "./functions/addKey"
import { noEffect } from "./functions/noEffect"
import { mapArray } from "./functions/mapArray"
import { Internal, internal } from "./functions/internal"
import { fire } from "./functions/fire"
import { HasId, HasType } from "./scope"
import { selectKey } from "./functions/selectKey"
import { selectPrefixKey } from "./functions/selectPrefixKey"
import { notNull } from "./functions/notNull"
import { never } from "./functions/never"
import { refreshAll } from "./functions/refresh"

function execDeep<S extends HasType, K, A>(etf: ETF<S, K, A>, path: string): State<Context<S>, Pack<K, A>> {

  function go(path: string, pack: Pack<K, A>, toBeProcessed: Pack<K, S>): State<Context<S>, Pack<K, A>> {

    return Context.getOutletIn<K, S>().flatMap(events => {

      if (_.isEmpty(events)) return Context.setOutletIn<K, S>(toBeProcessed).as(pack)
      else
        return State.void<Context<S>>()
          .flatTap(() => Context.setInlet(events))
          .flatTap(() => Context.emptyOutletIn())
          .flatMap(() => etf.state(path).flatMap(pack => go(path, pack, toBeProcessed.concat(events))))
    })
  }

  return etf.state(path).flatMap(pack => go(path, pack, []))

}

export class QueryTailImpl<S extends HasType, I, K, A> implements QueryTail<S, I, K, A> {

  readonly __input: I = undefined as I;
  readonly __key: K = undefined as K;
  readonly __value: A = undefined as A;

  constructor(
    readonly etf: ETF<S, K, A>,
    readonly prev: QueryTail<S, any, any, any>[] = [],
    readonly store: QueryObj<S, any> | undefined = undefined,
    readonly storekey: string | undefined = undefined,
    readonly isAction: boolean = false
  ) { }

  static empty<S extends HasType>(): QueryTail<S, any, any, any> {
    return new QueryTailImpl<S, any, any, any>(empty())
  }

  static never<S extends HasType>(): QueryTail<S, any, any, any> {
    return new QueryTailImpl<S, any, any, any>(never())
  }

  static make<S extends HasType, I, K, A>(
    etf: ETF<S, K, A>,
    prev: QueryTail<S, any, any, any>[] = [],
    store: QueryObj<S, any> | undefined = undefined,
    storekey: string | undefined = undefined,
    isAction: boolean = false
  ): QueryTail<S, I, K, A> {
    return new QueryTailImpl(etf, prev, store, storekey, isAction)
  }

  static guard<S extends HasType, I, K>(arg: any): arg is QueryTail<S, I, K, any> {
    return arg && typeof arg == 'object' && 'etf' in arg
  }

  static exec<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>, path: string = ''): State<Context<S>, Pack<K, A>> {
    return qt.etf.state(path)
  }

  static execDeep<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>, path: string = ''): State<Context<S>, Pack<K, A>> {
    return execDeep(qt.etf, path)
  }

  static readKeys<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>): Reader<Storage, K[]> {
    return Reader.apply<Storage, K[]>(storage =>
      qt.etf.keys('').run(new Context(storage))
    )
  }

  static readPackByKeys<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>): (keys: K[]) => Reader<Storage, Pack<K, A>> {
    return keys => Reader.apply<Storage, Pack<K, A>>(storage =>
      qt.etf.value('')(keys).run(new Context(storage))
    )
  }

  static readAll<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>): Reader<Storage, Pack<K, A>> {
    return QueryTailImpl.readKeys(qt).flatMap(QueryTailImpl.readPackByKeys(qt))
  }

  static readQuery<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>): Reader<Storage, ValueOptOrRecord<K, A>> {
    return QueryTailImpl.readKeys(qt).flatMap(keys => (
      _.isEqual(keys, ['']) || _.isEmpty(keys)
        ? QueryTailImpl.readValue(qt, '' as K).map(v => v as ValueOptOrRecord<K, A>)
        : QueryTailImpl.readRecord(qt, keys)).map(v => v as ValueOptOrRecord<K, A>)
    )
  }

  static readValue<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>, key: K): Reader<Storage, A | undefined> {
    return QueryTailImpl.readPackByKeys(qt)([key])
      .map(pack => _.chain(pack).filter(v => !v.deleted).map(v => v.value).value()[0])
      .map(value => value === null ? undefined : value)
  }

  static readRecord<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>, keys: K[]): Reader<Storage, Record<any, A>> {
    return QueryTailImpl.readPackByKeys(qt)(keys).map(pack =>
      _.chain(pack)
        .flatMap(entry => entry.deleted ? [] : [[entry.key as string, entry.value]])
        .fromPairs()
        .value()
    )
  }

  static readMapAsync<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>, ctx: Context<S>): Promise<Map<K, A>> {
    return QueryTailImpl.readAll(qt)
      .map(pack => _.flatMap<PackEntry<K, A>, [K, A]>(pack, entry => entry.deleted ? [] : [[entry.key, entry.value]]))
      .map(pairs => new Map(pairs))
      .run(ctx.storage)
  }

  static readMapByKeysAsync<S extends HasType, I, K, A>(qt: QueryTail<S, I, K, A>, ctx: Context<S>): (keys: K[]) => Promise<Map<K, A>> {
    return keys => QueryTailImpl
      .readPackByKeys(qt)(keys)
      .map(pack => _.flatMap<PackEntry<K, A>, [K, A]>(pack, entry => entry.deleted ? [] : [[entry.key, entry.value]]))
      .map(pairs => new Map(pairs))
      .run(ctx.storage)
  }

  static async runQuery<S extends HasType, I, K, A>(
    qt: QueryTail<S, I, K, A>,
    inlet: S | S[] | I | I[],
  ): Promise<ValueOptOrRecord<K, A>> {
    const out = await QueryTailImpl.execDeep(qt).runS(Context.empty<S>().withInletEvent(inlet as S))
    return await QueryTailImpl.readQuery(qt).run(out.storage)
  }

  withETF<K, R>(etf: ETF<S, K, R>): QueryTail<S, I, K, R> {
    return new QueryTailImpl(etf, this.prev, this.store, this.storekey, this.isAction)
  }

  get select(): QuerySelectValue<S, I, K, A> {
    const self = this
    return new Proxy<QuerySelectValue<S, I, K, A>>({} as QuerySelectValue<S, I, K, A>, {
      get(_target: QuerySelectValue<S, I, K, A>, path: string) {
        return self.withETF(select(self.etf as ETF<S, K, object>, path as keyof object),)
      }
    })
  }

  get by(): QueryByKey<S, I, A> {
    const self = this
    return new Proxy<QueryByKey<S, I, A>>({} as QueryByKey<S, I, A>, {
      get(_target: QueryByKey<S, I, A>, path: string) {
        return self.withETF(byKey(self.etf as ETF<S, K, object>, (v: any) => path in v ? v[path] : undefined))
      }
    })
  }

  as<R>(r: R): QueryTail<S, I, K, R> {
    return this.withETF(map(this.etf, () => r))
  }

  astype<V extends S['type'], R extends Extract<S, { type: V }>>(asType: V): QueryTail<S, I, K, R> {
    return this.withETF(map(this.etf, v => _.isObject(v) ? ({ ...v, type: asType }) as any as R : ({ type: asType }) as R))
  }

  map<R>(f: (v: A, k: K) => R): QueryTail<S, I, K, R> {
    return this.withETF(map(this.etf, f))
  }

  mapArray<R>(f: (v: A, k: K) => R[]): QueryTail<S, I, K, R> {
    return this.withETF(mapArray(this.etf, f))
  }

  random<R>(f: (v: A, n: number) => R): QueryTail<S, I, K, R> {
    return this.withETF(map(this.etf, v => f(v, random(1, 99999999999))))
  }

  with<R>(r: R): QueryTail<S, I, K, A & R> {
    return this.withETF(map(this.etf, v => ({ ...v, ...r })))
  }

  byKey<K0>(f: (v: A, k: K) => K0): QueryTail<S, I, K0, A> {
    return this.withETF(byKey(this.etf, f))
  }

  addKey<K0>(f: (v: A, k: K) => K0): QueryTail<S, I, K0, A> {
    return this.withETF(addKey(this.etf, f))
  }

  selectKey(keyPattern: string | K | K[]): QueryTail<S, I, KSingle, A> {
    return this.withETF(selectKey(this.etf, keyPattern))
  }
  selectPrefixKey(keyPattern: string | K | K[]): QueryTail<S, I, K, A> {
    return this.withETF(selectPrefixKey(this.etf, keyPattern))
  }

  byId(): QueryTail<S, I, string, A> {
    return this.byKey(v => (v as HasId).id)
  }

  filter(f: (v: A, k: K) => boolean): QueryTail<S, I, K, A> {
    return this.withETF(filter(this.etf, f))
  }

  notNull<A>(this: QueryTail<S, I, K, A | undefined>): QueryTail<S, I, K, A> {
    return this.withETF(notNull(this.etf))
  }

  flatten(this: A extends any[] ? QueryTail<S, I, K, A> : never): QueryTail<S, I, K, A extends (infer U)[] ? U : never> {
    return this.withETF<K, A extends (infer U)[] ? U : never>(flatten(this.etf))
  }

  optional(): QueryTail<S, I, K, A | undefined> {
    return this.withETF(optional(this.etf))
  }

  reduce(this: QueryTail<S, I, K, A>, f: (v1: A, v2: A) => A): QueryTail<S, I, K, A> {
    return this.withETF(reduce(this.etf, f))
  }

  fold<R>(initialValue: R, f: (acc: R, value: A) => R): QueryTail<S, I, K, R> {
    return this.withETF(fold(this.etf, initialValue, f))
  }

  join<B>(other: QueryTail<S, any, K, B>): QueryTail<S, I, K, [A, B]> {
    return this.withETF(map(joinETF({ a: this.etf, b: once(other.etf) }), joined => [joined.a, joined.b] as [A, B]))
  }

  latest(this: QueryTail<S, I, K, A>): QueryTail<S, I, K, A> {
    return this.withETF(latest(this.etf))
  }

  evalMap<R>(f: (v: A, k: K) => Promise<R>): QueryTail<S, I, K, R> {
    return this.withETF(evalMap(this.etf, f))
  }

  evalTap<R>(f: (v: A, k: K) => Promise<R>): QueryTail<S, I, K, A> {
    return this.withETF(evalTap(this.etf, f))
  }

  once(): QueryTail<S, I, K, A> {
    return this.withETF(once(this.etf))
  }

  internal<R extends A>(): QueryTail<S, I, K, R>;
  internal<V extends S['type'], R extends Extract<S, { type: V }>,>(asType?: V): QueryTail<S, I, K, R>;
  internal<R extends HasType>(asType?: (a: A) => R): QueryTail<S, I, K, R>;
  internal<R extends HasType>(asType?: any): QueryTail<S, I, K, R> {
    const isFunction = _.isFunction(asType)
    let asNode: Internal<S, K, R>
    if (isFunction) asNode = internal(map(this.etf, asType)) as any
    else asNode = internal(this.etf, asType) as any

    return this.withETF(asNode)
  }

  external<R extends A>(): QueryTail<S, I, K, R>;
  external<V extends S['type'], R extends Extract<S, { type: V }>,>(asType?: V): QueryTail<S, I, K, R>;
  external<R extends HasType>(asType?: (a: A) => R): QueryTail<S, I, K, R>;
  external<R extends HasType>(asType?: any): QueryTail<S, I, K, R> {
    const isFunction = _.isFunction(asType)
    let asNode: External<S, K, R>
    if (isFunction) asNode = external(map(this.etf, asType)) as any
    else asNode = external(this.etf, asType) as any

    return this.withETF(asNode)
  }

  publishAsync<C>(
    f: (r: A) => (cb: (r1: S) => void) => (() => void) | void,
    clear?: QueryTail<S, I, K, C>
  ): QueryTail<S, I, KSingle, void> {
    return this.withETF<KSingle, void>(publishAsync(this.etf, f, clear?.etf || never<S, K, C>()))
  }

  noEffect(): QueryTail<S, I, K, A> {
    return this.withETF(noEffect(this.etf))
  }

  log(prefix?: string, f: (v: A) => any = v => v): QueryTail<S, I, K, A> {
    return this.withETF(fire(this.etf, v => console.log(prefix, f(v))))
  }

  inStore(store: QueryObj<S, any>, storekey: string): QueryTail<S, I, K, A> {
    return QueryTailImpl.make<S, I, K, A>(
      prefixed(this.etf, storekey),
      this.prev,
      store,
      storekey,
      this.isAction
    )
  }

  refreshAll(): QueryTail<S, I, K, A> {
    return this.withETF<K, A>(refreshAll(this.etf))
  }

}
