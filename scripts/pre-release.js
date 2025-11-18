#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Determine package.json path - works whether run from root or dist directory
// Check if we're in dist/scripts (parent has package.json) or root/scripts (dist/package.json exists)
const distPackageJsonPath = fs.existsSync(path.join(__dirname, '..', 'dist', 'package.json'))
	? path.join(__dirname, '..', 'dist', 'package.json') // Running from root/scripts
	: path.join(__dirname, '..', 'package.json'); // Running from dist/scripts

if (!fs.existsSync(distPackageJsonPath)) {
	console.error(`package.json not found at: ${distPackageJsonPath}`);
	process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(distPackageJsonPath, 'utf8'));

// Remove dist/ prefix from paths for NPM publishing
// When publishing from dist folder, paths should be relative to dist root
if (pkg.n8n) {
	if (pkg.n8n.credentials) {
		pkg.n8n.credentials = pkg.n8n.credentials.map((p) => p.replace(/^dist\//, ''));
	}
	if (pkg.n8n.nodes) {
		pkg.n8n.nodes = pkg.n8n.nodes.map((p) => p.replace(/^dist\//, ''));
	}
}

// Remove the "files" field for NPM publishing
// When publishing from dist folder, all files in dist are included by default
// The "files" field with ["dist"] would be incorrect since we're already in dist
delete pkg.files;

// Ensure package name starts with n8n-nodes- for NPM publishing
if (!pkg.name.startsWith('n8n-nodes-')) {
	pkg.name = 'n8n-nodes-port-api-ai';
}

// Remove dev scripts that aren't needed in published package
delete pkg.scripts?.build;
delete pkg.scripts?.['build:watch'];
delete pkg.scripts?.dev;
delete pkg.scripts?.lint;
delete pkg.scripts?.['lint:fix'];
delete pkg.scripts?.release;
delete pkg.scripts?.prepublishOnly;

// Remove devDependencies as they're not needed in published package
delete pkg.devDependencies;

fs.writeFileSync(distPackageJsonPath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`✓ Prepared ${path.basename(distPackageJsonPath)} for NPM publishing`);
console.log('  - Removed dist/ prefixes from n8n paths');
console.log('  - Removed files field');
console.log('  - Removed dev scripts and devDependencies');

