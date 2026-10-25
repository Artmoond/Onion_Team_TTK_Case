import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Регистрация Service Worker для PWA с гарантией мгновенного обновления версий
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => {
        // Запрашиваем проверку новой версии при каждом открытии страницы
        reg.update();

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                // Если новая версия активировалась — перезагружаем для немедленного применения изменений
                window.location.reload();
              }
            });
          }
        });
      })
      .catch(err => {
        console.warn('PWA ServiceWorker registration failed:', err);
      });
  });
}
