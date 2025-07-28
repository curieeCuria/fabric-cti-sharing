import React, { useContext, useState, useEffect } from 'react';
import { BundleContext } from '../contexts/BundleContext';
import { Typography, CircularProgress } from '@mui/material';

const GraphView = () => {
  const { bundles } = useContext(BundleContext);
  const [selectedCTI, setSelectedCTI] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCTI = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/bundle/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedCTI(data);
      } else {
        alert('Failed to fetch CTI');
      }
    } catch (error) {
      alert('Error fetching CTI');
    }
    setLoading(false);
  };

  return (
    <div>
      <Typography variant="h5">CTI Graph View</Typography>
      {bundles.map((meta) => (
        <div key={meta.id}>
          <button onClick={() => fetchCTI(meta.id)} disabled={loading}>
            {meta.id} (by {meta.createdBy})
          </button>
          {loading && <CircularProgress />}
          {selectedCTI && selectedCTI.id === meta.id && (
            <pre>{JSON.stringify(selectedCTI, null, 2)}</pre>
          )}
        </div>
      ))}
    </div>
);
};

export default GraphView;