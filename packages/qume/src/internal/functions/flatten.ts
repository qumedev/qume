import { WithState } from "../base"
import { concatPack, emptyPack, flatMapPack, singlePack, Pack, setEntryValue } from "../Pack"
import { ETF } from "../etf"
import * as _ from 'lodash'

const FLATTEN = 'FLATTEN'

export type Flatten<S, K, R> = { type: typeof FLATTEN } & WithState<S, K, R>

export function flatten<S, K, A>(prev: ETF<S, K, A[]>): Flatten<S, K, A> {

  const flatten0 = flatMapPack<K, K, A[], A>(
    entry => _.reduce(entry.value, (acc, v) => concatPack(acc, [setEntryValue(entry, v)]), emptyPack<K, A>())
  )

  return {
    type: FLATTEN,
    locale: prev.locale,
    state: prefixPath => prev.state(prefixPath).map(flatten0),
    keys: prev.keys,
    value: prefixPath => keys => prev.value(prefixPath)(keys).map(flatten0)
  }
}
