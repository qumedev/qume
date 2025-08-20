import { pathKey, WithState } from "../base"
import { emptyPack, flatMapPack, mapKeyPack, Pack, setEntryKey } from "../Pack"
import * as _ from "lodash"
import { Context } from "../Context"
import { ETF } from "../etf"

const ADD_KEY = 'ADD_KEY'

export type AddKey<S, K, R> = { type: typeof ADD_KEY } & WithState<S, K, R>

// TODO make it stateless
export function addKey<S, K, K0, R>(prev: ETF<S, K, R>, f: (v: R, k: K) => K0): AddKey<S, K0, R> {
  const locale = pathKey(prev.locale, ADD_KEY)
  return {
    type: ADD_KEY,
    locale: locale,

    state: path => prev.state(path)
      .map(flatMapPack<K, K0, R, R>(entry =>
        entry.deleted
          ? emptyPack<K0, R>()
          : [setEntryKey(entry, pathKey(entry.key, f(entry.value, entry.key)))]
      ))
      .flatTap(Context.writeByKeys<S, K0, R>(pathKey(path, locale))),

    keys: Context.allKeys(locale),
    value: Context.valueByKeys(locale)

  }
}
