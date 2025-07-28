import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { BundleProvider } from './contexts/BundleContext';

ReactDOM.render(
  <BundleProvider>
    <App />
  </BundleProvider>,
  document.getElementById('root')
);