const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loading...');

contextBridge.exposeInMainWorld('electronAPI', {
    // Terminal operations
    writeToTerminal: (terminalId, data) => ipcRenderer.send('terminal-write', { terminalId, data }),
    executeCommand: (terminalId, command) => ipcRenderer.send('terminal-execute', { terminalId, command }),
    clearTerminal: (terminalId) => ipcRenderer.send('terminal-clear', terminalId),
    resizeTerminal: (terminalId, cols, rows) => ipcRenderer.send('terminal-resize', { terminalId, cols, rows }),

    // Multi-terminal management
    createTerminal: (initialCwd) => ipcRenderer.send('terminal-create', initialCwd || null),
    killTerminal: (terminalId) => {
        try {
            return ipcRenderer.send('terminal-kill', terminalId);
        } catch (error) {
            console.error('Failed to kill terminal:', error);
            return false;
        }
    },
    listTerminals: () => ipcRenderer.send('terminal-list'),
    // Add these to your existing preload.js file

  changeTerminalPath: (terminalId, path) =>
    ipcRenderer.invoke('change-terminal-path', { terminalId, path }),

  // ===== ✅ Active Terminal Functions =====
  setActiveTerminalId: (terminalId) => {
    activeTerminalId = terminalId;
    ipcRenderer.send('set-active-terminal', terminalId);
  },

  getActiveTerminalId: () => {
    return activeTerminalId;
  },
    // Terminal events
    onTerminalData: (callback) => {
        ipcRenderer.on('terminal-data', (event, { terminalId, data }) => callback(terminalId, data));
    },

    onTerminalExit: (callback) => {
        ipcRenderer.on('terminal-exit', (event, { terminalId, code }) => callback(terminalId, code));
    },

    onTerminalCreated: (callback) => {
        ipcRenderer.on('terminal-created', (event, terminalId) => callback(terminalId));
    },

    onTerminalKilled: (callback) => {
        ipcRenderer.on('terminal-killed', (event, { terminalId, success }) => callback(terminalId, success));
    },

    onTerminalListResponse: (callback) => {
        ipcRenderer.on('terminal-list-response', (event, terminals) => callback(terminals));
    },

    // Remove listeners
    removeTerminalListeners: () => {
        ipcRenderer.removeAllListeners('terminal-data');
        ipcRenderer.removeAllListeners('terminal-exit');
        ipcRenderer.removeAllListeners('terminal-created');
        ipcRenderer.removeAllListeners('terminal-killed');
        ipcRenderer.removeAllListeners('terminal-list-response');
    },

    // Window controls
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),

    openInBrowser: (filePathOrUrl, browser) =>
        ipcRenderer.invoke('open-in-browser', { filePathOrUrl, browser: browser || 'default' }),

    // File system operations
    openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
    createProject: (projectName) => ipcRenderer.invoke('create-project', projectName),
    saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
    createFileOnDisk: (parentPath, fileName, content, isBase64 = false) => ipcRenderer.invoke('create-file-on-disk', parentPath, fileName, content, isBase64),
    createFolderOnDisk: (parentPath, folderName) => ipcRenderer.invoke('create-folder-on-disk', parentPath, folderName),
    deleteFromDisk: (itemPath) => ipcRenderer.invoke('delete-from-disk', itemPath),
    saveFileDialog: (defaultName, content) => ipcRenderer.invoke('save-file-dialog', defaultName, content),
    renameOnDisk: (oldPath, newPath) => ipcRenderer.invoke('rename-on-disk', oldPath, newPath),
    moveOnDisk: (oldPath, newPath) => ipcRenderer.invoke('move-on-disk', oldPath, newPath),

    // System info
    getHomeDirectory: () => ipcRenderer.invoke('get-home-directory'),
    getDrives: () => ipcRenderer.invoke('get-drives'),
    platform: process.platform,

    // Path utilities
    path: {
        join: (...args) => args.join(process.platform === 'win32' ? '\\' : '/'), // Simple fallback, better to handle in main
        extname: (filename) => {
            const parts = filename.split('.');
            return parts.length > 1 ? '.' + parts.pop() : '';
        },
        dirname: (filePath) => {
            const separator = (process.platform === 'win32' && filePath.includes('\\')) ? '\\' : '/';
            const parts = filePath.split(separator);
            parts.pop();
            return parts.join(separator) || (separator === '/' ? '/' : '.\\');
        }
    },

    // Helpers
    formatBytes: (bytes, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    formatDate: (date) => {
        return new Date(date).toLocaleString();
    }
});

console.log('Preload script loaded');
