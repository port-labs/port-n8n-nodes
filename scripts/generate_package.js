// scripts/prepare-dist.cjs
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const srcDir = path.join(root, 'src');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const removeDistPrefix = (p) =>
    typeof p === 'string' && p.startsWith('dist/') ? p.slice(5) : p;

const ensureDir = (p) => fs.mkdirSync(p, {
    recursive: true
});
const copyFile = (from, to) => {
    ensureDir(path.dirname(to));
    fs.copyFileSync(from, to);
};

const copyDirRecursive = (from, to, filter = () => true) => {
    if (!fs.existsSync(from)) return;
    for (const entry of fs.readdirSync(from, {
            withFileTypes: true
        })) {
        const srcPath = path.join(from, entry.name);
        const dstPath = path.join(to, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, dstPath, filter);
        } else if (filter(srcPath)) {
            ensureDir(path.dirname(dstPath));
            fs.copyFileSync(srcPath, dstPath);
        }
    }
};

// 1) Ensure dist exists (tsc should have created it, but be safe)
ensureDir(dist);

// 2) Copy top-level docs if present
['README.md', 'LICENSE', 'CHANGELOG.md'].forEach((f) => {
    const src = path.join(root, f);
    if (fs.existsSync(src)) copyFile(src, path.join(dist, f));
});

// 3) Copy common assets if present
const icon = path.join(root, 'icon.png');
if (fs.existsSync(icon)) copyFile(icon, path.join(dist, 'icon.png'));

const assetsDir = path.join(root, 'assets');
if (fs.existsSync(assetsDir)) {
    copyDirRecursive(assetsDir, path.join(dist, 'assets'));
}

// 4) Copy NON-TypeScript files from src → dist, preserving structure
//    (examples: .png/.svg/.json templates, .xml, etc.)
const nonTsFilter = (p) => !/\.(ts|tsx|map)$/.test(p);
copyDirRecursive(srcDir, dist, nonTsFilter);

// 5) Generate minimal dist/package.json (runtime only)
const n8nSection = {
    n8nNodesApiVersion: pkg.n8n?.n8nNodesApiVersion || 1,
    nodes: (pkg.n8n?.nodes || []).map(removeDistPrefix),
    credentials: (pkg.n8n?.credentials || []).map(removeDistPrefix),
};

// Remove prefix from main and types
const main = removeDistPrefix(pkg.main) || 'index.js';
const types = removeDistPrefix(pkg.types) || 'index.d.ts';

const distPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    keywords: pkg.keywords || [],
    license: pkg.license,
    author: pkg.author,
    type: 'commonjs',
    engines: {
        node: ">=18"
    },
    main,
    types,
    exports: './' + main,
    n8n: n8nSection,
    publishConfig: pkg.publishConfig || {
        access: 'public',
        provenance: true
    },
    repository: pkg.repository,
    bugs: pkg.bugs,
    homepage: pkg.homepage,
    // Only keep runtime deps/peers that consumers must have:
    peerDependencies: pkg.peerDependencies || {},
    dependencies: pkg.dependencies || {},
    files: ['.']
};

fs.writeFileSync(path.join(dist, 'package.json'), JSON.stringify(distPkg, null, 2) + '\n');

console.log('✅ Prepared dist/ (docs, assets, non-TS files, package.json)');