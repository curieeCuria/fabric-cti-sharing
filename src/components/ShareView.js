import React, { useState } from 'react';
import { BundleContext } from '../contexts/BundleContext';
import { Button, TextField, Card, CardContent, CardActions, Snackbar, MenuItem, Select } from '@mui/material';

const ShareView = () => {
  const [formData, setFormData] = useState({ bundle: '', roles: [] });
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleChange = (e) => {
    setFormData({ ...formData, roles: e.target.value });
  };

  const handleShare = () => {
    fetch('http://localhost:5000/api/share', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ channelName: 'mychannel', chaincodeName: 'cti', bundle: formData.bundle, roles: formData.roles })
    })
      .then(res => res.json())
      .then(data => setSnackbar({ open: true, message: data.message || 'Share failed' }))
      .catch(() => setSnackbar({ open: true, message: 'Share failed' }));
  };

  return (
    <div>
      <h2>Share CTI Bundle</h2>
      <Card sx={{ maxWidth: 600, mb: 2 }}>
        <CardContent>
          <TextField
            label="CTI Bundle (JSON)"
            name="bundle"
            fullWidth
            margin="dense"
            multiline
            onChange={handleChange}
          />
          <Select
            multiple
            name="roles"
            value={formData.roles}
            onChange={handleRoleChange}
            fullWidth
            margin="dense"
          >
            <MenuItem value="analyst">Analyst</MenuItem>
            <MenuItem value="manager">Manager</MenuItem>
          </Select>
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