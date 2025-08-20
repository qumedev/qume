import { WithState } from "../base"
import { incrementSeqIdPack, mapValuePack, Pack } from "../Pack"
import { Context } from "../Context"
import { ETF } from "../etf"
import * as _ from 'lodash'
import { HasType } from "../scope"

export const EXTERNAL = 'EXTERNAL'

export type External<S, K, R> = { type: typeof EXTERNAL, as: string } & WithState<S, K, R>


export function external<
  S extends HasType, K, A,
  V extends S['type'],
  R extends Extract<S, { type: V }>,
>(prev: ETF<S, K, A>, asType?: V): External<S, K, R> {

  const transform: (pack: Pack<K, A>) => Pack<K, R> = _.flow(
    incrementSeqIdPack,
    mapValuePack<K, A, R>(entry => (_.isEmpty(asType) ? entry.value : { ...entry.value, type: asType }) as any as R)
  )

  return {
    type: EXTERNAL,
    locale: prev.locale,
    as: asType as string,
    state: path =>
      prev.state(path)
        .map(pack => _.filter(pack, v => !v.noEffect))
        .map(transform)
        .flatTap(r => Context.addOutletOut<K, S>(_.filter(r, entry => !entry.deleted))),

    keys: prev.keys,
    value: path => keys => prev.value(path)(keys).map(transform)
  }
}
