#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const mcpBin = path.join(root, 'dist', 'mcp', 'index.js');

const config = {
  mcpServers: {
    'env-secrets': {
      command: 'node',
      args: [mcpBin]
    }
  }
};

const dest = path.join(root, '.mcp.json');
fs.writeFileSync(dest, JSON.stringify(config, null, 2) + '\n');
console.log('wrote', dest);
console.log('  command: node', mcpBin);
