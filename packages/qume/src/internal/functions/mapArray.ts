import { WithState } from "../base"
import { flatMapPack, Pack, setEntryValue } from "../Pack"
import { ETF } from "../etf"
import * as _ from 'lodash'

const MAPPED_ARRAY = 'MAPPED_ARRAY'

export type MappedArray<S, K, R> = { type: typeof MAPPED_ARRAY } & WithState<S, K, R>

export function mapArray<S, K, R, R1>(prev: ETF<S, K, R>, f: (v: R, k: K) => R1[]): MappedArray<S, K, R1> {

  function mapArray0(f: (t: R, k: K) => R1[]): (pack: Pack<K, R>) => Pack<K, R1> {
    return flatMapPack<K, K, R, R1>(entry =>
      entry.deleted
        ? [entry]
        : f(entry.value, entry.key).map(value => setEntryValue(entry, value))
    )
  }

  return {
    type: MAPPED_ARRAY,
    locale: prev.locale,
    keys: prev.keys,
    state: path => prev.state(path).map(mapArray0(f)),
    value: path => keys => prev.value(path)(keys).map(mapArray0(f))
  }
}
