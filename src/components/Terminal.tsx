import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useOS } from '../context/OsContext';
import { ChevronRight, FolderOpen, File, Palette } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface CommandSuggestion {
  command: string;
  description: string;
  icon?: React.ReactNode;
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

export const Terminal = () => {
  const {
    state,
    addTerminalCommand,
    clearTerminal,
    createFile,
    createDirectory,
    deleteNode,
    listDirectory,
    getNodeByPath,
    setCurrentPath,
    executeCommand: executeOSCommand
  } = useOS();

  const { activeTheme: globalTheme } = useTheme();
  const theme = terminalThemes[globalTheme.id] || terminalThemes.henu;

  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [user] = useState('henu');
  const [host] = useState('terminal');

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commandSuggestions: CommandSuggestion[] = [
    { command: 'help', description: 'Show all available commands' },
    { command: 'ls', description: 'List directory contents' },
    { command: 'cd', description: 'Change directory' },
    { command: 'pwd', description: 'Print working directory' },
    { command: 'cat', description: 'Display file contents' },
    { command: 'mkdir', description: 'Create new directory' },
    { command: 'touch', description: 'Create new file' },
    { command: 'rm', description: 'Remove files/directories' },
    { command: 'rmdir', description: 'Remove empty directory' },
    { command: 'cp', description: 'Copy files/directories' },
    { command: 'mv', description: 'Move/rename files' },
    { command: 'clear', description: 'Clear terminal screen' },
    { command: 'echo', description: 'Display text' },
    { command: 'whoami', description: 'Display current user' },
    { command: 'date', description: 'Show current date and time' },
    { command: 'find', description: 'Search for files' },
    { command: 'grep', description: 'Search text in files' },
    { command: 'ps', description: 'Show running processes' },
    { command: 'kill', description: 'Terminate process' },
    { command: 'df', description: 'Disk space usage' },
    { command: 'du', description: 'Directory space usage' },
    { command: 'head', description: 'Show first lines of file' },
    { command: 'tail', description: 'Show last lines of file' },
    { command: 'wc', description: 'Word count' },
    { command: 'sort', description: 'Sort lines of text' },
    { command: 'uniq', description: 'Remove duplicate lines' },
    { command: 'diff', description: 'Compare files' },
    { command: 'tar', description: 'Archive files' },
    { command: 'zip', description: 'Compress files' },
    { command: 'unzip', description: 'Extract files' },
    { command: 'chmod', description: 'Change file permissions' },
    { command: 'chown', description: 'Change file owner' },
    { command: 'history', description: 'Show command history' },
    { command: 'alias', description: 'Create command alias' },
    { command: 'export', description: 'Set environment variable' },
    { command: 'env', description: 'Show environment variables' },
    { command: 'henu', description: 'HENU AI tools' },
  ];

  const henuCommands = ['fix', 'build', 'optimize', 'explain', 'deploy', 'test', 'analyze', 'generate'];

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.terminalHistory]);

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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : 0;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
    else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0 && selectedSuggestion === -1) {
        setInput(suggestions[0].command + ' ');
        inputRef.current?.focus();
      } else if (selectedSuggestion >= 0) {
        setInput(suggestions[selectedSuggestion].command + ' ');
        setSelectedSuggestion(-1);
      }
    }
    else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const changeDirectory = (path: string) => {
    if (path === '~') {
      setCurrentPath('/home/user');
      return { success: true, message: '' };
    }

    if (path === '..') {
      const newPath = state.currentPath.split('/').slice(0, -1).join('/') || '/';
      setCurrentPath(newPath);
      return { success: true, message: '' };
    }

    if (path.startsWith('/')) {
      const node = getNodeByPath(path);
      if (node && node.type === 'directory') {
        setCurrentPath(path);
        return { success: true, message: '' };
      } else {
        return { success: false, message: `cd: ${path}: No such directory` };
      }
    } else {
      // Handle relative path
      const newPath = state.currentPath === '/' ? `/${path}` : `${state.currentPath}/${path}`;
      const node = getNodeByPath(newPath);
      if (node && node.type === 'directory') {
        setCurrentPath(newPath);
        return { success: true, message: '' };
      } else {
        return { success: false, message: `cd: ${path}: No such directory` };
      }
    }
  };

  const executeCommand = (cmd: string) => {
    const parts = cmd.trim().split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    let output = '';
    let isError = false;

    switch (command) {
      case 'help':
        output = `📋 HENU Terminal Commands\n${'═'.repeat(60)}\n\n`;
        commandSuggestions.forEach((cmd, i) => {
          output += `  ${cmd.command.padEnd(15)} ${cmd.description}`;
          if ((i + 1) % 3 === 0) output += '\n';
        });
        output += `\n\n📁 File Operations: ls, cd, cat, mkdir, touch, rm, cp, mv\n`;
        output += `🔍 Search: find, grep, locate\n`;
        output += `⚙️  System: ps, kill, df, du, chmod, chown\n`;
        output += `📊 Text Processing: head, tail, wc, sort, uniq, diff\n`;
        output += `📦 Archives: tar, zip, unzip\n`;
        output += `🤖 AI Tools: henu <fix|build|optimize|explain|deploy|test>\n`;
        output += `\n💡 Tips: Use Tab for autocomplete, ↑/↓ for history, Ctrl+L to clear`;
        break;

      case 'ls':
        const files = listDirectory(args[0]);
        if (files.length === 0) {
          output = '(empty directory)';
        } else if (args.includes('-l') || args.includes('-la')) {
          output = 'Permissions\tSize\tModified\t\tName\n';
          output += '-'.repeat(70) + '\n';
          files.forEach(f => {
            const perm = f.type === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--';
            const size = f.size ? `${f.size} B` : '0 B';
            const modified = f.modified ? new Date(f.modified).toLocaleDateString() : 'Unknown';
            const icon = f.type === 'directory' ? '📁' : '📄';
            output += `${perm}\t${size.padStart(8)}\t${modified.padEnd(15)}\t${icon} ${f.name}\n`;
          });
        } else if (args.includes('-a')) {
          output = '.  ..  ';
          files.forEach(f => {
            output += `${f.type === 'directory' ? '📁' : '📄'} ${f.name}${' '.repeat(15 - f.name.length)}`;
            if (files.indexOf(f) % 4 === 3) output += '\n';
          });
        } else {
          files.forEach(f => {
            output += `${f.type === 'directory' ? '📁' : '📄'} ${f.name.padEnd(20)} `;
            if (files.indexOf(f) % 3 === 2) output += '\n';
          });
        }
        break;

      case 'cd':
        if (args.length === 0) {
          const result = changeDirectory('~');
          if (!result.success) {
            output = result.message;
            isError = true;
          }
        } else {
          const result = changeDirectory(args[0]);
          if (!result.success) {
            output = result.message;
            isError = true;
          }
        }
        break;

      case 'pwd':
        output = state.currentPath;
        break;

      case 'cat':
        if (args.length === 0) {
          output = 'Usage: cat <filename> [filename2 ...]';
          isError = true;
        } else {
          args.forEach((arg, index) => {
            const path = arg.startsWith('/') ? arg : `${state.currentPath}/${arg}`;
            const node = getNodeByPath(path);
            if (!node) {
              output += `cat: ${arg}: No such file or directory\n`;
              isError = true;
            } else if (node.type !== 'file') {
              output += `cat: ${arg}: Is a directory\n`;
              isError = true;
            } else {
              output += `${index > 0 ? '\n\n' : ''}${arg}:\n${'─'.repeat(40)}\n${node.content || '(empty file)'}`;
            }
          });
        }
        break;

      case 'mkdir':
        if (args.length === 0) {
          output = 'Usage: mkdir <directory_name>';
          isError = true;
        } else {
          args.forEach(arg => {
            try {
              createDirectory(arg);
              output += `Created directory: ${arg}\n`;
            } catch (error) {
              output += `mkdir: cannot create directory '${arg}': File exists\n`;
              isError = true;
            }
          });
        }
        break;

      case 'touch':
        if (args.length === 0) {
          output = 'Usage: touch <filename>';
          isError = true;
        } else {
          args.forEach(arg => {
            try {
              createFile(arg);
              output += `Created file: ${arg}\n`;
            } catch (error) {
              output += `touch: cannot create file '${arg}': File exists\n`;
              isError = true;
            }
          });
        }
        break;

      case 'rm':
        if (args.length === 0) {
          output = 'Usage: rm <file> or rm -r <directory>';
          isError = true;
        } else {
          const recursive = args.includes('-r') || args.includes('-rf');
          args.forEach(arg => {
            if (arg.startsWith('-')) return;
            const path = arg.startsWith('/') ? arg : `${state.currentPath}/${arg}`;
            const node = getNodeByPath(path);
            if (!node) {
              output += `rm: cannot remove '${arg}': No such file or directory\n`;
              isError = true;
            } else if (node.type === 'directory' && !recursive) {
              output += `rm: cannot remove '${arg}': Is a directory\n`;
              output += `Use 'rm -r' to remove directories\n`;
              isError = true;
            } else {
              deleteNode(node.id);
              output += `Removed: ${arg}\n`;
            }
          });
        }
        break;

      case 'rmdir':
        if (args.length === 0) {
          output = 'Usage: rmdir <directory_name>';
          isError = true;
        } else {
          args.forEach(arg => {
            const path = arg.startsWith('/') ? arg : `${state.currentPath}/${arg}`;
            const node = getNodeByPath(path);
            if (!node) {
              output += `rmdir: failed to remove '${arg}': No such file or directory\n`;
              isError = true;
            } else if (node.type !== 'directory') {
              output += `rmdir: failed to remove '${arg}': Not a directory\n`;
              isError = true;
            } else if (node.children && node.children.length > 0) {
              output += `rmdir: failed to remove '${arg}': Directory not empty\n`;
              isError = true;
            } else {
              deleteNode(node.id);
              output += `Removed directory: ${arg}\n`;
            }
          });
        }
        break;

      case 'cp':
        if (args.length < 2) {
          output = 'Usage: cp <source> <destination>';
          isError = true;
        } else {
          output = 'cp: Not implemented yet';
          isError = true;
        }
        break;

      case 'mv':
        if (args.length < 2) {
          output = 'Usage: mv <source> <destination>';
          isError = true;
        } else {
          output = 'mv: Not implemented yet';
          isError = true;
        }
        break;

      case 'clear':
        clearTerminal();
        addTerminalCommand(cmd, '');
        return;

      case 'echo':
        output = args.join(' ');
        break;

      case 'whoami':
        output = user;
        break;

      case 'date':
        output = new Date().toLocaleString();
        break;

      case 'find':
        if (args.length === 0) {
          output = 'Usage: find <directory> -name "pattern"';
          isError = true;
        } else {
          const pattern = args.find(arg => arg.includes('*')) || args[0];
          output = `find: Searching for "${pattern}"\n`;
          output += 'find: Not fully implemented yet';
        }
        break;

      case 'grep':
        if (args.length < 2) {
          output = 'Usage: grep "pattern" <file>';
          isError = true;
        } else {
          const pattern = args[0];
          const filename = args[1];
          const path = filename.startsWith('/') ? filename : `${state.currentPath}/${filename}`;
          const node = getNodeByPath(path);

          if (!node || node.type !== 'file') {
            output = `grep: ${filename}: No such file or directory`;
            isError = true;
          } else {
            const lines = (node.content || '').split('\n');
            const matches = lines.filter(line => line.includes(pattern));
            output = matches.length > 0
              ? matches.map(line => `  ${line}`).join('\n')
              : `No matches found for "${pattern}" in ${filename}`;
          }
        }
        break;

      case 'head':
        if (args.length === 0) {
          output = 'Usage: head <file> [-n lines]';
          isError = true;
        } else {
          const n = args.includes('-n') ? parseInt(args[args.indexOf('-n') + 1]) : 10;
          const filename = args.find(arg => !arg.startsWith('-'));
          if (!filename) {
            output = 'No filename specified';
            isError = true;
          } else {
            const path = filename.startsWith('/') ? filename : `${state.currentPath}/${filename}`;
            const node = getNodeByPath(path);
            if (!node || node.type !== 'file') {
              output = `head: cannot open '${filename}' for reading: No such file`;
              isError = true;
            } else {
              const lines = (node.content || '').split('\n');
              output = lines.slice(0, n).join('\n');
            }
          }
        }
        break;

      case 'tail':
        if (args.length === 0) {
          output = 'Usage: tail <file> [-n lines]';
          isError = true;
        } else {
          const n = args.includes('-n') ? parseInt(args[args.indexOf('-n') + 1]) : 10;
          const filename = args.find(arg => !arg.startsWith('-'));
          if (!filename) {
            output = 'No filename specified';
            isError = true;
          } else {
            const path = filename.startsWith('/') ? filename : `${state.currentPath}/${filename}`;
            const node = getNodeByPath(path);
            if (!node || node.type !== 'file') {
              output = `tail: cannot open '${filename}' for reading: No such file`;
              isError = true;
            } else {
              const lines = (node.content || '').split('\n');
              output = lines.slice(-n).join('\n');
            }
          }
        }
        break;

      case 'wc':
        if (args.length === 0) {
          output = 'Usage: wc <file>';
          isError = true;
        } else {
          const filename = args[0];
          const path = filename.startsWith('/') ? filename : `${state.currentPath}/${filename}`;
          const node = getNodeByPath(path);
          if (!node || node.type !== 'file') {
            output = `wc: ${filename}: No such file or directory`;
            isError = true;
          } else {
            const content = node.content || '';
            const lines = content.split('\n').length;
            const words = content.split(/\s+/).filter(w => w).length;
            const chars = content.length;
            output = `${lines}\t${words}\t${chars}\t${filename}`;
          }
        }
        break;

      case 'ps':
        output = 'PID\tTTY\tTIME\tCMD\n';
        output += '1\ttty1\t00:00:01\tinit\n';
        output += '123\ttty1\t00:00:15\tbash\n';
        output += '456\ttty1\t00:01:23\tnode\n';
        output += '789\ttty1\t00:00:05\tterminal\n';
        break;

      case 'df':
        output = 'Filesystem\tSize\tUsed\tAvail\tUse%\tMounted on\n';
        output += '/dev/sda1\t50G\t15G\t32G\t31%\t/\n';
        output += 'tmpfs\t2.0G\t0\t2.0G\t0%\t/tmp\n';
        break;

      case 'du':
        const node = getNodeByPath(state.currentPath);
        if (node) {
          const size = node.type === 'file' ? (node.size || 0) : 4096;
          output = `${size}\t${state.currentPath}`;
        } else {
          output = `du: cannot access '${state.currentPath}': No such file or directory`;
          isError = true;
        }
        break;

      case 'history':
        output = commandHistory.map((cmd, i) => `${i + 1}  ${cmd}`).join('\n');
        break;

      case 'env':
        output = `USER=${user}\n`;
        output += `HOME=/home/${user}\n`;
        output += `PATH=/usr/local/bin:/usr/bin:/bin\n`;
        output += `PWD=${state.currentPath}\n`;
        output += `SHELL=/bin/bash\n`;
        output += `TERM=xterm-256color\n`;
        break;

      case 'henu':
        if (args.length === 0) {
          output = `🤖 HENU AI Tools\n${'═'.repeat(40)}\n`;
          henuCommands.forEach(cmd => {
            output += `  henu ${cmd.padEnd(12)} `;
            switch (cmd) {
              case 'fix': output += 'Fix code issues and bugs'; break;
              case 'build': output += 'Build and compile project'; break;
              case 'optimize': output += 'Optimize code performance'; break;
              case 'explain': output += 'Explain code functionality'; break;
              case 'deploy': output += 'Deploy to production'; break;
              case 'test': output += 'Run tests and generate reports'; break;
              case 'analyze': output += 'Analyze code complexity'; break;
              case 'generate': output += 'Generate code from specs'; break;
            }
            output += '\n';
          });
        } else if (henuCommands.includes(args[0])) {
          output = `🤖 HENU AI: Processing "${args[0]}" command...\n`;
          output += `⏳ Initializing AI model...\n`;
          output += `🔍 Analyzing current context...\n`;
          output += `💡 Generating solution...\n\n`;

          // Simulate AI response
          setTimeout(() => {
            let aiOutput = '';
            switch (args[0]) {
              case 'fix':
                aiOutput = `✅ Code issues fixed!\n\nFixed 3 syntax errors\nAdded 2 null checks\nImproved error handling\nOptimized 2 functions`;
                break;
              case 'build':
                aiOutput = `✅ Build successful!\n\nCompiled 15 files\n0 errors, 2 warnings\nBuild size: 2.3MB\nBuild time: 1.2s`;
                break;
              case 'optimize':
                aiOutput = `✅ Code optimized!\n\nPerformance improved by 40%\nMemory usage reduced by 25%\nRemoved redundant code\nAdded caching layer`;
                break;
              default:
                aiOutput = `✅ ${args[0].charAt(0).toUpperCase() + args[0].slice(1)} completed successfully!`;
            }
            addTerminalCommand(cmd, output + aiOutput, false);
          }, 1500);

          addTerminalCommand(cmd, output, false);
          setInput('');
          return;
        } else {
          output = `Invalid henu command: ${args[0]}\nUse 'henu' for available commands`;
          isError = true;
        }
        break;

      case '':
        output = '';
        break;

      default:
        output = `Command not found: ${command}\nTry 'help' for available commands`;
        isError = true;
    }

    if (cmd.trim() && !commandHistory.includes(cmd.trim())) {
      setCommandHistory(prev => [...prev, cmd.trim()].slice(-100));
    }

    addTerminalCommand(cmd, output, isError);
    executeOSCommand(cmd);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (trimmedInput) {
      if (trimmedInput === 'clear') {
        clearTerminal();
      } else {
        executeCommand(trimmedInput);
      }
      setInput('');
      setHistoryIndex(-1);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: CommandSuggestion) => {
    setInput(suggestion.command + ' ');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const getCurrentDirectoryName = () => {
    if (state.currentPath === '/') return '/';
    return state.currentPath.split('/').pop() || '~';
  };


  return (
    <div className={`h-full flex flex-col bg-transparent ${theme.font} text-sm`}>
      {/* Terminal Body */}
      <div className={`flex-1 overflow-auto p-4 ${theme.background}`}>
        {/* Welcome Message - Show only on first load */}
        {state.terminalHistory.length === 0 && (
          <div className="text-green-400 mb-6">
            <div className="text-xl mb-2">🚀 HENU Terminal v2.0</div>
            <div className="text-gray-400 text-sm mb-4">
              AI-Powered Development Environment • Type <span className="text-yellow-400">'help'</span> to begin
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-3 bg-gray-900/50 rounded border border-gray-800">
                <div className="text-cyan-400 text-xs mb-1">📁 File System</div>
                <div className="text-gray-400 text-xs">Create, edit, delete files</div>
              </div>
              <div className="p-3 bg-gray-900/50 rounded border border-gray-800">
                <div className="text-purple-400 text-xs mb-1">🤖 AI Tools</div>
                <div className="text-gray-400 text-xs">Code analysis & generation</div>
              </div>
              <div className="p-3 bg-gray-900/50 rounded border border-gray-800">
                <div className="text-yellow-400 text-xs mb-1">⚡ Quick Access</div>
                <div className="text-gray-400 text-xs">Tab autocomplete, History</div>
              </div>
            </div>
          </div>
        )}

        {/* Command History */}
        <div className="space-y-4">
          {state.terminalHistory.map((item, i) => (
            <div key={i} className="mb-3 group">
              <div className="flex items-center space-x-2 mb-1">
                <div className={`flex items-center space-x-2 ${theme.userColor} flex-shrink-0`}>
                  <ChevronRight size={12} />
                  <span className="font-bold">{user}</span>
                  <span className="text-gray-500">@</span>
                  <span className="font-bold">{host}</span>
                  <span className="text-gray-500">:</span>
                  <span className={theme.pathColor}>{getCurrentDirectoryName()}</span>
                  <span className="text-gray-500">$</span>
                </div>
                <span className={`${theme.commandColor} break-all`}>{item.command}</span>
                <button
                  onClick={() => {
                    setInput(item.command);
                    inputRef.current?.focus();
                  }}
                  className="opacity-0 group-hover:opacity-100 text-xs text-gray-500 hover:text-gray-300 ml-2 flex-shrink-0"
                  title="Reuse command"
                >
                  ↩
                </button>
              </div>
              {item.output && (
                <div className={`ml-8 mt-1 whitespace-pre-wrap break-words ${item.isError ? 'text-red-400' : 'text-gray-300'}`}>
                  {item.output}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="mt-4 relative">
          <div className="flex items-start space-x-2 mb-2">
            <div className={`flex items-center space-x-2 ${theme.userColor} flex-shrink-0 pt-1`}>
              <ChevronRight size={14} />
              <span className="font-bold">{user}</span>
              <span className="text-gray-500">@</span>
              <span className="font-bold">{host}</span>
              <span className="text-gray-500">:</span>
              <span className={theme.pathColor}>{getCurrentDirectoryName()}</span>
              <span className="text-gray-500">$</span>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 relative min-w-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`w-full bg-transparent ${theme.commandColor} focus:outline-none ${theme.cursorColor} placeholder-gray-600`}
                placeholder="Type command here..."
                autoFocus
                spellCheck={false}
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-800 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.command}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-800 flex items-center justify-between ${index === selectedSuggestion ? 'bg-gray-800' : ''
                        }`}
                      onMouseEnter={() => setSelectedSuggestion(index)}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-6 h-6 rounded bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <ChevronRight size={12} className="text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-gray-100 truncate">{suggestion.command}</div>
                          <div className="text-xs text-gray-500 truncate">{suggestion.description}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 flex-shrink-0">Tab ↵</div>
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>

        </div>

        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Footer */}
      <div className={`px-4 py-2 border-t ${theme.border} flex items-center justify-between text-xs text-gray-600 ${theme.background} backdrop-blur-md`}>
        <div className="flex items-center space-x-4 overflow-x-auto">
          <div className="flex items-center space-x-2">
            <Palette size={12} className="text-theme-accent" />
            <span className="hidden sm:inline">Theme: {globalTheme.name}</span>
          </div>
          <div className="flex items-center space-x-1">
            <FolderOpen size={12} />
            <span>{listDirectory().length} items</span>
          </div>
          <div className="flex items-center space-x-1 text-blue-400">
            <File size={12} />
            <span>{commandHistory.length} logs</span>
          </div>
        </div>
        <div className="font-mono text-gray-500">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};