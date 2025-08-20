export const CREATE_TODO = 'CREATE_TODO'
export const TODO_CREATED = 'TODO_CREATED'
export const TODO_ACTIVATED = 'TODO_ACTIVATED'
export const TODO_COMPLETED = 'TODO_COMPLETED'
export const TODO = 'TODO'

export type CreateToDo = { type: typeof CREATE_TODO, title: string }
export type ToDoCreated = { type: typeof TODO_CREATED, id: string, title: string }
export type ToDoActivated = { type: typeof TODO_ACTIVATED, id: string }
export type ToDoCompleted = { type: typeof TODO_COMPLETED, id: string }
export type ToDo = { type: typeof TODO, id: string, title: string, active: boolean }

export type ToDoFact =
  | CreateToDo
  | ToDoCreated
  | ToDoActivated
  | ToDoCompleted
  | ToDo