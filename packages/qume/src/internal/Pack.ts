
import _ from "lodash"

export const FULL_PACK = 'FULL_PACK'
export const EMPTY_PACK = 'EMPTY_PACK'



interface ActivePackEntry<K, T> {
  readonly key: K;
  readonly value: T; // Never null
  readonly seqId: number;
  readonly deleted: false; // Literal false
  readonly noEffect: boolean;
}

interface DeletedPackEntry<K> {
  readonly key: K;
  readonly value: null; // Always null
  readonly seqId: number;
  readonly deleted: true; // Literal true
  readonly noEffect: boolean;
}

// Union type for the two states
export type PackEntry<K, T> = ActivePackEntry<K, T> | DeletedPackEntry<K>;



export function setEntryKey<K0, K, T>(entry: PackEntry<K, T>, key: K0): PackEntry<K0, T> {
  return entry.deleted
    ? deletedEntry(key, entry.seqId, entry.noEffect)
    : activeEntry(key, entry.value, entry.seqId, entry.noEffect);
}

export function setEntryValue<K, T, T0>(entry: PackEntry<K, T>, value: T0): PackEntry<K, T0> {
  return entry.deleted
    ? deletedEntry(entry.key, entry.seqId, entry.noEffect)
    : activeEntry(entry.key, value, entry.seqId, entry.noEffect);
}

export function incEntrySeqId<K, T>(entry: PackEntry<K, T>): PackEntry<K, T> {
  return entry.deleted
    ? deletedEntry(entry.key, entry.seqId + 1, entry.noEffect)
    : activeEntry(entry.key, entry.value, entry.seqId + 1, entry.noEffect);
}

export function setEntryDeleted<K, T>(entry: PackEntry<K, T>): PackEntry<K, T> {
  return deletedEntry(entry.key, entry.seqId, entry.noEffect);
}

export function setEntryNotDeleted<K, T, T0>(entry: PackEntry<K, T>, value: T0): PackEntry<K, T0> {
  return activeEntry(entry.key, value, entry.seqId, entry.noEffect);
}

export function setEntryNoEffect<K, T>(entry: PackEntry<K, T>, noEffect: boolean): PackEntry<K, T> {
  return entry.deleted
    ? deletedEntry(entry.key, entry.seqId, noEffect)
    : activeEntry(entry.key, entry.value, entry.seqId, noEffect);
}

export function activeEntry<K, T>(key: K, value: T, seqId: number, noEffect: boolean = false): ActivePackEntry<K, T> {
  return { key, value, seqId, deleted: false, noEffect };
}

export function deletedEntry<K>(key: K, seqId: number, noEffect: boolean = false): DeletedPackEntry<K> {
  return { key, value: null, seqId, deleted: true, noEffect };
}

export function entry<K, T>(key: K, value: T, seqId: number, deleted: boolean = false, noEffect: boolean = false): PackEntry<K, T> {
  if (deleted) {
    return deletedEntry(key, seqId, noEffect);
  } else {
    return activeEntry(key, value, seqId, noEffect);
  }
}

export function entryObj<K, T>(obj: {
  key: K,
  value: T | null,
  seqId: number,
  deleted?: boolean,
  noEffect?: boolean,
}): PackEntry<K, T> {
  const deleted = obj.deleted ?? false;
  if (deleted) {
    return deletedEntry(obj.key, obj.seqId, obj.noEffect);
  } else {
    if (obj.value === null || obj.value === undefined) {
      throw new Error("Active entries must have a non-null value");
    }
    return activeEntry(obj.key, obj.value, obj.seqId, obj.noEffect);
  }
}

export type Pack<K, T> = PackEntry<K, T>[] //& UnPack<K, T>

export function emptyPack<K, T>(): Pack<K, T> { return [] }
export function singlePack<K, T>(key: K, value: T, seqId: number, deleted: boolean = false, noEffect: boolean = false): Pack<K, T> {
  return [entry(key, value, seqId, deleted, noEffect)]
}
export function wrapPack<K, T>(entry: PackEntry<K, T>): Pack<K, T> {
  return [entry]
}

export function fullPackFromArray<K, T>(key: K, values: T[], seqId: number, deleted: boolean = false, noEffect: boolean = false): Pack<K, T> {
  return _.map(values, value => entry(key, value, seqId, deleted, noEffect))
}
export const incrementSeqIdPack = flatMapPack(entry => [incEntrySeqId(entry)])

export function mapKeyPack<K, K0, T>(f: (entry: PackEntry<K, T>) => K0): (pack: Pack<K, T>) => Pack<K0, T> {
  return flatMapPack<K, K0, T, T>(entry => [setEntryKey(entry, f(entry))])
}
export function mapValuePack<K, T, R>(f: (entry: PackEntry<K, T>) => R): (pack: Pack<K, T>) => Pack<K, R> {
  return flatMapPack<K, K, T, R>(entry => [setEntryValue(entry, f(entry))])
}

// export function semiFlatMapPack<K, T, R>(f: (t: T, k: K) => R[]): (pack: Pack<K, T>) => Pack<K, R> {
//   return pack => _.reduce(pack, (acc, v) =>
//     acc.concat(f(v.value, v.key).map(event => entry(v.key, event, v.seqId, v.deleted, v.noEffect))),
//     emptyPack<K, R>())
// }


export function mapPack<K, K0, T, R>(f: (pack: PackEntry<K, T>) => PackEntry<K0, R>): (pack: Pack<K, T>) => Pack<K0, R> {
  return flatMapPack(entry => [f(entry)])
}

export function flatMapPack<K, K0, T, R>(f: (pack: PackEntry<K, T>) => Pack<K0, R>): (pack: Pack<K, T>) => Pack<K0, R> {
  return pack => _.reduce(pack, (acc: Pack<K0, R>, entry) => acc.concat(f(entry)), [])
}

// export function flatMapPack<K, K0, T, R>(f: (t: T, k: K, seqId: number, deleted: boolean, noEffect: boolean) => Pack<K0, R>): (pack: Pack<K, T>) => Pack<K0, R> {
//   return pack => _.reduce(pack, (acc: Pack<K0, R>, entry) =>
//     acc.concat(f(entry.value, entry.key, entry.seqId, entry.deleted, entry.noEffect)), [])
// }

export function foldPack<K, T, R>(empty: R, f: (acc: R, entry: PackEntry<K, T>) => R): (pack: Pack<K, T>) => R {
  return pack => _.reduce(pack, (acc, entry) => f(acc, entry), empty)
}

export function concatPack<K, T>(pack1: Pack<K, T>, pack2: Pack<K, T>): Pack<K, T> {
  return pack1.concat(pack2)
}

export function flattenPack<K, T>(arr: Pack<K, T>[]): Pack<K, T> {
  return _.reduce(arr, (acc, p) => acc.concat(p), emptyPack())
}

export function mergePack<K, T>(pack: Pack<K, T>): { [x: string]: T } {
  return _.chain(pack)
    .groupBy((entry) => entry.key)
    .mapValues(grouped => _.map(grouped, (entry) => entry.value))
    .mapValues(partials =>
      _.reduce(partials, (acc, v) => ({ ...acc, ...v }), {} as T)
    )
    .value()
}

