// detail-table.js

function normalizeRows(columns, rows, limit) {
  return (rows || []).slice(0, limit || 50).map((row, rowIndex) => ({
    rowId: row._idx !== undefined ? row._idx : rowIndex,
    rowClass: row._highlight ? 'highlight' : '',
    cells: (columns || []).map((column) => ({
      key: column,
      value: row[column] || '—',
    })),
  }));
}

Component({
  properties: {
    columns: {
      type: Array,
      value: [],
    },
    rows: {
      type: Array,
      value: [],
    },
    limit: {
      type: Number,
      value: 50,
    },
  },

  observers: {
    'columns, rows, limit': function(columns, rows, limit) {
      this.setData({ viewRows: normalizeRows(columns, rows, limit) });
    },
  },

  data: {
    viewRows: [],
  },
});
