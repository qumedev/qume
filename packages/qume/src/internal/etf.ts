import { Mapped } from "./functions/map"
import { Narrow } from "./functions/narrow"
import { Join } from "./functions/join"
import { Select } from "./functions/select"
import { Count } from "./functions/count"
import { External } from "./functions/external"
import { Ask } from "./functions/ask"
import { ByKey } from "./functions/byKey"
import { Merge } from "./functions/merge"
import { Filter } from "./functions/filter"
import { Optional } from "./functions/optional"
import { Prefixed } from "./functions/prefixed"
import { Empty } from "./functions/empty"
import { EvalMap } from "./functions/evalMap"
import { PublishAsync } from "./functions/publishAsync"
import { AddKey } from "./functions/addKey"
import { Flatten } from "./functions/flatten"
import { NoEffect } from "./functions/noEffect"
import { MappedArray } from "./functions/mapArray"
import { Internal } from "./functions/internal"
import { Fire } from "./functions/fire"
import { SelectKey } from "./functions/selectKey"
import { SelectPrefixKey } from "./functions/selectPrefixKey"
import { NotNull } from "./functions/notNull"
import { Never } from "./functions/never"
import { Refresh } from "./functions/refresh"
import { Fold as FoldType, Reduce, Once, Latest } from "./functions/fold"

export type Extr<S, K, R> = Ask<S, K, R> | Empty<S, K, R> | Never<S, K, R>
export type Transform<S, K, R> =
  | ByKey<S, K, R>
  | AddKey<S, K, R>
  | Once<S, K, R>
  | Mapped<S, K, R>
  | MappedArray<S, K, R>
  | EvalMap<S, K, R>
  | Prefixed<S, K, R>
  | SelectKey<S, K, R>
  | SelectPrefixKey<S, K, R>
  | Filter<S, K, R>
  | NotNull<S, K, R>
  | Flatten<S, K, R>
  | NoEffect<S, K, R>
  | Fire<S, K, R>
  | Merge<S, K, R>
  | Join<S, K, R>
  | Select<S, K, R>
  | Narrow<S, K, R>
  | Optional<S, K, R>
  | Internal<S, K, R>
  | External<S, K, R>
  | PublishAsync<S, K, R>
  | Refresh<S, K, R>
  | FoldType<S, K, any, R>
export type Fold<S, K, R> = Reduce<S, K, R> | Once<S, K, R> | Latest<S, K, R> | Count<S, K, R> | FoldType<S, K, any, R>

export type ETF<S, K, R> = Extr<S, K, R> | Transform<S, K, R> | Fold<S, K, R>



