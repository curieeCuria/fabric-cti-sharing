import React, { useState } from 'react';
import { TextField, Button, Card, CardContent, CardActions, Typography } from '@mui/material';

const ChaincodeSubmission = () => {
  const [formData, setFormData] = useState({ chaincodeName: '', version: '', file: '' });

  const handleChange = (e) => {
    if (e.target.name === 'file') {
      const reader = new FileReader();
      reader.onload = (event) => setFormData({ ...formData, file: event.target.result.split(',')[1] });
      reader.readAsDataURL(e.target.files[0]);
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/submit-chaincode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        alert('Chaincode submitted');
      } else {
        const error = await res.json();
        alert(`Failed: ${error.error}`);
      }
    } catch (error) {
      alert('Error submitting chaincode');
    }
  };

  return (
    <Card sx={{ maxWidth: 400, m: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5">Submit Chaincode</Typography>
        <TextField label="Chaincode Name" name="chaincodeName" fullWidth margin="dense" onChange={handleChange} />
        <TextField label="Version" name="version" fullWidth margin="dense" onChange={handleChange} />
        <TextField label="File" type="file" name="file" fullWidth margin="dense" onChange={handleChange} InputLabelProps={{ shrink: true }} />
      </CardContent>
      <CardActions>
        <Button variant="contained" onClick={handleSubmit}>Submit</Button>
      </CardActions>
    </Card>
  );
};

export default ChaincodeSubmission;