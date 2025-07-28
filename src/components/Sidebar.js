import React from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Toolbar } from '@mui/material';
import { Dashboard, Timeline, Share, AccountTree, AdminPanelSettings, Code } from '@mui/icons-material';
import { Link } from 'react-router-dom';

const drawerWidth = 240;

const Sidebar = () => {
  const token = localStorage.getItem('token');
  let isAdmin = false;
  if (token) {
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      isAdmin = decoded.enrollmentId === 'admin';
    } catch (error) {
      console.error('Error decoding token:', error);
    }
  }

  return (
    <Drawer
      variant="permanent"
      sx={{ width: drawerWidth, flexShrink: 0, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }}
    >
      <Toolbar />
      <List>
        <ListItem button component={Link} to="/">
          <ListItemIcon><Dashboard /></ListItemIcon>
          <ListItemText primary="Manage" />
        </ListItem>
        <ListItem button component={Link} to="/timeline">
          <ListItemIcon><Timeline /></ListItemIcon>
          <ListItemText primary="Timeline" />
        </ListItem>
        <ListItem button component={Link} to="/graph">
          <ListItemIcon><AccountTree /></ListItemIcon>
          <ListItemText primary="Graph" />
        </ListItem>
        <ListItem button component={Link} to="/share">
          <ListItemIcon><Share /></ListItemIcon>
          <ListItemText primary="Share" />
        </ListItem>
        {isAdmin && (
          <ListItem button component={Link} to="/admin">
            <ListItemIcon><AdminPanelSettings /></ListItemIcon>
            <ListItemText primary="Admin Dashboard" />
          </ListItem>
        )}
        <ListItem button component={Link} to="/submit-chaincode">
          <ListItemIcon><Code /></ListItemIcon>
          <ListItemText primary="Submit Chaincode" />
        </ListItem>
      </List>
    </Drawer>
  );
};

export default Sidebar;