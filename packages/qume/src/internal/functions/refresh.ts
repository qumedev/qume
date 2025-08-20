import { WithState } from "../base"
import { ETF } from "../etf"
import { Context } from "../Context"
import { HasType } from "../scope"
import { State } from "../State"
import { incrementSeqIdPack, singlePack } from "../Pack"
import * as _ from "lodash"

const REFRESH = 'REFRESH'

export type Refresh<S, K, R> = { type: typeof REFRESH } & WithState<S, K, R>

export function refreshAll<S extends HasType, K, A>(etf: ETF<S, K, A>): Refresh<S, K, A> {
  return {
    type: REFRESH,
    locale: etf.locale,
    keys: etf.keys,
    // state: path => etf.state(path).flatTap(pack =>
    //   _.isEmpty(pack) ? State.pure<Context<S>, void>(undefined) : Context.addOutletIn(
    //     singlePack('', { type: '_$REFRESH' } as S, _.max(incrementSeqIdPack(pack).map(en => en.seqId)) || 0)
    //   )
    // ),
    state: path => etf.state(path).flatTap(pack =>
      _.isEmpty(pack)
        ? State.pure<Context<S>, void>(undefined)
        : Context.clearStorage<S>()
    ),
    value: etf.value
  }
}
