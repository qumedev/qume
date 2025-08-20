import { WithState } from "../base"
import { incrementSeqIdPack, mapValuePack, Pack } from "../Pack"
import { Context } from "../Context"
import { ETF } from "../etf"
import * as _ from 'lodash'
import { HasType } from "../scope"

export const INTERNAL = 'INTERNAL'

export type Internal<S, K, R> = { type: typeof INTERNAL } & WithState<S, K, R>


export function internal<
  S extends HasType, K, A,
  V extends S['type'],
  R extends Extract<S, { type: V }>,
>(prev: ETF<S, K, A>, asType?: V): Internal<S, K, R> {

  const transform: (pack: Pack<K, A>) => Pack<K, R> = _.flow(
    incrementSeqIdPack,
    mapValuePack<K, A, R>(entry => (_.isEmpty(asType) ? entry.value : { ...entry.value, type: asType }) as any as R)
  )

  return {
    type: INTERNAL,
    locale: prev.locale,
    state: path =>
      prev.state(path).map(transform).flatTap(r =>
        Context.addOutletIn<K, S>(_.filter(r, entry => !entry.deleted && !entry.noEffect))
      ),

    keys: prev.keys,
    value: path => keys => prev.value(path)(keys).map(transform)
  }
}
