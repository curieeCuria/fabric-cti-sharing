import React, { useContext } from 'react';
import { BundleContext } from '../contexts/BundleContext';
import { Typography, List, ListItem, ListItemText } from '@mui/material';

const ManageView = () => {
  const { bundles } = useContext(BundleContext);

  return (
    <div>
      <Typography variant="h5">Manage CTI</Typography>
      <List>
        {bundles.map((meta) => (
          <ListItem key={meta.id}>
            <ListItemText primary={meta.id} secondary={`Created by: ${meta.createdBy}`} />
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export default ManageView;