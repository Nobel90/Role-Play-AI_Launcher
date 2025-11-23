// test-server.js
// Simple local HTTP server for testing the launcher

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Configuration
const config = {
    port: 8080,
    host: 'localhost',
    // Directory containing your game files/manifests
    // Change this to point to your Unreal package directory
    serveDirectory: 'D:\\VR Centre\\Perforce\\RolePlay_AI\\Package\\300MB_Chunks\\V2\\Windows',
    // Directory for chunks (chunk-based downloads)
    chunksDirectory: path.join(process.cwd(), 'test-server-files', 'chunks'),
    // Directory for manifests and version files
    testFilesDirectory: path.join(process.cwd(), 'test-server-files'),
    // Enable HTTPS (set to true and provide cert/key paths if needed)
    useHttps: false,
    sslCert: null,
    sslKey: null
};

// MIME types
const mimeTypes = {
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.pak': 'application/octet-stream',
    '.exe': 'application/octet-stream',
    '.dll': 'application/octet-stream',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}

function serveFile(filePath, res) {
    const stat = fs.statSync(filePath);
    const mimeType = getMimeType(filePath);

    // Set headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache');

    // Create read stream and pipe to response
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    stream.on('error', (err) => {
        console.error(`Error reading file ${filePath}:`, err);
        if (!res.headersSent) {
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    });
}

function handleRequest(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // Parse URL
    const parsedUrl = url.parse(req.url, true);
    let filePath = parsedUrl.pathname;

    // Remove leading slash
    if (filePath.startsWith('/')) {
        filePath = filePath.substring(1);
    }

    // Security: prevent directory traversal
    if (filePath.includes('..')) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    // Handle chunks (chunk-based downloads)
    if (filePath.startsWith('chunks/')) {
        const chunkPath = filePath.substring(7); // Remove 'chunks/' prefix
        const fullPath = path.join(config.chunksDirectory, chunkPath);
        serveFileIfExists(fullPath, res, req);
        return;
    }

    // Handle manifest and version files from test-server-files
    // Serve v1.0.1.3 manifest as default, but also support other versions for comparison
    if (filePath === 'roleplayai_manifest.json') {
        // Default to v1.0.1.3 manifest
        const fullPath = path.join(config.testFilesDirectory, 'roleplayai_manifest_v1.0.1.3.json');
        serveFileIfExists(fullPath, res, req);
        return;
    }
    // Support multiple manifest versions for comparison
    if (filePath.startsWith('roleplayai_manifest_v') && filePath.endsWith('.json')) {
        const fullPath = path.join(config.testFilesDirectory, filePath);
        serveFileIfExists(fullPath, res, req);
        return;
    }
    if (filePath === 'version.json') {
        const fullPath = path.join(config.testFilesDirectory, filePath);
        serveFileIfExists(fullPath, res, req);
        return;
    }

    // Build full path for game files
    const fullPath = path.join(config.serveDirectory, filePath);
    serveFileIfExists(fullPath, res, req);
}

function serveFileIfExists(fullPath, res, req) {

    // Check if file exists
    fs.access(fullPath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log(`404: ${req.method} ${req.url}`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }

        // Check if it's a directory
        fs.stat(fullPath, (err, stats) => {
            if (err) {
                res.writeHead(500);
                res.end('Internal Server Error');
                return;
            }

            if (stats.isDirectory()) {
                // List directory contents (optional - for debugging)
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`<h1>Directory listing disabled</h1><p>Access files directly: ${req.url}</p>`);
                return;
            }

            // Serve the file
            const sizeKB = (stats.size / 1024).toFixed(2);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            const sizeStr = stats.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
            console.log(`200: ${req.method} ${req.url} (${sizeStr})`);
            serveFile(fullPath, res);
        });
    });
}

// Create server
const server = config.useHttps && config.sslCert && config.sslKey
    ? https.createServer({
          cert: fs.readFileSync(config.sslCert),
          key: fs.readFileSync(config.sslKey)
      }, handleRequest)
    : http.createServer(handleRequest);

// Start server
server.listen(config.port, config.host, () => {
    const protocol = config.useHttps ? 'https' : 'http';
    console.log('='.repeat(50));
    console.log('Test Server Started');
    console.log('='.repeat(50));
    console.log(`Server: ${protocol}://${config.host}:${config.port}`);
    console.log(`Serving from: ${config.serveDirectory}`);
    console.log('='.repeat(50));
    console.log('\nExample URLs:');
    console.log(`  Manifest: ${protocol}://${config.host}:${config.port}/roleplayai_manifest.json`);
    console.log(`  Version:  ${protocol}://${config.host}:${config.port}/version.json`);
    console.log(`  Chunks:   ${protocol}://${config.host}:${config.port}/chunks/XX/hash...`);
    console.log('\nPress Ctrl+C to stop the server\n');
});

// Handle errors
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${config.port} is already in use. Try a different port.`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
});

