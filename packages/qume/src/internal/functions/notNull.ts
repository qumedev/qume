
import { WithState } from "../base"
import { emptyPack, flatMapPack, singlePack, Pack, wrapPack, setEntryDeleted, mapPack, PackEntry } from "../Pack"
import { ETF } from "../etf"
import _ from "lodash"

const NOT_NULL = 'NOT_NULL'

export type NotNull<S, K, R> = { type: typeof NOT_NULL } & WithState<S, K, R>


export function notNull<S, K, A>(prev: ETF<S, K, A>): NotNull<S, K, NonNullable<A>> {

  const filter0 = mapPack<K, K, A, NonNullable<A>>(entry => (
    entry.deleted || _.isUndefined(entry.value) || _.isNull(entry.value)
      ? setEntryDeleted<K, A>(entry) : entry
  ) as PackEntry<K, NonNullable<A>>)

  return {
    type: NOT_NULL,
    locale: prev.locale,
    state: prefixPath => prev.state(prefixPath).map(filter0),
    keys: prev.keys,
    value: prefixPath => keys => prev.value(prefixPath)(keys).map(filter0)
  }
}

