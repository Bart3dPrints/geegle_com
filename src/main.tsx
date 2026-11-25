import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GeegleRoot } from './GeegleRoot';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GeegleRoot />
  </StrictMode>
);
