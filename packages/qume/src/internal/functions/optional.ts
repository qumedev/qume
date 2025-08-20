import { WithState } from "../base"
import { concatPack, entry, flatMapPack, singlePack, Pack, setEntryValue, mapPack, setEntryDeleted, setEntryNotDeleted } from "../Pack"
import { ETF } from "../etf"
import * as _ from 'lodash'

const OPTIONAL = 'OPTIONAL'

export type Optional<S, K, R> = { type: typeof OPTIONAL } & WithState<S, K, R>

export function optional<S, K, R>(prev: ETF<S, K, R>): Optional<S, K, R | undefined> {
  return {
    type: OPTIONAL,
    locale: prev.locale,
    state: path => prev.state(path).map(mapPack(entry => {
      const value = entry.deleted ? undefined : entry.value

      return setEntryNotDeleted(entry, value)
    })),

    keys: prev.keys,
    value: path => keys => prev.value(path)(keys)
      .map(pack => _.reduce(keys, (acc, key) => {

        const entryPack = _.find(pack, en => en.key == key && !en.deleted)
          || entry(key, undefined, 0, false)

        return concatPack(acc, [entryPack])
      }, [] as Pack<K, R | undefined>))
  }
}
