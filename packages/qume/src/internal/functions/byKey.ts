import { pathKey, WithState } from "../base"
import { deletedEntry, emptyPack, flatMapPack, mapPack, Pack, PackEntry, setEntryKey } from "../Pack"
import * as _ from "lodash"
import { Context } from "../Context"
import { ETF } from "../etf"

const BY_KEY = 'BY_KEY'

export type ByKey<S, K, R> = { type: typeof BY_KEY } & WithState<S, K, R>

export function byKey<S, K, K0, R>(prev: ETF<S, K, R>, f: (v: R, k: K) => K0): ByKey<S, K0, R> {
  const locale = pathKey(prev.locale, BY_KEY)
  return {
    type: BY_KEY,
    locale: locale,
    state: path => prev.state(path)
      .map(flatMapPack<K, K0, R, R>(entry =>
        entry.deleted
          // the most painful part, deleted value might be transformed multiple times, 
          // we can't identify a new key anymore
          ? emptyPack<K0, R>()
          : [setEntryKey(entry, f(entry.value, entry.key))]
      ))
      .flatTap(Context.writeByKeys<S, K0, R>(pathKey(path, locale))),

    keys: Context.allKeys(locale),
    value: Context.valueByKeys(locale)
  }
}
