import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Регистрация Service Worker для PWA и офлайн-кэширования
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => {
        console.log('PWA ServiceWorker registered with scope:', reg.scope);
      })
      .catch(err => {
        console.warn('PWA ServiceWorker registration failed:', err);
      });
  });
}
