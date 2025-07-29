import React, { useContext, useState } from 'react';
import { BundleContext } from '../contexts/BundleContext';
import { Button, TextField, Card, CardContent, CardActions, Snackbar } from '@mui/material';

const ShareView = () => {
  const { bundle } = useContext(BundleContext);
  const [channelName, setChannelName] = useState('');
  const [chaincodeName, setChaincodeName] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const handleShare = () => {
    fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName, chaincodeName, bundle })
    })
      .then(res => res.json())
      .then(() => setSnackbar({ open: true, message: 'Shared successfully' }))
      .catch(() => setSnackbar({ open: true, message: 'Share failed' }));
  };

  return (
    <div>
      <h2>Share CTI Bundle</h2>
      <Card sx={{ maxWidth: 600, mb: 2 }}>
        <CardContent>
          <TextField
            label="Channel Name"
            fullWidth
            margin="dense"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
          />
          <TextField
            label="Chaincode Name"
            fullWidth
            margin="dense"
            value={chaincodeName}
            onChange={(e) => setChaincodeName(e.target.value)}
          />
        </CardContent>
        <CardActions>
          <Button variant="contained" onClick={handleShare}>Share</Button>
        </CardActions>
      </Card>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
      />
    </div>
  );
};

export default ShareView;
