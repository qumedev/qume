import { IonApp, setupIonicReact } from '@ionic/react';
import React from 'react';
import { Navigate, BrowserRouter, Route, Routes } from 'react-router-dom';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/display.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';


/* Theme variables */

import './theme/variables.css';


import Home from './pages/Home';
import { runMain } from 'qume';
import { QumeProvider } from 'qume-react';
import { todoStore } from './features/todoStore';


setupIonicReact({ mode: 'ios' });

const mainStore = runMain({ todoStore })


const App: React.FC = () => (
  <IonApp>
    <QumeProvider main={mainStore}>
      <BrowserRouter >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Navigate to="/" replace={true} />} />
        </Routes>
      </BrowserRouter>
    </QumeProvider>
  </IonApp>
);

export default App;
