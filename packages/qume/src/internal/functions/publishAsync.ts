import { pathKey, WithState } from "../base"
import { emptyPack, mapValuePack } from "../Pack"
import { Context } from "../Context"
import { ETF } from "../etf"
import * as _ from 'lodash'
import { State } from "../State"

const PUBLISH_ASYNC = 'PUBLISH_ASYNC'

export type PublishAsync<S, K, R> = { type: typeof PUBLISH_ASYNC } & WithState<S, K, R>

// TODO: handle unsubscribe
export function publishAsync<S, K, C, R>(
  prev: ETF<S, K, R>,
  f: (r: R) => (cb: (r1: S) => void) => (() => void) | void,
  clear: ETF<S, K, C>
): PublishAsync<S, '', void> {

  const locale = pathKey(prev.locale, PUBLISH_ASYNC)

  return {
    type: PUBLISH_ASYNC,
    locale: locale,
    state: path => prev.state(path)
      .flatMap(pack => clear.state(path).map(clearPack => ({ pack, clearPack })))
      .flatMap(({ pack, clearPack }) => {
        if (_.isEmpty(clearPack)) return State.pure(pack)
        else return State.traverseArr(clearPack, entry => {
          const pathLocale = pathKey(path, locale)
          const key: string = pathKey(pathLocale, entry.key as string)
          return Context
            .readOpt<S, () => void>(key)
            .map(clearCb => clearCb && clearCb.value())
        }).as(pack)
      })
      .flatMap(pack => Context.getOutletAsync<S>().map(cb => ({ pack, cb })))
      .flatTap(({ pack, cb }) =>
        State.traverseArr(pack, entry => {
          const skip = State.pure<Context<S>, undefined>(undefined)

          if (entry.noEffect) return skip
          if (entry.deleted) return skip
          const clearCb = f(entry.value)(cb)

          if (!clearCb) return skip
          const pathLocale = pathKey(path, locale)
          const key: string = pathKey(pathLocale, entry.key as string)

          return Context.storeValue(key, clearCb, entry.seqId)
        })
      )
      .map(() => emptyPack()),

    keys: Context.emptyKeys(),
    value: Context.emptyValue()
  }
}
