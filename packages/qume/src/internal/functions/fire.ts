import { WithState } from "../base"
import { mapPack, mapValuePack, Pack } from "../Pack"
import { ETF } from "../etf"
import * as _ from 'lodash'

const FIRE = 'FIRE'

export type Fire<S, K, R> = { type: typeof FIRE } & WithState<S, K, R>

export function fire<S, K, R>(prev: ETF<S, K, R>, f: (v: R, k: K) => void): Fire<S, K, R> {

  const fire0 = mapPack<K, K, R, R>(
    entry => {
      if (!entry.deleted && !entry.noEffect)
        f(entry.value, entry.key)

      return entry
    }
  )

  return {
    type: FIRE,
    locale: prev.locale,
    keys: prev.keys,
    state: path => prev.state(path).map(fire0),
    value: prev.value
  }
}
