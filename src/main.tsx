import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './modules/App';
import {ScreenBoundary,screenErrorOptions} from './modules/ScreenBoundary';
import './styles.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

createRoot(document.getElementById('root')!,screenErrorOptions).render(<React.StrictMode><ScreenBoundary screen="EcoVibes" onHome={()=>window.location.assign('/')}><App /></ScreenBoundary></React.StrictMode>);
