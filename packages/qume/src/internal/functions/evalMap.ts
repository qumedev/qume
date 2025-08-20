import { pathKey, WithState } from "../base"
import { foldPack, emptyPack, singlePack, Pack, concatPack, setEntryValue } from "../Pack"
import { Context } from "../Context"
import { ETF } from "../etf"
import * as _ from 'lodash'

const EVAL_MAP = 'EVAL_MAP'

export type EvalMap<S, K, R> = { type: typeof EVAL_MAP } & WithState<S, K, R>

export function evalTap<S, K, R, R1>(prev: ETF<S, K, R>, f: (v: R, k: K) => Promise<R1>): EvalMap<S, K, R> {
  return evalMap(prev, async (v, k) => f(v, k).then(() => v))
}

export function evalMap<S, K, R, R1>(prev: ETF<S, K, R>, f: (v: R, k: K) => Promise<R1>): EvalMap<S, K, R1> {

  const locale = pathKey(prev.locale, EVAL_MAP)
  return {
    type: EVAL_MAP,
    locale: locale,
    state: path =>
      prev.state(path).evalMap(
        foldPack<K, R, Promise<Pack<K, R1>>>(Promise.resolve(emptyPack<K, R1>()),
          async (acc, entry) => {
            if (entry.noEffect)
              return acc
            else if (entry.deleted) {
              const accPack = await acc
              return concatPack(accPack, [entry])
            }
            else {
              const accPack = await acc
              const value = await f(entry.value, entry.key)
              return concatPack(accPack, [setEntryValue(entry, value)])
            }
          })
      ).flatTap(Context.writeByKeys<S, K, R1>(pathKey(path, locale))),

    keys: Context.allKeys(locale),
    value: Context.valueByKeys(locale)

  }
}
