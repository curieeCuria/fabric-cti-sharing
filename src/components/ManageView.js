import React, { useContext, useState, useEffect } from 'react';
import { BundleContext } from '../contexts/BundleContext';
import {
  List, ListItem, ListItemText, IconButton, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, Chip, Box, Typography
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

const ManageView = () => {
  const { bundle, setBundle } = useContext(BundleContext);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editedObj, setEditedObj] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [objectToDelete, setObjectToDelete] = useState(null);
  const [filters, setFilters] = useState({ type: '', search: '', dateFrom: null, dateTo: null });

  // Initialize or reset editedObj when dialog opens
  useEffect(() => {
    if (dialogOpen && !editedObj) {
      setEditedObj({ type: '', name: '', description: '' });
    }
  }, [dialogOpen, editedObj]);

  // Debug: Log editedObj to track state changes
  useEffect(() => {
    console.log('editedObj:', editedObj);
  }, [editedObj]);

  const handleAdd = () => {
    setEditedObj({ type: '', name: '', description: '' });
    setDialogOpen(true);
  };

  const handleEdit = (obj) => {
    setEditedObj({ ...obj }); // Deep copy to avoid mutation
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    setObjectToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    setBundle({
      ...bundle,
      objects: bundle.objects.filter(o => o.id !== objectToDelete)
    });
    setDeleteDialogOpen(false);
    setObjectToDelete(null);
  };

  const handleSave = () => {
    if (!editedObj?.type) return; // Prevent save if no type selected
    const updatedObj = editedObj.id
      ? { ...editedObj } // Edit existing object
      : {
          ...editedObj,
          id: `${editedObj.type}--${Date.now()}`,
          spec_version: '2.1',
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        };
    setBundle(prevBundle => ({
      ...prevBundle,
      objects: editedObj.id
        ? prevBundle.objects.map(o => o.id === editedObj.id ? updatedObj : o)
        : [...prevBundle.objects, updatedObj]
    }));
    setDialogOpen(false);
    setEditedObj(null);
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setFilters({ type: '', search: '', dateFrom: null, dateTo: null });
  };

  const filteredObjects = bundle.objects.filter(obj => {
    const matchesType = filters.type ? obj.type === filters.type : true;
    const matchesSearch = filters.search
      ? (obj.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
         obj.description?.toLowerCase().includes(filters.search.toLowerCase()))
      : true;
    const matchesDate = (filters.dateFrom || filters.dateTo)
      ? (new Date(obj.created) >= (filters.dateFrom || new Date(0)) &&
         new Date(obj.created) <= (filters.dateTo || new Date()))
      : true;
    return matchesType && matchesSearch && matchesDate;
  });

  const uniqueTypes = [...new Set(bundle.objects.map(obj => obj.type))];

  const getTypeSpecificFields = (type) => {
    if (!type) return null;
    switch (type) {
      case 'identity':
        return (
          <>
            <TextField
              margin="dense"
              label="Identity Class"
              fullWidth
              value={editedObj.identity_class || ''}
              onChange={(e) => setEditedObj({ ...editedObj, identity_class: e.target.value })}
            />
          </>
        );
      case 'malware':
        return (
          <>
            <TextField
              margin="dense"
              label="Is Family"
              fullWidth
              value={editedObj.is_family || false}
              onChange={(e) => setEditedObj({ ...editedObj, is_family: e.target.value === 'true' })}
              select
            >
              <MenuItem value="true">True</MenuItem>
              <MenuItem value="false">False</MenuItem>
            </TextField>
            <TextField
              margin="dense"
              label="Labels"
              fullWidth
              value={editedObj.labels ? editedObj.labels.join(', ') : ''}
              onChange={(e) => setEditedObj({ ...editedObj, labels: e.target.value.split(', ').filter(Boolean) })}
            />
          </>
        );
      case 'indicator':
        return (
          <>
            <TextField
              margin="dense"
              label="Pattern"
              fullWidth
              value={editedObj.pattern || ''}
              onChange={(e) => setEditedObj({ ...editedObj, pattern: e.target.value })}
            />
            <TextField
              margin="dense"
              label="Confidence"
              fullWidth
              value={editedObj.confidence || ''}
              onChange={(e) => setEditedObj({ ...editedObj, confidence: parseInt(e.target.value) || '' })}
              type="number"
            />
          </>
        );
      case 'relationship':
        const existingIds = bundle.objects.map(obj => obj.id);
        return (
          <>
            <Select
              margin="dense"
              label="Relationship Type"
              fullWidth
              value={editedObj.relationship_type || ''}
              onChange={(e) => setEditedObj({ ...editedObj, relationship_type: e.target.value })}
              displayEmpty
            >
              <MenuItem value="">Select Relationship Type</MenuItem>
              <MenuItem value="indicates">indicates</MenuItem>
              <MenuItem value="related-to">related-to</MenuItem>
              <MenuItem value="mitigates">mitigates</MenuItem>
              <MenuItem value="uses">uses</MenuItem>
              <MenuItem value="targets">targets</MenuItem>
              <MenuItem value="attributed-to">attributed-to</MenuItem>
            </Select>
            <Select
              margin="dense"
              label="Source Ref"
              fullWidth
              value={editedObj.source_ref || ''}
              onChange={(e) => setEditedObj({ ...editedObj, source_ref: e.target.value })}
              displayEmpty
            >
              <MenuItem value="">Select or Enter New ID</MenuItem>
              {existingIds.map(id => (
                <MenuItem key={id} value={id}>{id}</MenuItem>
              ))}
            </Select>
            <TextField
              margin="dense"
              label="New Source Ref (if not listed)"
              fullWidth
              value={existingIds.includes(editedObj.source_ref) ? '' : editedObj.source_ref || ''}
              onChange={(e) => setEditedObj({ ...editedObj, source_ref: e.target.value })}
              placeholder="Enter new ID"
              disabled={existingIds.includes(editedObj.source_ref)}
            />
            <Select
              margin="dense"
              label="Target Ref"
              fullWidth
              value={editedObj.target_ref || ''}
              onChange={(e) => setEditedObj({ ...editedObj, target_ref: e.target.value })}
              displayEmpty
            >
              <MenuItem value="">Select or Enter New ID</MenuItem>
              {existingIds.map(id => (
                <MenuItem key={id} value={id}>{id}</MenuItem>
              ))}
            </Select>
            <TextField
              margin="dense"
              label="New Target Ref (if not listed)"
              fullWidth
              value={existingIds.includes(editedObj.target_ref) ? '' : editedObj.target_ref || ''}
              onChange={(e) => setEditedObj({ ...editedObj, target_ref: e.target.value })}
              placeholder="Enter new ID"
              disabled={existingIds.includes(editedObj.target_ref)}
            />
          </>
        );
      case 'sighting':
        return (
          <>
            <TextField
              margin="dense"
              label="First Seen"
              fullWidth
              value={editedObj.first_seen || ''}
              onChange={(e) => setEditedObj({ ...editedObj, first_seen: e.target.value })}
              type="datetime-local"
            />
            <TextField
              margin="dense"
              label="Last Seen"
              fullWidth
              value={editedObj.last_seen || ''}
              onChange={(e) => setEditedObj({ ...editedObj, last_seen: e.target.value })}
              type="datetime-local"
            />
            <TextField
              margin="dense"
              label="Count"
              fullWidth
              value={editedObj.count || ''}
              onChange={(e) => setEditedObj({ ...editedObj, count: parseInt(e.target.value) || '' })}
              type="number"
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div>
        <Typography variant="h5">Manage CTI Objects</Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            displayEmpty
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="">All Types</MenuItem>
            {uniqueTypes.map(type => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </Select>
          <TextField
            label="Search Name/Description"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <DatePicker
            label="From Date"
            value={filters.dateFrom}
            onChange={(date) => handleFilterChange('dateFrom', date)}
            renderInput={(params) => <TextField {...params} />}
          />
          <DatePicker
            label="To Date"
            value={filters.dateTo}
            onChange={(date) => handleFilterChange('dateTo', date)}
            renderInput={(params) => <TextField {...params} />}
          />
          <Button variant="outlined" onClick={clearFilters}>Clear Filters</Button>
        </Box>
        <Box sx={{ mb: 2 }}>
          {filters.type && <Chip label={`Type: ${filters.type}`} onDelete={() => handleFilterChange('type', '')} sx={{ mr: 1 }} />}
          {filters.search && <Chip label={`Search: ${filters.search}`} onDelete={() => handleFilterChange('search', '')} sx={{ mr: 1 }} />}
          {filters.dateFrom && <Chip label={`From: ${filters.dateFrom.toLocaleDateString()}`} onDelete={() => handleFilterChange('dateFrom', null)} sx={{ mr: 1 }} />}
          {filters.dateTo && <Chip label={`To: ${filters.dateTo.toLocaleDateString()}`} onDelete={() => handleFilterChange('dateTo', null)} sx={{ mr: 1 }} />}
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={handleAdd} sx={{ mb: 2 }}>
          Add CTI Object
        </Button>
        <List>
          {filteredObjects.map(obj => (
            <ListItem key={obj.id}
              secondaryAction={
                <>
                  <IconButton edge="end" aria-label="edit" onClick={() => handleEdit(obj)}>
                    <Edit />
                  </IconButton>
                  <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(obj.id)}>
                    <Delete />
                  </IconButton>
                </>
              }
            >
              <ListItemText
                primary={`${obj.type.toUpperCase()}: ${obj.name || ''}`}
                secondary={obj.description}
              />
            </ListItem>
          ))}
        </List>
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
          <DialogTitle>{editedObj?.id ? 'Edit CTI Object' : 'Add CTI Object'}</DialogTitle>
          <DialogContent>
            <Select
              margin="dense"
              label="Type"
              fullWidth
              value={editedObj?.type || ''}
              onChange={(e) => setEditedObj(prev => ({ ...prev, type: e.target.value }))}
              displayEmpty
            >
              <MenuItem value="">Select Type</MenuItem>
              {uniqueTypes.map(type => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
            {editedObj?.type && (
              <>
                <TextField
                  margin="dense"
                  label="Name"
                  fullWidth
                  value={editedObj?.name || ''}
                  onChange={(e) => setEditedObj(prev => ({ ...prev, name: e.target.value }))}
                />
                <TextField
                  margin="dense"
                  label="Description"
                  fullWidth
                  value={editedObj?.description || ''}
                  onChange={(e) => setEditedObj(prev => ({ ...prev, description: e.target.value }))}
                />
                {getTypeSpecificFields(editedObj?.type)}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!editedObj?.type}>Save</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to delete the object "{bundle.objects.find(o => o.id === objectToDelete)?.name || objectToDelete}"?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmDelete} color="error">Delete</Button>
          </DialogActions>
        </Dialog>
      </div>
    </LocalizationProvider>
  );
};

export default ManageView;