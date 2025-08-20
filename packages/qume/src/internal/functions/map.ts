import { WithState } from "../base"
import { mapPack, mapValuePack, Pack, setEntryValue } from "../Pack"
import { ETF } from "../etf"
import * as _ from 'lodash'

const MAPPED = 'MAPPED'

export type Mapped<S, K, R> = { type: typeof MAPPED } & WithState<S, K, R>

export function map<S, K, R, R1>(prev: ETF<S, K, R>, f: (v: R, k: K) => R1): Mapped<S, K, R1> {

  const map0 = mapPack<K, K, R, R1>(entry =>
    entry.deleted ? entry : setEntryValue(entry, f(entry.value, entry.key))
  )

  return {
    type: MAPPED,
    locale: prev.locale,
    keys: prev.keys,
    state: path => prev.state(path).map(map0),
    value: path => keys => prev.value(path)(keys).map(map0)
  }
}
