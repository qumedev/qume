import * as _ from "lodash"
import { QueryTail } from "../internal/QueryTail";
import { QueryTailImpl } from "../internal/QueryTailImpl";
import { scope, KSingle, ActionSymbol, ActionInput, } from "../internal/scope";
import { Context } from "../internal/Context";
import { entry, singlePack, Pack, PackEntry, activeEntry, entryObj } from "../internal/Pack";
import { MainStore, runMain } from "../internal/MainStore";
import { TRANSFORM } from "../internal/base";
import { StoreExecutor } from "..";
import { map } from "../internal/functions/map";
import { join as joinETF } from "../internal/functions/join";


export const CREATE_TODO = 'CREATE_TODO'
export const TODO_CREATED = 'TODO_CREATED'
export const COMPLETE_TODO = 'COMPLETE_TODO'

export const TODO_ACTIVATED = 'TODO_ACTIVATED'
export const TODO_COMPLETED = 'TODO_COMPLETED'
export const TODO_TITLE_COMPLETED = 'TODO_TITLE_COMPLETED'
export const TODO = 'TODO'
export const TODOS = 'TODOS'
export const TODO_GROUP_ADDED = 'TODO_GROUP_ADDED'
export const TODO_UNLISTEN = 'TODO_UNLISTEN'

type CreateToDo = { type: typeof CREATE_TODO, title: string }
type CompleteToDo = { type: typeof COMPLETE_TODO, id: string }
type ToDoCreated = { type: typeof TODO_CREATED, id: string, title: string }
type ToDoActivated = { type: typeof TODO_ACTIVATED, id: string }
type ToDoCompleted = { type: typeof TODO_COMPLETED, id: string }
type ToDoTitleCompleted = { type: typeof TODO_TITLE_COMPLETED, title: string }
type ToDo = { type: typeof TODO, id: string, title: string, active: boolean, note?: string }
type ToDos = { type: typeof TODOS, todos: ToDo[] }
type ToDoGroupAdded = { type: typeof TODO_GROUP_ADDED, id: string, groupId: string }
type ToDoUnlisten = { type: typeof TODO_UNLISTEN, id: string }

type ToDoFact =
  | CreateToDo
  | CompleteToDo
  | ToDoCreated
  | ToDoActivated
  | ToDoCompleted
  | ToDoTitleCompleted
  | ToDoGroupAdded
  | ToDoUnlisten
  | ToDo
  | ToDos


describe('stream', () => {

  const jestConsole = console;

  beforeEach(() => {
    global.console = require('console');
  });

  afterEach(() => {
    global.console = jestConsole;
  });

  it('simple select', async () => {

    const { query } = scope<ToDoFact>()

    const testQuery = query(CREATE_TODO).select.title

    let input: ToDoFact[] = [
      { type: CREATE_TODO, title: "todo1" },
    ]

    const values = await QueryTailImpl.runQuery(testQuery, input)

    expect(values).toStrictEqual("todo1")
  })

  it('simple reduce by key', async () => {

    const { query } = scope<ToDoFact>()

    const createQuery =
      query(TODO_CREATED)
        .by.id
        .select.title
        .reduce((_v1, v2) => v2)

    let input: ToDoFact[] = [
      { type: TODO_CREATED, title: "todo1", id: '1' },
      { type: TODO_CREATED, title: "todo2", id: '2' },
      { type: TODO_CREATED, title: "todo3", id: '3' },
    ]

    const values = await QueryTailImpl.runQuery(createQuery, input)

    expect(values).toStrictEqual({ '1': 'todo1', '2': 'todo2', '3': 'todo3' })
  })

  it('reduce', async () => {

    const { query } = scope<ToDoFact>()

    const testQuery = query(TODO).map(() => 1).reduce((v1, v2) => v1 + v2)

    let input: ToDoFact[] = [
      { type: TODO, title: "todo1", id: "1", active: true },
      { type: TODO, title: "todo2", id: "1", active: false },
    ]

    const value = await QueryTailImpl.runQuery(testQuery, input) || 0

    expect(value).toStrictEqual(2)
  })

  it('reduce chain', async () => {

    const { query } = scope<ToDoFact>()

    const testQuery =
      query(TODO)
        .by.id
        .reduce((v1, v2) => ({ ...v1, ...v2, title: v1.title + '-' + v2.title }))
        .reduce((v1, v2) => ({ ...v1, ...v2, active: v1.active || v2.active }))

    let input: ToDoFact[] = [
      { type: TODO, title: "todo1", id: "1", active: true },
      { type: TODO, title: "todo2", id: "1", active: false },
    ]

    const value = await QueryTailImpl.runQuery(testQuery.selectKey("1"), input)

    expect(value?.title).toStrictEqual("todo1-todo2")
    expect(value?.active).toStrictEqual(true)
  })

  it('fold method', async () => {

    const { query } = scope<ToDoFact>()

    // Test fold with numbers - sum all todo ids as numbers
    const sumQuery = query(TODO_CREATED)
      .map(todo => parseInt(todo.id))
      .fold(0, (sum, id) => sum + id)

    let input: ToDoFact[] = [
      { type: TODO_CREATED, id: "1", title: "todo1" },
      { type: TODO_CREATED, id: "2", title: "todo2" },
      { type: TODO_CREATED, id: "3", title: "todo3" }
    ]

    const result = await QueryTailImpl.runQuery(sumQuery, input)
    expect(result).toBe(6) // 1 + 2 + 3

    // Test fold with strings - concatenate titles
    const concatQuery = query(TODO_CREATED)
      .select.title
      .fold("", (acc, title) => acc + title + ",")

    const concatResult = await QueryTailImpl.runQuery(concatQuery, input)
    expect(concatResult).toBe("todo1,todo2,todo3,")
  })

  it('join method', async () => {

    const { query } = scope<ToDoFact>()

    // Attach different event types - TODO_CREATED with TODO_ACTIVATED
    const counterQuery =
      query(TODO_CREATED).by.id
        .join(query(TODO_ACTIVATED).by.id)
        .as(1)
        .reduce((a, b) => a + b)


    let input: ToDoFact[] = [
      { type: TODO_CREATED, id: "1", title: "First Todo" },
      { type: TODO_CREATED, id: "2", title: "Second Todo" },
      // { type: TODO_ACTIVATED, id: "1" },
      // { type: TODO_ACTIVATED, id: "1" }, // Same id activated twice
      { type: TODO_ACTIVATED, id: "2" },
      { type: TODO_ACTIVATED, id: "2" }//
    ]

    const counterResult = await QueryTailImpl.runQuery(counterQuery, input)

    // Counter should show symmetric join behavior (both sides trigger)
    expect(counterResult).toEqual({
      // "1": 1, // First join + second TODO_ACTIVATED update = 2 triggers
      "2": 1  // Single join when both events are present = 1 trigger
    })
  })


  it('flatten', async () => {

    const { query } = scope<ToDoFact>()

    const mach = query(TODOS).select.todos.flatten()

    let input: ToDoFact = {
      type: TODOS, todos: [
        { type: TODO, id: "1", title: "todo1", active: true },
        { type: TODO, id: "2", title: "todo2", active: true },
      ]
    }

    let pack = await QueryTailImpl.exec(mach).runA(query.emptyContext.withInletEvent(input))

    expect(pack.length).toStrictEqual(2)
  })


  it('refresh', async () => {

    const { query, store } = scope<ToDoFact>()

    const testStore = store({
      todos: query(TODO_CREATED).by.id.select.title,
      refresher: query(TODO_UNLISTEN).refreshAll()
    })

    const executor = new StoreExecutor(testStore)

    executor.publish({ type: TODO_CREATED, title: "todo1", id: '1' })
    executor.publish({ type: TODO_CREATED, title: "todo2", id: '2' })

    await timeout(0)

    const todos1 = await executor.readQuery(testStore.todos)
    expect(todos1).toStrictEqual({ '1': 'todo1', '2': 'todo2' })

    executor.publish({ type: TODO_UNLISTEN, id: 'any' })
    await timeout(0)

    const todos2 = await executor.readQuery(testStore.todos)
    expect(todos2).toStrictEqual(undefined)
  })

  it('gracefull refresh', async () => {

    const { query, store, action } = scope<ToDoFact>()

    const testStore = store({
      todos: action((id: string) => id)
        .evalMap(id => new Promise<string>(resolve => setTimeout(() => resolve(id), 0)))
        .map(id => ({ title: `todo${id}`, id }))
        .by.id
        .select.title,

      refresher: query(TODO_UNLISTEN).refreshAll()
    })

    const executor = new StoreExecutor(testStore)
    await executor.action(testStore.todos)('3')

    executor.action(testStore.todos)('1')
    executor.action(testStore.todos)('2')

    executor.publish({ type: TODO_UNLISTEN, id: '' })

    await timeout(10)

    const todos = await executor.readQuery(testStore.todos)
    expect(todos).toStrictEqual({ "1": "todo1", "2": "todo2" })
  })

  it('random', async () => {

    const { query } = scope<ToDoFact>()

    const qt =
      query(CREATE_TODO)
        .random((v, r) => ({ ...v, id: r }))
        .by.id
        .select.title

    let input: ToDoFact[] = [
      { type: CREATE_TODO, title: "todo1" },
      { type: CREATE_TODO, title: "todo2" },
      { type: CREATE_TODO, title: "todo3" },
    ]

    const values = await QueryTailImpl.runQuery(qt, input)

    expect(_.chain(values).values().sort().value()).toStrictEqual(['todo1', 'todo2', 'todo3'])
  })

  it('action no parameter', async () => {

    const { action } = scope<ToDoFact>()

    const qt = action().map(() => 1)
    const resultAction = await QueryTailImpl.runQuery(qt, { type: ActionSymbol, value: undefined, isAction: true })

    expect(resultAction).toStrictEqual(1)
  })

  it('action', async () => {

    const { action } = scope<ToDoFact>()

    const qt = action((v: number) => v + 1)
    const resultAction = await QueryTailImpl.runQuery(qt, { type: ActionSymbol, value: [123], isAction: true })

    expect(resultAction).toStrictEqual(124)

    const resultNonFunc = await QueryTailImpl.runQuery(qt, { type: CREATE_TODO, title: "todo3" })
    expect(resultNonFunc).toStrictEqual(undefined)
  })

  it('action 3 parameters', async () => {

    const { action } = scope<ToDoFact>()

    // Create a 4-parameter action that generates a detailed todo
    const createDetailedTodo = action((id: string, title: string, active: boolean) =>
      ({ type: TODO, id, title, active }))

    // Test direct execution with 4 parameters
    const result = await QueryTailImpl.runQuery(
      createDetailedTodo,
      { type: ActionSymbol, value: ['1', 'Implement feature', true], isAction: true }
    )

    expect(result).toMatchObject({
      type: TODO,
      id: '1',
      title: 'Implement feature',
      active: true,
    })

  })

  it('store.action', async () => {

    const { action, query, store } = scope<ToDoFact>()

    const st = store({
      action: action((v: number) => v).map(v => v + 1),
      call2: query(CREATE_TODO)
    })

    const main = runMain({ st })
    const inc = main.action(st.action)

    expect(await inc(123)).toStrictEqual(124)
  })

  it('main.store', async () => {

    const { action, query, store } = scope<ToDoFact>()

    const st = store({
      create: action((id: string) => ({ id, title: "todo" })).internal(TODO_CREATED),
      singleKey: query(TODO_CREATED),
      byKey: query(TODO_CREATED).by.id
    })

    const main = runMain({ st })

    const created = await main.actions(st).create("1")
    await timeout(0)

    const { singleKey, byKey } = await main.readStore(st)

    expect(created.id).toStrictEqual("1")
    expect(byKey).toStrictEqual({ "1": { id: "1", title: "todo", type: TODO_CREATED } })
    expect(singleKey.id).toStrictEqual("1")
  })

  it('main.listenStore', async () => {

    const { action, query, store } = scope<ToDoFact>()

    const st = store({
      create: action((id: string) => ({ id, title: `todo${id}` })).internal(TODO_CREATED),
      singleKey: query(TODO_CREATED),
      byKey: query(TODO_CREATED).by.id.select.title
    })

    const main = runMain({ st })

    let storeUpdates: any[] = []

    main.listenStore(st, (storeData) => {
      storeUpdates.push(storeData)
    })

    await main.actions(st).create("1")
    await main.actions(st).create("2")
    await timeout(0)

    expect(storeUpdates.length).toBeGreaterThanOrEqual(3)

    const finalUpdate = storeUpdates[storeUpdates.length - 1]
    expect(finalUpdate.byKey).toStrictEqual({ "1": "todo1", "2": "todo2" })
    expect(finalUpdate.singleKey.title).toStrictEqual("todo2") // Latest

    const callback = (storeData: any) => { }
    main.listenStore(st, callback)
    main.unlistenStore(st, callback)

  })

  it('main.store adaptive registration', async () => {

    const { action, query, store } = scope<ToDoFact>()

    const main = runMain({})

    const dynamicStore = store({
      create: action((id: string) => ({ id, title: `dynamic${id}` })).internal(TODO_CREATED),
      todos: query(TODO_CREATED).by.id.select.title
    })

    const actions = main.actions(dynamicStore)
    expect(actions.create).toBeDefined()

    await actions.create("1")
    await timeout(0)

    const storeData = await main.readStore(dynamicStore)
    expect(storeData.todos).toStrictEqual({ "1": "dynamic1" })

    let updates: any[] = []
    main.listenStore(dynamicStore, (data) => updates.push(data))

    await actions.create("2")
    await timeout(0)

    expect(updates.length).toBeGreaterThanOrEqual(1)
    const finalData = await main.readStore(dynamicStore)
    expect(finalData.todos).toStrictEqual({ "1": "dynamic1", "2": "dynamic2" })
  })

  it('evalMap', async () => {

    const { query } = scope<ToDoFact>()

    const qt = query(CREATE_TODO).evalMap(a => Promise.resolve(a))

    let input: ToDoFact = { type: CREATE_TODO, title: "todo1" }

    expect(await QueryTailImpl.runQuery(qt, input)).toStrictEqual(input)
  })


  it('no effect', async () => {

    const { query } = scope<ToDoFact>()

    const qt = query(CREATE_TODO).noEffect().evalMap(a => Promise.resolve(a))

    let input: ToDoFact = { type: CREATE_TODO, title: "todo1" }

    expect(await QueryTailImpl.runQuery(qt, input)).toStrictEqual(undefined)
  })

  it('simple filter', async () => {

    const { query } = scope<ToDoFact>()
    let counter = 0

    const testQuery = query(TODO)
      .by.id
      .filter(v => v.active)
      .map(v => { if (v.id === "2") counter = counter + 1; return v })

    let input: ToDoFact[] = [
      { type: TODO, title: "todo1", id: "1", active: true },
      { type: TODO, title: "todo2", id: "2", active: true },
      { type: TODO, title: "todo2", id: "2", active: false },
    ]

    const values = await QueryTailImpl.runQuery(testQuery, input)

    expect(values).toBeDefined()
    if (!values) return

    expect(values['1']).toStrictEqual({ type: TODO, title: "todo1", id: "1", active: true })
    expect(values['2']).toStrictEqual(undefined)
    expect(counter).toStrictEqual(1)
  })

  it('not null filter', async () => {

    const { query } = scope<ToDoFact>()


    const testQuery =
      query(TODO).by.id.select.note.notNull()

    let input: ToDoFact[] = [
      { type: TODO, title: "todo1", id: "1", active: true, note: "note1" },
      { type: TODO, title: "todo2", id: "2", active: false },
    ]

    const value = await QueryTailImpl.runQuery(testQuery, input)

    expect(value).toStrictEqual({ "1": "note1" })
  })

  it('evalMap filter', async () => {

    const { query } = scope<ToDoFact>()

    const testQuery =
      query(TODO)
        .by.id
        .filter(v => v.active)
        .evalMap(v => Promise.resolve({ id: v.id }))
        .evalMap(v => Promise.resolve({ id: v.id }))

    let input: ToDoFact[] = [
      { type: TODO, title: "todo1", id: "1", active: true },
      { type: TODO, title: "todo2", id: "2", active: true },
      { type: TODO, title: "todo1", id: "1", active: false },
    ]

    expect(await QueryTailImpl.runQuery(testQuery, input)).toStrictEqual({ '2': { id: '2' } })
  })

  xit('chain calls combination', async () => {

    const { query } = scope<ToDoFact>()
    let counter = 0

    const testQuery =
      query(TODO)
        .filter(v => v.active)
        .evalMap(v => { counter = counter + 1; return Promise.resolve(v) })
        .evalMap(v => Promise.resolve({ groupId: '123', title: v.title }))
        .by.groupId
        .select.title
        .map(v => [v])
        .reduce((v1, v2) => v1.concat(v2))

    let input: ToDoFact[] = [
      { type: TODO, title: "todo1", id: "1", active: true },
      { type: TODO, title: "todo2", id: "2", active: true },
      // TODO: woah, should it work?
      { type: TODO, title: "todo1", id: "1", active: false },
    ]

    const values = await QueryTailImpl.runQuery(testQuery, input)

    expect(values).toStrictEqual({ '123': ['todo1', 'todo2'] })
    expect(counter).toStrictEqual(2)
  })

  it('selectKey', async () => {
    const { query } = scope<ToDoFact>()

    const testQuery = query(TODO_CREATED).by.id.selectKey('1').select.title

    let input: ToDoFact[] = [
      { type: TODO_CREATED, id: "1", title: "todo1" },
      { type: TODO_CREATED, id: "2", title: "todo2" },
      { type: TODO_CREATED, id: "3", title: "todo3" },
    ]

    const value = await QueryTailImpl.runQuery(testQuery, input)

    expect(value).toStrictEqual("todo1")
  })

  it('read by selectKey', async () => {
    const { query } = scope<ToDoFact>()

    const testQuery = query(TODO_CREATED).by.id.select.title
    const readQuery = testQuery.selectKey("1")

    let input: ToDoFact[] = [
      { type: TODO_CREATED, id: "1", title: "todo1" },
      { type: TODO_CREATED, id: "2", title: "todo2" },
      { type: TODO_CREATED, id: "3", title: "todo3" },
    ]

    const out = await QueryTailImpl.execDeep(testQuery).runS(query.emptyContext.withInletEvent(input))
    const value = await QueryTailImpl.readValue(readQuery, "").run(out.storage)

    expect(value).toStrictEqual("todo1")
  })


  it('add key', async () => {

    const { query, join } = scope<ToDoFact>()

    const testQuery =
      join({
        todo: query(TODO_CREATED).by.id,
        group: query(TODO_GROUP_ADDED).by.id,
      })
        .byKey(v => [v.group.groupId, v.group.id])
        .map(v => ({ groupId: v.group.groupId, title: v.todo.title }))
        .selectPrefixKey('123')

    let input: ToDoFact[] = [
      { type: TODO_CREATED, id: "1", title: "todo1" },
      { type: TODO_GROUP_ADDED, id: "1", groupId: "123" },
      { type: TODO_CREATED, id: "2", title: "todo2" },
      { type: TODO_GROUP_ADDED, id: "2", groupId: "123" },
      { type: TODO_CREATED, id: "3", title: "todo3" },
      { type: TODO_GROUP_ADDED, id: "3", groupId: "321" },
    ]

    const values = await QueryTailImpl.runQuery(testQuery, input)//, '123')

    expect(values).toStrictEqual({
      '123.1': { groupId: '123', title: 'todo1' },
      '123.2': { groupId: '123', title: 'todo2' }
    })
  })

  it('simple merge', async () => {

    const { query } = scope<ToDoFact>()

    const mach =
      query(
        query(TODO_COMPLETED).as(true),
        query(TODO_ACTIVATED).as(false),
        query(TODO_COMPLETED).as(true),
      )

    let input: Pack<KSingle, ToDoFact> = [
      entry('', { type: TODO_COMPLETED, id: "1" }, 1),
      entry('', { type: TODO_ACTIVATED, id: "1" }, 2),
    ]
    const ctx = query.emptyContext.withInlet(input)

    const expected = [
      entryObj({ key: '', value: true, seqId: 1 }),
      entryObj({ key: '', value: false, seqId: 2 }),
    ]

    expect(await QueryTailImpl.exec(mach).runA(ctx)).toStrictEqual(expected)
  })

  it('simple join', async () => {

    const { query, join } = scope<ToDoFact>()

    const mach =
      join({
        first: query(CREATE_TODO).map(v => v.title),
        second: query(CREATE_TODO).map(v => v.title),
        third: query(CREATE_TODO).map(v => v.title),
      })
    let input: ToDoFact[] = [
      { type: CREATE_TODO, title: "todo1" },
      { type: CREATE_TODO, title: "todo2" },
    ]

    let out = await QueryTailImpl.execDeep(mach).runS(query.emptyContext.withInletEvent(input[0]))

    expect(await QueryTailImpl.readMapAsync(mach, out).then(v => v.get('')))
      .toStrictEqual({
        first: "todo1",
        second: "todo1",
        third: "todo1",
      })

    out = await QueryTailImpl.execDeep(mach).runS(out.withInletEvent(input[1]))

    expect(await QueryTailImpl.readMapAsync(mach, out).then(v => v.get('')))
      .toStrictEqual({
        first: "todo2",
        second: "todo2",
        third: "todo2",
      })
  })

  it('join propogates when is full', async () => {
    const { query, join } = scope<ToDoFact>()

    const mach =
      join({
        created: query(TODO_CREATED).by.id,
        completed: query(TODO_COMPLETED).by.id,
      })
        .map(v => ({ title: v.created.title }))
        .internal(TODO_TITLE_COMPLETED)

    let input: ToDoFact[] = [
      { type: TODO_CREATED, id: "1", title: "todo1" },
      { type: TODO_COMPLETED, id: "1" },
      { type: TODO_COMPLETED, id: "1" },
    ]
    const ctx = query.emptyContext.withInletEvent(input)
    let events = await QueryTailImpl.exec(mach).runA(ctx)

    expect(events.map(v => v.value))
      .toStrictEqual([
        { type: TODO_TITLE_COMPLETED, title: "todo1" },
        { type: TODO_TITLE_COMPLETED, title: "todo1" },
      ])

  })

  it('join must have a flat storage', async () => {
    const { query, join } = scope<ToDoFact>()

    const q =
      join({
        side: query(TODO_COMPLETED),
        nst: join({
          side: query(TODO_COMPLETED),
          nst: join({
            side: query(TODO_COMPLETED),
            nst: join({
              side: query(TODO_COMPLETED),
              nst: query(TODO_ACTIVATED),
            }),
          }),
        })
      })

    let input: Pack<KSingle, ToDoFact> = [
      entry('', { type: TODO_ACTIVATED, id: "1" }, 1, false),
      entry('', { type: TODO_COMPLETED, id: "1" }, 2, false),
    ]
    const ctx = query.emptyContext.withInlet(input)
    let out = await QueryTailImpl.exec(q).runS(ctx)

    const storage = {
      'side': { type: 'TODO_COMPLETED', id: '1' },
      'nst.side': { type: 'TODO_COMPLETED', id: '1' },
      'nst.nst.side': { type: 'TODO_COMPLETED', id: '1' },
      'nst.nst.nst.side': { type: 'TODO_COMPLETED', id: '1' },
      'nst.nst.nst.nst': { type: 'TODO_ACTIVATED', id: '1' },
    }

    const meta = {
      'side': 2,
      'nst.side': 2,
      'nst.nst.side': 2,
      'nst.nst.nst.side': 2,
      'nst.nst.nst.nst': 1,
    }

    const value = {
      "side": { "type": "TODO_COMPLETED", "id": "1" },
      "nst": {
        "side": { "type": "TODO_COMPLETED", "id": "1" },
        "nst": {
          "side": { "type": "TODO_COMPLETED", "id": "1" },
          "nst": {
            "side": { "type": "TODO_COMPLETED", "id": "1" },
            "nst": { "type": "TODO_ACTIVATED", "id": "1" }
          }
        }
      }
    }


    const valuePack = await QueryTailImpl.readAll(q).run(out.storage)

    expect(await out.storage.readValues()).toStrictEqual(storage)
    expect(await out.storage.readMeta()).toStrictEqual(meta)
    expect(_.head(valuePack)?.value).toStrictEqual(value)
  })



  it('permutations of publishing', async () => {
    const { query, join } = scope<ToDoFact>()

    const machDouble =
      join({
        one: query(CREATE_TODO).internal(TODO_ACTIVATED),
        three: query(TODO_ACTIVATED).internal(TODO_COMPLETED)
      })

    const machFlat =
      join({
        one: query(CREATE_TODO).internal(TODO_ACTIVATED).internal(TODO_COMPLETED),//.map(v => v),
      })


    const event: CreateToDo = { type: CREATE_TODO, title: "olololol" }
    const initStorage = query.emptyContext.withInletEvent(event)

    const eventsDouble = await QueryTailImpl.execDeep(machDouble).runS(initStorage)
    const eventsFlat = await QueryTailImpl.execDeep(machFlat).runS(initStorage)

    expect(eventsDouble.outletIn.map(v => v.value)).toStrictEqual([
      { type: TODO_ACTIVATED, title: "olololol" },
      { type: TODO_COMPLETED, title: "olololol" }
    ])
    expect(eventsDouble.outletIn).toStrictEqual(eventsFlat.outletIn)

  })

  it('once method with keys', async () => {

    const { query } = scope<ToDoFact>()

    // Test once() behavior with multiple keys
    const onceQuery = query(TODO_ACTIVATED).by.id.once()
    const counterQuery = onceQuery.as(1).reduce((a, b) => a + b)

    let input: ToDoFact[] = [
      { type: TODO_ACTIVATED, id: "1" },
      { type: TODO_ACTIVATED, id: "1" }, // Duplicate for key "1"
      { type: TODO_ACTIVATED, id: "2" },
      { type: TODO_ACTIVATED, id: "1" }, // Another duplicate for key "1"
      { type: TODO_ACTIVATED, id: "2" }  // Duplicate for key "2"
    ]

    const result = await QueryTailImpl.runQuery(onceQuery, input)
    const counterResult = await QueryTailImpl.runQuery(counterQuery, input)

    // Fixed: once() should process the first event for each key
    expect(result).toEqual({
      "1": { type: TODO_ACTIVATED, id: "1" },
      "2": { type: TODO_ACTIVATED, id: "2" }
    })

    // Fixed: Counter should show each key triggered only once
    expect(counterResult).toEqual({
      "1": 1, // Only first TODO_ACTIVATED for id "1"
      "2": 1  // Only first TODO_ACTIVATED for id "2"
    })
  })

  it('once publishing', async () => {
    const { query, join } = scope<ToDoFact>()

    const qu =
      join({
        one: query(CREATE_TODO).once().internal(TODO_ACTIVATED)
      })


    const events: Pack<string, ToDoFact> = [
      entry('', { type: CREATE_TODO, title: "olololol" }, 0),
      entry('', { type: CREATE_TODO, title: "olololol" }, 1),
    ]
    const initStorage = query.emptyContext.withInlet(events)

    const eventsDouble = await QueryTailImpl.exec(qu).runS(initStorage)

    expect(eventsDouble.outletIn.map(v => v.value)).toStrictEqual([
      { type: TODO_ACTIVATED, title: "olololol" },
    ])
  })

  it('publish async', async () => {

    const { query } = scope<ToDoFact>()

    const createQuery =
      query(TODO_CREATED).publishAsync(() => cb => {
        cb({ type: TODO_COMPLETED, id: "1" })
        cb({ type: TODO_ACTIVATED, id: "1" })
      })

    let counter = 0
    const publish = () => { counter = counter + 1 }

    await QueryTailImpl.exec(createQuery).runS(
      query.emptyContext
        .withInletEvent({ type: TODO_CREATED, id: "1", title: "todo1" })
        .withOutletAsync(publish)
    )

    expect(counter).toStrictEqual(2)
  })

  it('publish async with clear', async () => {
    const { query } = scope<ToDoFact>()

    let callback: (event: ToDoFact) => void = () => { }
    let subsCount: number = 0
    const subscribe = (cb: (event: ToDoFact) => void) => {
      callback = cb
      subsCount = subsCount + 1
    }
    let unsubsCount: number = 0
    const unsubscribe = (cb: (event: ToDoFact) => void) => {

      if (cb == callback) {
        callback = () => { }
        unsubsCount = unsubsCount + 1
      }
    }

    const fullQuery =
      query(CREATE_TODO).publishAsync(todo => pub => {

        const cb = (event: ToDoFact) => pub(event)

        subscribe(cb)
        return () => unsubscribe(cb)
      }, query(TODO_UNLISTEN))

    let published: ToDoFact[] = []
    const expected: ToDoFact = { type: TODO_CREATED, title: "todo1", id: "1" }
    const expectedPublished = [expected]

    const out = await QueryTailImpl.execDeep(fullQuery).runS(
      query.emptyContext
        .withInletEvent({ type: CREATE_TODO, title: "todo1" })
        .withOutletAsync((event: ToDoFact) => { published.push(event) })
    )
    expect(subsCount).toStrictEqual(1)

    callback(expected)
    await timeout(0)

    expect(published).toStrictEqual([expected])

    await QueryTailImpl.execDeep(fullQuery).runS(out.withInletEvent({ type: TODO_UNLISTEN, id: "1" }))

    callback(expected)
    await timeout(0)

    expect(published).toStrictEqual(expectedPublished)
    expect(unsubsCount).toStrictEqual(1)
  })

  it('simple counter', async () => {

    type CounterEvent =
      | { type: 'INCREMENT' }
      | { type: 'DECREMENT' }
      | { type: 'SET_VALUE', value: number }

    const { query, store, action } = scope<CounterEvent>()
    const counterStore = store({
      // Actions that emit events
      increment: action().internal('INCREMENT'),
      decrement: action().internal('DECREMENT'),
      setValue: action((value: number) => ({ type: 'SET_VALUE', value })).internal(),

      // Clean counter using fold with initial value and proper state management
      count: query('INCREMENT', 'DECREMENT', 'SET_VALUE')
        .fold(0, (current, event) => {
          switch (event.type) {
            case 'INCREMENT': return current + 1
            case 'DECREMENT': return current - 1
            case 'SET_VALUE': return event.value
            default: return current
          }
        })
    })

    const main = runMain({ counterStore })

    // Test all operations
    await main.actions(counterStore).setValue(0)
    await main.actions(counterStore).increment()
    await main.actions(counterStore).increment()
    await main.actions(counterStore).decrement()
    await main.actions(counterStore).setValue(10)
    await main.actions(counterStore).increment()
    await timeout(0)

    const count = await main.readQuery(counterStore.count)
    expect(count).toBe(11)
  })

  it('simple todo', async () => {
    const { query, join } = scope<ToDoFact>()

    const fullQuery =
      join({
        created: query(CREATE_TODO)
          .random((v, r) => ({ ...v, id: r.toString() }))
          .by.id
          .internal(TODO_CREATED),

        all: join({
          id: query(TODO_CREATED).by.id.select.id,
          title: query(TODO_CREATED).by.id.select.title,
          active: query(
            query(TODO_CREATED).by.id.as(true),
            query(TODO_ACTIVATED).by.id.as(true),
            query(TODO_COMPLETED).by.id.as(false),
          )
        }).internal(TODO),
        active: query(TODO).by.id.filter(todo => todo.active).optional(),
      })

    const input: ToDoFact[] = [
      { type: CREATE_TODO, title: "todo1" },
      { type: CREATE_TODO, title: "todo2" },
      { type: CREATE_TODO, title: "todo3" },
    ]
    const ctx = query.emptyContext.withInletEvent(input)
    const out = await QueryTailImpl.execDeep(fullQuery).runS(ctx)


    const todo1Query = fullQuery.map(v => v.all).filter(v => v.title == "todo1")
    const todo1Res = await QueryTailImpl.readMapAsync(todo1Query, out)
    const createdId = Array.from(todo1Res.values())[0].id

    let input2: Pack<'', ToDoFact> = singlePack('', { type: TODO_COMPLETED, id: createdId }, 3)

    const out2 = await QueryTailImpl.execDeep(fullQuery).runS(out.withInlet(input2).withOutletIn([]))

    const resultQuery = fullQuery.map(v => ({ title: v.all.title, active: v.all.active }))

    const result = await QueryTailImpl.readMapAsync(resultQuery, out2)

    expect(_.chain(Array.from(result.values())).sortBy(v => v.title).value()).toStrictEqual([
      { title: "todo1", active: false },
      { title: "todo2", active: true },
      { title: "todo3", active: true },
    ])

    const activeQuery = fullQuery
      .filter(v => !_.isEmpty(v.active))
      .map(v => v.active!)
      .map(v => ({ title: v.title }))

    const active = await QueryTailImpl.readMapAsync(activeQuery, out2)

    expect(_.chain(Array.from(active.values())).sortBy(v => v.title).value()).toStrictEqual([
      { title: "todo2" },
      { title: "todo3" },
    ])

  })

  it('recursive processing in store', async () => {
    const { query, store } = scope<ToDoFact>()
    const repeatNumber = 10000
    const ones = _.range(0, repeatNumber).map(() => "1").join("")
    const id = '4321'

    const fullStore =
      store({
        one: query(TODO_CREATED)
          .map(ev => ({ ...ev, title: ev.title + '1' }))
          .filter(ev => ev.title.length <= repeatNumber)
          .internal(TODO_CREATED)
          .by.id
      })

    const executor = new StoreExecutor(fullStore)
    executor.publish({ type: TODO_CREATED, id: id, title: "" })

    await timeout(0)

    const one = (await executor.readQuery(fullStore.one)) || {}

    expect(one[id].title).toEqual(ones)
  })

  it('simple store combination', async () => {

    const { query, store } = scope<ToDoFact>()

    const todoCreatedFirst =
      store({
        first: query(TODO_CREATED).map(() => 1),
      })
    const todoCreatedSecond =
      store({
        second: query(TODO_CREATED).map(() => '2'),
      })
    const todoCreatedThird =
      store({
        third: query(TODO_CREATED).map(() => '3'),
      })
    const todoCreatedFourth =
      store({
        fourth: query(TODO_CREATED).map(() => '4'),
      })
    const todoCreatedFifth =
      store({
        fifth: query(TODO_CREATED).map(() => '5'),
      })
    const todoCreatedSixth =
      store({
        sixth: query(TODO_CREATED).map(() => '6'),
      })

    const combined0 = store(
      todoCreatedFirst,
      todoCreatedSecond,
      todoCreatedThird,
      todoCreatedFourth,
      todoCreatedFifth,
      todoCreatedSixth
    )

    const combined = store(combined0, {
      secondLevel: query(TODO_CREATED).as(''),
    })


    const executor = new StoreExecutor(combined)

    executor.publish({ type: TODO_CREATED, id: "1", title: "todo1" })
    executor.publish({ type: TODO_ACTIVATED, id: "1" })

    await executor.inprogress
    const first = await executor.readQuery(combined.first)
    const second = await executor.readQuery(combined.second)
    const third = await executor.readQuery(combined.secondLevel)


    expect(first).toEqual(1)
    expect(second).toEqual('2')
    expect(third).toEqual('')
  })

  it('combined join single fire', async () => {

    const { query, join, store } = scope<ToDoFact>()

    let counter = 0
    const fullStore =
      store({
        res: join({
          first: query(TODO_CREATED),
          second: query(TODO_ACTIVATED),
        }).evalMap(v => {
          counter = counter + 1
          return Promise.resolve(v)
        })
      })

    const executor = new StoreExecutor(fullStore)
    executor.publish({ type: TODO_CREATED, id: "1", title: "todo1" })
    executor.publish({ type: TODO_ACTIVATED, id: "1" })

    await executor.inprogress

    expect(counter).toEqual(1)
  })

  it('query store', async () => {

    const { query, join, store } = scope<ToDoFact>()

    const fullStore = store({
      created: query(CREATE_TODO)
        .random((v, r) => ({ ...v, id: r.toString() }))
        .by.id
        .internal(TODO_CREATED),

      all: join({
        id: query(TODO_CREATED).by.id.map(v => v.id),
        title: query(TODO_CREATED).by.id.map(v => v.title),
        active: query(
          query(TODO_CREATED).by.id.as(true),
          query(TODO_ACTIVATED).by.id.as(true),
          query(TODO_COMPLETED).by.id.as(false),
        )
      }).internal(TODO),
      active: query(TODO).by.id.filter(todo => todo.active),
    })

    const executor = new StoreExecutor(fullStore)
    const input: ToDoFact[] = [
      { type: CREATE_TODO, title: "todo1" },
      { type: CREATE_TODO, title: "todo2" },
      { type: CREATE_TODO, title: "todo3" },
    ]

    // fullStore.listener.created.listen(value => value)

    input.map(ev => executor.publish(ev))


    await executor.inprogress
    const created = await executor.readQuery(fullStore.created)

    expect(titles(created)).toStrictEqual(["todo1", "todo2", "todo3"])


    const todo1Id = _.find(created, v => v.title == "todo1")!.id

    executor.publish({ type: TODO_COMPLETED, id: todo1Id })

    await timeout(0)

    const result2 = await executor.readQuery(fullStore.active)

    expect(titles(result2)).toStrictEqual(["todo2", "todo3"])

  })

  it('query store listener by key', async () => {

    const { query, store } = scope<ToDoFact>()

    const fullStore = store({
      created: query(TODO_CREATED).by.id.evalMap(v => Promise.resolve(v))
    })

    const executor = new StoreExecutor(fullStore)

    let created;
    executor.listenQuery(fullStore.created, v => {
      created = v
    })

    executor.publish({ type: TODO_CREATED, id: "1", title: "todo1" })
    await timeout(0)

    expect(created).toStrictEqual({
      "1": { type: TODO_CREATED, id: "1", title: "todo1" },
    })
  })


  it('query store listener fire counters', async () => {

    const { query, store } = scope<ToDoFact>()

    const fullStore = store({
      created: query(TODO_CREATED).by.id,
      completed: query(TODO_COMPLETED).by.id,
    })

    const executor = new StoreExecutor(fullStore)

    let counter = 0
    executor.listenQuery(fullStore.created, () => {
      counter = counter + 1
    })
    await timeout(0)

    executor.publish({ type: TODO_CREATED, id: "1", title: "todo1" })
    executor.publish({ type: TODO_COMPLETED, id: "1" })
    await timeout(0)

    let counter2 = 0
    executor.listenQuery(fullStore.created, () => {
      counter2 = counter2 + 1
    })
    await timeout(0)

    expect(counter).toStrictEqual(2)
    expect(counter2).toStrictEqual(1)
  })

  it('query store listener', async () => {

    const { query, store, action } = scope<ToDoFact>()

    const fullStore = store({
      create: action((id: string) => ({ id, title: "todo1" })).internal(TODO_CREATED),
      created: query(TODO_CREATED).by.id.select.title
    })

    const executor = new StoreExecutor(fullStore)

    let created: Record<string, string> = {}
    executor.listenQuery(fullStore.created, v => {
      created = v
    })

    await executor.action(fullStore.create)("1")
    await timeout(0)

    expect(created).toStrictEqual({ "1": "todo1" })
  })

  it('publish async store', async () => {

    const { query, store } = scope<ToDoFact>()

    const fullStore = store({
      created: query(TODO_CREATED).publishAsync(todo => cb => {
        cb({ type: TODO_COMPLETED, id: todo.id })
        cb({ type: TODO_ACTIVATED, id: todo.id })
      }),

      activated: query(TODO_ACTIVATED).select.id,
    })


    const executor = new StoreExecutor(fullStore)
    executor.publish({ type: TODO_CREATED, id: "1", title: 'todo1' })

    await timeout(0)
    const activated = await executor.readQuery(fullStore.activated)

    expect(activated).toStrictEqual("1")
  })

  it('store communication', async () => {

    const CREATE_TODO = 'CREATE_TODO'
    const TODO_CREATED = 'TODO_CREATED'
    type TodoEvent =
      | { type: typeof CREATE_TODO, text: string }
      | { type: typeof TODO_CREATED, id: string, text: string }

    function makeFrontend() {

      const { query, store } = scope<TodoEvent>()

      return store({
        published: query(CREATE_TODO).external(),
        list: query(TODO_CREATED).by.id.latest(),
      })
    }

    const CREATE_TODO_REQUEST = 'CREATE_TODO_REQUEST'
    const TODO_CREATED_RESPONSE = 'TODO_CREATED_RESPONSE'
    type BackendEvent =
      | { type: typeof CREATE_TODO_REQUEST, text: string }
      | { type: typeof TODO_CREATED_RESPONSE, id: string, text: string }

    function makeBackend() {

      const { query, store } = scope<BackendEvent>()

      return store({
        published: query(CREATE_TODO_REQUEST).map(v => ({ id: v.text })).external(TODO_CREATED_RESPONSE),
      })
    }

    function makeBridge() {

      const { query, store } = scope<BackendEvent | TodoEvent>()

      return store({
        fromBackend: query(TODO_CREATED_RESPONSE).external(TODO_CREATED),
        fromFrontend: query(CREATE_TODO).external(CREATE_TODO_REQUEST),
      })
    }

    const feStore = makeFrontend()
    const beStore = makeBackend()
    const bridgeStore = makeBridge()

    const main = runMain({ feStore, beStore, bridgeStore })


    main.publish({ type: CREATE_TODO, text: "todo1" })
    main.publish({ type: CREATE_TODO, text: "todo2" })
    main.publish({ type: CREATE_TODO, text: "todo3" })

    await timeout(0)

    const list = await main.readQuery(feStore.list)

    expect(_.keys(list).length).toStrictEqual(3)
  })

  it('hero-code example from docs', async () => {
    
    // Reuse existing ToDoFact types (matching the hero-code.tsx example)
    const { query, action, store, join } = scope<ToDoFact>()

    // Helper to generate unique IDs (simplified uuid)
    const uuid = () => Math.random().toString(36).substring(2, 15)

    const todoStore = store({
      // call this to make todos
      create: action((title: string) => ({ type: TODO_CREATED, id: uuid(), title })).internal(),
      complete: action((id: string) => ({ type: TODO_COMPLETED, id })).internal(),
      // this updates itself when you create todos
      todos: query(TODO_CREATED).by.id,
      // shows only todos that haven't been completed yet
      active: join({
          created: query(TODO_CREATED).by.id,
          completed: query(TODO_COMPLETED).by.id.optional()
        })
        .filter(todos => !todos.completed)
        .map(todos => todos.created)
    })

    const main = runMain({ todoStore })

    // Test creating and completing todos
    const todo1 = await main.actions(todoStore).create("Learn Qume")
    const todo2 = await main.actions(todoStore).create("Build awesome app")
    await timeout(0)

    // Critical: Verify both todos are active initially
    const activeTodos = await main.readQuery(todoStore.active)
    expect(Object.keys(activeTodos)).toHaveLength(2)

    // Complete one todo
    await main.actions(todoStore).complete(todo1.id)
    await timeout(0)

    // Critical: Verify only uncompleted todo remains active
    const activeAfterComplete = await main.readQuery(todoStore.active)
    expect(Object.keys(activeAfterComplete)).toHaveLength(1)
    expect(activeAfterComplete[todo2.id]).toBeDefined()
  })

  function timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  function titles(rec: Record<any, ToDoCreated | ToDo>): string[] {
    return _.chain(rec).map(({ title }) => (title)).sortedUniq().value().sort()
  }

});

