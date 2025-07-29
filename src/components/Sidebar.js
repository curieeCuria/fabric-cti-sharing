import React from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Toolbar } from '@mui/material';
import { Dashboard, Timeline, Share, AccountTree } from '@mui/icons-material';
import { Link } from 'react-router-dom';

const drawerWidth = 240;

const Sidebar = () => (
  <Drawer
    variant="permanent"
    sx={{
      width: drawerWidth,
      flexShrink: 0,
      '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
    }}
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
    </List>
  </Drawer>
);

export default Sidebar;
