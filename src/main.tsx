import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './fonts';
import './styles.css';
import App from './App';
import { debugView } from './config';
import { DebugTextures } from './ui/DebugTextures';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{debugView === 'textures' ? <DebugTextures /> : <App />}</StrictMode>,
);
