import { Path, Offset, ValueFunc, KeysFunc, pathKey } from "./base"
import { State } from "./State"

import * as _ from "lodash"
import { concatPack, emptyPack, entry, flattenPack, foldPack, singlePack, Pack } from "./Pack"
import { Reader } from "./Reader"
import { KSingle } from "./scope"

export type ReadExecution<K> = { type: 'READ', key: K }
export type ProcessExecution<S> = { type: 'PROCESS', event: S }

export type Execution<S, K> = ReadExecution<K> | ProcessExecution<S>
export function isRead<S, K>(execution: Execution<S, K>): execution is ReadExecution<K> { return execution.type == 'READ' }
export function isProcess<S, K>(execution: Execution<S, K>): execution is ProcessExecution<S> { return execution.type == 'PROCESS' }

// function toRead<S>(): Execution<S> { return { type: 'READ' } }
// function toProcess<S>(event: S): Execution<S> { return { type: 'PROCESS', event } }


export interface Storage {

  listen(cb: (values: Record<string, any>) => void): void
  unlisten(cb: (values: Record<string, any>) => void): void
  // sepIdByType(type: string): Promise<number>
  // readOffsets(): Promise<Record<string, number>>
  readMeta(): Promise<Record<Path, number>>
  readValues(): Promise<Record<Path, any>>
  readValue(path: Path): Promise<{ value: any, seqId: number } | undefined>

  // storeOffsets(offsets: Record<string, number>): Promise<void>
  storeValue(key: Path, value: any, seqId: number): Promise<void>
  dropValue(key: Path): Promise<void>
  dropValueByPrefix(prefix: Path): Promise<void>
  clearAll(): Promise<void>

}

export class InMemoryStorage implements Storage {
  private _map: Record<Path, { value: any, seqId: number }> = {}

  listen(_cb: (values: Record<string, any>) => void) { }
  unlisten(_cb: (values: Record<string, any>) => void) { }

  readMeta(): Promise<Record<Path, number>> {
    return Promise.resolve(_.mapValues(this._map, v => v.seqId))
  }
  readValues(): Promise<Record<Path, any>> {
    return Promise.resolve(_.mapValues(this._map, v => v.value))
  }
  readValue(key: Path): Promise<{ value: any, seqId: number } | undefined> {
    return Promise.resolve(this._map[key])
  }

  storeValue(key: Path, value: any, seqId: number): Promise<void> {
    return new Promise(resolve => {
      this._map = { ...this._map, ...{ [key]: { value, seqId } } }
      resolve()
    })
  }
  dropValue(key: Path): Promise<void> {
    return new Promise(resolve => {
      this._map = _.omit(this._map, key)
      resolve()
    })
  }
  dropValueByPrefix(prefix: Path): Promise<void> {
    return new Promise(resolve => {
      const keysToRemove = _.keys(this._map).filter(key => key.startsWith(prefix))
      this._map = _.omit(this._map, keysToRemove)
      resolve()
    })
  }
  clearAll(): Promise<void> {
    return new Promise(resolve => {
      this._map = {}
      resolve()
    })
  }
}

export class Context<S> {

  constructor(
    readonly storage: Storage = new InMemoryStorage(),
    readonly inlet: Pack<any, S> = [],
    readonly outletIn: Pack<any, S> = [],
    readonly outletOut: Pack<any, S> = [],
    readonly outletAsync: ((s: S) => void) = () => {
      throw new Error("Function is not implemented")
    },
  ) { }

  withStorage(storage: Storage): Context<S> {
    return new Context<S>(storage, this.inlet, this.outletIn, this.outletOut, this.outletAsync)
  }
  withInlet(pack: Pack<any, S>): Context<S> {
    return new Context<S>(this.storage, pack, this.outletIn, this.outletOut, this.outletAsync)
  }
  withInletEvent(inlet: S | S[]): Context<S> {
    if (!_.isArray(inlet)) inlet = [inlet]
    const pack = inlet.map(v => entry<KSingle, S>('', v, 0, false))
    return new Context<S>(this.storage, pack, this.outletIn, this.outletOut, this.outletAsync)
  }
  withOutletIn(pack: Pack<any, S>): Context<S> {
    return new Context<S>(this.storage, this.inlet, pack, this.outletOut, this.outletAsync)
  }
  withOutletOut(pack: Pack<any, S>): Context<S> {
    return new Context<S>(this.storage, this.inlet, this.outletIn, pack, this.outletAsync)
  }
  withOutletAsync(cb: ((s: S) => void)): Context<S> {
    return new Context<S>(this.storage, this.inlet, this.outletIn, this.outletOut, cb)
  }

  static make<S>(storage: Storage): Context<S> {
    return new Context<S>(storage)
  }

  static empty<S>(): Context<S> {
    return new Context<S>(new InMemoryStorage())
  }

  static read<S, V>(path: Path, orEmpty: { value: V, seqId: number }): State<Context<S>, { value: V, seqId: number }> {
    return State.inspectF(s => s.storage.readValue(path).then(v => v || orEmpty))
  }
  static readOpt<S, V>(path: Path): State<Context<S>, { value: V, seqId: number } | undefined> {
    return State.inspectF(s => s.storage.readValue(path))
  }
  static storeValue<S, V>(path: Path, v: V, seqId: number): State<Context<S>, void> {
    return State.inspectF(s => s.storage.storeValue(path, v, seqId))
  }
  static delete<S>(path: Path): State<Context<S>, void> {
    return State.inspectF(s => s.storage.dropValue(path))
  }
  static clearStorage<S>(): State<Context<S>, void> {
    return State.inspectF(s => s.storage.clearAll())
  }
  static getInlet<K, S>(): State<Context<S>, Pack<K, S>> {
    return State.inspect(st => st.inlet)
  }
  static setInlet<K, S>(inlet: Pack<K, S>): State<Context<S>, void> {
    return State.modify<Context<S>>(st => st.withInlet(inlet))
  }
  static getOutletIn<K, S>(): State<Context<S>, Pack<K, S>> {
    return State.inspect(st => st.outletIn)
  }
  static getOutletOut<K, S>(): State<Context<S>, Pack<K, S>> {
    return State.inspect(st => st.outletOut)
  }
  static emptyOutletIn<S>(): State<Context<S>, void> {
    return State.modify<Context<S>>(st => st.withOutletIn([]))
  }
  static setOutletIn<K, S>(outlet: Pack<K, S>): State<Context<S>, void> {
    return State.modify<Context<S>>(st => st.withOutletIn(outlet))
  }
  static setOutletOut<K, S>(outlet: Pack<K, S>): State<Context<S>, void> {
    return State.modify<Context<S>>(st => st.withOutletOut(outlet))
  }
  static addOutletIn<K, S>(outlet: Pack<K, S>): State<Context<S>, void> {
    return State.modify(ctx => ctx.withOutletIn(ctx.outletIn.concat(outlet)))
  }
  static addOutletOut<K, S>(outlet: Pack<K, S>): State<Context<S>, void> {
    return State.modify(ctx => ctx.withOutletOut(ctx.outletOut.concat(outlet)))
  }
  static getOutletAsync<S>(): State<Context<S>, (s: S) => void> {
    return State.inspect(st => st.outletAsync)
  }

  static writeByKeys<S, K, V>(path: Path): (pack: Pack<K, V>) => State<Context<S>, void> {
    return foldPack<K, V, State<Context<S>, void>>(
      State.void(),
      (acc, entry) => {

        const key = _.isArray(entry.key) ? entry.key.join('.') : entry.key as string
        const pathkey: string = pathKey(path, key)

        if (entry.deleted) return acc.asF(Context.delete(pathkey))
        else return acc.asF(Context.storeValue(pathkey, entry.value, entry.seqId))
      }
    )
  }

  static emptyValue<S, K, R>(): ValueFunc<S, K, R> {
    return () => () => Reader.func(() => emptyPack<K, R>())
  }

  static valueByKeys<S, K, V>(locale: string = ''): ValueFunc<S, K, V> {
    return path => keys => {
      path = pathKey(path, locale)

      const readF = _.reduce(
        keys,
        (acc, k) => acc.flatMap(pack => {

          return Context.readOpt<S, V>(pathKey(path, k as string))
            .map(r => r ? concatPack(pack, singlePack(k, r.value, r.seqId)) : pack)
        }),
        State.pure<Context<S>, Pack<K, V>>(emptyPack())
      ).runA
      return Reader.apply(readF)
    }
  }

  static emptyKeys<S, K>(): KeysFunc<S, K> {
    return () => Reader.func(() => ['' as K])
  }

  static allKeys<S, K>(locale: string = ''): KeysFunc<S, K> {
    return path => {
      path = pathKey(path, locale)

      const regexp = path == ''
        ? new RegExp(`(.*)$`, 'g')
        : new RegExp(`^${path}\.(.*)$`, 'g')

      const readF = State.inspectF((st: Context<S>) => st.storage.readValues()).map(values =>
        _.chain(values)
          .map<string[]>((_v, k) => Array.from(k.matchAll(regexp), p => p[1]))
          .map(k => (_.head(k) || '') as K)
          .uniq()
          .value()
      ).runA

      return Reader.apply(readF)
    }
  }


}
