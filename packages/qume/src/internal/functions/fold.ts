import { Path, pathKey, WithState } from "../base"
import { ETF } from "../etf"
import { emptyPack, flattenPack, singlePack, Pack, wrapPack, setEntryValue } from "../Pack"
import { State } from "../State"
import { Context } from "../Context"
import * as _ from 'lodash'

const FOLD = 'FOLD'
const REDUCE = 'REDUCE'
const ONCE = 'ONCE'
const LATEST = 'LATEST'

export type Reduce<S, K, R> = { type: typeof REDUCE } & WithState<S, K, R>
export type Fold<S, K, A, R> = { type: typeof FOLD } & WithState<S, K, R>
export type Once<S, K, R> = { type: typeof ONCE } & WithState<S, K, R>
export type Latest<S, K, R> = { type: typeof LATEST } & WithState<S, K, R>

export function fold<S, K, A, R>(prev: ETF<S, K, A>, initialValue: R, f: (acc: R, value: A) => R): Fold<S, K, A, R> {
  const locale = pathKey(prev.locale, FOLD)
  return {
    type: FOLD,
    locale: locale,
    state: path => prev.state(path).flatMap(state0(pathKey(path, locale),
      (existing, newValue) => existing !== undefined ? f(existing, newValue) : f(initialValue, newValue)
    )),
    keys: Context.allKeys(locale),
    value: Context.valueByKeys(locale)
  }
}

export function reduce<S, K, R>(prev: ETF<S, K, R>, f: (v1: R, v2: R) => R): Reduce<S, K, R> {
  const locale = pathKey(prev.locale, REDUCE)
  return {
    type: REDUCE,
    locale: locale,
    state: path => prev.state(path).flatMap(state0(pathKey(path, locale),
      (existing, newValue) => existing !== undefined ? f(existing, newValue) : newValue
    )),
    keys: Context.allKeys(locale),
    value: Context.valueByKeys(locale)
  }
}

export function once<S, K, R>(prev: ETF<S, K, R>): Once<S, K, R> {
  const locale = pathKey(prev.locale, ONCE)
  return {
    type: ONCE,
    locale: locale,
    state: path => prev.state(path).flatMap(state0(pathKey(path, locale),
      (existing, newValue) => existing !== undefined ? 'skip' : newValue
    )),
    keys: Context.allKeys(locale),
    value: Context.valueByKeys(locale)
  }
}

export function latest<S, K, R>(prev: ETF<S, K, R>): Latest<S, K, R> {
  const locale = pathKey(prev.locale, LATEST)
  return {
    type: LATEST,
    locale: locale,
    state: path => prev.state(path).flatMap(state0(pathKey(path, locale),
      (_existing, newValue) => newValue
    )),
    keys: Context.allKeys(locale),
    value: Context.valueByKeys(locale)
  }
}

function state0<S, K, A, R>(path: Path, handler: (existing: R | undefined, newValue: A) => R | 'skip'):
  (pack: Pack<K, A>) => State<Context<S>, Pack<K, R>> {
  return pack =>
    State.traverseArr(pack, entry => {

      const key: string = pathKey(path, entry.key as string)

      if (entry.deleted) return Context.delete<S>(key).as(emptyPack<K, R>())

      return Context
        .readOpt<S, R>(key)
        .flatMap(existing => {
          const result = handler(existing?.value, entry.value)

          return result === 'skip'
            ? State.pure<Context<S>, Pack<K, R>>(emptyPack<K, R>())
            : Context.storeValue<S, R>(key, result, entry.seqId)
              .as(wrapPack(setEntryValue(entry, result)))
        })

    }).map(flattenPack)
}


