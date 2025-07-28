import React, { useContext, useState } from 'react';
import { BundleContext } from '../contexts/BundleContext';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot } from '@mui/lab';
import { Typography, Paper, CircularProgress } from '@mui/material';

const TimelineView = () => {
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
      <Typography variant="h5">CTI Timeline</Typography>
      <Timeline>
        {bundles.map((meta) => (
          <TimelineItem key={meta.id}>
            <TimelineSeparator>
              <TimelineDot onClick={() => fetchCTI(meta.id)} />
              <TimelineConnector />
            </TimelineSeparator>
            <TimelineContent>
              <Paper elevation={3} sx={{ p: 2 }}>
                <Typography variant="h6">{meta.id}</Typography>
                {loading && meta.id === selectedCTI?.id && <CircularProgress />}
                {selectedCTI && selectedCTI.id === meta.id && (
                  <Typography>Details: {JSON.stringify(selectedCTI, null, 2)}</Typography>
                )}
              </Paper>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  );
};

export default TimelineView;