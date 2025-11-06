const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'nodes', 'PortIo');
const destDir = path.join(__dirname, '..', 'dist', 'nodes', 'PortIo');

// Ensure destination directory exists
if (!fs.existsSync(destDir)){
    fs.mkdirSync(destDir, { recursive: true });
}

// Function to copy files
const copyFiles = () => {
    fs.readdir(srcDir, (err, files) => {
        if (err) {
            console.error("Error reading source directory:", err);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);

            // Only copy .svg files
            if (file.endsWith('.svg')) {
                fs.copyFile(filePath, destPath, (err) => {
                    if (err) {
                        console.error(`Error copying file ${file}:`, err);
                    } else {
                        console.log(`Successfully copied: ${file}`);
                    }
                });
            }
        });
    });
};

// Start copying the SVG files
copyFiles();
