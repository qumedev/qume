import { WithState } from "../base"
import { emptyPack, flatMapPack, singlePack, Pack, wrapPack, setEntryDeleted, mapPack } from "../Pack"
import { ETF } from "../etf"

const FILTER = 'FILTER'

export type Filter<S, K, R> = { type: typeof FILTER } & WithState<S, K, R>


export function filter<S, K, A>(prev: ETF<S, K, A>, f: (v: A, k: K) => boolean): Filter<S, K, A> {

  const filter0 = mapPack<K, K, A, A>(entry => !entry.deleted && f(entry.value, entry.key) ? entry : setEntryDeleted(entry))

  return {
    type: FILTER,
    locale: prev.locale,
    state: prefixPath => prev.state(prefixPath).map(filter0),
    keys: prev.keys,
    value: prefixPath => keys => prev.value(prefixPath)(keys).map(filter0)
  }
}

