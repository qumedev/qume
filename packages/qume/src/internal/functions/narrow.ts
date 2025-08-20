import { StateFunc, WithState } from "../base"
import { emptyPack, singlePack, Pack, flatMapPack, setEntryValue } from "../Pack"
import { ETF } from "../etf"
import { Context } from "../Context"
import * as _ from "lodash"

const NARROW = 'NARROW'
export type Narrow<S, K, R> = { type: typeof NARROW } & WithState<S, K, R>


type NarrowFilter<R, K1 extends keyof R> = Partial<{ [k in K1]: R[k] & PropertyKey }>
// type NarrowValue<R> = Extract<R, NarrowFilter<R>>



export function narrow<
  S,
  K,
  R extends object,
  B extends NarrowFilter<R, keyof R>,
  T extends Extract<R, B>
>(prev: ETF<S, K, R>, filter: B): ETF<S, K, T> {

  return {
    type: NARROW,
    locale: prev.locale,
    state: narrowState(prev, filter),
    keys: Context.emptyKeys(),
    value: Context.emptyValue()
  }
}

function narrowState<
  S,
  K,
  R extends object,
  B extends NarrowFilter<R, keyof R>,
  T extends Extract<R, B>,
>(prev: ETF<S, K, R>, filter: B): StateFunc<S, K, T> {

  return prefixPath => prev.state(prefixPath)
    .map(flatMapPack(entry => {

      const pairs = _.toPairs(filter) as [keyof R, any][]
      const isMatch = _.every(pairs, ([k, v]) => !entry.deleted && entry.value[k] == v)

      return isMatch && !entry.deleted ? [setEntryValue(entry, entry.value as any as T)] : emptyPack()
    }))
}
