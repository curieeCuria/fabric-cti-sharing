import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BundleProvider } from './contexts/BundleContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BundleProvider>
      <App />
    </BundleProvider>
  </React.StrictMode>
);
