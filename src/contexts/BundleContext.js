import React, { createContext, useState } from 'react';

export const BundleContext = createContext();

export const BundleProvider = ({ children }) => {
  const [bundle, setBundle] = useState({ type: 'bundle', id: 'bundle--temp', spec_version: '2.1', objects: [] });
  return (
    <BundleContext.Provider value={{ bundle, setBundle }}>
      {children}
    </BundleContext.Provider>
  );
};
