import { pathKey, WithState } from "../base"
import { ETF } from "../etf"
import { emptyPack, flattenPack } from "../Pack"
import * as _ from "lodash"
import { State } from "../State"
import { Context } from "../Context"
import { Reader } from "../Reader"

const MERGE = 'MERGE'
export type Merge<S, K, R> = { type: typeof MERGE } & WithState<S, K, R>

export function merge<S, K, R>(prev: ETF<S, K, R>[]): Merge<S, K, R> {
  return {
    type: MERGE,
    locale: '',
    keys: path =>
      _.reduce(
        prev,
        (acc, line, fieldKey) =>
          line.keys(pathKey(path, fieldKey + ''))
            .flatMap(keys => acc.map(accKeys => accKeys.concat(keys))),
        Reader.pure<Context<S>, K[]>([])
      ).map(_.uniq),

    state:
      prefixPath =>
        Context.getInlet<K, S>().flatMap(events =>
          State.traverseArr(events, event =>
            State.traverseArr(prev, (qt, k) =>
              Context.setInlet<K, S>([event])
                .asF(qt.state(pathKey(prefixPath, k + '')))
            ).map(packs => _.find(packs, v => !_.isEmpty(v)) || emptyPack<K, R>())
          ).map(flattenPack).flatTap(() => Context.setInlet<K, S>(events))
        ),

    value: prefixPath => keys =>
      Reader.traverseArr(prev, (qt: ETF<S, K, R>, k: number) =>
        qt.value(pathKey(prefixPath, k + ''))(keys)
      )
        .map(flattenPack)
        .map(pack =>
          // find max seqId per each key
          _.chain(pack).groupBy(v => v.key).map(packByKey =>
            _.chain(packByKey)
              .sortBy(entry => entry.seqId)
              .reverse().head().value() || emptyPack<K, R>()
          ).value()
        ),
  }
}
