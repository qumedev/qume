import * as React from "react";
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { scope } from 'qume'
import { QumeProvider, useAction, usePublisher, useStore, useStoreActions, useStoreValues } from "..";


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

const main = runMain({})

const ToDoList: React.FC = () => {

  const [todoval, todoact] = useStore({
    create: action((title: string) => title)
      .random((title, r) => ({ title, id: r.toString() }))
      .internal(TODO_CREATED),

    all: join({
      id: query(TODO_CREATED).by.id.select.id,
      title: query(TODO_CREATED).by.id.select.title,
      active: query(
        query(TODO_CREATED).by.id.as(true),
        query(TODO_ACTIVATED).by.id.as(true),
        query(TODO_COMPLETED).by.id.as(false),
      )
    })
  })


  const activeOnly = Object.values(todoval.all).filter(todo => todo.active)


  React.useEffect(() => {
    todoact.create("new todo")
  }, [])

  return (
    <div>
      <button onClick={() => todoact.create("new todo")}>Create</button>
      <div>
        {activeOnly.map(todo => <div key={todo.id}>{todo.title}</div>)}
      </div>
    </div>
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
  });
});
