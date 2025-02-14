import React from 'react';
import './App.css';
import './index.css';
import LandingPage from './components/LandingPage';
import NewGame from './components/NewGame';
import { BrowserRouter, Route, Routes} from 'react-router-dom';
function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<LandingPage/>}/>
          <Route path='/newgame' element={<NewGame/>}/>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
