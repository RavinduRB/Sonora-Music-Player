const { app, BrowserWindow, ipcMain, screen, dialog, desktopCapturer } = require('electron');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

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
      let requestPath;
      try {
        requestPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      } catch {
        response.writeHead(400);
        response.end('Bad request');
        return;
      }
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

  mainWindow.setContentProtection(true);
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
// Writes are queued and swapped in atomically so overlapping saves cannot interleave and a crash cannot truncate the library
let libraryWriteQueue = Promise.resolve();
function writeLibraryFile(filePath, library) {
  const write = libraryWriteQueue.then(async () => {
    const tempPath = `${filePath}.tmp`;
    await fs.promises.writeFile(tempPath, JSON.stringify(library, null, 2), 'utf8');
    await fs.promises.rename(tempPath, filePath);
  });
  libraryWriteQueue = write.catch(() => {});
  return write;
}
// Song IDs are serialized first, so this finds an entry without buffering its large audio URL.
async function findLibrarySongRange(filePath, songId) {
  const prefix = Buffer.allocUnsafe(16 * 1024);
  let prefixLength = 0;
  let offset = 0;
  let arrayStarted = false;
  let itemStart = -1;
  let itemPreviousComma = -1;
  let previousComma = -1;
  let objectDepth = 0;
  let inString = false;
  let escaped = false;
  let pendingTarget = null;

  for await (const chunk of fs.createReadStream(filePath)) {
    for (let index = 0; index < chunk.length; index += 1, offset += 1) {
      const byte = chunk[index];
      if (itemStart < 0) {
        if (pendingTarget) {
          if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
          if (byte === 0x2c) return { start: pendingTarget.start, end: offset + 1 };
          if (byte === 0x5d) {
            return {
              start: pendingTarget.previousComma >= 0 ? pendingTarget.previousComma : pendingTarget.start,
              end: pendingTarget.end
            };
          }
          throw new Error('Saved library has invalid JSON after a song');
        }
        if (!arrayStarted) {
          if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
          if (byte !== 0x5b) throw new Error('Saved library is not a JSON array');
          arrayStarted = true;
          continue;
        }
        if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
        if (byte === 0x2c) {
          previousComma = offset;
          continue;
        }
        if (byte === 0x5d) return null;
        if (byte !== 0x7b) throw new Error('Saved library contains an invalid song entry');
        itemStart = offset;
        itemPreviousComma = previousComma;
        objectDepth = 1;
        prefixLength = 0;
        prefix[prefixLength++] = byte;
        inString = false;
        escaped = false;
        continue;
      }

      if (prefixLength < prefix.length) prefix[prefixLength++] = byte;
      if (inString) {
        if (escaped) escaped = false;
        else if (byte === 0x5c) escaped = true;
        else if (byte === 0x22) inString = false;
        continue;
      }
      if (byte === 0x22) inString = true;
      else if (byte === 0x7b || byte === 0x5b) objectDepth += 1;
      else if (byte === 0x7d || byte === 0x5d) {
        objectDepth -= 1;
        if (objectDepth < 0 || (objectDepth === 0 && byte !== 0x7d)) {
          throw new Error('Saved library contains an invalid song entry');
        }
        if (objectDepth === 0) {
          const text = prefix.toString('utf8', 0, prefixLength);
          const idMatch = /"id"\s*:\s*("(?:\\.|[^"\\])*")/.exec(text);
          if (idMatch && JSON.parse(idMatch[1]) === songId) {
            pendingTarget = {
              start: itemStart,
              end: offset + 1,
              previousComma: itemPreviousComma
            };
          }
          itemStart = -1;
        }
      }
    }
  }
  if (!arrayStarted || itemStart >= 0) throw new Error('Saved library contains invalid JSON');
  return null;
}

async function removeLibrarySongFromFile(filePath, songId) {
  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  const range = await findLibrarySongRange(filePath, songId);
  if (!range) return false;

  const tempPath = `${filePath}.tmp`;
  try {
    await pipeline((async function* copyRemainingLibrary() {
      if (range.start > 0) {
        yield* fs.createReadStream(filePath, { start: 0, end: range.start - 1 });
      }
      if (range.end < stat.size) {
        yield* fs.createReadStream(filePath, { start: range.end, end: stat.size - 1 });
      }
    })(), fs.createWriteStream(tempPath));
    await fs.promises.rename(tempPath, filePath);
    return true;
  } catch (error) {
    try {
      await fs.promises.unlink(tempPath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') console.error('Could not clean up temporary library file:', cleanupError);
    }
    throw error;
  }
}

ipcMain.handle('sonora:remove-library-song', async (_event, songId) => {
  if (typeof songId !== 'string' || !songId) throw new Error('Song ID must be a non-empty string');
  const remove = libraryWriteQueue.then(() => removeLibrarySongFromFile(
    path.join(app.getPath('userData'), 'sonora-library.json'),
    songId
  ));
  libraryWriteQueue = remove.catch(() => {});
  return remove;
});
ipcMain.handle('sonora:persist-library', async (_event, library) => {
  if (!Array.isArray(library)) throw new Error('Library data must be an array');
  await writeLibraryFile(path.join(app.getPath('userData'), 'sonora-library.json'), library);
  return true;
});
const settingsPath = () => path.join(app.getPath('userData'), 'sonora-settings.json');
ipcMain.handle('sonora:load-settings', async () => {
  try {
    const settings = JSON.parse(await fs.promises.readFile(settingsPath(), 'utf8'));
    return ['auto', 'light', 'dark'].includes(settings?.themeMode) ? { themeMode: settings.themeMode } : {};
  } catch {
    return {};
  }
});
ipcMain.handle('sonora:save-settings', async (_event, settings) => {
  if (!['auto', 'light', 'dark'].includes(settings?.themeMode)) throw new Error('Invalid theme mode');
  await fs.promises.writeFile(settingsPath(), JSON.stringify({ themeMode: settings.themeMode }, null, 2), 'utf8');
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
// The transparent area lets clicks through. This is polled from the cursor position because
// no mouse events reach a click-through window while a file is being dragged over it.
let widgetRect = null;
let mouseIgnored = false;
ipcMain.on('sonora:widget-rect', (_event, rect) => {
  if (!rect || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key]))) return;
  widgetRect = rect;
});
setInterval(() => {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || !widgetRect) return;
  const cursor = screen.getCursorScreenPoint();
  const bounds = mainWindow.getContentBounds();
  const x = cursor.x - bounds.x;
  const y = cursor.y - bounds.y;
  const inside = x >= widgetRect.x && x <= widgetRect.x + widgetRect.width
    && y >= widgetRect.y && y <= widgetRect.y + widgetRect.height;
  if (mouseIgnored === inside) {
    mouseIgnored = !inside;
    mainWindow.setIgnoreMouseEvents(mouseIgnored, { forward: true });
  }
}, 50);

// Picks a light or dark UI by measuring the brightness of the desktop behind the widget.
// The window is excluded from screen capture (see createWindow) so only the desktop is measured.
let currentTheme = null;
let pendingTheme = null;
let sampling = false;
const THEME_INTERVAL_MS = 1500;

function sendTheme(theme) {
  if (theme === currentTheme || !mainWindow || mainWindow.isDestroyed()) return;
  currentTheme = theme;
  mainWindow.webContents.send('sonora:theme', theme);
}

async function sampleBackground() {
  if (sampling || !mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized() || !widgetRect) return;
  sampling = true;
  try {
    const bounds = mainWindow.getContentBounds();
    const display = screen.getDisplayMatching(bounds);
    const thumbWidth = 480;
    const thumbHeight = Math.max(1, Math.round(thumbWidth * display.bounds.height / display.bounds.width));
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: thumbWidth, height: thumbHeight } });
    const source = sources.find((item) => item.display_id === String(display.id)) || sources[0];
    if (!source || source.thumbnail.isEmpty()) return;
    const { width, height } = source.thumbnail.getSize();
    const scale = width / display.bounds.width;
    const left = Math.max(0, Math.floor((bounds.x + widgetRect.x - display.bounds.x) * scale));
    const top = Math.max(0, Math.floor((bounds.y + widgetRect.y - display.bounds.y) * scale));
    const right = Math.min(width, Math.ceil((bounds.x + widgetRect.x + widgetRect.width - display.bounds.x) * scale));
    const bottom = Math.min(height, Math.ceil((bounds.y + widgetRect.y + widgetRect.height - display.bounds.y) * scale));
    if (right <= left || bottom <= top) return;
    const pixels = source.thumbnail.toBitmap(); // BGRA
    let total = 0;
    let count = 0;
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const i = (y * width + x) * 4;
        total += 0.2126 * pixels[i + 2] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i];
        count++;
      }
    }
    const luminance = total / count / 255;
    // Hysteresis keeps the theme from flickering when the background is mid-tone
    const next = currentTheme === 'dark' ? (luminance > 0.58 ? 'light' : 'dark') : (luminance < 0.46 ? 'dark' : 'light');
    if (next === currentTheme) pendingTheme = null;
    else if (currentTheme === null || pendingTheme === next) { pendingTheme = null; sendTheme(next); }
    else pendingTheme = next;
  } catch {
    // Capture can fail on a locked screen; keep the current theme
  } finally {
    sampling = false;
  }
}
setInterval(sampleBackground, THEME_INTERVAL_MS);
ipcMain.on('sonora:resize', (_event, height) => {
  if (!mainWindow || !Number.isInteger(height)) return;
  const { x, y, width, height: currentHeight } = mainWindow.getBounds();
  const { workArea } = screen.getDisplayNearestPoint({ x, y });
  const nextHeight = Math.max(130, Math.min(height, 760));
  if (currentHeight === nextHeight) return;
  // setSize() silently fails to shrink this frameless, non-resizable window on Windows; setBounds() works.
  // The window is also kept inside the work area so the library never opens below the screen edge.
  const nextY = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - nextHeight));
  mainWindow.setBounds({ x, y: nextY, width, height: nextHeight });
});
