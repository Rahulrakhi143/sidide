import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { Plus, X, Terminal as TerminalIcon, Trash2, Maximize2, ChevronDown } from 'lucide-react';
import { useOS } from '../context/OsContext';
import 'xterm/css/xterm.css';

// Declare electronAPI on window
declare global {
    interface Window {
        electronAPI?: {
            writeToTerminal: (terminalId: string, data: string) => void;
            executeCommand: (terminalId: string, command: string) => void;
            clearTerminal: (terminalId: string) => void;
            resizeTerminal: (terminalId: string, cols: number, rows: number) => void;
            createTerminal: () => void;
            killTerminal: (terminalId: string) => void;
            listTerminals: () => void;
            setActiveTerminalId: (terminalId: string) => void;
            changeTerminalPath: (terminalId: string, path: string) => Promise<unknown>;
            onTerminalData: (callback: (terminalId: string, data: string) => void) => void;
            onTerminalExit: (callback: (terminalId: string, code: number) => void) => void;
            onTerminalCreated: (callback: (terminalId: string) => void) => void;
            onTerminalKilled: (callback: (terminalId: string, success: boolean) => void) => void;
            onTerminalListResponse: (callback: (terminals: string[]) => void) => void;
            removeTerminalListeners: () => void;
        };
    }
}

interface TerminalTab {
    id: string;
    title: string;
    xterm: XTerm | null;
    fitAddon: FitAddon | null;
    isReady: boolean;
    isActive: boolean;
}

interface TerminalTheme {
    name: string;
    background: string;
    foreground: string;
    cursor: string;
    cursorAccent: string;
    selection: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
}

const terminalThemes: Record<string, TerminalTheme> = {
    henu: {
        name: 'HENU IDE',
        background: '#0a0a0f',
        foreground: '#e0e0e0',
        cursor: '#ff4444',
        cursorAccent: '#0a0a0f',
        selection: 'rgba(255, 68, 68, 0.3)',
        black: '#1a1a2e',
        red: '#ff4444',
        green: '#00ff88',
        yellow: '#ffcc00',
        blue: '#4488ff',
        magenta: '#ff44ff',
        cyan: '#00ccff',
        white: '#ffffff',
        brightBlack: '#555555',
        brightRed: '#ff6666',
        brightGreen: '#66ff99',
        brightYellow: '#ffdd66',
        brightBlue: '#66aaff',
        brightMagenta: '#ff66ff',
        brightCyan: '#66ddff',
        brightWhite: '#ffffff'
    },
    matrix: {
        name: 'Matrix',
        background: '#000000',
        foreground: '#00ff00',
        cursor: '#00ff00',
        cursorAccent: '#000000',
        selection: 'rgba(0, 255, 0, 0.3)',
        black: '#000000',
        red: '#ff0000',
        green: '#00ff00',
        yellow: '#ffff00',
        blue: '#0000ff',
        magenta: '#ff00ff',
        cyan: '#00ffff',
        white: '#ffffff',
        brightBlack: '#555555',
        brightRed: '#ff5555',
        brightGreen: '#55ff55',
        brightYellow: '#ffff55',
        brightBlue: '#5555ff',
        brightMagenta: '#ff55ff',
        brightCyan: '#55ffff',
        brightWhite: '#ffffff'
    },
    dracula: {
        name: 'Dracula',
        background: '#282a36',
        foreground: '#f8f8f2',
        cursor: '#f8f8f2',
        cursorAccent: '#282a36',
        selection: 'rgba(68, 71, 90, 0.5)',
        black: '#21222c',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff'
    },
    nord: {
        name: 'Nord',
        background: '#2e3440',
        foreground: '#d8dee9',
        cursor: '#88c0d0',
        cursorAccent: '#2e3440',
        selection: 'rgba(136, 192, 208, 0.3)',
        black: '#3b4252',
        red: '#bf616a',
        green: '#a3be8c',
        yellow: '#ebcb8b',
        blue: '#81a1c1',
        magenta: '#b48ead',
        cyan: '#88c0d0',
        white: '#e5e9f0',
        brightBlack: '#4c566a',
        brightRed: '#bf616a',
        brightGreen: '#a3be8c',
        brightYellow: '#ebcb8b',
        brightBlue: '#81a1c1',
        brightMagenta: '#b48ead',
        brightCyan: '#8fbcbb',
        brightWhite: '#eceff4'
    }
};

export const TerminalXterm = () => {
    const { state } = useOS();
    const [tabs, setTabs] = useState<TerminalTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('terminal-1');
    const [currentTheme, setCurrentTheme] = useState<string>('henu');
    const [showThemeMenu, setShowThemeMenu] = useState(false);
    const terminalContainerRef = useRef<HTMLDivElement>(null);
    const terminalInstancesRef = useRef<Map<string, { xterm: XTerm; fitAddon: FitAddon }>>(new Map());
    const currentPathRef = useRef<string>('');
    const isElectron = typeof window !== 'undefined' && window.electronAPI;

    // Keep current path ref updated so new terminal can start in same directory
    useEffect(() => {
        currentPathRef.current = state.currentPath || state.rootPath || '';
    }, [state.currentPath, state.rootPath]);

    // Initialize first terminal and sync active terminal ID with main process
    useEffect(() => {
        if (tabs.length === 0) {
            setTabs([{
                id: 'terminal-1',
                title: 'Terminal 1',
                xterm: null,
                fitAddon: null,
                isReady: false,
                isActive: true
            }]);
            if (isElectron && window.electronAPI?.setActiveTerminalId) {
                window.electronAPI.setActiveTerminalId('terminal-1');
            }
        }
    }, [tabs.length, isElectron]);

    // Setup terminal listeners
    useEffect(() => {
        if (!isElectron) return;

        const api = window.electronAPI!;

        // Handle terminal data from main process
        api.onTerminalData((terminalId: string, data: string) => {
            const instance = terminalInstancesRef.current.get(terminalId);
            if (instance?.xterm) {
                instance.xterm.write(data);
            }
        });

        // Handle terminal exit
        api.onTerminalExit((terminalId: string, code: number) => {
            console.log(`Terminal ${terminalId} exited with code ${code}`);
            setTabs(prev => prev.map(tab =>
                tab.id === terminalId ? { ...tab, isReady: false } : tab
            ));
        });

        // Handle new terminal created - set as active and apply current path (same as previous terminal)
        api.onTerminalCreated((terminalId: string) => {
            console.log(`Terminal ${terminalId} created`);
            if (api.setActiveTerminalId) api.setActiveTerminalId(terminalId);
            setTabs(prev => {
                const newTab: TerminalTab = {
                    id: terminalId,
                    title: `Terminal ${prev.length + 1}`,
                    xterm: null,
                    fitAddon: null,
                    isReady: true,
                    isActive: true
                };
                return [...prev.map(t => ({ ...t, isActive: false })), newTab];
            });
            setActiveTabId(terminalId);
            // Fallback: if main didn't get cwd, send cd command (preload expects terminalId, path as two args)
            const path = currentPathRef.current;
            if (path && api.changeTerminalPath) {
                api.changeTerminalPath(terminalId, path).then((r: unknown) => {
                    if (r && typeof r === 'object' && 'success' in r && (r as { success?: boolean }).success) {
                        console.log(`New terminal ${terminalId} cd to: ${path}`);
                    }
                }).catch(() => {});
            }
        });

        // Handle terminal killed
        api.onTerminalKilled((terminalId: string, success: boolean) => {
            if (success) {
                const instance = terminalInstancesRef.current.get(terminalId);
                if (instance) {
                    instance.xterm.dispose();
                    terminalInstancesRef.current.delete(terminalId);
                }
                setTabs(prev => {
                    const remaining = prev.filter(t => t.id !== terminalId);
                    if (remaining.length > 0 && !remaining.some(t => t.isActive)) {
                        remaining[remaining.length - 1].isActive = true;
                        setActiveTabId(remaining[remaining.length - 1].id);
                    }
                    return remaining;
                });
            }
        });

        return () => {
            api.removeTerminalListeners();
        };
    }, [isElectron]);

    // Initialize xterm instance for active tab
    useEffect(() => {
        if (!terminalContainerRef.current || !activeTabId) return;

        // Check if instance already exists
        if (terminalInstancesRef.current.has(activeTabId)) {
            const existing = terminalInstancesRef.current.get(activeTabId)!;
            terminalContainerRef.current.innerHTML = '';
            existing.xterm.open(terminalContainerRef.current);
            existing.fitAddon.fit();
            existing.xterm.focus();
            return;
        }

        // Create new xterm instance
        const xterm = new XTerm({
            cursorBlink: true,
            cursorStyle: 'block',
            fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, Monaco, monospace',
            fontSize: 14,
            lineHeight: 1.2,
            theme: terminalThemes[currentTheme],
            allowTransparency: true,
            scrollback: 5000,
            convertEol: true
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        xterm.loadAddon(fitAddon);
        xterm.loadAddon(webLinksAddon);

        // Clear container and open terminal
        terminalContainerRef.current.innerHTML = '';
        xterm.open(terminalContainerRef.current);
        fitAddon.fit();

        // Store instance
        terminalInstancesRef.current.set(activeTabId, { xterm, fitAddon });

        // Update tab state
        setTabs(prev => prev.map(tab =>
            tab.id === activeTabId
                ? { ...tab, xterm, fitAddon, isReady: true }
                : tab
        ));

        // Handle user input - send to main process
        if (isElectron) {
            xterm.onData((data) => {
                window.electronAPI!.writeToTerminal(activeTabId, data);
            });

            // Request resize
            const resize = () => {
                fitAddon.fit();
                window.electronAPI!.resizeTerminal(activeTabId, xterm.cols, xterm.rows);
            };

            const resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(terminalContainerRef.current);

            return () => {
                resizeObserver.disconnect();
            };
        } else {
            // Fallback for non-Electron environment
            xterm.writeln('\x1b[1;32m═══════════════════════════════════════════\x1b[0m');
            xterm.writeln('\x1b[1;36m     HENU IDE Terminal (Web Preview)       \x1b[0m');
            xterm.writeln('\x1b[1;32m═══════════════════════════════════════════\x1b[0m');
            xterm.writeln('');
            xterm.writeln('\x1b[33mNote: Real shell commands require Electron.\x1b[0m');
            xterm.writeln('Run with: \x1b[1;35mnpm run electron:dev\x1b[0m');
            xterm.writeln('');
            xterm.write('\x1b[1;34mhenu@terminal\x1b[0m:\x1b[1;33m~\x1b[0m$ ');

            let currentLine = '';
            xterm.onData((data) => {
                if (data === '\r') {
                    xterm.writeln('');
                    if (currentLine.trim()) {
                        xterm.writeln(`\x1b[90mSimulated output for: ${currentLine}\x1b[0m`);
                    }
                    currentLine = '';
                    xterm.write('\x1b[1;34mhenu@terminal\x1b[0m:\x1b[1;33m~\x1b[0m$ ');
                } else if (data === '\x7f') { // Backspace
                    if (currentLine.length > 0) {
                        currentLine = currentLine.slice(0, -1);
                        xterm.write('\b \b');
                    }
                } else {
                    currentLine += data;
                    xterm.write(data);
                }
            });
        }

        xterm.focus();
    }, [activeTabId, isElectron]);

    // Update theme across all terminals
    useEffect(() => {
        const theme = terminalThemes[currentTheme];
        terminalInstancesRef.current.forEach(({ xterm }) => {
            xterm.options.theme = theme;
        });
    }, [currentTheme]);

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            terminalInstancesRef.current.forEach(({ fitAddon, xterm }) => {
                fitAddon.fit();
                if (isElectron && window.electronAPI) {
                    const terminalId = Array.from(terminalInstancesRef.current.entries())
                        .find(([_, v]) => v.xterm === xterm)?.[0];
                    if (terminalId) {
                        window.electronAPI.resizeTerminal(terminalId, xterm.cols, xterm.rows);
                    }
                }
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isElectron]);

    // Ctrl+Shift+C: copy terminal selection to clipboard
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!(e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c'))) return;
            const instance = terminalInstancesRef.current.get(activeTabId);
            if (!instance?.xterm) return;
            const text = instance.xterm.getSelection();
            if (!text) return;
            e.preventDefault();
            e.stopPropagation();
            navigator.clipboard.writeText(text).catch(() => {});
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [activeTabId]);

    // Run command from editor (Run button) in the active terminal
    useEffect(() => {
        const handleRunCommand = (e: CustomEvent<{ command: string }>) => {
            const cmd = e.detail?.command;
            if (!cmd || !isElectron || !window.electronAPI?.executeCommand) return;
            window.electronAPI.executeCommand(activeTabId, cmd);
        };
        window.addEventListener('run-terminal-command', handleRunCommand as EventListener);
        return () => window.removeEventListener('run-terminal-command', handleRunCommand as EventListener);
    }, [activeTabId, isElectron]);

    const createNewTerminal = useCallback(() => {
        if (isElectron && window.electronAPI) {
            const workspacePath = state.rootPath || state.currentPath || currentPathRef.current || '';
            window.electronAPI.createTerminal(workspacePath);
        } else {
            // Web fallback
            const newId = `terminal-${tabs.length + 1}`;
            setTabs(prev => [
                ...prev.map(t => ({ ...t, isActive: false })),
                {
                    id: newId,
                    title: `Terminal ${prev.length + 1}`,
                    xterm: null,
                    fitAddon: null,
                    isReady: true,
                    isActive: true
                }
            ]);
            setActiveTabId(newId);
        }
    }, [tabs.length, isElectron, state.rootPath, state.currentPath]);

    useEffect(() => {
        const onNewTerminal = () => createNewTerminal();
        window.addEventListener('henu-trigger-new-terminal', onNewTerminal);
        return () => window.removeEventListener('henu-trigger-new-terminal', onNewTerminal);
    }, [createNewTerminal]);

    const closeTerminal = useCallback((terminalId: string) => {
        if (tabs.length <= 1) return; // Keep at least one terminal

        if (isElectron && window.electronAPI) {
            window.electronAPI.killTerminal(terminalId);
        } else {
            // Web fallback
            const instance = terminalInstancesRef.current.get(terminalId);
            if (instance) {
                instance.xterm.dispose();
                terminalInstancesRef.current.delete(terminalId);
            }
            setTabs(prev => {
                const remaining = prev.filter(t => t.id !== terminalId);
                if (remaining.length > 0 && terminalId === activeTabId) {
                    remaining[remaining.length - 1].isActive = true;
                    setActiveTabId(remaining[remaining.length - 1].id);
                }
                return remaining;
            });
        }
    }, [tabs.length, activeTabId, isElectron]);

    const switchTab = useCallback((terminalId: string) => {
        if (isElectron && window.electronAPI?.setActiveTerminalId) {
            window.electronAPI.setActiveTerminalId(terminalId);
        }
        setTabs(prev => prev.map(t => ({
            ...t,
            isActive: t.id === terminalId
        })));
        setActiveTabId(terminalId);
    }, [isElectron]);

    const clearActiveTerminal = useCallback(() => {
        if (isElectron && window.electronAPI) {
            window.electronAPI.clearTerminal(activeTabId);
        } else {
            const instance = terminalInstancesRef.current.get(activeTabId);
            if (instance) {
                instance.xterm.clear();
            }
        }
    }, [activeTabId, isElectron]);

    return (
        <div className="h-full flex flex-col bg-[#0a0a0f] rounded-lg overflow-hidden border border-red-900/30">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-r from-gray-900/80 to-gray-800/60 border-b border-red-900/20">
                {/* Tabs */}
                <div className="flex items-center space-x-1 overflow-x-auto flex-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => switchTab(tab.id)}
                            className={`
                flex items-center space-x-2 px-3 py-1.5 rounded-t text-sm transition-all duration-200
                ${tab.isActive
                                    ? 'bg-[#0a0a0f] text-white border-t-2 border-red-500'
                                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                                }
              `}
                        >
                            <TerminalIcon size={14} className={tab.isActive ? 'text-red-400' : 'text-gray-500'} />
                            <span>{tab.title}</span>
                            {tabs.length > 1 && (
                                <X
                                    size={12}
                                    className="hover:text-red-400 ml-1 opacity-60 hover:opacity-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        closeTerminal(tab.id);
                                    }}
                                />
                            )}
                        </button>
                    ))}

                    {/* New Terminal Button */}
                    <button
                        onClick={createNewTerminal}
                        className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-gray-700/50 rounded transition-colors"
                        title="New Terminal"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-1">
                    {/* Theme Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowThemeMenu(!showThemeMenu)}
                            className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors"
                        >
                            <span>{terminalThemes[currentTheme].name}</span>
                            <ChevronDown size={12} />
                        </button>

                        {showThemeMenu && (
                            <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded shadow-lg z-50 min-w-[120px]">
                                {Object.entries(terminalThemes).map(([key, theme]) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setCurrentTheme(key);
                                            setShowThemeMenu(false);
                                        }}
                                        className={`
                      w-full px-3 py-2 text-left text-sm hover:bg-gray-800 transition-colors
                      ${currentTheme === key ? 'text-red-400' : 'text-gray-300'}
                    `}
                                    >
                                        {theme.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Clear Terminal */}
                    <button
                        onClick={clearActiveTerminal}
                        className="p-1.5 text-gray-500 hover:text-yellow-400 hover:bg-gray-700/50 rounded transition-colors"
                        title="Clear Terminal"
                    >
                        <Trash2 size={14} />
                    </button>

                    {/* Maximize (placeholder) */}
                    <button
                        className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-gray-700/50 rounded transition-colors"
                        title="Maximize"
                    >
                        <Maximize2 size={14} />
                    </button>
                </div>
            </div>

            {/* Terminal Container - extra bottom padding (~2 lines) so last command/output stay fully visible */}
            <div
                ref={terminalContainerRef}
                className="flex-1 p-2 min-h-0"
                style={{
                    backgroundColor: terminalThemes[currentTheme].background,
                    paddingBottom: '2.5em'
                }}
            />

            {/* Status Bar */}
            <div className="flex items-center justify-between px-3 py-1 text-xs bg-gray-900/80 border-t border-red-900/20 text-gray-500">
                <div className="flex items-center space-x-4">
                    <span className="text-gray-400">Theme: {terminalThemes[currentTheme].name}</span>
                    <span>{tabs.length} terminal{tabs.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center space-x-4">
                    <span className={tabs.find(t => t.id === activeTabId)?.isReady ? 'text-green-400' : 'text-yellow-400'}>
                        {tabs.find(t => t.id === activeTabId)?.isReady ? '● Connected' : '○ Connecting...'}
                    </span>
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        </div>
    );
};

export default TerminalXterm;
