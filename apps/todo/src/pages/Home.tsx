import React, { useState } from 'react';
import { IonContent, IonItem, IonLabel, IonList, IonPage, IonCheckbox, IonButton, IonInput } from '@ionic/react';
import { useStore } from 'qume-react';
import { todoStore } from '../features/todoStore';
import { ToDo } from '../features/todoTypes';

const Home: React.FC = () => {
  const [newTodoTitle, setNewTodoTitle] = useState('');

  // Get store values and actions
  const [storeValues, actions] = useStore(todoStore);

  // Extract todos from store
  const allTodos = storeValues.all || {};
  const activeTodos = storeValues.active || {};
  const completedTodos = storeValues.completed || {};

  const handleAddTodo = async () => {
    if (newTodoTitle.trim()) {
      await actions.create(newTodoTitle.trim());
      setNewTodoTitle('');
    }
  };

  const handleToggleTodo = async (id: string, isCompleted: boolean) => {
    if (isCompleted) {
      await actions.activate(id);
    } else {
      await actions.complete(id);
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50">
        <div className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto">
          <div className="p-6 sm:bg-white sm:rounded-3xl sm:shadow-xl">
            <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Todo Manager</h1>

            {/* Add new todo section */}
            <div className="mb-6">
              <IonInput
                className="mb-3"
                value={newTodoTitle}
                placeholder="Enter todo title"
                onIonInput={(e) => setNewTodoTitle(e.detail.value || '')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const currentValue = (e.target as HTMLIonInputElement).value as string || '';
                    if (currentValue.trim()) {
                      actions.create(currentValue.trim());
                      setNewTodoTitle('');
                    }
                  }
                }}
              />
              <IonButton expand="block" onClick={handleAddTodo} disabled={!newTodoTitle.trim()} >
                Add Todo
              </IonButton>
            </div>

            {/* Todo lists */}
            {Object.keys(allTodos).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No todos yet. Add one above to get started!
              </div>
            ) : (
              <>
                {/* Active Todos */}
                {Object.keys(activeTodos).length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-700">
                        Active Tasks
                      </h3>
                      <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                        {Object.keys(activeTodos).length}
                      </span>
                    </div>
                    <IonList>
                      {(Object.values(activeTodos) as ToDo[]).map((todo) => (
                        <IonItem key={todo.id}>
                          <IonCheckbox
                            slot="start"
                            checked={false}
                            onIonChange={() => handleToggleTodo(todo.id, false)}
                          />
                          <IonLabel>
                            <h2>{todo.title}</h2>
                            <p>ID: {todo.id}</p>
                          </IonLabel>
                        </IonItem>
                      ))}
                    </IonList>
                  </div>
                )}

                {/* Completed Todos */}
                {Object.keys(completedTodos).length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-700">
                        Completed Tasks
                      </h3>
                      <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                        {Object.keys(completedTodos).length}
                      </span>
                    </div>
                    <IonList>
                      {(Object.values(completedTodos) as ToDo[]).map((todo) => (
                        <IonItem key={todo.id}>
                          <IonCheckbox
                            slot="start"
                            checked={true}
                            onIonChange={() => handleToggleTodo(todo.id, true)}
                          />
                          <IonLabel>
                            <h2 className="opacity-60"> {todo.title} </h2>
                            <p>ID: {todo.id}</p>
                          </IonLabel>
                        </IonItem>
                      ))}
                    </IonList>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
