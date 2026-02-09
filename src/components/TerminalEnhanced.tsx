import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { useOS } from '../context/OsContext';
import {
    Palette, Plus, X,
    SplitSquareHorizontal, Columns, Terminal as TerminalIcon,
    ChevronDown
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getGitService } from '../services/GitService';

// Shell types
type ShellType = 'powershell' | 'bash' | 'zsh' | 'cmd' | 'henu';

interface ShellConfig {
    id: ShellType;
    name: string;
    prompt: string;
    icon: string;
    color: string;
}

const shells: ShellConfig[] = [
    { id: 'powershell', name: 'PowerShell', prompt: 'PS>', icon: '⚡', color: 'text-blue-400' },
    { id: 'bash', name: 'Bash', prompt: '$', icon: '🐧', color: 'text-green-400' },
    { id: 'zsh', name: 'Zsh', prompt: '%', icon: '🚀', color: 'text-purple-400' },
    { id: 'cmd', name: 'CMD', prompt: '>', icon: '📦', color: 'text-yellow-400' },
    { id: 'henu', name: 'HENU Shell', prompt: '›', icon: '🔥', color: 'text-red-400' },
];

// Terminal instance interface
interface TerminalInstance {
    id: string;
    name: string;
    shell: ShellType;
    history: { command: string; output: string; isError?: boolean; timestamp: Date }[];
    commandHistory: string[];
    currentPath: string;
}

interface CommandSuggestion {
    command: string;
    description: string;
}

interface TerminalTheme {
    name: string;
    background: string;
    foreground: string;
    border: string;
    accent: string;
    userColor: string;
    pathColor: string;
    commandColor: string;
    cursorColor: string;
    font: string;
}

const terminalThemes: Record<string, TerminalTheme> = {
    henu: {
        name: 'HENU IDE',
        background: 'bg-black/40',
        foreground: 'text-gray-300',
        border: 'border-red-900/30',
        accent: 'text-red-400',
        userColor: 'text-cyan-400',
        pathColor: 'text-yellow-400',
        commandColor: 'text-gray-100',
        cursorColor: 'caret-green-500',
        font: 'font-mono'
    },
    matrix: {
        name: 'Matrix',
        background: 'bg-black/90',
        foreground: 'text-green-500',
        border: 'border-green-900/50',
        accent: 'text-green-400',
        userColor: 'text-green-600',
        pathColor: 'text-green-400',
        commandColor: 'text-green-300',
        cursorColor: 'caret-green-400',
        font: 'font-mono'
    },
    cyberpunk: {
        name: 'Cyberpunk',
        background: 'bg-indigo-950/80',
        foreground: 'text-pink-300',
        border: 'border-yellow-500/30',
        accent: 'text-yellow-400',
        userColor: 'text-purple-400',
        pathColor: 'text-cyan-400',
        commandColor: 'text-white',
        cursorColor: 'caret-yellow-400',
        font: 'font-mono'
    },
    nord: {
        name: 'Nord',
        background: 'bg-[#2E3440]/90',
        foreground: 'text-[#D8DEE9]',
        border: 'border-[#4C566A]',
        accent: 'text-[#88C0D0]',
        userColor: 'text-[#81A1C1]',
        pathColor: 'text-[#A3BE8C]',
        commandColor: 'text-[#ECEFF4]',
        cursorColor: 'caret-[#88C0D0]',
        font: 'font-mono'
    },
    sunset: {
        name: 'Sunset',
        background: 'bg-orange-950/70',
        foreground: 'text-orange-100',
        border: 'border-orange-500/20',
        accent: 'text-orange-400',
        userColor: 'text-red-400',
        pathColor: 'text-yellow-400',
        commandColor: 'text-white',
        cursorColor: 'caret-red-500',
        font: 'font-mono'
    }
};

// Local storage keys
const STORAGE_KEYS = {
    TERMINALS: 'henu_terminals',
    HISTORY: 'henu_terminal_history',
    SETTINGS: 'henu_terminal_settings'
};

export const TerminalEnhanced = () => {
    const {
        state,
        addTerminalCommand,
        createFile,
        createDirectory,
        deleteNode,
        listDirectory,
        getNodeByPath,
        setCurrentPath,
    } = useOS();

    const { activeTheme: globalTheme } = useTheme();
    const theme = terminalThemes[globalTheme.id] || terminalThemes.henu;

    // Create new terminal instance
    const createTerminalInstance = (shell: ShellType = 'henu', count: number = 1): TerminalInstance => {
        return {
            id: `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `Terminal ${count}`,
            shell,
            history: [],
            commandHistory: [],
            currentPath: state?.currentPath || '/home/user'
        };
    };

    // Terminal instances state
    const [terminals, setTerminals] = useState<TerminalInstance[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.TERMINALS);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            } catch {
                // Fall through to default
            }
        }
        return [createTerminalInstance('henu', 1)];
    });

    const [activeTerminalId, setActiveTerminalId] = useState<string>(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.TERMINALS);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed[0].id;
                }
            } catch {
                // Fall through
            }
        }
        return '';
    });
    const [splitMode, setSplitMode] = useState<'none' | 'horizontal' | 'vertical'>('none');
    const [splitTerminalId, setSplitTerminalId] = useState<string | null>(null);
    const [showShellSelector, setShowShellSelector] = useState(false);

    // Input state
    const [input, setInput] = useState('');
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
    const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const terminalEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const lastPathUpdateRef = useRef<number>(0);

    // Wrapper function that uses current terminals length
    const createNewTerminal = (shell: ShellType = 'henu'): TerminalInstance => {
        return createTerminalInstance(shell, terminals.length + 1);
    };

    // Save terminals to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.TERMINALS, JSON.stringify(terminals));
    }, [terminals]);

    // Load command history from localStorage
    useEffect(() => {
        const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
        if (savedHistory) {
            try {
                const history = JSON.parse(savedHistory);
                setTerminals(prev => prev.map(t => ({
                    ...t,
                    commandHistory: history[t.id] || t.commandHistory
                })));
            } catch (e) {
                console.error('Failed to load history:', e);
            }
        }
    }, []);

    // Get active terminal (must be before useEffects that use it)
    const activeTerminal = terminals.find(t => t.id === activeTerminalId) || terminals[0];
    const splitTerminal = splitTerminalId ? terminals.find(t => t.id === splitTerminalId) : null;

    // Listen for path updates from file explorer - FIXED VERSION
    useEffect(() => {
        const handlePathUpdate = (event: CustomEvent<{ path: string }>) => {
            const { path } = event.detail;
            const now = Date.now();
            
            // Prevent multiple updates within 500ms
            if (now - lastPathUpdateRef.current < 500) return;
            lastPathUpdateRef.current = now;
            
            console.log(`Terminal received path update: ${path}`, event.type);
            
            if (activeTerminal) {
                // Update terminal's current path
                updateTerminalPath(activeTerminal.id, path);
                
                // Send cd command to terminal via electron
                const api = (window as any).electronAPI;
                if (api && api.executeCommand) {
                    let cdCommand = '';
                    if (navigator.platform.toLowerCase().includes('win')) {
                        cdCommand = `cd "${path.replace(/\//g, '\\')}"\r\n`;
                    } else {
                        cdCommand = `cd "${path}"\r\n`;
                    }
                    console.log(`Sending cd command to terminal: ${cdCommand}`);
                    api.executeCommand(activeTerminal.id, cdCommand);
                } else {
                    // If no electron API, simulate the cd command
                    console.log(`Simulating cd command for path: ${path}`);
                    executeInTerminal(activeTerminal.id, `cd "${path}"`);
                }
            }
        };

        // Listen for both event names for compatibility
        const handleUpdatePath = (e: Event) => {
            const customEvent = e as CustomEvent<{ path: string }>;
            if (customEvent.detail && customEvent.detail.path) {
                handlePathUpdate(customEvent);
            }
        };

        window.addEventListener('terminal-path-update', handleUpdatePath);
        window.addEventListener('update-terminal-path', handleUpdatePath);
        
        return () => {
            window.removeEventListener('terminal-path-update', handleUpdatePath);
            window.removeEventListener('update-terminal-path', handleUpdatePath);
        };
    }, [activeTerminal]);

    // Listen for run commands from code editor
    useEffect(() => {
        const handleRunCommand = (event: CustomEvent<{ command: string }>) => {
            const { command } = event.detail;
            if (activeTerminal) {
                executeInTerminal(activeTerminal.id, command);
            }
        };

        window.addEventListener('run-terminal-command', handleRunCommand as EventListener);
        
        return () => {
            window.removeEventListener('run-terminal-command', handleRunCommand as EventListener);
        };
    }, [activeTerminal]);

    // Save command history to localStorage
    const saveHistory = useCallback(() => {
        const historyMap: Record<string, string[]> = {};
        terminals.forEach(t => {
            historyMap[t.id] = t.commandHistory.slice(-100);
        });
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(historyMap));
    }, [terminals]);

    useEffect(() => {
        saveHistory();
    }, [terminals, saveHistory]);

    // Command suggestions
    const commandSuggestions: CommandSuggestion[] = [
        { command: 'help', description: 'Show all available commands' },
        { command: 'ls', description: 'List directory contents' },
        { command: 'cd', description: 'Change directory' },
        { command: 'pwd', description: 'Print working directory' },
        { command: 'cat', description: 'Display file contents' },
        { command: 'mkdir', description: 'Create new directory' },
        { command: 'touch', description: 'Create new file' },
        { command: 'rm', description: 'Remove files/directories' },
        { command: 'clear', description: 'Clear terminal screen' },
        { command: 'echo', description: 'Display text' },
        { command: 'whoami', description: 'Display current user' },
        { command: 'date', description: 'Show current date and time' },
        { command: 'history', description: 'Show command history' },
        { command: 'henu', description: 'HENU AI tools' },
    ];

    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeTerminal?.history]);

    useEffect(() => {
        if (input.trim()) {
            const filtered = commandSuggestions.filter(cmd =>
                cmd.command.toLowerCase().startsWith(input.toLowerCase().split(' ')[0])
            );
            setSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
            setSelectedSuggestion(-1);
        } else {
            setShowSuggestions(false);
        }
    }, [input]);

    // Add new terminal
    const addTerminal = (shell: ShellType = 'henu') => {
        const newTerminal = createNewTerminal(shell);
        setTerminals(prev => [...prev, newTerminal]);
        setActiveTerminalId(newTerminal.id);
        setShowShellSelector(false);
    };

    // Close terminal
    const closeTerminal = (id: string) => {
        if (terminals.length <= 1) return;

        setTerminals(prev => prev.filter(t => t.id !== id));
        if (activeTerminalId === id) {
            const remaining = terminals.filter(t => t.id !== id);
            setActiveTerminalId(remaining[0]?.id || '');
        }
        if (splitTerminalId === id) {
            setSplitTerminalId(null);
            setSplitMode('none');
        }
    };

    // Clear terminal history
    const clearTerminalHistory = (id: string) => {
        setTerminals(prev => prev.map(t =>
            t.id === id ? { ...t, history: [] } : t
        ));
    };

    // Toggle split mode
    const toggleSplit = (mode: 'horizontal' | 'vertical') => {
        if (splitMode === mode) {
            setSplitMode('none');
            setSplitTerminalId(null);
        } else {
            setSplitMode(mode);
            if (!splitTerminalId && terminals.length > 1) {
                const other = terminals.find(t => t.id !== activeTerminalId);
                setSplitTerminalId(other?.id || null);
            } else if (!splitTerminalId) {
                const newTerminal = createNewTerminal();
                setTerminals(prev => [...prev, newTerminal]);
                setSplitTerminalId(newTerminal.id);
            }
        }
    };

    // Update terminal path
    const updateTerminalPath = (terminalId: string, path: string) => {
        setTerminals(prev => prev.map(t =>
            t.id === terminalId ? { ...t, currentPath: path } : t
        ));
    };

    // Execute command in specific terminal
    const executeInTerminal = async (terminalId: string, cmd: string) => {
        const terminal = terminals.find(t => t.id === terminalId);
        if (!terminal) return;

        const parts = cmd.trim().split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        let output = '';
        let isError = false;

        switch (command) {
            case 'help':
                output = `
╔══════════════════════════════════════════════════════════════╗
║                    HENU Terminal v2.0                        ║
║              Multi-Instance • Split View                     ║
╠══════════════════════════════════════════════════════════════╣
║  FILE SYSTEM                                                 ║
║  ls [-la]          List directory contents                   ║
║  cd <path>         Change directory                          ║
║  pwd               Print working directory                   ║
║  cat <file>        Display file contents                     ║
║  mkdir <dir>       Create directory                          ║
║  touch <file>      Create file                               ║
║  rm <file>         Remove file/directory                     ║
║                                                              ║
║  TERMINAL                                                    ║
║  clear             Clear terminal screen                     ║
║  history           Show command history                      ║
║  shell <type>      Switch shell (bash/zsh/powershell/cmd)    ║
║                                                              ║
║  HENU AI                                                     ║
║  henu fix          Auto-fix code issues                      ║
║  henu optimize     Optimize code                             ║
║  henu explain      Explain code                              ║
╚══════════════════════════════════════════════════════════════╝`;
                break;

            case 'ls':
                const items = listDirectory();
                if (items.length === 0) {
                    output = '(empty directory)';
                } else {
                    const dirs = items.filter(i => i.type === 'directory');
                    const files = items.filter(i => i.type === 'file');
                    output = [
                        ...dirs.map(d => `📁 ${d.name}/`),
                        ...files.map(f => `📄 ${f.name}`)
                    ].join('\n');
                }
                break;

            case 'pwd':
                output = terminal.currentPath || state.currentPath;
                break;

            case 'cd':
                if (args.length === 0) {
                    output = 'cd: missing argument';
                    isError = true;
                } else {
                    const path = args[0];
                    if (path === '~') {
                        setCurrentPath('/home/user');
                        updateTerminalPath(terminalId, '/home/user');
                    } else if (path === '..') {
                        const newPath = (terminal.currentPath || state.currentPath).split('/').slice(0, -1).join('/') || '/';
                        setCurrentPath(newPath);
                        updateTerminalPath(terminalId, newPath);
                    } else {
                        const newPath = path.startsWith('/') ? path : `${terminal.currentPath || state.currentPath}/${path}`;
                        const node = getNodeByPath(newPath);
                        if (node && node.type === 'directory') {
                            setCurrentPath(newPath);
                            updateTerminalPath(terminalId, newPath);
                        } else {
                            output = `cd: ${path}: No such directory`;
                            isError = true;
                        }
                    }
                }
                break;

            case 'clear':
                clearTerminalHistory(terminalId);
                return;

            case 'history':
                output = terminal.commandHistory.map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n') || 'No command history';
                break;

            case 'shell':
                if (args.length === 0) {
                    output = `Current shell: ${terminal.shell}\nAvailable: ${shells.map(s => s.id).join(', ')}`;
                } else {
                    const newShell = args[0].toLowerCase() as ShellType;
                    if (shells.find(s => s.id === newShell)) {
                        setTerminals(prev => prev.map(t =>
                            t.id === terminalId ? { ...t, shell: newShell } : t
                        ));
                        output = `Switched to ${newShell}`;
                    } else {
                        output = `Unknown shell: ${args[0]}`;
                        isError = true;
                    }
                }
                break;

            case 'mkdir':
                if (args.length === 0) {
                    output = 'mkdir: missing operand';
                    isError = true;
                } else {
                    try {
                        createDirectory(args[0]);
                        output = `Created directory: ${args[0]}`;
                    } catch {
                        output = `mkdir: cannot create directory '${args[0]}'`;
                        isError = true;
                    }
                }
                break;

            case 'touch':
                if (args.length === 0) {
                    output = 'touch: missing operand';
                    isError = true;
                } else {
                    try {
                        createFile(args[0], '');
                        output = `Created file: ${args[0]}`;
                    } catch {
                        output = `touch: cannot create file '${args[0]}'`;
                        isError = true;
                    }
                }
                break;

            case 'rm':
                if (args.length === 0) {
                    output = 'rm: missing operand';
                    isError = true;
                } else {
                    const node = getNodeByPath(args[0]);
                    if (node) {
                        deleteNode(node.id);
                        output = `Removed: ${args[0]}`;
                    } else {
                        output = `rm: cannot remove '${args[0]}': No such file or directory`;
                        isError = true;
                    }
                }
                break;

            case 'cat':
                if (args.length === 0) {
                    output = 'cat: missing operand';
                    isError = true;
                } else {
                    const node = getNodeByPath(args[0]);
                    if (node && node.type === 'file') {
                        output = node.content || '(empty file)';
                    } else {
                        output = `cat: ${args[0]}: No such file`;
                        isError = true;
                    }
                }
                break;

            case 'echo':
                output = args.join(' ');
                break;

            case 'whoami':
                output = 'henu';
                break;

            case 'date':
                output = new Date().toString();
                break;

            case 'henu':
                const subcommand = args[0] || 'help';
                output = `🔥 HENU AI: ${subcommand}\n\nProcessing with AI...\n(This would connect to HENU AI backend)`;
                break;

            case 'git':
                const gitService = getGitService();
                if (!gitService) {
                    output = 'Git service not initialized. Try re-opening the folder.';
                    isError = true;
                    break;
                }

                const gitCmd = args[0];
                if (!gitCmd) {
                    output = 'Usage: git <command> [args]\nAvailable: init, status, add, commit, branch, checkout, log, push, pull';
                    isError = true;
                    break;
                }

                try {
                    switch (gitCmd) {
                        case 'init':
                            await gitService.init();
                            output = 'Initialized empty Git repository';
                            window.dispatchEvent(new CustomEvent('git-changed'));
                            break;
                        case 'status':
                            const status = await gitService.getStatus();
                            output = `On branch ${status.branch}\n\n`;
                            if (status.staged.length > 0) {
                                output += 'Changes to be committed:\n';
                                status.staged.forEach(f => output += `  modified: ${f}\n`);
                            }
                            if (status.modified.length > 0) {
                                output += '\nChanges not staged for commit:\n';
                                status.modified.forEach(f => output += `  modified: ${f}\n`);
                            }
                            if (status.untracked.length > 0) {
                                output += '\nUntracked files:\n';
                                status.untracked.forEach(f => output += `  ${f}\n`);
                            }
                            if (status.modified.length === 0 && status.staged.length === 0 && status.untracked.length === 0) {
                                output += 'nothing to commit, working tree clean';
                            }
                            break;
                        case 'add':
                            if (!args[1]) {
                                output = 'Nothing specified, nothing added.';
                            } else {
                                await gitService.add(args[1] === '.' ? [...(await gitService.getStatus()).modified, ...(await gitService.getStatus()).untracked] : args[1]);
                                output = `Added ${args[1]}`;
                            }
                            window.dispatchEvent(new CustomEvent('git-changed'));
                            break;
                        case 'commit':
                            const msgIndex = args.indexOf('-m');
                            if (msgIndex === -1 || !args[msgIndex + 1]) {
                                output = 'Aborting commit due to empty commit message.\nUse: git commit -m "message"';
                                isError = true;
                            } else {
                                const commitMsg = args.slice(msgIndex + 1).join(' ').replace(/['"]/g, '');
                                const sha = await gitService.commit(commitMsg);
                                output = `[main ${sha.substring(0, 7)}] ${commitMsg}`;
                            }
                            window.dispatchEvent(new CustomEvent('git-changed'));
                            break;
                        case 'branch':
                            if (!args[1]) {
                                const branches = await gitService.listBranches();
                                output = branches.map(b => b.current ? `* ${b.name}` : `  ${b.name}`).join('\n');
                            } else {
                                await gitService.createBranch(args[1]);
                                output = `Created branch ${args[1]}`;
                            }
                            window.dispatchEvent(new CustomEvent('git-changed'));
                            break;
                        case 'checkout':
                            if (!args[1]) {
                                output = 'Please specify a branch to checkout.';
                                isError = true;
                            } else {
                                await gitService.checkout(args[1]);
                                output = `Switched to branch '${args[1]}'`;
                            }
                            window.dispatchEvent(new CustomEvent('git-changed'));
                            break;
                        case 'log':
                            const logCommits = await gitService.log(args[1] ? parseInt(args[1]) : 10);
                            output = logCommits.map(c =>
                                `\x1b[33mcommit ${c.oid}\x1b[0m\nAuthor: ${c.author}\nDate: ${new Date(c.timestamp).toLocaleString()}\n\n    ${c.message}\n`
                            ).join('\n');
                            break;
                        case 'push':
                            await gitService.push();
                            output = 'Everything up-to-date';
                            break;
                        case 'pull':
                            await gitService.pull();
                            output = 'Already up to date.';
                            break;
                        default:
                            output = `git: '${gitCmd}' is not a git command. See 'git help'.`;
                            isError = true;
                    }
                } catch (err: any) {
                    output = `fatal: ${err.message}`;
                    isError = true;
                }
                break;

            default:
                output = `${command}: command not found\nType 'help' for available commands`;
                isError = true;
        }

        // Add to terminal history
        setTerminals(prev => prev.map(t => {
            if (t.id !== terminalId) return t;
            return {
                ...t,
                history: [...t.history, { command: cmd, output, isError, timestamp: new Date() }],
                commandHistory: [...t.commandHistory, cmd]
            };
        }));

        // Also add to global terminal history
        addTerminalCommand(cmd, output, isError);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (!activeTerminal) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const history = activeTerminal.commandHistory;
            if (history.length > 0) {
                const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : 0;
                setHistoryIndex(newIndex);
                setInput(history[history.length - 1 - newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(activeTerminal.commandHistory[activeTerminal.commandHistory.length - 1 - newIndex]);
            } else {
                setHistoryIndex(-1);
                setInput('');
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (suggestions.length > 0 && selectedSuggestion === -1) {
                setInput(suggestions[0].command + ' ');
            } else if (selectedSuggestion >= 0) {
                setInput(suggestions[selectedSuggestion].command + ' ');
                setSelectedSuggestion(-1);
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !activeTerminal) return;

        executeInTerminal(activeTerminal.id, input.trim());
        setInput('');
        setHistoryIndex(-1);
        setShowSuggestions(false);
    };

    const handleSuggestionClick = (suggestion: CommandSuggestion) => {
        setInput(suggestion.command + ' ');
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const getCurrentDirectoryName = (path?: string) => {
        const p = path || activeTerminal?.currentPath || state.currentPath;
        const parts = p.split('/');
        return parts[parts.length - 1] || '/';
    };

    // Render terminal content
    const renderTerminalContent = (terminal: TerminalInstance, isSecondary = false) => {
        const shellConfig = shells.find(s => s.id === terminal.shell) || shells[4];

        return (
            <div className={`h-full flex flex-col ${theme.background} ${theme.font}`}>
                {/* Terminal Content */}
                <div className="flex-1 overflow-auto p-4 text-sm">
                    {/* Welcome Message */}
                    {terminal.history.length === 0 && (
                        <div className={`mb-4 ${theme.foreground}`}>
                            <div className="text-lg mb-1">{shellConfig.icon} {shellConfig.name} Terminal</div>
                            <div className="text-gray-500 text-xs">Type 'help' to see available commands</div>
                            <div className="text-gray-600 text-xs mt-1">Current path: {terminal.currentPath}</div>
                        </div>
                    )}

                    {/* Command History */}
                    <div className="space-y-3">
                        {terminal.history.map((item, i) => (
                            <div key={i} className="mb-2">
                                <div className="flex items-center space-x-2 mb-0.5">
                                    <span className={shellConfig.color}>{shellConfig.prompt}</span>
                                    <span className={theme.pathColor}>{getCurrentDirectoryName(terminal.currentPath)}</span>
                                    <span className={theme.commandColor}>{item.command}</span>
                                </div>
                                {item.output && (
                                    <div className={`ml-4 whitespace-pre-wrap ${item.isError ? 'text-red-400' : 'text-gray-400'}`}>
                                        {item.output}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Input Area (only for active terminal, not secondary in split) */}
                    {(!isSecondary || terminal.id === activeTerminalId) && (
                        <div className="mt-3 relative">
                            <div className="flex items-center space-x-2">
                                <span className={shellConfig.color}>{shellConfig.prompt}</span>
                                <span className={theme.pathColor}>{getCurrentDirectoryName(terminal.currentPath)}</span>
                                <form onSubmit={handleSubmit} className="flex-1">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className={`w-full bg-transparent ${theme.commandColor} focus:outline-none ${theme.cursorColor}`}
                                        placeholder="Enter command..."
                                        autoFocus
                                        spellCheck={false}
                                    />
                                </form>
                            </div>

                            {/* Suggestions */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                                    {suggestions.map((s, i) => (
                                        <button
                                            key={s.command}
                                            type="button"
                                            onClick={() => handleSuggestionClick(s)}
                                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-800 ${i === selectedSuggestion ? 'bg-gray-800' : ''}`}
                                        >
                                            <span className="text-gray-200">{s.command}</span>
                                            <span className="text-gray-500 ml-2">{s.description}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div ref={terminalEndRef} />
                </div>
            </div>
        );
    };

    return (
        <div className={`h-full flex flex-col ${theme.background} backdrop-blur-xl`}>
            {/* Tab Bar */}
            <div className={`flex items-center border-b ${theme.border} bg-black/50`}>
                {/* Terminal Tabs */}
                <div className="flex-1 flex items-center overflow-x-auto">
                    {terminals.map(t => {
                        const shellConfig = shells.find(s => s.id === t.shell) || shells[4];
                        return (
                            <button
                                key={t.id}
                                onClick={() => setActiveTerminalId(t.id)}
                                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs border-r border-gray-800 transition-colors ${activeTerminalId === t.id
                                    ? 'bg-white/10 text-white'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                    }`}
                            >
                                <span>{shellConfig.icon}</span>
                                <span>{t.name}</span>
                                {terminals.length > 1 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }}
                                        className="ml-1 p-0.5 hover:bg-red-900/50 rounded opacity-50 hover:opacity-100"
                                    >
                                        <X size={10} />
                                    </button>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Controls */}
                <div className="flex items-center space-x-1 px-2">
                    {/* New Terminal Button */}
                    <div className="relative">
                        <button
                            onClick={() => setShowShellSelector(!showShellSelector)}
                            className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white flex items-center space-x-1"
                            title="New Terminal"
                        >
                            <Plus size={14} />
                            <ChevronDown size={10} />
                        </button>
                        {showShellSelector && (
                            <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded shadow-xl z-50 py-1 min-w-40">
                                <div className="px-3 py-1 text-[10px] text-gray-500 uppercase">Select Shell</div>
                                {shells.map(shell => (
                                    <button
                                        key={shell.id}
                                        onClick={() => addTerminal(shell.id)}
                                        className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs hover:bg-white/10 text-gray-300"
                                    >
                                        <span>{shell.icon}</span>
                                        <span>{shell.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Split Buttons */}
                    <button
                        onClick={() => toggleSplit('vertical')}
                        className={`p-1.5 rounded transition-colors ${splitMode === 'vertical' ? 'bg-theme-accent/30 text-white' : 'hover:bg-white/10 text-gray-400'}`}
                        title="Split Vertical"
                    >
                        <Columns size={14} />
                    </button>
                    <button
                        onClick={() => toggleSplit('horizontal')}
                        className={`p-1.5 rounded transition-colors ${splitMode === 'horizontal' ? 'bg-theme-accent/30 text-white' : 'hover:bg-white/10 text-gray-400'}`}
                        title="Split Horizontal"
                    >
                        <SplitSquareHorizontal size={14} />
                    </button>
                </div>
            </div>

            {/* Terminal Content Area */}
            <div className={`flex-1 flex ${splitMode === 'horizontal' ? 'flex-col' : 'flex-row'} overflow-hidden`}>
                {/* Primary Terminal */}
                <div className={`${splitMode !== 'none' ? (splitMode === 'horizontal' ? 'h-1/2' : 'w-1/2') : 'flex-1'} overflow-hidden`}>
                    {activeTerminal && renderTerminalContent(activeTerminal)}
                </div>

                {/* Split Divider */}
                {splitMode !== 'none' && splitTerminal && (
                    <>
                        <div className={`${splitMode === 'horizontal' ? 'h-1 cursor-row-resize' : 'w-1 cursor-col-resize'} bg-gray-800 hover:bg-theme-accent/50`} />
                        <div className={`${splitMode === 'horizontal' ? 'h-1/2' : 'w-1/2'} overflow-hidden`}>
                            {renderTerminalContent(splitTerminal, true)}
                        </div>
                    </>
                )}
            </div>

            {/* Status Bar */}
            <div className={`px-3 py-1 border-t ${theme.border} flex items-center justify-between text-[10px] text-gray-500 bg-black/30`}>
                <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                        <TerminalIcon size={10} />
                        <span>{terminals.length} terminal{terminals.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <Palette size={10} />
                        <span>{globalTheme.name}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-green-400">
                        <span>Path: {activeTerminal?.currentPath?.split('/').pop() || '/'}</span>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <span>{activeTerminal?.commandHistory.length || 0} commands</span>
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        </div>
    );
};