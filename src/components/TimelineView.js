import React, { useContext, useEffect, useRef, useState } from 'react';
import { BundleContext } from '../contexts/BundleContext';
import { DataSet, Timeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.min.css';
import { Select, MenuItem, Chip, Box, Button, Typography, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

const TimelineView = () => {
  const { bundle } = useContext(BundleContext);
  const timelineRef = useRef(null);
  const [filters, setFilters] = useState({ types: [], dateFrom: null, dateTo: null });
  const [timelineInstance, setTimelineInstance] = useState(null);

  const uniqueTypes = [...new Set(bundle.objects.map(obj => obj.type))];

  useEffect(() => {
    if (!bundle.objects.length) return;
    const container = timelineRef.current;
    const groups = new DataSet(
      uniqueTypes.map(type => ({ id: type, content: type }))
    );
    const items = new DataSet(
      bundle.objects
        .filter(obj => filters.types.length ? filters.types.includes(obj.type) : true)
        .filter(obj => {
          const date = new Date(obj.created || obj.first_seen);
          return (!filters.dateFrom || date >= filters.dateFrom) &&
                 (!filters.dateTo || date <= filters.dateTo);
        })
        .map(obj => {
          let start = obj.created || obj.first_seen;
          let end = obj.modified || obj.last_seen || start;
          return {
            id: obj.id,
            group: obj.type,
            content: obj.name || obj.id,
            start,
            end
          };
        })
    );
    const timeline = new Timeline(container, items, groups, {
      zoomMin: 1000 * 60 * 60 * 24, // 1 day
      zoomMax: 1000 * 60 * 60 * 24 * 365 // 1 year
    });
    setTimelineInstance(timeline);
    return () => timeline.destroy();
  }, [bundle, filters]);

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setFilters({ types: [], dateFrom: null, dateTo: null });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div>
        <Typography variant="h5">Timeline View</Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', position: 'sticky', top: 0, background: '#fff', zIndex: 1, p: 2 }}>
          <Select
            multiple
            value={filters.types}
            onChange={(e) => handleFilterChange('types', e.target.value)}
            displayEmpty
            renderValue={(selected) => selected.length ? selected.join(', ') : 'All Types'}
            sx={{ minWidth: 200 }}
          >
            {uniqueTypes.map(type => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </Select>
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
          {filters.types.map(type => (
            <Chip
              key={type}
              label={`Type: ${type}`}
              onDelete={() => handleFilterChange('types', filters.types.filter(t => t !== type))}
              sx={{ mr: 1 }}
            />
          ))}
          {filters.dateFrom && (
            <Chip
              label={`From: ${filters.dateFrom.toLocaleDateString()}`}
              onDelete={() => handleFilterChange('dateFrom', null)}
              sx={{ mr: 1 }}
            />
          )}
          {filters.dateTo && (
            <Chip
              label={`To: ${filters.dateTo.toLocaleDateString()}`}
              onDelete={() => handleFilterChange('dateTo', null)}
              sx={{ mr: 1 }}
            />
          )}
        </Box>
        <div ref={timelineRef} style={{ height: '400px' }} />
      </div>
    </LocalizationProvider>
  );
};

export default TimelineView;