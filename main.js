const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

let mainWindow;
let localServer;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function startLocalServer() {
  return new Promise((resolve, reject) => {
    localServer = http.createServer((request, response) => {
      const requestPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const relativePath = requestPath === '/' ? 'index.html' : requestPath.slice(1);
      const filePath = path.resolve(__dirname, relativePath);
      if (!filePath.startsWith(path.resolve(__dirname) + path.sep)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }
      fs.readFile(filePath, (error, data) => {
        if (error) {
          response.writeHead(error.code === 'ENOENT' ? 404 : 500);
          response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
          return;
        }
        response.writeHead(200, {
          'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
          'Cache-Control': 'no-store'
        });
        response.end(data);
      });
    });
    localServer.once('error', reject);
    localServer.listen(0, '127.0.0.1', () => {
      resolve(`http://127.0.0.1:${localServer.address().port}`);
    });
  });
}

async function createWindow() {
  const localUrl = await startLocalServer();
  mainWindow = new BrowserWindow({
    width: 320,
    height: 150,
    minWidth: 300,
    minHeight: 130,
    maxWidth: 430,
    maxHeight: 760,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    show: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(`${localUrl}/index.html`);
  mainWindow.once('ready-to-show', () => {
    positionTopRight();
    mainWindow.show();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    localServer?.close();
    localServer = null;
  });
}

function positionTopRight() {
  if (!mainWindow) return;
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  const [windowWidth, windowHeight] = mainWindow.getSize();
  mainWindow.setPosition(x + width - windowWidth - 16, y + 16);
}

app.whenReady().then(createWindow).catch((error) => {
  console.error('Could not start Sonora:', error);
  app.quit();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });

ipcMain.on('sonora:minimize', () => mainWindow?.minimize());
ipcMain.on('sonora:close', () => mainWindow?.close());
ipcMain.handle('sonora:youtube-metadata', (_event, url) => new Promise((resolve, reject) => {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const request = https.get(endpoint, (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => {
      if (response.statusCode !== 200) {
        reject(new Error(`YouTube metadata request failed with status ${response.statusCode}`));
        return;
      }
      try {
        const metadata = JSON.parse(body);
        resolve({
          title: typeof metadata.title === 'string' ? metadata.title : '',
          artist: typeof metadata.author_name === 'string' ? metadata.author_name : '',
          thumbnail: typeof metadata.thumbnail_url === 'string' ? metadata.thumbnail_url : ''
        });
      } catch {
        reject(new Error('YouTube metadata response was invalid'));
      }
    });
  });
  request.setTimeout(8000, () => request.destroy(new Error('YouTube metadata request timed out')));
  request.on('error', reject);
}));
ipcMain.handle('sonora:load-library', async () => {
  const libraryPath = path.join(app.getPath('userData'), 'sonora-library.json');
  try {
    const data = await fs.promises.readFile(libraryPath, 'utf8');
    const library = JSON.parse(data);
    if (!Array.isArray(library)) throw new Error('Saved library is not an array');
    return library;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
});
ipcMain.handle('sonora:persist-library', async (_event, library) => {
  if (!Array.isArray(library)) throw new Error('Library data must be an array');
  const libraryPath = path.join(app.getPath('userData'), 'sonora-library.json');
  await fs.promises.writeFile(libraryPath, JSON.stringify(library, null, 2), 'utf8');
  return true;
});
ipcMain.handle('sonora:save-library', async (_event, library) => {
  if (!Array.isArray(library)) throw new Error('Library data must be an array');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Sonora library',
    defaultPath: path.join(app.getPath('downloads'), 'sonora-library.json'),
    filters: [{ name: 'JSON files', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.promises.writeFile(result.filePath, JSON.stringify(library, null, 2), 'utf8');
  return { canceled: false, filePath: result.filePath };
});
ipcMain.on('sonora:always-on-top', (_event, enabled) => {
  if (!mainWindow || typeof enabled !== 'boolean') return;
  mainWindow.setAlwaysOnTop(enabled);
});
ipcMain.on('sonora:mouse-through', (_event, enabled) => {
  if (!mainWindow || typeof enabled !== 'boolean') return;
  mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
});
ipcMain.on('sonora:resize', (_event, height) => {
  if (!mainWindow || !Number.isInteger(height)) return;
  const [width, currentHeight] = mainWindow.getSize();
  const [x, y] = mainWindow.getPosition();
  const display = screen.getDisplayNearestPoint({ x, y });
  const rightOffset = display.workArea.x + display.workArea.width - (x + width);
  const nextHeight = Math.max(130, Math.min(height, 760));
  if (currentHeight === nextHeight) return;
  mainWindow.setSize(width, nextHeight);
  mainWindow.setPosition(
    display.workArea.x + display.workArea.width - width - rightOffset,
    y
  );
});
