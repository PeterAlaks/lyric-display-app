import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import ControlPanel from './pages/ControlPanel';
import Output1 from './pages/Output1';
import Output2 from './pages/Output2';
import NewSongCanvas from './components/NewSongCanvas';
import QRCodeDialog from './components/QRCodeDialog';
import useLyricsStore from './context/LyricsStore';

const Router = import.meta.env.MODE === 'development' ? BrowserRouter : HashRouter;

// QR Dialog Page Component
const QRDialogPage = () => {
  const { darkMode } = useLyricsStore();
  
  return (
    <div className={`min-h-screen flex items-center justify-center ${
      darkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <QRCodeDialog 
        isOpen={true} 
        onClose={() => window.close()} 
        darkMode={darkMode} 
      />
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ControlPanel />} />
        <Route path="/output1" element={<Output1 />} />
        <Route path="/output2" element={<Output2 />} />
        <Route path="/new-song" element={<NewSongCanvas />} />
        <Route path="/qr-dialog" element={<QRDialogPage />} />
      </Routes>
    </Router>
  );
}