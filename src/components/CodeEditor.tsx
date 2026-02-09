import { useEffect, useState, useRef, useCallback } from 'react';
import { useOS, FileSystemNode } from '../context/OsContext';
import { codeRunner, ExecutionResult } from '../services/CodeRunner';
import { TabBar } from './TabBar';
import {
  Code2, Save, Search, ChevronUp, ChevronDown,
  Eye, EyeOff,
  Play, Loader, AlignLeft
} from 'lucide-react';
import { formatCode } from '../services/FormatService';

export const CodeEditor = () => {
  const { state, updateFileContent, addTerminalCommand, openTab, closeTab, addOutputMessage } = useOS();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [isDirty, setIsDirty] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [theme, setTheme] = useState<'dark' | 'light' | 'oled'>('dark');
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1); // -1 = no selection yet
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [showOutput, setShowOutput] = useState(false);
  const [isLoadingPython, setIsLoadingPython] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Undo/Redo stacks (max 100 steps)
  const MAX_UNDO = 100;
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isUndoRedoRef = useRef(false);

  const applyContent = useCallback((newContent: string, opts?: { skipUndo?: boolean }) => {
    if (opts?.skipUndo) {
      isUndoRedoRef.current = true;
      setContent(newContent);
      setWordCount(countWords(newContent));
      setTimeout(() => { isUndoRedoRef.current = false; }, 0);
      return;
    }
    setContent(prev => {
      if (prev !== newContent) {
        const stack = undoStackRef.current;
        if (stack.length >= MAX_UNDO) stack.shift();
        stack.push(prev);
        redoStackRef.current = [];
      }
      return newContent;
    });
    setWordCount(countWords(newContent));
  }, []);

  const doUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push(content);
    isUndoRedoRef.current = true;
    setContent(prev);
    setWordCount(countWords(prev));
    setTimeout(() => { isUndoRedoRef.current = false; }, 0);
  }, [content]);

  const doRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(content);
    isUndoRedoRef.current = true;
    setContent(next);
    setWordCount(countWords(next));
    setTimeout(() => { isUndoRedoRef.current = false; }, 0);
  }, [content]);

  // Auto-save state
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [autoSaveDelay] = useState(2000);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentFile = state.activeFile;

  // Initialize code runner
  useEffect(() => {
    codeRunner.init();
    return () => codeRunner.cleanup();
  }, []);

  useEffect(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    if (currentFile && currentFile.type === 'file') {
      const fileContent = currentFile.content || '';
      setContent(fileContent);
      setOriginalContent(fileContent);
      setIsDirty(false);
      setWordCount(countWords(fileContent));
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    } else {
      setContent('');
      setOriginalContent('');
      setIsDirty(false);
      setWordCount(0);
      setOutput('');
      setShowOutput(false);
    }
  }, [currentFile?.id]);

  useEffect(() => {
    if (showOutput && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, showOutput]);

  // Track dirty state for tabs
  useEffect(() => {
    if (currentFile && content !== originalContent) {
      setDirtyTabs(prev => new Set(prev).add(currentFile.id));
      setIsDirty(true);
    } else if (currentFile) {
      setDirtyTabs(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentFile.id);
        return newSet;
      });
      setIsDirty(false);
    }
  }, [content, originalContent, currentFile]);

  // Ref for latest content (used by goto-line handler)
  const contentRef = useRef(content);
  contentRef.current = content;

  const handleSaveRef = useRef<() => void>(() => {});
  const handleRunCodeRef = useRef<() => void>(() => {});

  // Listen for Find/Replace/Go to Line from menu or command palette
  useEffect(() => {
    const onTriggerFind = (e: CustomEvent<{ search: string }>) => {
      if (!currentFile) return;
      const search = e.detail?.search ?? '';
      setSearchText(search);
      setCurrentMatchIndex(-1);
      setShowSearch(true);
      setTimeout(() => {
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        searchInput?.focus();
      }, 50);
    };
    const onTriggerReplace = (e: CustomEvent<{ search: string; replace: string }>) => {
      if (!currentFile) return;
      const search = e.detail?.search ?? '';
      const replace = e.detail?.replace ?? '';
      setSearchText(search);
      setReplaceText(replace);
      setCurrentMatchIndex(-1);
      setShowSearch(true);
      setShowReplace(true);
      setTimeout(() => {
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        searchInput?.focus();
      }, 50);
    };
    const onTriggerGoToLine = (e: CustomEvent<{ line: number }>) => {
      if (!currentFile || !textareaRef.current) return;
      const line = e.detail?.line;
      if (typeof line !== 'number' || line < 1) return;
      const text = contentRef.current;
      const lines = text.split('\n');
      const lineIndex = Math.min(line, lines.length) - 1;
      const before = lines.slice(0, lineIndex).join('\n');
      const start = before.length;
      const end = start + lines[lineIndex].length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(start, end);
      textareaRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    const onTriggerUndo = () => { doUndo(); };
    const onTriggerRedo = () => { doRedo(); };
    const onTriggerSave = () => { handleSaveRef.current?.(); };
    const onTriggerSaveAll = () => { handleSaveRef.current?.(); };
    const runEditorCommand = (cmd: string) => {
      if (!currentFile || !textareaRef.current) return;
      textareaRef.current.focus();
      setTimeout(() => document.execCommand(cmd), 0);
    };
    const onTriggerCut = () => runEditorCommand('cut');
    const onTriggerCopy = () => runEditorCommand('copy');
    const onTriggerPaste = () => runEditorCommand('paste');
    const onTriggerSelectAll = () => runEditorCommand('selectAll');
    const onTriggerRun = () => { handleRunCodeRef.current?.(); };
    window.addEventListener('henu-trigger-find', onTriggerFind as EventListener);
    window.addEventListener('henu-trigger-replace', onTriggerReplace as EventListener);
    window.addEventListener('henu-trigger-goto-line', onTriggerGoToLine as EventListener);
    window.addEventListener('henu-trigger-undo', onTriggerUndo);
    window.addEventListener('henu-trigger-redo', onTriggerRedo);
    window.addEventListener('henu-trigger-save', onTriggerSave);
    window.addEventListener('henu-trigger-save-all', onTriggerSaveAll);
    window.addEventListener('henu-trigger-cut', onTriggerCut);
    window.addEventListener('henu-trigger-copy', onTriggerCopy);
    window.addEventListener('henu-trigger-paste', onTriggerPaste);
    window.addEventListener('henu-trigger-select-all', onTriggerSelectAll);
    window.addEventListener('henu-trigger-run', onTriggerRun);
    return () => {
      window.removeEventListener('henu-trigger-find', onTriggerFind as EventListener);
      window.removeEventListener('henu-trigger-replace', onTriggerReplace as EventListener);
      window.removeEventListener('henu-trigger-goto-line', onTriggerGoToLine as EventListener);
      window.removeEventListener('henu-trigger-undo', onTriggerUndo);
      window.removeEventListener('henu-trigger-redo', onTriggerRedo);
      window.removeEventListener('henu-trigger-save', onTriggerSave);
      window.removeEventListener('henu-trigger-save-all', onTriggerSaveAll);
      window.removeEventListener('henu-trigger-cut', onTriggerCut);
      window.removeEventListener('henu-trigger-copy', onTriggerCopy);
      window.removeEventListener('henu-trigger-paste', onTriggerPaste);
      window.removeEventListener('henu-trigger-select-all', onTriggerSelectAll);
      window.removeEventListener('henu-trigger-run', onTriggerRun);
    };
  }, [currentFile?.id, doUndo, doRedo]);

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Tab - Next tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const currentIndex = state.openTabs.findIndex(tab => tab.id === currentFile?.id);
        if (currentIndex !== -1 && state.openTabs.length > 1) {
          const nextIndex = (currentIndex + 1) % state.openTabs.length;
          openTab(state.openTabs[nextIndex]);
        }
      }
      // Ctrl+Shift+Tab - Previous tab
      else if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = state.openTabs.findIndex(tab => tab.id === currentFile?.id);
        if (currentIndex !== -1 && state.openTabs.length > 1) {
          const nextIndex = currentIndex === 0 ? state.openTabs.length - 1 : currentIndex - 1;
          openTab(state.openTabs[nextIndex]);
        }
      }
      // Ctrl+W - Close current tab
      else if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (currentFile) {
          handleTabClose(currentFile, e as any);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.openTabs, currentFile, openTab]);

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  // Escape special regex characters for find
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Get all match positions (case-insensitive)
  const getMatchPositions = useCallback(() => {
    if (!searchText.trim()) return [];
    try {
      const re = new RegExp(escapeRegex(searchText), 'gi');
      const positions: { start: number; end: number }[] = [];
      let m;
      while ((m = re.exec(content)) !== null) {
        positions.push({ start: m.index, end: m.index + m[0].length });
      }
      return positions;
    } catch {
      return [];
    }
  }, [searchText, content]);

  const matchPositions = getMatchPositions();
  const matchCount = matchPositions.length;

  const navigateToMatch = useCallback((index: number) => {
    if (matchPositions.length === 0 || !textareaRef.current) return;
    const idx = ((index % matchPositions.length) + matchPositions.length) % matchPositions.length;
    const { start, end } = matchPositions[idx];
    setCurrentMatchIndex(idx);
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(start, end);
    // Scroll into view
    const lineHeight = 1.5 * fontSize;
    const lineNum = content.substring(0, start).split('\n').length;
    const scrollTop = Math.max(0, (lineNum - 3) * lineHeight);
    if (textareaRef.current.scrollTop !== undefined) {
      (textareaRef.current as any).scrollTop = scrollTop;
    }
    const container = textareaRef.current.parentElement;
    if (container) {
      container.scrollTop = scrollTop;
    }
  }, [matchPositions, content, fontSize]);

  const goToNextMatch = useCallback(() => {
    if (matchPositions.length === 0) return;
    // First press or wrap: next from current (0-based)
    const nextIdx = currentMatchIndex < 0 ? 0 : (currentMatchIndex + 1) % matchPositions.length;
    navigateToMatch(nextIdx);
  }, [matchPositions.length, currentMatchIndex, navigateToMatch]);

  const goToPrevMatch = useCallback(() => {
    if (matchPositions.length === 0) return;
    const prevIdx = currentMatchIndex <= 0 ? matchPositions.length - 1 : currentMatchIndex - 1;
    navigateToMatch(prevIdx);
  }, [matchPositions.length, currentMatchIndex, navigateToMatch]);

  const [isFormatting, setIsFormatting] = useState(false);

  const handleFormat = async () => {
    if (!currentFile || !content) return;

    setIsFormatting(true);
    try {
      const formatted = await formatCode(content, currentFile.name);
      if (formatted !== content) {
        applyContent(formatted);
        setIsDirty(true);
        addOutputMessage(`Formatted ${currentFile.name}`, 'info');
      }
    } catch (error: any) {
      addOutputMessage(`Format error: ${error.message}`, 'error');
    } finally {
      setIsFormatting(false);
    }
  };

  // Auto-save function
  const performAutoSave = useCallback(() => {
    if (currentFile && isDirty && autoSaveEnabled) {
      setIsAutoSaving(true);
      updateFileContent(currentFile.id, content);
      setOriginalContent(content);
      setIsDirty(false);
      setLastAutoSaved(new Date());

      // Remove from dirty tabs
      setDirtyTabs(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentFile.id);
        return newSet;
      });

      // Brief visual feedback then hide
      setTimeout(() => {
        setIsAutoSaving(false);
      }, 800);
    }
  }, [currentFile, isDirty, autoSaveEnabled, content, updateFileContent]);

  // Trigger auto-save after delay when content changes
  useEffect(() => {
    if (!autoSaveEnabled || !isDirty || !currentFile) {
      return;
    }

    // Clear any previous timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(() => {
      performAutoSave();
    }, autoSaveDelay);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [content, isDirty, autoSaveEnabled, autoSaveDelay, currentFile, performAutoSave]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    applyContent(newContent);

    if (currentFile && currentFile.content !== newContent) {
      setIsDirty(true);
    } else {
      setIsDirty(false);
    }
  };

  const handleSave = useCallback(async (isAutoSave: boolean = false) => {
    if (currentFile) {
      if (!isAutoSave) {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
      }

      updateFileContent(currentFile.id, content);
      setOriginalContent(content);
      setIsDirty(false);

      setDirtyTabs(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentFile.id);
        return newSet;
      });

      if (currentFile.path && (window as any).electronAPI) {
        try {
          const result = await (window as any).electronAPI.saveFile(currentFile.path, content);
          if (!result?.success && result !== undefined) {
            addOutputMessage(`Save failed: ${result?.error || 'Unknown error'}`, 'error');
          }
        } catch (err: any) {
          addOutputMessage(`Save error: ${err.message}`, 'error');
        }
      }

      if (!isAutoSave) {
        showToast(`Saved: ${currentFile.name}`, 'success');
      }
    }
  }, [currentFile, content, updateFileContent, addOutputMessage]);
  handleSaveRef.current = () => handleSave(false);

  // Tab management handlers
  const handleTabClick = (file: FileSystemNode) => {
    openTab(file);
  };

  const handleTabClose = (file: FileSystemNode, e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if file has unsaved changes
    if (dirtyTabs.has(file.id)) {
      const confirmClose = window.confirm(
        `"${file.name}" has unsaved changes. Close anyway?`
      );
      if (!confirmClose) return;
    }

    closeTab(file.id);

    // Remove from dirty tabs
    setDirtyTabs(prev => {
      const newSet = new Set(prev);
      newSet.delete(file.id);
      return newSet;
    });
  };

  // Helper function to show toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 bg-gray-900 border border-gray-700 px-4 py-2 rounded-lg text-sm z-50 shadow-2xl animate-slideIn`;
    toast.style.color = type === 'success' ? '#10b981' : 
                       type === 'error' ? '#ef4444' : 
                       type === 'warning' ? '#f59e0b' : 'var(--text-primary)';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('animate-slideOut');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  // Get file extension
  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || 'txt';
  };

  // Updated run function - FIXED for terminal execution
  const handleRunCode = useCallback(async () => {
    if (!currentFile?.content) return;

    const ext = getFileExtension(currentFile.name);
    let filePath = currentFile.path || '';
    
    // If no path, construct it from current path
    if (!filePath && state.currentPath) {
      filePath = state.currentPath.endsWith('/') 
        ? state.currentPath + currentFile.name
        : state.currentPath + '/' + currentFile.name;
    }

    // For web languages, keep browser preview
    if (['html', 'css', 'js', 'jsx', 'ts', 'tsx'].includes(ext)) {
      setIsRunning(true);
      setShowOutput(true);
      
      let result: ExecutionResult | undefined;
      try {
        switch (ext) {
          case 'html':
            result = await codeRunner.runHTML(content);
            break;
          case 'js':
          case 'jsx':
          case 'ts':
          case 'tsx':
            result = await codeRunner.runJavaScript(content);
            break;
          case 'css':
            const cssHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <style>${content}</style>
              </head>
              <body>
                <h1>CSS Preview</h1>
                <div class="demo" style="padding: 20px; margin: 20px; border: 2px dashed #ccc;">
                  <p>This is a preview of your CSS.</p>
                  <button class="demo-btn">Demo Button</button>
                </div>
              </body>
              </html>
            `;
            result = await codeRunner.runHTML(cssHtml);
            break;
        }
        
        if (result) {
          setOutput(prev => {
            const timestamp = new Date().toLocaleTimeString();
            const timeInfo = result!.executionTime > 0
              ? `\n⏱️ Execution time: ${result!.executionTime.toFixed(2)}ms`
              : '';
            return `[${timestamp}] ${result!.output}${timeInfo}\n${'─'.repeat(60)}\n${prev}`;
          });
          addOutputMessage(`${result!.output}`, result!.success ? 'success' : 'error');
        }
      } catch (error: any) {
        setOutput(prev => `❌ Error: ${error.message}\n${'─'.repeat(60)}\n${prev}`);
        addOutputMessage(`Error: ${error.message}`, 'error');
      } finally {
        setIsRunning(false);
      }
    } else {
      // For other languages, run in terminal with proper path
      const commands: Record<string, string> = {
        'py': `python "${filePath}"`,
        'java': `javac "${filePath}" && java "${filePath.replace('.java', '')}"`,
        'cpp': `g++ "${filePath}" -o "${filePath.replace('.cpp', '.exe')}" && "${filePath.replace('.cpp', '.exe')}"`,
        'c': `gcc "${filePath}" -o "${filePath.replace('.c', '.exe')}" && "${filePath.replace('.c', '.exe')}"`,
        'php': `php "${filePath}"`,
        'rb': `ruby "${filePath}"`,
        'go': `go run "${filePath}"`,
        'rs': `rustc "${filePath}" && "${filePath.replace('.rs', '.exe')}"`,
        'sh': `bash "${filePath}"`,
        'bat': `"${filePath}"`,
        'ps1': `powershell -ExecutionPolicy Bypass -File "${filePath}"`,
        'sql': `sqlite3 < "${filePath}"`,
        'js': `node "${filePath}"`,
        'ts': `tsc "${filePath}" && node "${filePath.replace('.ts', '.js')}"`,
      };

      const command = commands[ext] || `echo "Cannot execute .${ext} files directly"`;
      
      // Get directory path
      const dir = filePath.substring(0, filePath.lastIndexOf('/') || filePath.lastIndexOf('\\'));
      
      let terminalCommand = '';
      if (dir && dir !== filePath) {
        // First change directory, then execute
        terminalCommand = `cd "${dir}" && ${command}`;
      } else {
        // Just run the command in current directory
        terminalCommand = command;
      }
      
      // Send command to terminal
      window.dispatchEvent(new CustomEvent('run-terminal-command', { 
        detail: { command: terminalCommand } 
      }));
      
      // Show message
      showToast(`Running ${currentFile.name} in terminal`, 'info');
      
      // Also add to terminal history
      addTerminalCommand(`run ${currentFile.name}`, `Executing ${ext.toUpperCase()} file...`);
    }
  }, [content, currentFile, state.currentPath, addTerminalCommand]);
  handleRunCodeRef.current = () => handleRunCode();

  const handleSelectionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;

    const beforeCursor = text.substring(0, cursorPos);
    const lines = beforeCursor.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    setCursorLine(line);
    setCursorCol(col);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      setShowSearch(true);
      setTimeout(() => {
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        searchInput?.focus();
      }, 0);
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      handleRunCode();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      setShowOutput(!showOutput);
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      doUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      doRedo();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = (e.target as HTMLTextAreaElement).selectionStart;
      const end = (e.target as HTMLTextAreaElement).selectionEnd;
      const newValue = content.substring(0, start) + ("  ") + content.substring(end);
      applyContent(newValue);

      // Reset cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }

    // Auto-pairing
    const pairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '\'': '\'',
      '"': '"',
      '`': '`'
    };

    if (pairs[e.key]) {
      e.preventDefault();
      const start = (e.target as HTMLTextAreaElement).selectionStart;
      const end = (e.target as HTMLTextAreaElement).selectionEnd;
      const selection = content.substring(start, end);
      const newValue = content.substring(0, start) + e.key + selection + pairs[e.key] + content.substring(end);
      applyContent(newValue);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 1;
          textareaRef.current.selectionEnd = end + 1;
        }
      }, 0);
    }

    if (e.shiftKey && e.altKey && e.key === 'F') {
      e.preventDefault();
      handleFormat();
    }

    if (e.key === 'Escape' && showSearch) {
      setShowSearch(false);
    }
  };

  const getFileIcon = () => {
    if (!currentFile) return '📄';

    const ext = getFileExtension(currentFile.name);
    switch (ext) {
      case 'html': return '🌐';
      case 'css': return '🎨';
      case 'js': return '⚡';
      case 'ts': return '🔷';
      case 'jsx': return '⚛️';
      case 'tsx': return '🦊';
      case 'json': return '{}';
      case 'py': return '🐍';
      case 'java': return '☕';
      case 'cpp': case 'c': return '🔧';
      case 'php': return '🐘';
      case 'rb': return '💎';
      case 'go': return '🐹';
      case 'rs': return '🦀';
      case 'md': return '📝';
      case 'sql': return '🗃️';
      default: return '📄';
    }
  };

  const getLanguageName = () => {
    if (!currentFile) return 'Plain Text';

    const ext = getFileExtension(currentFile.name);
    switch (ext) {
      case 'js': return 'JavaScript';
      case 'ts': return 'TypeScript';
      case 'jsx': return 'React JSX';
      case 'tsx': return 'React TSX';
      case 'html': return 'HTML';
      case 'css': return 'CSS';
      case 'json': return 'JSON';
      case 'py': return 'Python';
      case 'java': return 'Java';
      case 'cpp': return 'C++';
      case 'c': return 'C';
      case 'php': return 'PHP';
      case 'rb': return 'Ruby';
      case 'go': return 'Go';
      case 'rs': return 'Rust';
      case 'md': return 'Markdown';
      case 'sql': return 'SQL';
      case 'txt': return 'Text';
      default: return ext.toUpperCase();
    }
  };

  const getRunTooltip = () => {
    if (!currentFile) return 'Run Code';

    const ext = getFileExtension(currentFile.name);
    if (['html', 'css', 'js', 'jsx', 'ts', 'tsx'].includes(ext)) {
      return 'Preview in browser';
    } else if (['py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'].includes(ext)) {
      return `Run ${ext.toUpperCase()} in terminal`;
    } else {
      return 'Execute file';
    }
  };

  if (!currentFile || currentFile.type !== 'file') {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-gray-900/90 to-black/90">
        <div className="text-center text-gray-500">
          <Code2 size={64} className="mx-auto mb-4 opacity-20 animate-pulse" />
          <div className="font-mono text-lg mb-2">No File Selected</div>
          <div className="text-sm text-gray-600 max-w-md mx-auto">
            Click on a file in the File Explorer to start editing
          </div>
        </div>
      </div>
    );
  }

  const lines = content.split('\n');
  const totalLines = lines.length;
  const fileExt = getFileExtension(currentFile.name);

  return (
    <div
      className="h-full flex flex-col bg-gray-950"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Tab Bar */}
      <TabBar
        tabs={state.openTabs}
        activeTabId={currentFile?.id || null}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        dirtyTabs={dirtyTabs}
      />

      {/* Editor Header */}
      <div className="px-4 py-3 border-b border-theme flex items-center justify-between bg-theme-secondary/80 backdrop-blur-sm">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className={`w-2 h-2 rounded-full ${isDirty ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
          <span className="text-2xl">{getFileIcon()}</span>
          <div className="flex-1 min-w-0">
            <div className="text-gray-300 text-sm font-mono truncate flex items-center space-x-2">
              <span>{currentFile.name}</span>
              {isDirty && <span className="text-yellow-500 text-xs">●</span>}
              <span className="text-gray-600 text-xs">({getLanguageName()})</span>
            </div>
            <div className="text-gray-600 text-xs font-mono mt-0.5 truncate">
              {currentFile.path || `/${currentFile.name}`}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {showSearch && (
            <div className="flex items-center space-x-2 bg-gray-800 px-2 py-1 rounded">
              <Search size={14} className="text-gray-400" />
              <input
                type="search"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setCurrentMatchIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault();
                    goToNextMatch();
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    goToPrevMatch();
                  }
                }}
                placeholder="Search (case-insensitive)..."
                className="bg-transparent text-sm text-gray-300 focus:outline-none w-40"
                autoFocus
              />
              {searchText && matchCount > 0 && (
                <>
                  <button
                    onClick={goToPrevMatch}
                    className="p-0.5 text-gray-400 hover:text-white rounded"
                    title="Previous match (↑)"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <span className="text-xs text-gray-500 min-w-[3rem]">
                    {currentMatchIndex < 0 ? '—' : currentMatchIndex + 1} / {matchCount}
                  </span>
                  <button
                    onClick={goToNextMatch}
                    className="p-0.5 text-gray-400 hover:text-white rounded"
                    title="Next match (↓)"
                  >
                    <ChevronDown size={16} />
                  </button>
                </>
              )}
              {searchText && matchCount === 0 && (
                <span className="text-xs text-red-400">0 matches</span>
              )}
              {showReplace && (
                <>
                  <span className="text-gray-600">|</span>
                  <input
                    type="text"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="Replace with..."
                    className="bg-transparent text-sm text-gray-300 focus:outline-none w-28"
                  />
                  <button
                    onClick={() => {
                      if (!searchText.trim() || matchPositions.length === 0 || currentMatchIndex < 0) return;
                      const { start, end } = matchPositions[currentMatchIndex];
                      const newContent = content.substring(0, start) + replaceText + content.substring(end);
                      applyContent(newContent);
                      setOriginalContent(newContent);
                      setIsDirty(true);
                      setTimeout(() => {
                        try {
                          const re = new RegExp(escapeRegex(searchText), 'gi');
                          const newPositions: { start: number; end: number }[] = [];
                          let m;
                          while ((m = re.exec(newContent)) !== null) {
                            newPositions.push({ start: m.index, end: m.index + m[0].length });
                          }
                          if (newPositions.length > 0) {
                            const nextIdx = Math.min(currentMatchIndex, newPositions.length - 1);
                            const { start: s, end: e } = newPositions[nextIdx];
                            setCurrentMatchIndex(nextIdx);
                            textareaRef.current?.focus();
                            textareaRef.current?.setSelectionRange(s, e);
                          } else {
                            setCurrentMatchIndex(-1);
                          }
                        } catch { setCurrentMatchIndex(-1); }
                      }, 0);
                    }}
                    className="text-xs px-2 py-0.5 bg-blue-700/50 hover:bg-blue-600/50 rounded text-blue-300"
                  >
                    Replace
                  </button>
                  <button
                    onClick={() => {
                      if (!searchText.trim()) return;
                      const re = new RegExp(escapeRegex(searchText), 'gi');
                      const newContent = content.replace(re, replaceText);
                      applyContent(newContent);
                      setOriginalContent(newContent);
                      setIsDirty(true);
                    }}
                    className="text-xs px-2 py-0.5 bg-green-700/50 hover:bg-green-600/50 rounded text-green-300"
                  >
                    Replace All
                  </button>
                </>
              )}
              <button
                onClick={() => { setShowSearch(false); setShowReplace(false); }}
                className="text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            </div>
          )}

          <button
            onClick={() => setShowSearch(true)}
            className="p-2 hover:bg-white/10 rounded text-theme-muted hover:text-theme transition-colors"
            title="Search (Ctrl+F)"
          >
            <Search size={16} />
          </button>

          <button
            onClick={handleRunCode}
            disabled={isRunning || isLoadingPython}
            className={`p-2 rounded transition-colors flex items-center space-x-1 ${isRunning || isLoadingPython
              ? 'bg-yellow-900/40 text-yellow-300'
              : 'bg-green-900/40 hover:bg-green-800/40 text-green-300 hover:text-green-200'
              }`}
            title={`${getRunTooltip()} (Ctrl+R)`}
          >
            {isRunning || isLoadingPython ? (
              <>
                <Loader size={16} className="animate-spin" />
                <span className="text-xs hidden sm:inline">
                  {isLoadingPython ? 'Loading Python...' : 'Running...'}
                </span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span className="text-xs hidden sm:inline">Run</span>
              </>
            )}
          </button>

          {/* Auto-save indicator */}
          {isAutoSaving && (
            <div className="flex items-center space-x-1 text-yellow-400 text-xs animate-pulse">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
              <span>Auto-saving...</span>
            </div>
          )}

          {/* Last auto-saved indicator */}
          {!isAutoSaving && lastAutoSaved && autoSaveEnabled && (
            <div className="text-gray-500 text-xs flex items-center space-x-1">
              <span>Auto-saved</span>
            </div>
          )}

          <button
            onClick={handleFormat}
            disabled={isFormatting}
            className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
            title="Format Code (Alt+Shift+F)"
          >
            {isFormatting ? <Loader size={16} className="animate-spin" /> : <AlignLeft size={16} />}
            <span className="text-xs hidden sm:inline ml-1">Format</span>
          </button>

          <button
            onClick={() => handleSave(false)}
            disabled={!isDirty}
            className="p-2 bg-theme-accent/20 hover:bg-theme-accent/30 rounded text-theme-accent hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1"
            title="Save (Ctrl+S)"
          >
            <Save size={16} />
            <span className="text-xs hidden sm:inline">Save</span>
          </button>

          {/* Auto-save toggle */}
          <button
            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
            className={`p-2 rounded transition-colors text-xs flex items-center space-x-1 ${autoSaveEnabled
              ? 'bg-green-900/40 text-green-400 hover:bg-green-800/40'
              : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
              }`}
            title={`Auto-save: ${autoSaveEnabled ? 'ON' : 'OFF'} (${autoSaveDelay / 1000}s delay)`}
          >
            <span className={`w-2 h-2 rounded-full ${autoSaveEnabled ? 'bg-green-400' : 'bg-gray-500'}`}></span>
            <span className="hidden sm:inline">Auto</span>
          </button>
        </div>
      </div>

      {/* Editor Toolbar */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between bg-gray-900/80 text-xs">
        <div className="flex items-center space-x-4">
          <div className="text-theme-muted">
            <span className="text-theme-accent font-mono">{cursorLine}:{cursorCol}</span>
          </div>
          <div className="text-theme-muted">
            <span className="text-purple-400 font-mono">{totalLines} lines</span>
          </div>
          <div className="text-theme-muted">
            <span className="text-theme-accent font-mono">{wordCount} words</span>
          </div>
          <div className="text-theme-muted">
            <span className="text-yellow-400 font-mono">{content.length} chars</span>
          </div>
          <div className="text-theme-muted">
            <span className="text-theme-accent font-mono">.{fileExt}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-300"
          >
            {showLineNumbers ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
          >
            <option value={12}>12px</option>
            <option value={14}>14px</option>
            <option value={16}>16px</option>
            <option value={18}>18px</option>
            <option value={20}>20px</option>
          </select>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="oled">OLED</option>
          </select>
        </div>
      </div>

      {/* Editor and Output Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative overflow-hidden" ref={editorRef}>
          {/* Line Numbers */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-theme-secondary/30 border-r border-theme overflow-y-auto z-10">
            <div className="py-4">
              {lines.map((_, i) => (
                <div
                  key={i}
                  className={`text-right pr-3 text-xs font-mono h-6 flex items-center justify-end ${i + 1 === cursorLine
                    ? 'text-theme-accent bg-theme-accent/10 font-bold'
                    : 'text-theme-muted'
                    }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Text Editor */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onSelect={handleSelectionChange}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 w-full h-full bg-theme-primary text-theme font-mono focus:outline-none resize-none p-4 pl-16 selection:bg-theme-accent/30"
            style={{
              caretColor: '#FF6347',
              lineHeight: '1.5',
              tabSize: 2,
              fontSize: `${fontSize}px`,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace"
            }}
            spellCheck={false}
            placeholder="Start typing here..."
          />

          {/* Highlight current line */}
          {cursorLine > 0 && (
            <div
              className="absolute right-0 bg-red-900/10 border-l-2 border-red-500/50 pointer-events-none"
              style={{
                top: `${(cursorLine - 1) * 1.5 * fontSize + 16}px`,
                height: `${1.5 * fontSize}px`,
                left: '48px'
              }}
            ></div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 border-t border-gray-800 flex items-center justify-between text-xs font-mono bg-gray-900/90">
        <div className="flex items-center space-x-4">
          <div className="text-gray-600">
            <span className="text-green-400">Ln {cursorLine}</span>,
            <span className="text-green-400"> Col {cursorCol}</span>
          </div>
          <div className="text-gray-600">
            <span className="text-blue-400">{totalLines} lines</span>
          </div>
          <div className="text-gray-600">
            <span className="text-purple-400">{content.length} chars</span>
          </div>
          {searchText && (
            <div className="text-gray-600">
              <span className="text-yellow-400">{matchCount} matches</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2 text-gray-600">
          <div className="flex items-center space-x-1">
            <div className={`px-2 py-0.5 rounded ${isRunning ? 'bg-yellow-900/40 text-yellow-400' : 'bg-gray-800'}`}>
              {isRunning ? '▶ Running...' : 'Ready'}
            </div>
          </div>
          <div className="hidden sm:block">
            <span className="text-green-400">UTF-8</span>
            <span className="mx-1">•</span>
            <span className="text-blue-400">UNIX (LF)</span>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="px-4 py-1 border-t border-gray-800 text-xs text-gray-600 bg-gray-900/90 hidden md:flex items-center space-x-4">
        <div><span className="text-gray-400">Ctrl+S</span> Save</div>
        <div><span className="text-gray-400">Ctrl+F</span> Find</div>
        <div><span className="text-gray-400">Ctrl+R</span> Run</div>
        <div><span className="text-gray-400">Ctrl+E</span> Toggle Output</div>
        <div><span className="text-gray-400">Ctrl+Z</span> Undo</div>
        <div><span className="text-gray-400">Ctrl+Y</span> Redo</div>
      </div>
    </div>
  );
};