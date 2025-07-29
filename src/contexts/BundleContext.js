import React, { createContext, useState, useEffect } from 'react';

export const BundleContext = createContext();

export const BundleProvider = ({ children }) => {
  const [bundle, setBundle] = useState({ objects: [] });

  useEffect(() => {
    fetch('/stix-bundle.json')
      .then(res => res.json())
      .then(data => setBundle(data));
  }, []);

  return (
    <BundleContext.Provider value={{ bundle, setBundle }}>
      {children}
    </BundleContext.Provider>
  );
};
