import { scope } from 'qume'
import { TODO, ToDoFact, TODO_ACTIVATED, TODO_COMPLETED, TODO_CREATED } from './todoTypes'

const { query, join, store, action } = scope<ToDoFact>()

export const todoStore = store({
  // Action to create new todos
  create: action((title: string) => ({
    id: Math.random().toString(36).substring(2, 15),
    title: title,
  })).internal(TODO_CREATED),

  complete: action((id: string) => ({ id })).internal(TODO_COMPLETED),
  activate: action((id: string) => ({ id })).internal(TODO_ACTIVATED),

  // Store all created todos by id
  todos: query(TODO_CREATED).by.id,

  // Create full todo objects with active status
  all: join({
    id: query(TODO_CREATED).by.id.select.id,
    title: query(TODO_CREATED).by.id.select.title,
    active: query(
      query(TODO_CREATED).by.id.as(true),
      query(TODO_ACTIVATED).by.id.as(true),
      query(TODO_COMPLETED).by.id.as(false),
    )
  }).internal(TODO),

  // Filter only active todos
  active: query(TODO).by.id.filter(todo => todo.active),

  // Filter only completed todos
  completed: query(TODO).by.id.filter(todo => !todo.active),
})
