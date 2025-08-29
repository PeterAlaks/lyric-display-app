import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import ControlPanel from './pages/ControlPanel';
import Output1 from './pages/Output1';
import Output2 from './pages/Output2';
import NewSongCanvas from './components/NewSongCanvas';

const Router = import.meta.env.MODE === 'development' ? BrowserRouter : HashRouter;

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ControlPanel />} />
        <Route path="/output1" element={<Output1 />} />
        <Route path="/output2" element={<Output2 />} />
        <Route path="/new-song" element={<NewSongCanvas />} />
      </Routes>
    </Router>
  );
}