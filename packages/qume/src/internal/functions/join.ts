import _ from "lodash"
import { pathKey, StateFunc, WithState } from "../base"
import { concatPack, emptyPack, flattenPack, singlePack, mapValuePack, mergePack, Pack, foldPack } from "../Pack"
import { State } from "../State"
import { Context } from "../Context"
import { ETF } from "../etf"
import { Reader } from "../Reader"

const JOIN = 'JOIN'

export type Join<S, K, R> = { type: typeof JOIN } & WithState<S, K, R>

// type JoinTerm<R> = {[K in keyof R]: {state: StateFunc<JoinValueField<R, K>>}}
// type Take<R, K0 extends keyof R> = R[K0]
// type WithValueField<R, K0 extends keyof R> = {value: Take<R[K0], keyof R[K0]>}
// type GetValue<R, K0 extends keyof R> = Extract<R[K0], WithValueField<R, K0>>['value']
// type ReturnTypeOrNever<R> = R extends (...args: any) => any ? ReturnType<R> : never
// type ObjValue<R> = {[K in keyof R]: ReturnTypeOrNever<GetValue<R, K>>}

// type GetObjStateFunc<R, K0 extends keyof R> = R[K0] extends {state: StateFunc<infer V>} ? V : never
// export type JoinValueField<S, K, R, K0 extends keyof R> = R[K0] extends ETF<S, K, infer V> ? V : never
// export type JoinTerm<S, K, R> = { [K0 in keyof R]: ETF<S, K, JoinValueField<S, K, R, K0>> }
// export type JoinValue<S, K, R> = Partial<{ [K0 in keyof R]: JoinValueField<S, K, R, K0> }>

export type JoinTerm<S, K, R> = { [K0 in keyof R]: ETF<S, K, any> }
export type JoinValue<R> = { [K0 in keyof R]: any }

export function join<S, K, R extends JoinTerm<S, K, R>>(prevs: R): Join<S, K, JoinValue<R>> {
  return {
    type: JOIN,
    locale: '',
    state: joinState(prevs),
    keys: path =>
      _.reduce(
        prevs,
        (acc, line, fieldKey) =>
          line.keys(pathKey(path, fieldKey))
            .flatMap(keys => acc.map(accKeys => accKeys.concat(keys))),
        Reader.pure<Context<S>, K[]>([])
      ).map(_.uniq),

    value: path => keys => {

      const fieldKeys = _.keys(prevs)

      return _.reduce(prevs,
        (acc, line, fieldKey) => {

          return line.value(pathKey(path, fieldKey))(keys)
            .map(mapValuePack(entry => ({ [fieldKey]: entry.value }) as Partial<JoinValue<R>>))
            .flatMap(joinedValues => acc.map(accValues => concatPack<K, Partial<JoinValue<R>>>(accValues, joinedValues)))
        },
        Reader.pure<Context<S>, Pack<K, Partial<JoinValue<R>>>>(emptyPack())
      ).map(concat =>
        _.chain(concat)
          .groupBy(entry => entry.key)
          .mapValues(grouped => _.reduce(grouped, (acc, entry) => ({ ...acc, ...(entry.value) }), {} as Partial<JoinValue<R>>))
          .reduce((acc, merged, key) => {

            if (_.every(fieldKeys, k => k in merged))
              return concatPack(acc, singlePack<K, JoinValue<R>>(
                key as K,
                merged as JoinValue<R>,
                _.max(concat.map(v => v.seqId)) || 0,
                false,
                false,
              ))
            else return acc;
          }, emptyPack<K, JoinValue<R>>())
          .value()
      )
    }
  }
}

function joinState<S, K, R extends JoinTerm<S, K, R>>(prevs: R): StateFunc<S, K, JoinValue<R>> {


  const fieldKeys = _.keys(prevs)
  return prefixPath =>

    Context.getInlet<K, S>().flatMap(events =>
      State.traverseArr(events, event =>
        State.traverseObj(prevs, (qt, fieldKey) =>
          Context.setInlet<K, S>([event])
            .asF(qt.state(pathKey(prefixPath, fieldKey)))
            .map(mapValuePack(entry => ({ [fieldKey]: entry.value })))
        )
          .map(packs => _.findLast(packs, p => !_.isEmpty(p)) || emptyPack<K, { [x: string]: any }>())
          .map(pack => pack as Pack<K, Partial<JoinValue<R>>>)
          .flatMap(executedPack => {

            const executedPackObj = mergePack(executedPack)

            return _.chain(executedPackObj)
              .flatMap((v, k) => _.difference(fieldKeys, _.keys(v)).map(fieldKey => [fieldKey, k]))
              .groupBy(([fieldKey]) => fieldKey)
              .mapValues(grouped => _.map(grouped, ([, key]) => key as K))
              .reduce((all, keys, fieldKey) =>
                all.flatMap(acc => {

                  const run = prevs[fieldKey as keyof R].value(pathKey(prefixPath, fieldKey))(keys).run

                  return State.apply<Context<S>, Pack<K, Partial<JoinValue<R>>>>(s => run(s).then(a => [s, a]))
                    .map(mapValuePack(entry => ({ [fieldKey]: entry.value })))
                    // assembly everything in one big pack
                    .map(p => concatPack(acc, p as Pack<K, Partial<JoinValue<R>>>))
                }), State.pure<Context<S>, Pack<K, Partial<JoinValue<R>>>>(emptyPack()))
              .value()
              .map(readPack => {

                const readPackObj = mergePack(readPack)

                const executedSeqId = _.max(executedPack.map(v => v.seqId))
                const readSeqId = _.max(readPack.map(v => v.seqId))
                const seqId = _.max([executedSeqId, readSeqId]) || 0

                const noEffect = _.some(executedPack, en => en.noEffect)

                return _.reduce(executedPackObj, (acc, v, key) => {
                  const merged = ({ ...v, ...readPackObj[key] })

                  if (_.every(fieldKeys, k => k in merged))
                    return concatPack(acc, singlePack<K, JoinValue<R>>(key as K, merged as JoinValue<R>, seqId, false, noEffect))
                  else
                    return emptyPack<K, JoinValue<R>>()
                }, emptyPack<K, JoinValue<R>>())
              })

          })

      ).map(flattenPack).flatTap(() => Context.setInlet<K, S>(events))
    )
}


