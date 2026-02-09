import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import pty from 'node-pty';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let terminalProcesses = new Map(); // Store multiple terminal processes
let terminalCounter = 1;
let activeTerminalId = 'terminal-1';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        icon: path.join(__dirname, "../public/logo.ico"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false, // Allow loading Monaco from CDN
        },
        title: "HENU IDE",
        backgroundColor: '#000000',
        frame: false, // Frameless window for custom title bar
        show: false
    });

    // Start first terminal
    startTerminal(mainWindow, 'terminal-1');

    // In development, load from Vite dev server
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        // In production, load the built index.html
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindow = null;
        // Kill all terminal processes
        terminalProcesses.forEach(proc => {
            if (proc && proc.process && proc.process.kill) proc.process.kill();
        });
        terminalProcesses.clear();
    });
}

// ==================== TERMINAL FUNCTIONS ====================

function startTerminal(window, terminalId, initialCwd) {
    console.log(`========== STARTING TERMINAL ${terminalId} ==========`);

    const defaultCwd = process.env.HOME || process.env.USERPROFILE || process.cwd();
    const cwd = (initialCwd && typeof initialCwd === 'string' && initialCwd.trim()) ? initialCwd : defaultCwd;
    if (initialCwd) console.log(`Terminal ${terminalId} cwd: ${cwd}`);

    try {
        let shell;
        const platform = os.platform();

        // Windows specific PowerShell setup
        if (platform === 'win32') {
            shell = 'powershell.exe';
            console.log(`Using PowerShell for ${terminalId}`);

            // Windows: ensure cwd uses backslashes
            const cwdWin = cwd.replace(/\//g, '\\');

            // Windows specific options
            const ptyProcess = pty.spawn(shell, ['-NoLogo', '-NoExit'], {
                name: 'xterm-256color',
                cols: 80,
                rows: 30,
                cwd: cwdWin,
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor'
                },
                // Windows important settings
                useConpty: false, // Disable ConPTY for compatibility
                handleFlowControl: false
            });

            console.log(`Terminal ${terminalId} PID:`, ptyProcess.pid);

            // Store process reference
            terminalProcesses.set(terminalId, {
                process: ptyProcess,
                id: terminalId,
                windowId: window.id
            });

            // Handle terminal output
            ptyProcess.on('data', (data) => {
                if (window && !window.isDestroyed()) {
                    window.webContents.send('terminal-data', { terminalId, data });
                }
            });

            // Handle process exit
            ptyProcess.on('exit', (code) => {
                console.log(`Terminal ${terminalId} process exited with code:`, code);

                // Remove process from map
                if (terminalProcesses.has(terminalId)) {
                    terminalProcesses.delete(terminalId);
                }

                if (window && !window.isDestroyed()) {
                    window.webContents.send('terminal-exit', { terminalId, code });
                }
            });

            // Send welcome message after delay (PowerShell syntax; echo. is CMD-only)
            setTimeout(() => {
                if (ptyProcess && !ptyProcess.killed) {
                    ptyProcess.write('cls\r');
                    ptyProcess.write('echo "========================================="\r');
                    ptyProcess.write(`echo "    HENU IDE - TERMINAL ${terminalId}"\r`);
                    ptyProcess.write('echo "========================================="\r');
                    ptyProcess.write('echo ""\r');
                }
            }, 800);

        } else {
            // macOS/Linux - use bash or zsh
            shell = process.env.SHELL || '/bin/bash';
            console.log(`Using ${shell} for ${terminalId}`);

            const ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-256color',
                cols: 80,
                rows: 30,
                cwd: cwd,
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor'
                }
            });

            console.log(`Terminal ${terminalId} PID:`, ptyProcess.pid);

            // Store process reference
            terminalProcesses.set(terminalId, {
                process: ptyProcess,
                id: terminalId,
                windowId: window.id
            });

            // Handle terminal output
            ptyProcess.on('data', (data) => {
                if (window && !window.isDestroyed()) {
                    window.webContents.send('terminal-data', { terminalId, data });
                }
            });

            // Handle process exit
            ptyProcess.on('exit', (code) => {
                console.log(`Terminal ${terminalId} process exited with code:`, code);

                if (terminalProcesses.has(terminalId)) {
                    terminalProcesses.delete(terminalId);
                }

                if (window && !window.isDestroyed()) {
                    window.webContents.send('terminal-exit', { terminalId, code });
                }
            });

            // Send welcome message after delay
            setTimeout(() => {
                if (ptyProcess && !ptyProcess.killed) {
                    ptyProcess.write('clear\r');
                    ptyProcess.write('echo "========================================="\r');
                    ptyProcess.write(`echo "    HENU IDE - TERMINAL ${terminalId}"\r`);
                    ptyProcess.write('echo "========================================="\r');
                    ptyProcess.write('echo ""\r');
                }
            }, 500);
        }

    } catch (error) {
        console.error(`Failed to start terminal ${terminalId}:`, error);
    }
}

function killTerminal(terminalId) {
    const terminal = terminalProcesses.get(terminalId);
    if (!terminal || !terminal.process) return false;
    // Remove from map first so no resize/write runs on dead pty
    terminalProcesses.delete(terminalId);
    try {
        terminal.process.kill();
        console.log(`Terminal ${terminalId} killed`);
        return true;
    } catch (error) {
        console.error(`Error killing terminal ${terminalId}:`, error);
        return false;
    }
}

// ==================== TERMINAL IPC HANDLERS ====================

ipcMain.on('terminal-write', (event, { terminalId, data }) => {
    const terminal = terminalProcesses.get(terminalId);
    if (!terminal || !terminal.process) return;
    try {
        if (terminal.process.write) terminal.process.write(data);
    } catch (err) {
        if (String(err?.message || '').includes('pty') || String(err?.message || '').includes('exist')) {
            terminalProcesses.delete(terminalId);
        }
    }
});
ipcMain.on('set-active-terminal', (event, terminalId) => {
  if (terminalProcesses.has(terminalId)) {
    activeTerminalId = terminalId;
    console.log('Active terminal set to:', terminalId);
  }
});
ipcMain.handle('get-active-terminal', () => {
  return activeTerminalId;
});

ipcMain.on('terminal-execute', (event, { terminalId, command }) => {
    console.log(`IPC: Executing command in terminal ${terminalId}:`, command);
    const terminal = terminalProcesses.get(terminalId);
    if (terminal && terminal.process && terminal.process.write) {
        terminal.process.write(command + '\r\n');
    }
});

ipcMain.on('terminal-clear', (event, terminalId) => {
    const terminal = terminalProcesses.get(terminalId);
    if (!terminal || !terminal.process) return;
    try {
        if (terminal.process.write) {
            if (os.platform() === 'win32') {
                terminal.process.write('cls\r\n');
            } else {
                terminal.process.write('clear\r\n');
            }
        }
    } catch (err) {
        if (String(err?.message || '').includes('pty') || String(err?.message || '').includes('exist')) {
            terminalProcesses.delete(terminalId);
        }
    }
});

ipcMain.on('terminal-resize', (event, { terminalId, cols, rows }) => {
    const terminal = terminalProcesses.get(terminalId);
    if (!terminal || !terminal.process) return;
    try {
        if (terminal.process.resize) {
            terminal.process.resize(cols, rows);
        }
    } catch (err) {
        if (String(err?.message || '').includes('pty') || String(err?.message || '').includes('exist')) {
            terminalProcesses.delete(terminalId);
        }
        console.warn(`Terminal resize skipped for ${terminalId}:`, err?.message);
    }
});

ipcMain.on('terminal-create', (event, initialCwd) => {
    terminalCounter++;
    const newTerminalId = `terminal-${terminalCounter}`;
    startTerminal(BrowserWindow.fromWebContents(event.sender), newTerminalId, initialCwd);

    // Send new terminal info to renderer
    event.sender.send('terminal-created', newTerminalId);
});

ipcMain.on('terminal-kill', (event, terminalId) => {
    const killed = killTerminal(terminalId);
    event.sender.send('terminal-killed', { terminalId, success: killed });
});

ipcMain.on('terminal-list', (event) => {
    const terminals = Array.from(terminalProcesses.keys());
    event.sender.send('terminal-list-response', terminals);
});

// ==================== WINDOW CONTROL IPC HANDLERS ====================

ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});
// Add this handler in main.js
// main.js mein ye code add karo ya update karo

// Terminal path change handler
ipcMain.handle('change-terminal-path', async (event, { terminalId, path }) => {
  try {
    console.log(`Changing terminal ${terminalId} path to: ${path}`);
    
    const terminal = terminalProcesses.get(terminalId);
    if (!terminal || !terminal.process) {
      return { success: false, error: 'Terminal not found' };
    }

    const platform = os.platform();
    let command = '';
    
    if (platform === 'win32') {
      // Windows - convert forward slashes to backslashes
      const windowsPath = path.replace(/\//g, '\\');
      command = `cd "${windowsPath}"\r\n`;
    } else {
      // Linux/Mac
      command = `cd "${path}"\r\n`;
    }
    
    try {
      terminal.process.write(command);
      console.log(`Sent cd command to terminal ${terminalId}: ${command.trim()}`);
      return { success: true, path: path };
    } catch (writeErr) {
      if (String(writeErr?.message || '').includes('pty') || String(writeErr?.message || '').includes('exist')) {
        terminalProcesses.delete(terminalId);
      }
      return { success: false, error: writeErr.message };
    }
  } catch (error) {
    console.error('Error changing terminal path:', error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle('execute-file', async (event, { filePath, command }) => {
  try {
    const dir = path.dirname(filePath);
    const filename = path.basename(filePath);
    
    // Use active terminal so Run works in whichever terminal is selected
    const terminalId = activeTerminalId;
    const fullCommand = `cd "${dir}" && ${command}`;
    
    const terminal = terminalProcesses.get(terminalId);
    if (terminal && terminal.process && terminal.process.write) {
      terminal.process.write(fullCommand + '\r\n');
      return { success: true, command: fullCommand };
    }
    
    return { success: false, error: 'Terminal not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

// Open HTML/URL in Chrome, Edge, or default browser
ipcMain.handle('open-in-browser', async (event, { filePathOrUrl, browser }) => {
  try {
    const url = filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')
      ? filePathOrUrl
      : 'file:///' + filePathOrUrl.replace(/\\/g, '/');
    const platform = os.platform();

    if (browser === 'default') {
      await shell.openExternal(url);
      return { success: true };
    }

    if (platform === 'win32') {
      const winPaths = {
        chrome: [
          path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ],
        edge: [
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ]
      };
      const candidates = winPaths[browser] || winPaths.chrome;
      let exe = null;
      for (const p of candidates) {
        if (p && fs.existsSync(p)) {
          exe = p;
          break;
        }
      }
      if (!exe) {
        await shell.openExternal(url);
        return { success: true, fallback: 'default' };
      }
      spawn(exe, [url], { detached: true, stdio: 'ignore' });
      return { success: true };
    }

    if (platform === 'darwin') {
      const macApps = { chrome: 'Google Chrome', edge: 'Microsoft Edge' };
      const appName = macApps[browser] || macApps.chrome;
      spawn('open', ['-a', appName, url], { detached: true, stdio: 'ignore' });
      return { success: true };
    }

    spawn(browser === 'edge' ? 'microsoft-edge' : 'google-chrome', [url], { detached: true, stdio: 'ignore' });
    return { success: true };
  } catch (err) {
    console.error('open-in-browser error:', err);
    try {
      await shell.openExternal(filePathOrUrl.startsWith('http') ? filePathOrUrl : 'file:///' + filePathOrUrl.replace(/\\/g, '/'));
    } catch (e) {}
    return { success: false, error: String(err?.message || err) };
  }
});

// ==================== FILE SYSTEM IPC HANDLERS ====================

// Helper function to read directory recursively
const readDirectoryRecursive = (dirPath, maxDepth = 5, currentDepth = 0) => {
    if (currentDepth >= maxDepth) {
        return [];
    }

    try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        // Filter out hidden files and large/irrelevant directories for performance
        const ignoredDirs = [
            'node_modules', '__pycache__', '.git', '.next', 'dist', 'build', '.env', 'vendor', '.cache',
            'AppData', 'Local Settings', 'Application Data', 'My Documents', 'Templates', 'Start Menu'
        ];
        const filteredItems = items.filter(item =>
            !item.name.startsWith('.') &&
            !ignoredDirs.includes(item.name)
        );

        return filteredItems.map((item, index) => {
            const itemPath = path.join(dirPath, item.name);
            const isDirectory = item.isDirectory();

            const node = {
                id: `${Date.now()}-${currentDepth}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                name: item.name,
                type: isDirectory ? 'directory' : 'file',
                path: itemPath,
                modified: new Date(),
            };

            if (isDirectory) {
                // Recursively read children
                node.children = readDirectoryRecursive(itemPath, maxDepth, currentDepth + 1);
            } else {
                // Read file content for small files
                try {
                    const stats = fs.statSync(itemPath);
                    if (stats.size < 50000) { // Less than 50KB
                        node.content = fs.readFileSync(itemPath, 'utf-8');
                    } else {
                        node.content = '// File too large to load in editor';
                    }
                    node.size = stats.size;
                } catch (e) {
                    node.content = '';
                }
            }

            return node;
        });
    } catch (error) {
        console.error('Error reading directory:', dirPath, error);
        return [];
    }
};

// Open folder dialog
ipcMain.handle('open-folder-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select a Folder to Open'
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const folderPath = result.filePaths[0];
    const folderName = path.basename(folderPath);

    console.log('Reading folder:', folderPath);

    // Read folder contents recursively
    try {
        const fileSystem = readDirectoryRecursive(folderPath, 4); // Max depth of 4

        console.log('Loaded', fileSystem.length, 'items from folder');

        return {
            name: folderName,
            path: folderPath,
            fileSystem: fileSystem
        };
    } catch (error) {
        console.error('Error reading folder:', error);
        return {
            name: folderName,
            path: folderPath,
            fileSystem: []
        };
    }
});

// Open file dialog
ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        title: 'Select a File to Open',
        filters: [
            { name: 'All Files', extensions: ['*'] },
            { name: 'JavaScript', extensions: ['js', 'jsx', 'ts', 'tsx'] },
            { name: 'HTML', extensions: ['html', 'htm'] },
            { name: 'CSS', extensions: ['css', 'scss', 'sass'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'Markdown', extensions: ['md', 'markdown'] }
        ]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);

    try {
        const stats = fs.statSync(filePath);
        let content = '';

        if (stats.size < 100000) {
            content = fs.readFileSync(filePath, 'utf-8');
        } else {
            content = '// File too large to load';
        }

        return {
            success: true,
            name: fileName,
            path: filePath,
            content: content,
            size: stats.size
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Read file content
ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Read directory contents recursively with safety limits
ipcMain.handle('read-directory', async (event, dirPath) => {
    console.log('IPC: Reading directory:', dirPath);
    try {
        // Use the existing robust recursive function instead of re-implementing it
        const fileSystem = readDirectoryRecursive(dirPath, 2); // Limit to 2 levels for performance on startup
        return { success: true, fileSystem };
    } catch (error) {
        console.error('Error in read-directory handler:', error);
        return { success: false, error: error.message };
    }
});

// Create new project
ipcMain.handle('create-project', async (event, projectName) => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory', 'createDirectory'],
            title: 'Select Location for New Project'
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, canceled: true };
        }

        const parentPath = result.filePaths[0];
        const projectPath = path.join(parentPath, projectName);

        if (fs.existsSync(projectPath)) {
            return { success: false, error: 'A folder with this name already exists' };
        }

        fs.mkdirSync(projectPath, { recursive: true });

        const defaultFiles = {
            'README.md': `# ${projectName}\n\nWelcome to your new project!\n`,
            'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>${projectName}</title>\n    <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n    <h1>Hello, ${projectName}!</h1>\n    <script src="script.js"></script>\n</body>\n</html>\n`,
            'styles.css': `/* Styles for ${projectName} */\nbody { font-family: sans-serif; background: #1a1a2e; color: #fff; }\n`,
            'script.js': `// JavaScript for ${projectName}\nconsole.log('Hello from ${projectName}!');\n`
        };

        for (const [filename, content] of Object.entries(defaultFiles)) {
            fs.writeFileSync(path.join(projectPath, filename), content, 'utf-8');
        }

        fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
        fs.writeFileSync(path.join(projectPath, 'src', 'main.js'), `// Main entry point\n`, 'utf-8');

        const fileSystem = readDirectoryRecursive(projectPath, 4);
        return { success: true, name: projectName, path: projectPath, fileSystem };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Save file to disk
ipcMain.handle('save-file', async (event, filePath, content) => {
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create new file on disk (content: string; isBase64: write as binary when true)
ipcMain.handle('create-file-on-disk', async (event, parentPath, fileName, content = '', isBase64 = false) => {
    try {
        const filePath = path.join(parentPath, fileName);
        if (fs.existsSync(filePath)) return { success: false, error: 'File already exists' };
        if (isBase64) {
            const buf = Buffer.from(content, 'base64');
            fs.writeFileSync(filePath, buf);
        } else {
            fs.writeFileSync(filePath, content, 'utf-8');
        }
        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create new folder on disk
ipcMain.handle('create-folder-on-disk', async (event, parentPath, folderName) => {
    try {
        const folderPath = path.join(parentPath, folderName);
        if (fs.existsSync(folderPath)) return { success: false, error: 'Folder already exists' };
        fs.mkdirSync(folderPath, { recursive: true });
        return { success: true, path: folderPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete file or folder from disk
ipcMain.handle('delete-from-disk', async (event, itemPath) => {
    try {
        const stats = fs.statSync(itemPath);
        if (stats.isDirectory()) {
            fs.rmSync(itemPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(itemPath);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Save As dialog
ipcMain.handle('save-file-dialog', async (event, defaultName, content) => {
    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: defaultName,
            title: 'Save File As',
            filters: [
                { name: 'All Files', extensions: ['*'] },
                { name: 'JavaScript', extensions: ['js', 'jsx', 'ts', 'tsx'] },
                { name: 'HTML', extensions: ['html', 'htm'] },
                { name: 'CSS', extensions: ['css', 'scss', 'sass'] }
            ]
        });
        if (result.canceled || !result.filePath) return { success: false, canceled: true };
        fs.writeFileSync(result.filePath, content, 'utf-8');
        return { success: true, path: result.filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get Home Directory
ipcMain.handle('get-home-directory', () => {
    return os.homedir();
});

// Get Drives (Windows specific, returns simplified list for other platforms)
ipcMain.handle('get-drives', () => {
    if (process.platform === 'win32') {
        // Simple way to list common drives on Windows
        const drives = ['C:', 'D:', 'E:', 'F:', 'G:'];
        const activeDrives = [];
        for (const drive of drives) {
            try {
                if (fs.existsSync(drive + '\\')) {
                    activeDrives.push({ name: `Local Disk (${drive})`, path: drive + '\\', icon: 'fa-hdd' });
                }
            } catch (e) {
                // Ignore errors (e.g. drive not ready)
            }
        }
        return activeDrives;
    } else {
        return [
            { name: 'Root', path: '/', icon: 'fa-hdd' }
        ];
    }
});

// Rename file or folder on disk
ipcMain.handle('rename-on-disk', async (event, oldPath, newPath) => {
    try {
        if (!fs.existsSync(oldPath)) return { success: false, error: 'Source does not exist' };
        if (fs.existsSync(newPath)) return { success: false, error: 'Destination already exists' };
        fs.renameSync(oldPath, newPath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Move file or folder on disk
ipcMain.handle('move-on-disk', async (event, oldPath, newPath) => {
    try {
        if (!fs.existsSync(oldPath)) return { success: false, error: 'Source does not exist' };
        if (fs.existsSync(newPath)) return { success: false, error: 'Destination already exists' };
        fs.renameSync(oldPath, newPath); // renameSync works as move if across same partition
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ==================== APP LIFECYCLE ====================

app.whenReady().then(() => {
    console.log('Electron app ready...');
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Kill all terminal processes
        terminalProcesses.forEach(proc => {
            if (proc.process && proc.process.kill) {
                proc.process.kill();
            }
        });
        terminalProcesses.clear();
        app.quit();
    }
});

app.on('before-quit', () => {
    terminalProcesses.forEach(proc => {
        if (proc.process && proc.process.kill) {
            proc.process.kill();
        }
    });
    terminalProcesses.clear();
});
