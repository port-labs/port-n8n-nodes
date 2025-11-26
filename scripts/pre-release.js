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

delete pkg.scripts;

// Remove devDependencies as they're not needed in published package
delete pkg.devDependencies;

fs.writeFileSync(distPackageJsonPath, JSON.stringify(pkg, null, 2) + '\n');

// Copy README.md, LICENSE, and docs folder to dist folder
const distDir = path.dirname(distPackageJsonPath);
const rootDir = fs.existsSync(path.join(__dirname, '..', 'dist', 'package.json'))
	? path.join(__dirname, '..') // Running from root/scripts
	: path.join(__dirname, '..', '..'); // Running from dist/scripts

// Function to remove GitHub-specific markdown syntax
function removeGitHubMarkdown(content) {
	// Remove GitHub callout syntax like [!NOTE], [!WARNING], [!TIP], etc.
	// Pattern matches: > [!NOTE] or >[!NOTE] followed by optional spaces and newline
	content = content.replace(/^>\s*\[!([A-Z]+)\]\s*$/gm, (match, calloutType) => {
		// Convert callout type to a readable format
		const calloutMap = {
			NOTE: '**Note:**',
			WARNING: '**Warning:**',
			TIP: '**Tip:**',
			IMPORTANT: '**Important:**',
			CAUTION: '**Caution:**',
		};
		return `> ${calloutMap[calloutType] || `**${calloutType}:**`}`;
	});
	return content;
}

const filesToCopy = ['README.md', 'LICENSE'];
for (const file of filesToCopy) {
	const src = path.join(rootDir, file);
	const dest = path.join(distDir, file);
	if (fs.existsSync(src)) {
		if (file === 'README.md') {
			// Process README.md to remove GitHub-specific markdown
			const content = fs.readFileSync(src, 'utf8');
			const processedContent = removeGitHubMarkdown(content);
			fs.writeFileSync(dest, processedContent, 'utf8');
			console.log(`✓ Copied and processed ${file} to dist folder`);
		} else {
			fs.copyFileSync(src, dest);
			console.log(`✓ Copied ${file} to dist folder`);
		}
	} else {
		console.warn(`⚠ ${file} not found at project root`);
	}
}

// Copy docs folder recursively
function copyRecursiveSync(src, dest) {
	const exists = fs.existsSync(src);
	const stats = exists && fs.statSync(src);
	const isDirectory = exists && stats.isDirectory();
	if (isDirectory) {
		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}
		fs.readdirSync(src).forEach((childItemName) => {
			copyRecursiveSync(
				path.join(src, childItemName),
				path.join(dest, childItemName)
			);
		});
	} else {
		fs.copyFileSync(src, dest);
	}
}

const docsSrc = path.join(rootDir, 'docs');
const docsDest = path.join(distDir, 'docs');
if (fs.existsSync(docsSrc)) {
	copyRecursiveSync(docsSrc, docsDest);
	console.log(`✓ Copied docs folder to dist folder`);
} else {
	console.warn(`⚠ docs folder not found at project root`);
}

// Remove .map files (source maps) and build artifacts from dist folder
function removeBuildArtifacts(dir) {
	if (!fs.existsSync(dir)) {
		return;
	}
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			removeBuildArtifacts(fullPath);
		} else if (entry.isFile()) {
			// Remove source map files
			if (entry.name.endsWith('.map')) {
				fs.unlinkSync(fullPath);
			}
			// Remove TypeScript build info file
			if (entry.name === 'tsconfig.tsbuildinfo') {
				fs.unlinkSync(fullPath);
			}
		}
	}
}

removeBuildArtifacts(distDir);
console.log(`✓ Removed .map files and build artifacts from dist folder`);

console.log(`✓ Prepared ${path.basename(distPackageJsonPath)} for NPM publishing`);
console.log('  - Removed dist/ prefixes from n8n paths');
console.log('  - Removed files field');
console.log('  - Removed scripts and devDependencies');

