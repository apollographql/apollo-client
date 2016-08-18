import * as types from './types';

export function addTodo(text: any): any {
  return { type: types.ADD_TODO, text };
}

export function deleteTodo(id: any): any {
  return { type: types.DELETE_TODO, id };
}

export function editTodo(id: any, text: any): any {
  return { type: types.EDIT_TODO, id, text };
}

export function completeTodo(id: any): any {
  return { type: types.COMPLETE_TODO, id };
}

export function completeAll(): any {
  return { type: types.COMPLETE_ALL };
}

export function clearCompleted(): any {
  return { type: types.CLEAR_COMPLETED };
}
