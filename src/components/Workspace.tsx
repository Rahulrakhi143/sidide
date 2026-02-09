import { useState, useEffect, useRef } from 'react';
import { Panel } from './Panel';
import { FileExplorer } from './FileExplorer';
import logo from '../assets/logo.png';
import { CodeEditor } from './CodeEditor';
import { AIAgent } from './AIAgent';
import { BottomPanel } from './BottomPanel';
import { Preview } from './Preview';
import { GitPanel } from './GitPanel';
import { StatusHUD } from './StatusHUD';
import { SettingsPanel } from './SettingsPanel';
import { FileDialog, CommandPalette } from './FileDialog';
import { NewProjectDialog } from './NewProjectDialog';
import { useOS } from '../context/OsContext';
import {
  Play, Square, RotateCcw, Eye, Maximize2, Grid3x3,
  Zap, Split, Layout,
  ChevronLeft, ChevronRight, X, Minus,
  Bell, GitBranch, Palette, Check, Settings, User
} from 'lucide-react';
import { useTheme, themes } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { LogOut, Shield } from 'lucide-react';

// Electron API (exposed via preload.js with context isolation)
const electronAPI = (window as any).electronAPI;

// Workspace component logic
type LayoutMode = 'default' | 'code' | 'terminal' | 'preview' | 'ai' | 'custom';

// Menu configuration
const menuConfig: Record<string, { label: string; shortcut?: string; action?: string; divider?: boolean }[]> = {
  File: [
    { label: 'New Project...', action: 'newProject' },
    { label: 'New File', shortcut: 'Ctrl+N', action: 'newFile' },
    { label: 'New Folder', shortcut: 'Ctrl+Shift+N', action: 'newFolder' },
    { divider: true, label: '' },
    { label: 'Open File...', shortcut: 'Ctrl+O', action: 'openFile' },
    { label: 'Open Folder...', shortcut: 'Ctrl+K Ctrl+O', action: 'openFolder' },
    { divider: true, label: '' },
    { label: 'Save', shortcut: 'Ctrl+S', action: 'save' },
    { label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: 'saveAs' },
    { label: 'Save All', shortcut: 'Ctrl+K S', action: 'saveAll' },
    { divider: true, label: '' },
    { label: 'Exit', shortcut: 'Alt+F4', action: 'exit' },
  ],
  Edit: [
    { label: 'Undo', shortcut: 'Ctrl+Z', action: 'undo' },
    { label: 'Redo', shortcut: 'Ctrl+Y', action: 'redo' },
    { divider: true, label: '' },
    { label: 'Cut', shortcut: 'Ctrl+X', action: 'cut' },
    { label: 'Copy', shortcut: 'Ctrl+C', action: 'copy' },
    { label: 'Paste', shortcut: 'Ctrl+V', action: 'paste' },
    { divider: true, label: '' },
    { label: 'Find', shortcut: 'Ctrl+F', action: 'find' },
    { label: 'Replace', shortcut: 'Ctrl+H', action: 'replace' },
  ],
  Selection: [
    { label: 'Select All', shortcut: 'Ctrl+A', action: 'selectAll' },
    { label: 'Expand Selection', shortcut: 'Shift+Alt+Right', action: 'expandSelection' },
    { label: 'Shrink Selection', shortcut: 'Shift+Alt+Left', action: 'shrinkSelection' },
  ],
  View: [
    { label: 'Command Palette...', shortcut: 'Ctrl+Shift+P', action: 'commandPalette' },
    { divider: true, label: '' },
    { label: 'Explorer', shortcut: 'Ctrl+Shift+E', action: 'toggleExplorer' },
    { label: 'Terminal', shortcut: 'Ctrl+`', action: 'toggleTerminal' },
    { label: 'AI Assistant', shortcut: 'Ctrl+Shift+A', action: 'toggleAI' },
    { divider: true, label: '' },
    { label: 'Full Screen', shortcut: 'F11', action: 'fullscreen' },
  ],
  Go: [
    { label: 'Go to File...', shortcut: 'Ctrl+P', action: 'goToFile' },
    { label: 'Go to Symbol...', shortcut: 'Ctrl+Shift+O', action: 'goToSymbol' },
    { label: 'Go to Line...', shortcut: 'Ctrl+G', action: 'goToLine' },
  ],
  Run: [
    { label: 'Start Debugging', shortcut: 'F5', action: 'startDebug' },
    { label: 'Run Without Debugging', shortcut: 'Ctrl+F5', action: 'runWithoutDebug' },
    { label: 'Stop', shortcut: 'Shift+F5', action: 'stop' },
    { label: 'Restart', shortcut: 'Ctrl+Shift+F5', action: 'restart' },
  ],
  Terminal: [
    { label: 'New Terminal', shortcut: 'Ctrl+Shift+`', action: 'newTerminal' },
    { label: 'Split Terminal', shortcut: 'Ctrl+Shift+5', action: 'splitTerminal' },
    { divider: true, label: '' },
    { label: 'Run Task...', action: 'runTask' },
    { label: 'Run Build Task', shortcut: 'Ctrl+Shift+B', action: 'runBuildTask' },
  ],
  Help: [
    { label: 'Welcome', action: 'welcome' },
    { label: 'Documentation', action: 'docs' },
    { label: 'Keyboard Shortcuts', shortcut: 'Ctrl+K Ctrl+S', action: 'shortcuts' },
    { divider: true, label: '' },
    { label: 'About HENU', action: 'about' },
  ],
};

export const Workspace = () => {
  const { activeTheme, setActiveTheme } = useTheme();
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'preview' | 'ai' | 'git'>('ai');
  const [isRunning, setIsRunning] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState('editor');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('default');
  const [isResizing, setIsResizing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Build Complete', message: 'Project built successfully', time: '2 min ago', unread: true },
    { id: 2, title: 'AI Suggestion', message: 'Optimization available for main.js', time: '5 min ago', unread: true },
    { id: 3, title: 'System Update', message: 'HENU v1.2 available', time: '1 hour ago', unread: false },
  ]);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Get current user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  // Dialog states
  const [dialogType, setDialogType] = useState<'newFile' | 'newFolder' | 'saveAs' | 'openFile' | 'goToLine' | 'find' | 'replace' | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);

  // OS Context
  const { state, createFile, addOutputMessage, updateFileSystem, setCurrentPath, openTab, openFolder } = useOS();

  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<{ type: string; startX?: number; startY?: number; startWidth?: number; startHeight?: number }>({ type: '' });

  // Panel layout states
  const [panelLayouts, setPanelLayouts] = useState({
    sidebar: { width: 300, isResizing: false },
    terminal: { height: 250, isResizing: false },
    rightPanel: { width: 380, isResizing: false },
  });

  // Auto-adjust layout on window resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 1024) {
        setPanelLayouts(prev => ({
          ...prev,
          sidebar: { ...prev.sidebar, width: 240 },
          rightPanel: { ...prev.rightPanel, width: 320 },
        }));
      } else if (width < 1280) {
        setPanelLayouts(prev => ({
          ...prev,
          sidebar: { ...prev.sidebar, width: 280 },
          rightPanel: { ...prev.rightPanel, width: 350 },
        }));
      } else {
        setPanelLayouts(prev => ({
          ...prev,
          sidebar: { ...prev.sidebar, width: 300 },
          rightPanel: { ...prev.rightPanel, width: 380 },
        }));
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (isResizing && resizeHandleRef.current.type) {
      e.preventDefault();
      const { type, startX, startY, startWidth, startHeight } = resizeHandleRef.current;
      switch (type) {
        case 'sidebar':
          if (startX !== undefined && startWidth !== undefined) {
            const newWidth = Math.max(200, Math.min(500, startWidth + (e.clientX - startX)));
            setPanelLayouts(prev => ({ ...prev, sidebar: { ...prev.sidebar, width: newWidth } }));
          }
          break;
        case 'terminal':
          if (startY !== undefined && startHeight !== undefined) {
            const newHeight = Math.max(150, Math.min(500, startHeight - (e.clientY - startY)));
            setPanelLayouts(prev => ({ ...prev, terminal: { ...prev.terminal, height: newHeight } }));
          }
          break;
        case 'rightPanel':
          if (startX !== undefined && startWidth !== undefined) {
            const newWidth = Math.max(250, Math.min(500, startWidth - (e.clientX - startX)));
            setPanelLayouts(prev => ({ ...prev, rightPanel: { ...prev.rightPanel, width: newWidth } }));
          }
          break;
      }
    }
  };

  const startResizing = (type: string, e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeHandleRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: type === 'sidebar' ? panelLayouts.sidebar.width : type === 'rightPanel' ? panelLayouts.rightPanel.width : undefined,
      startHeight: type === 'terminal' ? panelLayouts.terminal.height : undefined,
    };
    document.body.style.cursor = type === 'terminal' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const stopResizing = () => {
    setIsResizing(false);
    resizeHandleRef.current = { type: '' };
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  useEffect(() => {
    const handleMouseUp = () => stopResizing();
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    };
  }, []);

  // Close notifications on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showNotifications && !target.closest('.notifications-container')) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      window.addEventListener('click', handleClick);
    }
    return () => window.removeEventListener('click', handleClick);
  }, [showNotifications]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (activeMenu && !target.closest('.menu-container')) {
        setActiveMenu(null);
      }
    };
    if (activeMenu) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeMenu]);

  // Close profile menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showProfileMenu && !target.closest('.profile-container')) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      window.addEventListener('click', handleClick);
    }
    return () => window.removeEventListener('click', handleClick);
  }, [showProfileMenu]);

  const handleLayoutChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
    switch (mode) {
      case 'code':
        setPanelLayouts({ sidebar: { width: 300, isResizing: false }, terminal: { height: 0, isResizing: false }, rightPanel: { width: 0, isResizing: false } });
        setSidebarCollapsed(false);
        setTerminalCollapsed(true);
        setRightPanelCollapsed(true);
        break;
      case 'terminal':
        setPanelLayouts({ sidebar: { width: 0, isResizing: false }, terminal: { height: 500, isResizing: false }, rightPanel: { width: 0, isResizing: false } });
        setSidebarCollapsed(true);
        setTerminalCollapsed(false);
        setRightPanelCollapsed(true);
        break;
      case 'preview':
        setPanelLayouts({ sidebar: { width: 0, isResizing: false }, terminal: { height: 0, isResizing: false }, rightPanel: { width: 800, isResizing: false } });
        setRightPanelMode('preview');
        setSidebarCollapsed(true);
        setTerminalCollapsed(true);
        setRightPanelCollapsed(false);
        break;
      case 'ai':
        setPanelLayouts({ sidebar: { width: 0, isResizing: false }, terminal: { height: 0, isResizing: false }, rightPanel: { width: 500, isResizing: false } });
        setRightPanelMode('ai');
        setSidebarCollapsed(true);
        setTerminalCollapsed(true);
        setRightPanelCollapsed(false);
        break;
      default:
        setPanelLayouts({ sidebar: { width: 300, isResizing: false }, terminal: { height: 250, isResizing: false }, rightPanel: { width: 380, isResizing: false } });
        setSidebarCollapsed(false);
        setTerminalCollapsed(false);
        setRightPanelCollapsed(false);
        break;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const clearNotifications = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };


  const handleRunCode = () => {
    window.dispatchEvent(new CustomEvent('henu-trigger-run'));
  };

  // Window control functions
  const handleMinimize = () => {
    if (electronAPI) electronAPI.minimizeWindow();
  };

  const handleMaximize = () => {
    if (electronAPI) electronAPI.maximizeWindow();
  };

  const handleClose = () => {
    if (electronAPI) electronAPI.closeWindow();
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            if (e.shiftKey) {
              e.preventDefault();
              handleMenuAction('newFolder');
            } else {
              e.preventDefault();
              handleMenuAction('newFile');
            }
            break;
          case 's':
            e.preventDefault();
            if (e.shiftKey) {
              handleMenuAction('saveAs');
            } else {
              handleMenuAction('save');
            }
            break;
          case 'p':
            e.preventDefault();
            handleMenuAction(e.shiftKey ? 'commandPalette' : 'goToFile');
            break;
          case 'o':
            if (e.shiftKey) {
              e.preventDefault();
              handleMenuAction('goToSymbol');
            }
            break;
          case 'b':
            e.preventDefault();
            handleMenuAction('toggleExplorer');
            break;
          case 'e':
            if (e.shiftKey) {
              e.preventDefault();
              handleMenuAction('toggleExplorer');
            }
            break;
          case 'a':
            if (e.shiftKey) {
              e.preventDefault();
              handleMenuAction('toggleAI');
            }
            break;
          case 'g':
            e.preventDefault();
            handleMenuAction('goToLine');
            break;
          case 'f':
            e.preventDefault();
            handleMenuAction('find');
            break;
          case 'h':
            e.preventDefault();
            handleMenuAction('replace');
            break;
          case 'r':
            e.preventDefault();
            handleMenuAction('startDebug');
            break;
          case '`':
          case 'backquote':
            e.preventDefault();
            handleMenuAction('toggleTerminal');
            break;
          case ',':
            e.preventDefault();
            setShowSettings(true);
            break;
        }
      }

      // F keys
      if (e.key === 'F5') {
        e.preventDefault();
        if (e.ctrlKey && e.shiftKey) {
          handleMenuAction('restart');
        } else if (e.ctrlKey) {
          handleMenuAction('runWithoutDebug');
        } else if (e.shiftKey) {
          handleMenuAction('stop');
        } else {
          handleMenuAction('startDebug');
        }
      }
      if (e.key === 'F11') {
        e.preventDefault();
        handleMenuAction('fullscreen');
      }

      // Escape to close dialogs
      if (e.key === 'Escape') {
        if (showCommandPalette) setShowCommandPalette(false);
        if (dialogType) setDialogType(null);
        if (showSettings) setShowSettings(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette, dialogType, showSettings, sidebarCollapsed, terminalCollapsed, rightPanelCollapsed]);

  // Menu action handler
  const handleMenuAction = (action: string) => {
    setActiveMenu(null);
    switch (action) {
      // File menu actions
      case 'newProject':
        setShowNewProject(true);
        break;
      case 'newFile':
        setDialogType('newFile');
        break;
      case 'newFolder':
        setDialogType('newFolder');
        break;
      case 'openFile':
        // Use Electron's file dialog
        if (electronAPI) {
          (async () => {
            try {
              const result = await electronAPI.openFileDialog();
              if (result && result.success) {
                // Create a FileSystemNode from the result and open it
                const fileNode = {
                  id: `file-${Date.now()}`,
                  name: result.name,
                  type: 'file' as const,
                  content: result.content,
                  path: result.path,
                  size: result.size,
                  modified: new Date()
                };
                openTab(fileNode);
                addOutputMessage(`Opened: ${result.name}`, 'success');
              }
            } catch (err: any) {
              addOutputMessage(`Error: ${err.message}`, 'error');
            }
          })();
        } else {
          addOutputMessage('Open File not available in browser mode', 'warning');
        }
        break;
      case 'openFolder':
        if (electronAPI) {
          (async () => {
            try {
              await openFolder();
              setSidebarCollapsed(false);
            } catch (err: any) {
              addOutputMessage(`Error: ${err.message}`, 'error');
            }
          })();
        } else {
          addOutputMessage('Open Folder not available in browser mode', 'warning');
        }
        break;
      case 'save':
        if (state.activeFile) {
          window.dispatchEvent(new CustomEvent('henu-trigger-save'));
        } else {
          addOutputMessage('No file to save', 'warning');
        }
        break;
      case 'saveAs':
        if (state.activeFile) {
          if (electronAPI) {
            (async () => {
              try {
                const result = await electronAPI.saveFileDialog(state.activeFile!.name, state.activeFile!.content || '');
                if (result.success) {
                  addOutputMessage(`Saved As: ${result.path}`, 'success');
                }
              } catch (err: any) {
                addOutputMessage(`Save As error: ${err.message}`, 'error');
              }
            })();
          } else {
            setDialogType('saveAs');
          }
        } else {
          addOutputMessage('No file to save', 'warning');
        }
        break;
      case 'saveAll':
        window.dispatchEvent(new CustomEvent('henu-trigger-save-all'));
        break;
      case 'exit':
        handleClose();
        break;

      // Edit menu actions
      case 'undo':
        window.dispatchEvent(new CustomEvent('henu-trigger-undo'));
        break;
      case 'redo':
        window.dispatchEvent(new CustomEvent('henu-trigger-redo'));
        break;
      case 'cut':
        window.dispatchEvent(new CustomEvent('henu-trigger-cut'));
        break;
      case 'copy':
        window.dispatchEvent(new CustomEvent('henu-trigger-copy'));
        break;
      case 'paste':
        window.dispatchEvent(new CustomEvent('henu-trigger-paste'));
        break;
      case 'find':
        setDialogType('find');
        break;
      case 'replace':
        setDialogType('replace');
        break;

      // Selection menu actions
      case 'selectAll':
        window.dispatchEvent(new CustomEvent('henu-trigger-select-all'));
        break;
      case 'expandSelection':
      case 'shrinkSelection':
        addOutputMessage(`${action}: Use keyboard shortcuts in editor`, 'info');
        break;

      // View menu actions
      case 'commandPalette':
        setShowCommandPalette(true);
        break;
      case 'toggleExplorer':
        setSidebarCollapsed(!sidebarCollapsed);
        break;
      case 'toggleTerminal':
        setTerminalCollapsed(!terminalCollapsed);
        break;
      case 'toggleAI':
        setRightPanelCollapsed(!rightPanelCollapsed);
        setRightPanelMode('ai');
        break;
      case 'fullscreen':
        toggleFullscreen();
        break;

      // Go menu actions
      case 'goToFile':
        handleMenuAction('openFile');
        break;
      case 'goToSymbol':
        setShowCommandPalette(true);
        break;
      case 'goToLine':
        setDialogType('goToLine');
        break;

      // Run menu actions
      case 'startDebug':
      case 'runWithoutDebug':
        handleRunCode();
        break;
      case 'stop':
        setIsRunning(false);
        addOutputMessage('Execution stopped', 'info');
        break;
      case 'restart':
        setIsRunning(false);
        setTimeout(() => handleRunCode(), 100);
        break;

      // Terminal menu actions
      case 'newTerminal':
        setTerminalCollapsed(false);
        if (electronAPI?.createTerminal) {
          electronAPI.createTerminal();
        } else {
          window.dispatchEvent(new CustomEvent('henu-trigger-new-terminal'));
        }
        break;
      case 'splitTerminal':
        setTerminalCollapsed(false);
        addOutputMessage('Split terminal: Use terminal toolbar', 'info');
        break;
      case 'runTask':
      case 'runBuildTask':
        addOutputMessage('Run task: Use terminal to run commands', 'info');
        break;

      // Help menu actions
      case 'welcome':
        addOutputMessage('Welcome to HENU IDE! Type "help" in terminal for commands.', 'info');
        break;
      case 'docs':
        window.open('https://github.com/henu-ide/docs', '_blank');
        break;
      case 'shortcuts':
        setShowSettings(true);
        break;
      case 'about':
        setNotifications(prev => [
          { id: Date.now(), title: 'About HENU IDE', message: 'Version 2.1.0 - Built with ❤️ by HENU Team', time: 'Just now', unread: true },
          ...prev
        ]);
        break;

      // Settings
      case 'settings':
        setShowSettings(true);
        break;

      default:
        console.log('Menu action:', action);
    }
  };

  // Handle dialog confirm
  const handleDialogConfirm = (value: string, extra?: string) => {
    switch (dialogType) {
      case 'newFile':
        addOutputMessage(`Created file: ${value}`, 'success');
        break;
      case 'newFolder':
        addOutputMessage(`Created folder: ${value}`, 'success');
        break;
      case 'saveAs':
        if (state.activeFile) {
          createFile(value, state.activeFile.content || '');
          addOutputMessage(`Saved as: ${value}`, 'success');
        }
        break;
      case 'goToLine': {
        const lineNum = parseInt(value, 10);
        if (!Number.isNaN(lineNum) && lineNum >= 1) {
          window.dispatchEvent(new CustomEvent('henu-trigger-goto-line', { detail: { line: lineNum } }));
        }
        break;
      }
      case 'find':
        window.dispatchEvent(new CustomEvent('henu-trigger-find', { detail: { search: value } }));
        break;
      case 'replace':
        window.dispatchEvent(new CustomEvent('henu-trigger-replace', { detail: { search: value, replace: extra ?? '' } }));
        break;
    }
    setDialogType(null);
  };

  return (
    <div ref={containerRef} className="h-screen w-screen bg-black overflow-hidden relative select-none" onMouseMove={handleMouseMove}>
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-red-950/10 to-black"></div>

      {/* Animated Grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite'
        }} />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="absolute w-px h-px bg-red-500/20 rounded-full" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${3 + Math.random() * 4}s infinite ease-in-out`,
            animationDelay: `${Math.random() * 2}s`,
            boxShadow: '0 0 20px 2px rgba(239, 68, 68, 0.3)'
          }} />
        ))}
      </div>

      <div className="relative z-10 h-full flex flex-col min-h-0">
        {/* Unified Single Header Bar - fixed at top so it never shifts or disappears */}
        <header className="fixed top-0 left-0 right-0 h-10 z-[100] bg-theme-tertiary border-b border-theme flex items-center justify-between px-2 select-none shadow-2xl">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: `linear-gradient(90deg, transparent, var(--accent-primary), transparent)` }}></div>
          {/* Left Section: Logo, HENU, Menu Items, Layout Buttons */}
          <div className="flex items-center h-full space-x-3 menu-container">
            {/* Logo */}
            <div className="flex items-center space-x-2 cursor-pointer px-1">
              <img src={logo} alt="Logo" className="w-7 h-7 object-contain" />
              <div className="text-glow-accent font-bold tracking-wider text-sm" style={{ color: 'var(--accent-primary)' }}>HENU IDE</div>
            </div>

            {/* Separator */}
            <div className="h-4 w-px bg-white/10"></div>

            {/* Theme Selector */}
            <div className="relative">
              <button
                onClick={() => setShowThemeSelector(!showThemeSelector)}
                className={`flex items-center space-x-2 px-3 h-7 rounded-md transition-all text-[11px] border ${showThemeSelector ? 'bg-white/10 border-white/20' : 'border-transparent hover:bg-white/10'}`}
                style={{ color: 'var(--text-primary)' }}
              >
                <Palette size={13} style={{ color: 'var(--accent-primary)' }} />
                <span>Theme: {activeTheme.name}</span>
              </button>

              {showThemeSelector && (
                <div className="absolute top-full left-0 mt-2 bg-theme-secondary border border-theme rounded-lg shadow-2xl py-2 min-w-44 z-[10000] animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-xl">
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Select IDE Theme</div>
                  {Object.values(themes).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTheme(t.id);
                        setShowThemeSelector(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-all flex items-center justify-between group ${activeTheme.id === t.id ? 'text-theme-accent bg-white/5' : 'text-gray-400'}`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.colors.accent }}></div>
                        <span>{t.name}</span>
                      </div>
                      {activeTheme.id === t.id && <Check size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="h-4 w-px bg-white/10"></div>

            {/* Menu Items */}
            {Object.keys(menuConfig).map((menuName) => (
              <div key={menuName} className="relative">
                <div
                  className={`px-2 h-10 flex items-center text-[11px] cursor-pointer transition-colors duration-150 ${activeMenu === menuName ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                  onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === menuName ? null : menuName); }}
                  onMouseEnter={() => { if (activeMenu && activeMenu !== menuName) setActiveMenu(menuName); }}
                >
                  {menuName}
                </div>
                {activeMenu === menuName && (
                  <div className="absolute top-full left-0 mt-0 bg-[#252526] border border-white/10 rounded-md shadow-xl py-1 min-w-56 z-[9999]">
                    {menuConfig[menuName].map((item, idx) => (
                      item.divider ? (
                        <div key={idx} className="h-px bg-white/10 my-1 mx-2" />
                      ) : (
                        <div key={idx} className="px-3 py-1.5 flex items-center justify-between text-[12px] text-gray-300 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors" onClick={() => item.action && handleMenuAction(item.action)}>
                          <span>{item.label}</span>
                          {item.shortcut && <span className="text-gray-500 text-[11px] ml-8">{item.shortcut}</span>}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Separator */}
            <div className="h-4 w-px bg-white/10"></div>

            {/* Layout Buttons */}
            <div className="flex items-center space-x-1">
              <button onClick={() => handleLayoutChange('default')} className={`px-2 py-1 text-[10px] rounded transition-all ${layoutMode === 'default' ? 'bg-red-900/40 text-red-300' : 'text-gray-400 hover:text-red-300 hover:bg-red-900/20'}`}>
                <Layout size={12} className="inline mr-1" />Default
              </button>
              <button onClick={() => handleLayoutChange('code')} className={`px-2 py-1 text-[10px] rounded transition-all ${layoutMode === 'code' ? 'bg-red-900/40 text-red-300' : 'text-gray-400 hover:text-red-300 hover:bg-red-900/20'}`}>
                <Split size={12} className="inline mr-1" />Code
              </button>
              <button onClick={() => handleLayoutChange('terminal')} className={`px-2 py-1 text-[10px] rounded transition-all ${layoutMode === 'terminal' ? 'bg-red-900/40 text-red-300' : 'text-gray-400 hover:text-red-300 hover:bg-red-900/20'}`}>
                <Grid3x3 size={12} className="inline mr-1" />Terminal
              </button>
            </div>
          </div>

          {/* Middle: Window Title */}
          <div className="flex-1 text-center text-gray-500 text-[11px] font-medium truncate px-4">
            {/* Folder path removed - now displayed in code editor */}
          </div>

          {/* Right Section: Control Buttons and Window Controls */}
          <div className="flex items-center h-full space-x-2">
            {/* Control Buttons */}
            <div className="flex items-center space-x-0.5 bg-black/40 rounded-lg p-0.5 border border-red-900/20">
              <button onClick={handleRunCode} className={`p-1.5 rounded transition-all ${isRunning ? 'bg-yellow-900/30 text-yellow-300' : 'hover:bg-red-900/30 text-red-400 hover:text-red-300'}`} title={isRunning ? 'Stop' : 'Run'}>
                {isRunning ? <Square size={13} className="animate-pulse" /> : <Play size={13} />}
              </button>
              <button onClick={() => handleLayoutChange('ai')} className="p-1.5 hover:bg-purple-900/30 rounded transition-all text-purple-400 hover:text-purple-300" title="AI Assistant">
                <Zap size={13} />
              </button>
              <button
                onClick={() => setRightPanelMode(rightPanelMode === 'preview' ? 'ai' : 'preview')}
                className={`p-1.5 rounded transition-all ${rightPanelMode === 'preview' ? 'bg-red-900/40 text-red-300' : 'text-red-400 hover:bg-red-900/30'
                  }`}
                title="Toggle Preview"
              >
                <Eye size={13} />
              </button>
              <button
                onClick={() => {
                  setRightPanelMode('git');
                  setRightPanelCollapsed(false);
                }}
                className={`p-1.5 rounded transition-all ${rightPanelMode === 'git' ? 'bg-red-900/40 text-red-300' : 'text-red-400 hover:bg-red-900/30'
                  }`}
                title="Git Panel"
              >
                <GitBranch size={13} />
              </button>
              <div className="relative notifications-container">
                <button onClick={() => setShowNotifications(!showNotifications)} className="p-1.5 hover:bg-red-900/30 rounded transition-all text-red-400 hover:text-red-300 relative" title="Notifications">
                  <Bell size={13} />
                  {notifications.filter(n => n.unread).length > 0 && (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-600 rounded-full flex items-center justify-center text-[8px]">{notifications.filter(n => n.unread).length}</div>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-96 bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-red-900/30 py-2 z-[9999]">
                    <div className="px-4 py-3 border-b border-red-900/20 flex justify-between items-center">
                      <h3 className="text-red-400 font-bold">Notifications</h3>
                      <button onClick={clearNotifications} className="text-xs text-gray-500 hover:text-gray-300">Mark all read</button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map(notification => (
                        <div key={notification.id} className={`px-4 py-3 hover:bg-red-900/10 transition-colors ${notification.unread ? 'bg-red-900/5' : ''}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-200">{notification.title}</div>
                              <div className="text-sm text-gray-400 mt-1">{notification.message}</div>
                            </div>
                            <div className="text-xs text-gray-500">{notification.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={toggleFullscreen} className="p-1.5 hover:bg-red-900/30 rounded transition-all text-red-400 hover:text-red-300" title="Fullscreen">
                <Maximize2 size={13} />
              </button>
              <button onClick={() => handleLayoutChange('default')} className="p-1.5 hover:bg-red-900/30 rounded transition-all text-red-400 hover:text-red-300" title="Reset Layout">
                <RotateCcw size={13} />
              </button>

              <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-theme-accent/20 rounded transition-all text-theme-accent" title="Settings">
                <Settings size={13} />
              </button>

              <div className="relative profile-container">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className={`p-1.5 rounded transition-all flex items-center justify-center border ${showProfileMenu ? 'bg-theme-accent/30 border-theme-accent' : 'hover:bg-theme-accent/20 border-theme-accent/20'} text-theme-accent`}
                  title="Profile"
                >
                  <User size={13} />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-red-900/30 py-4 z-[9999] animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-4 mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-theme-accent/20 flex items-center justify-center border border-theme-accent text-theme-accent">
                          <User size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">{user?.email?.split('@')[0] || 'Operator'}</div>
                          <div className="text-[10px] text-gray-500 truncate uppercase tracking-tighter">{user?.email || 'OFFLINE_MODE'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="px-2 space-y-1">
                      <div className="px-3 py-2 flex items-center justify-between text-xs text-gray-400 bg-black/40 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Shield size={12} className="text-blue-400" />
                          <span>Status</span>
                        </div>
                        <span className="text-[10px] text-green-400 font-mono">SECURE</span>
                      </div>

                      <button
                        onClick={() => { setShowSettings(true); setShowProfileMenu(false); }}
                        className="w-full px-3 py-2 flex items-center space-x-3 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <Settings size={14} />
                        <span>Account Settings</span>
                      </button>

                      <div className="h-px bg-white/5 my-2 mx-1" />

                      <button
                        onClick={() => supabase.auth.signOut()}
                        className="w-full px-3 py-2 flex items-center space-x-3 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors font-bold"
                      >
                        <LogOut size={14} />
                        <span>TERMINATE SESSION</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-white/10"></div>

            {/* Window Controls */}
            <div className="flex items-center h-full">
              <div className="w-10 h-full flex items-center justify-center text-gray-400 hover:bg-white/10 cursor-pointer transition-colors" onClick={handleMinimize} title="Minimize">
                <Minus size={14} />
              </div>
              <div className="w-10 h-full flex items-center justify-center text-gray-400 hover:bg-white/10 cursor-pointer transition-colors" onClick={handleMaximize} title="Maximize">
                <Square size={10} strokeWidth={1.5} />
              </div>
              <div className="w-10 h-full flex items-center justify-center text-gray-400 hover:bg-red-600 hover:text-white cursor-pointer transition-colors" onClick={handleClose} title="Close">
                <X size={14} />
              </div>
            </div>
          </div>
        </header>

        {/* Spacer so content starts below fixed header (same as header height) */}
        <div className="flex-shrink-0 w-full h-10" aria-hidden="true" />

        {/* Main Workspace Area */}
        <div className="flex-1 flex overflow-hidden relative min-h-0">
          {!sidebarCollapsed && (
            <>
              <div ref={sidebarRef} className="border-r border-theme overflow-hidden hover-lift transition-[box-shadow,opacity] duration-300" style={{ width: `${panelLayouts.sidebar.width}px` }}>
                <Panel title="FILE SYSTEM" className="h-full rounded-none" onCollapse={() => setSidebarCollapsed(true)}>
                  <FileExplorer />
                </Panel>
              </div>
              <div className="w-1 cursor-col-resize hover:bg-theme-accent/50 active:bg-theme-accent transition-colors" onMouseDown={(e) => startResizing('sidebar', e)} />
            </>
          )}

          {sidebarCollapsed && (
            <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-20">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2 bg-theme-secondary/80 backdrop-blur-sm border border-theme rounded-r-lg hover:bg-theme-accent/20 transition-all hover:translate-x-1"
              >
                <ChevronRight size={20} className="text-theme-accent" />
              </button>
            </div>
          )}

          {/* Middle Area - Code Editor & Terminal (terminal always mounted to preserve content) */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 border-b border-theme overflow-hidden hover-lift transition-[box-shadow,opacity] duration-300" style={{ height: terminalCollapsed ? '100%' : `calc(100% - ${panelLayouts.terminal.height}px - 8px)`, opacity: terminalCollapsed ? 1 : 0.98 }}>
              <Panel
                title="CODE EDITOR"
                className="h-full rounded-none"
                isActive={activeTab === 'editor'}
                onClick={() => setActiveTab('editor')}
                centerContent={
                  <div className="text-xs text-theme-muted font-mono flex items-center space-x-2">
                    <span className="text-theme-accent">📁</span>
                    <span>siddarth2-main\siddarth2-main</span>
                  </div>
                }
              >
                <CodeEditor />
              </Panel>
            </div>

            {/* Resize handle - only visible when terminal expanded */}
            {!terminalCollapsed && (
              <div className="h-1 flex-shrink-0 cursor-row-resize hover:bg-theme-accent/50 active:bg-theme-accent transition-colors" onMouseDown={(e) => startResizing('terminal', e)} />
            )}
            {/* Terminal panel: always in DOM (hidden when collapsed) so content is not cleared */}
            <div
              ref={terminalRef}
              className="border-t border-theme overflow-hidden hover-lift transition-[box-shadow,opacity] duration-300 flex-shrink-0"
              style={{
                height: terminalCollapsed ? 0 : `${panelLayouts.terminal.height}px`,
                minHeight: terminalCollapsed ? 0 : undefined,
                opacity: terminalCollapsed ? 0 : 1,
                pointerEvents: terminalCollapsed ? 'none' : 'auto',
                visibility: terminalCollapsed ? 'hidden' : 'visible',
              }}
            >
              <BottomPanel
                onCollapse={() => setTerminalCollapsed(true)}
                isActive={activeTab === 'terminal'}
                onClick={() => setActiveTab('terminal')}
              />
            </div>

            {terminalCollapsed && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-20 flex-shrink-0">
                <button
                  onClick={() => setTerminalCollapsed(false)}
                  className="p-2 bg-theme-secondary/80 backdrop-blur-sm border border-theme rounded-t-lg hover:bg-theme-accent/20 transition-all hover:-translate-y-1"
                >
                  <ChevronLeft size={20} className="text-theme-accent rotate-90" />
                </button>
              </div>
            )}
          </div>

          {/* Right Panel */}
          {!rightPanelCollapsed && (
            <>
              <div className="w-1 cursor-col-resize hover:bg-theme-accent/50 active:bg-theme-accent transition-colors" onMouseDown={(e) => startResizing('rightPanel', e)} />
              <div ref={rightPanelRef} className="border-l border-theme overflow-hidden hover-lift transition-[box-shadow,opacity] duration-300" style={{ width: `${panelLayouts.rightPanel.width}px` }}>
                <Panel
                  title={
                    rightPanelMode === 'preview' ? "LIVE PREVIEW" :
                      rightPanelMode === 'git' ? "GIT" :
                        "AI AGENT"
                  }
                  className="h-full rounded-none"
                  onCollapse={() => setRightPanelCollapsed(true)}
                >
                  {rightPanelMode === 'preview' ? <Preview /> :
                    rightPanelMode === 'git' ? <GitPanel /> :
                      <AIAgent />}
                </Panel>
              </div>
            </>
          )}

          {rightPanelCollapsed && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-20">
              <button
                onClick={() => setRightPanelCollapsed(false)}
                className="p-2 bg-theme-secondary/80 backdrop-blur-sm border border-theme rounded-l-lg hover:bg-theme-accent/20 transition-all hover:-translate-x-1"
              >
                <ChevronLeft size={20} className="text-theme-accent" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Status Bar - flex-shrink-0 so it does not shift */}
        <div className="flex-shrink-0 px-4 py-2 bg-black/60 backdrop-blur-md border-t border-red-900/30 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            <div className="text-gray-400 font-mono"><span className="text-red-400">Mode:</span> {layoutMode.toUpperCase()}</div>
            <div className="text-gray-400 font-mono"><span className="text-green-400">Panel:</span> {!sidebarCollapsed ? '📁' : '❌'} {!terminalCollapsed ? '💻' : '❌'} {!rightPanelCollapsed ? (rightPanelMode === 'preview' ? '👁️' : rightPanelMode === 'git' ? '🔀' : '🤖') : '❌'}</div>
            <div className="text-gray-400 font-mono"><span className="text-blue-400">Cursor:</span> {mousePos.x}, {mousePos.y}</div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
              </div>
              <span className="text-gray-500">System Normal</span>
            </div>
            <div className="h-4 w-px bg-red-900/30"></div>
            <div className="flex items-center space-x-1">
              <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full" style={{ width: '75%' }}></div>
              </div>
              <span className="text-gray-500">75% CPU</span>
            </div>
          </div>
        </div>
      </div>

      <StatusHUD />

      <style>{`
        .hover-lift { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .hover-lift:hover { box-shadow: 0 20px 40px rgba(239, 68, 68, 0.15), 0 0 30px rgba(239, 68, 68, 0.1); }
        .control-bar { position: relative; backdrop-filter: blur(20px); }
        .control-bar::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.5), transparent); animation: scan-line 3s linear infinite; }
        @keyframes scan-line { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes float { 0%, 100% { transform: translateY(0) translateX(0); } 50% { transform: translateY(-20px) translateX(10px); } }
        @keyframes gridMove { 0% { transform: translateX(0) translateY(0); } 100% { transform: translateX(50px) translateY(50px); } }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.3); border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(239, 68, 68, 0.5); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(239, 68, 68, 0.7); }
      `}</style>

      {/* Settings Panel */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* File Dialog */}
      {dialogType && (
        <FileDialog
          type={dialogType}
          isOpen={true}
          onClose={() => setDialogType(null)}
          onConfirm={handleDialogConfirm}
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onAction={handleMenuAction}
      />

      {/* New Project Dialog */}
      <NewProjectDialog
        isOpen={showNewProject}
        onClose={() => setShowNewProject(false)}
        onProjectCreated={(project) => {
          updateFileSystem(project.fileSystem);
          setCurrentPath(project.path);
          addOutputMessage(`Created project: ${project.name} at ${project.path}`, 'success');
          setSidebarCollapsed(false);
        }}
      />
    </div >
  );
};