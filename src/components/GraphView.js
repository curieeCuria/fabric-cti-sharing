import React, { useContext, useState } from 'react';
import { BundleContext } from '../contexts/BundleContext';
import ForceGraph2D from 'react-force-graph-2d';
import { Dialog, DialogTitle, DialogContent, Typography, List, ListItem, ListItemText, Select, MenuItem, Box, Button } from '@mui/material';

const GraphView = () => {
  const { bundle } = useContext(BundleContext);
  const [selectedNode, setSelectedNode] = useState(null);
  const [filters, setFilters] = useState({ nodeType: '', relationshipType: '' });

  const uniqueNodeTypes = [...new Set(bundle.objects.map(obj => obj.type).filter(type => type !== 'relationship'))];
  const uniqueRelationshipTypes = [...new Set(bundle.objects.filter(obj => obj.type === 'relationship').map(rel => rel.relationship_type))];

  // Filter nodes based on nodeType
  const filteredNodes = bundle.objects
    .filter(obj => obj.type !== 'relationship' && (!filters.nodeType || obj.type === filters.nodeType))
    .map(obj => ({
      id: obj.id,
      name: obj.name || obj.id,
      type: obj.type
    }));

  // Filter relationships where both source and target nodes exist in filteredNodes
  const validNodeIds = new Set(filteredNodes.map(node => node.id));
  const filteredLinks = bundle.objects
    .filter(o => o.type === 'relationship' && (!filters.relationshipType || o.relationship_type === filters.relationshipType))
    .filter(rel => validNodeIds.has(rel.source_ref) && validNodeIds.has(rel.target_ref))
    .map(rel => ({
      source: rel.source_ref,
      target: rel.target_ref,
      type: rel.relationship_type
    }));

  const handleNodeClick = (node) => {
    const obj = bundle.objects.find(o => o.id === node.id);
    setSelectedNode(obj);
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setFilters({ nodeType: '', relationshipType: '' });
  };

  return (
    <div>
      <Typography variant="h5">Graph View</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Select
          value={filters.nodeType}
          onChange={(e) => handleFilterChange('nodeType', e.target.value)}
          displayEmpty
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">All Node Types</MenuItem>
          {uniqueNodeTypes.map(type => (
            <MenuItem key={type} value={type}>{type}</MenuItem>
          ))}
        </Select>
        <Select
          value={filters.relationshipType}
          onChange={(e) => handleFilterChange('relationshipType', e.target.value)}
          displayEmpty
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">All Relationship Types</MenuItem>
          {uniqueRelationshipTypes.map(type => (
            <MenuItem key={type} value={type}>{type}</MenuItem>
          ))}
        </Select>
        <Button variant="outlined" onClick={clearFilters}>Clear Filters</Button>
      </Box>
      <ForceGraph2D
        graphData={{ nodes: filteredNodes, links: filteredLinks }}
        nodeLabel="name"
        linkLabel="type"
        nodeAutoColorBy="type"
        width={800}
        height={600}
        onNodeClick={handleNodeClick}
      />
      {selectedNode && (
        <Dialog open={!!selectedNode} onClose={() => setSelectedNode(null)}>
          <DialogTitle>{selectedNode.name || selectedNode.id}</DialogTitle>
          <DialogContent>
            <List>
              <ListItem>
                <ListItemText primary="Type" secondary={selectedNode.type} />
              </ListItem>
              {selectedNode.description && (
                <ListItem>
                  <ListItemText primary="Description" secondary={selectedNode.description} />
                </ListItem>
              )}
              {selectedNode.labels && (
                <ListItem>
                  <ListItemText primary="Labels" secondary={selectedNode.labels.join(', ')} />
                </ListItem>
              )}
              {selectedNode.created && (
                <ListItem>
                  <ListItemText primary="Created" secondary={new Date(selectedNode.created).toLocaleString()} />
                </ListItem>
              )}
              {selectedNode.pattern && (
                <ListItem>
                  <ListItemText primary="Pattern" secondary={selectedNode.pattern} />
                </ListItem>
              )}
            </List>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default GraphView;