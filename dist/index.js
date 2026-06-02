"use strict";
const { existsSync } = require('fs');
const { resolve, join } = require('path');
const { execSync } = require('child_process');
const actionDir = resolve(__dirname, '..');
const nmPath = join(actionDir, 'node_modules');
if (!existsSync(nmPath)) {
    execSync('npm ci --production', { cwd: actionDir, stdio: 'inherit' });
}
const { run } = require('./main');
run().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
