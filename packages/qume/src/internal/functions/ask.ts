import { pathKey, WithState } from "../base"
import { mapValuePack } from "../Pack"
import * as _ from "lodash"
import { HasType, KSingle } from "../scope"
import { Context } from "../Context"

export const ASK = 'ASK'

export type Ask<S, K, R> = { type: typeof ASK } & WithState<S, K, R>


export function ask<S extends HasType, R>(byTypes: string[]): Ask<S, KSingle, R> {
  return {
    type: ASK,
    locale: '',
    state: prefixPath =>
      Context.getInlet<KSingle, S>()
        .map(pack => _.filter(pack, entry => !entry.deleted && !_.isEmpty(_.intersection(byTypes, [entry.value.type]))))
        .map(mapValuePack(v => v.value as R))
        .flatTap(Context.writeByKeys<S, KSingle, R>(pathKey('', prefixPath))),

    keys: Context.allKeys(),
    value: Context.valueByKeys()
  }
}
