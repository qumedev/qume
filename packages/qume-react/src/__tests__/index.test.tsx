import * as React from "react";
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { scope } from 'qume'
import { QumeProvider, useAction, usePublisher, useQuery } from "..";


const TODO_CREATED = 'TODO_CREATED'
const TODO_ACTIVATED = 'TODO_ACTIVATED'
const TODO_COMPLETED = 'TODO_COMPLETED'

type ToDoCreated = { type: typeof TODO_CREATED, id: string, title: string }
type ToDoActivated = { type: typeof TODO_ACTIVATED, id: string }
type ToDoCompleted = { type: typeof TODO_COMPLETED, id: string }

type ToDoFact =
  | ToDoCreated
  | ToDoActivated
  | ToDoCompleted

const { query, join, store, runMain, action } = scope<ToDoFact>()

export const todoStore = store({
  create: action((title: string) => title)
    .random((title, r) => ({ title, id: r.toString() }))
    .internal(TODO_CREATED),

  all: join({
    id: query(TODO_CREATED).byId().map(v => v.id),
    title: query(TODO_CREATED).byId().map(v => v.title),
    active: query(
      query(TODO_CREATED).byId().as(true),
      query(TODO_ACTIVATED).byId().as(true),
      query(TODO_COMPLETED).byId().as(false),
    )
  })
})

const main = runMain({ todoStore })


const ToDoList: React.FC = () => {

  const all = useQuery(todoStore.all)
  const createTodo = useAction(todoStore.create)

  const activeOnly = Object.values(all)
    .filter(todo => todo.active)
    .map(v => v.title)

  React.useEffect(() => {
    createTodo("new todo")
  }, [])

  return (
    <div> {activeOnly.map(todo => <div key={todo}>{todo}</div>)} </div>
  );
};


describe("ToDoList", () => {
  it("renders and creates a todo", async () => {
    // Create the test DOM element
    const div = document.createElement("div");
    const root = createRoot(div);

    // Use act to handle the component rendering and updates
    await act(async () => {
      root.render(
        <QumeProvider main={main}>
          <ToDoList />
        </QumeProvider>
      );

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Verify component rendered the todo
    expect(div.textContent).toContain("new todo");

    // Check store state
    const storeState = await main.readQuery(todoStore.all);
    const todoItems = Object.values(storeState);

    expect(todoItems.length).toBeGreaterThan(0);
    expect(todoItems.some(todo => todo.title === "new todo")).toBeTruthy();
    expect(todoItems.every(todo => todo.active)).toBeTruthy();
  });
});
