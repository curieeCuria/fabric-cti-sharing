import React, { createContext, useState, useEffect } from 'react';

export const BundleContext = createContext();

export const BundleProvider = ({ children }) => {
  const [bundles, setBundles] = useState([]);
  const [page, setPage] = useState(0);
  const limit = 10;

  useEffect(() => {
    const fetchBundles = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`http://localhost:5000/api/bundles?startKey=${page * limit}&limit=${limit}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setBundles(prev => [...prev, ...data]);
        } else {
          console.error('Failed to fetch bundles');
        }
      } catch (error) {
        console.error('Error fetching bundles:', error);
      }
    };
    fetchBundles();
  }, [page]);

  return (
    <BundleContext.Provider value={{ bundles, setPage }}>
      {children}
    </BundleContext.Provider>
  );
};