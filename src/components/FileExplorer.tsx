import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOS, FileSystemNode } from '../context/OsContext';
import { getGitService } from '../services/GitService';
import {
  FolderIcon, FileIcon, ChevronRight, ChevronDown,
  Plus, Trash2, Edit3, Download,
  RefreshCw, Search, X,
  FileText, Image, Code, Database, Upload,
  FilePlus, FolderPlus, FolderOpen,
  Music, Video, Globe, Settings, Type,
  Binary
} from 'lucide-react';

export const FileExplorer = () => {
  const {
    state,
    openTab,
    createFile,
    createDirectory,
    deleteNode,
    getNodeByPath,
    setCurrentPath,
    updateFileSystem,
    updateNode,
    moveNode,
    findNodeById: findNodeByIdContext,
    getParentNode: getParentNodeContext,
    loadRealDirectory,
    openFolder
  } = useOS();

  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root']));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [contextNodeId, setContextNodeId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'modified' | 'size' | 'favorite'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [gitStatus, setGitStatus] = useState<Map<string, string>>(new Map());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastPathRef = useRef<string>('');

  // Update expanded when file system changes
  useEffect(() => {
    const paths = state.currentPath.split('/').filter(p => p);
    let currentPath = '';
    const newExpanded = new Set(expanded);

    paths.forEach(part => {
      currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
      const node = getNodeByPath(currentPath);
      if (node) {
        newExpanded.add(node.id);
      }
    });

    setExpanded(newExpanded);
  }, [state.currentPath]);

  // Sync terminal path when folder is opened or current path changes (so path is set in both cases)
  useEffect(() => {
    if (!state.rootPath || !(window as any).electronAPI) return;
    const path = state.currentPath || state.rootPath;
    updateTerminalPath(path);
  }, [state.rootPath, state.currentPath]);

  // Load Git status
  const loadGitStatus = useCallback(async () => {
    const gitService = getGitService();
    if (!gitService) return;

    try {
      const status = await gitService.getStatus();
      const statusMap = new Map<string, string>();

      status.modified.forEach(file => statusMap.set(file, 'M'));
      status.staged.forEach(file => statusMap.set(file, 'A'));
      status.untracked.forEach(file => statusMap.set(file, '?'));

      setGitStatus(statusMap);
    } catch (error) {
      console.error('Failed to load git status:', error);
    }
  }, []);

  useEffect(() => {
    loadGitStatus();
  }, [state.fileSystem, loadGitStatus]);

  useEffect(() => {
    if (state.activeFile) {
      setSelectedNodeId(state.activeFile.id);
      // Auto-expand parent directories
      const expandParents = (nodeId: string) => {
        const node = findNodeById(nodeId);
        if (node && node.parentId) {
          setExpanded(prev => new Set([...prev, node.parentId!]));
          expandParents(node.parentId);
        }
      };
      expandParents(state.activeFile.id);
    }
  }, [state.activeFile]);

  // Update terminal path when directory is clicked
  const updateTerminalPath = async (path: string) => {
    try {
      // Avoid duplicate updates
      if (lastPathRef.current === path) return;
      lastPathRef.current = path;
      
      console.log(`Updating terminal path to: ${path}`);
      
      // Method 1: Try to use Electron API directly
      const api = (window as any).electronAPI;
      if (api && api.changeTerminalPath) {
        // Get the active terminal ID
        let terminalId = 'terminal-1';
        if (api.getActiveTerminalId) {
          try {
            const activeId = await api.getActiveTerminalId();
            if (activeId) terminalId = activeId;
          } catch (e) {
            console.log('Using default terminal ID');
          }
        }
        
        console.log(`Using terminal ID: ${terminalId} for path: ${path}`);
        const result = await api.changeTerminalPath(terminalId, path);
        if (result.success) {
          console.log(`Terminal path changed successfully to: ${path}`);
          return;
        }
      }
      
      // Method 2: Send a custom event that terminals can listen to
      const pathUpdateEvent = new CustomEvent('terminal-path-update', {
        detail: { 
          path,
          timestamp: Date.now(),
          source: 'file-explorer'
        }
      });
      window.dispatchEvent(pathUpdateEvent);
      
      // Method 3: Also try the old event name for compatibility
      const updateEvent = new CustomEvent('update-terminal-path', {
        detail: { path }
      });
      window.dispatchEvent(updateEvent);
      
      console.log('Terminal path update events dispatched');
      
    } catch (error) {
      console.error('Failed to update terminal path:', error);
      
      // Fallback: Try one more time with direct event
      window.dispatchEvent(new CustomEvent('terminal-path-update', {
        detail: { path }
      }));
    }
  };

  const findNodeById = useCallback((id: string): any => {
    return findNodeByIdContext(id);
  }, [findNodeByIdContext]);

  const getParentNode = (id: string): any => {
    return getParentNodeContext(id);
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'js':
      case 'jsx':
        return <Code size={14} className="text-yellow-400" />;
      case 'ts':
      case 'tsx':
        return <Code size={14} className="text-blue-400" />;
      case 'html':
      case 'htm':
        return <Globe size={14} className="text-orange-500" />;
      case 'css':
      case 'scss':
      case 'sass':
        return <Type size={14} className="text-pink-500" />;
      case 'json':
        return <Settings size={14} className="text-yellow-600" />;
      case 'md':
        return <FileText size={14} className="text-gray-300" />;
      case 'txt':
        return <FileText size={14} className="text-gray-400" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <Image size={14} className="text-green-400" />;
      case 'mp3':
      case 'wav':
      case 'ogg':
        return <Music size={14} className="text-purple-400" />;
      case 'mp4':
      case 'avi':
      case 'mov':
        return <Video size={14} className="text-red-400" />;
      case 'db':
      case 'sql':
        return <Database size={14} className="text-blue-600" />;
      case 'exe':
      case 'bin':
      case 'dll':
        return <Binary size={14} className="text-red-500" />;
      case 'py':
        return <Code size={14} className="text-green-500" />;
      default:
        return <FileIcon size={14} className="text-blue-400" />;
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getAllVisibleNodes = (): any[] => {
    const result: any[] = [];

    const traverse = (nodes: any[], depth: number = 0) => {
      nodes.forEach(node => {
        if (node.name.startsWith('.') && !showHidden) return;
        result.push(node);

        if (node.type === 'directory' && expanded.has(node.id) && node.children) {
          traverse(node.children, depth + 1);
        }
      });
    };

    traverse(state.fileSystem);
    return result;
  };

  const handleFileClick = async (node: any, e?: React.MouseEvent) => {
    setSelectedNodeId(node.id);

    if (node.type === 'file') {
      openTab(node);
      // Path bar should show the file's parent folder (e.g. F:\video\ram\New Folder for newfile.txt)
      const parent = getParentNode(node.id);
      const parentPath = parent ? getNodePath(parent) : (state.rootPath || state.currentPath);
      if (parentPath) {
        setCurrentPath(parentPath);
        await updateTerminalPath(parentPath);
      }
    } else {
      toggleExpand(node.id);
      // Set current path to clicked folder and update terminal
      const path = getNodePath(node);
      if (path) {
        setCurrentPath(path);
        await updateTerminalPath(path);
      }
    }
  };

  const getNodePath = (node: any): string => {
    // Prefer full OS path from disk (so terminal gets e.g. C:\Users\...\New Folder)
    if (node.path && typeof node.path === 'string') return node.path;

    // Build full path: resolve parent path then append node name
    const parent = node.parentId ? findNodeById(node.parentId) : null;
    const sep = (typeof state.rootPath === 'string' && state.rootPath.includes('\\')) ? '\\' : '/';
    const base = parent ? getNodePath(parent) : (state.rootPath || '');
    if (!base) return node.name || '/';
    const joined = base.endsWith(sep) ? base + node.name : base + sep + node.name;
    return joined || '/';
  };

  const handleNewFile = async (parentId?: string) => {
    const targetParentId = parentId || (selectedNodeId && findNodeById(selectedNodeId)?.type === 'directory' ? selectedNodeId : 'root');
    const name = `newfile_${Date.now()}.txt`;
    const content = '';

    createFile(name, content, targetParentId);

    // Auto-rename after creation
    setTimeout(() => {
      const newFile = state.fileSystem
        .flatMap(n => [n, ...(n.children || [])])
        .find(f => f.name === name && f.parentId === targetParentId);
      if (newFile) {
        startRename(newFile);
      }
    }, 100);

    showToast(`Created file: ${name}`, 'success');
  };

  // Create a new empty folder without opening any file in the editor
  // Flow: empty folder open → path shows below search bar → New Folder → create at that path
  const handleNewFolder = async (parentId?: string) => {
    const pathShownBelowSearch = state.currentPath || state.rootPath;

    // 1) If a specific parent node is selected (context menu / tree), create inside it
    if (parentId) {
      const parentNode = findNodeById(parentId);
      const name = getNewFolderName(parentNode, 'New Folder');
      await createDirectory(name, parentId, undefined);
      showToast(`Created folder: ${name}`, 'success');
      return;
    }

    if (selectedNodeId) {
      const selected = findNodeById(selectedNodeId);
      if (selected?.type === 'directory') {
        const name = getNewFolderName(selected, 'New Folder');
        await createDirectory(name, selected.id, undefined);
        showToast(`Created folder: ${name}`, 'success');
        return;
      }
      if (selected?.parentId) {
        const name = getNewFolderName(findNodeById(selected.parentId), 'New Folder');
        await createDirectory(name, selected.parentId, undefined);
        showToast(`Created folder: ${name}`, 'success');
        return;
      }
    }

    // 2) Else: create in the path shown below the search bar (empty folder or current location)
    if (!pathShownBelowSearch || !state.rootPath) {
      showToast('Open a folder first', 'warning');
      return;
    }
    const baseName = 'New Folder';
    let name = baseName;
    const currentDir = getNodeByPath(pathShownBelowSearch);
    if (currentDir?.children?.length) {
      const existingNames = new Set(currentDir.children.map((c: any) => c.name));
      let counter = 1;
      while (existingNames.has(name)) name = `${baseName} ${counter++}`;
    }
    await createDirectory(name, undefined, pathShownBelowSearch);
    showToast(`Created folder: ${name}`, 'success');
  };

  const getNewFolderName = (parentNode: any, baseName: string): string => {
    let name = baseName;
    if (parentNode?.children?.length) {
      const existingNames = new Set(parentNode.children.map((c: any) => c.name));
      let counter = 1;
      while (existingNames.has(name)) name = `${baseName} ${counter++}`;
    }
    return name;
  };

  const startRename = (node: any) => {
    setEditingNodeId(node.id);
    setEditingName(node.name);
  };

  const handleRename = (nodeId: string) => {
    if (!editingName.trim()) {
      setEditingNodeId(null);
      return;
    }

    const node = findNodeById(nodeId);
    if (!node) return;

    const parent = getParentNode(nodeId);
    if (parent?.children?.some((child: FileSystemNode) => child.name === editingName && child.id !== nodeId)) {
      showToast(`"${editingName}" already exists in this directory!`, 'error');
      return;
    }

    updateNode(nodeId, { name: editingName });

    if (state.activeFile?.id === nodeId) {
      openTab({ ...state.activeFile, name: editingName });
    }

    setEditingNodeId(null);
    showToast(`Renamed to: ${editingName}`, 'success');
  };

  const handleDelete = (id: string) => {
    const node = findNodeById(id);
    if (!node) return;

    if (node.type === 'directory' && node.children && node.children.length > 0) {
      if (!confirm(`This folder contains ${node.children.length} items. Delete them all?`)) {
        return;
      }
    }

    deleteNode(id);

    if (selectedNodeId === id) {
      setSelectedNodeId(null);
    }

    showToast(`Deleted: ${node.name}`, 'success');
  };

  const handleDownload = (node: any) => {
    if (node.type === 'file' && node.content) {
      const blob = new Blob([node.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = node.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Downloaded: ${node.name}`, 'success');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node: any) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedNodeId(node.id);
    setContextNodeId(node.id);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Close context menu on click outside (anywhere except the menu itself)
  useEffect(() => {
    if (!showContextMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-file-explorer-context-menu]')) return;
      setShowContextMenu(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showContextMenu]);

  const handleUpload = () => {
    const api = (window as any).electronAPI;
    if (api && !state.rootPath) {
      showToast('Open a folder first to upload files', 'warning');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const api = (window as any).electronAPI;
    if (api && !state.rootPath) {
      showToast('Open a folder first to upload files', 'warning');
      e.target.value = '';
      return;
    }

    const targetParentId =
      selectedNodeId && findNodeById(selectedNodeId)?.type === 'directory'
        ? selectedNodeId
        : selectedNodeId
          ? getParentNode(selectedNodeId)?.id ?? 'root'
          : 'root';

    for (const file of Array.from(files)) {
      try {
        const isLikelyText =
          !file.type ||
          file.type.startsWith('text/') ||
          file.type === 'application/json' ||
          file.type === 'application/javascript' ||
          /\.(txt|md|json|js|ts|tsx|jsx|css|html|xml|svg|log|env)$/i.test(file.name);

        if (isLikelyText) {
          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string) ?? '');
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          });
          await createFile(file.name, content, targetParentId);
        } else {
          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const buf = reader.result as ArrayBuffer;
              const bytes = new Uint8Array(buf);
              let binary = '';
              for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
              resolve(btoa(binary));
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
          });
          await createFile(file.name, content, targetParentId, { isBase64: true });
        }
        showToast(`Uploaded: ${file.name}`, 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        showToast(`${file.name}: ${msg}`, 'error');
      }
    }

    e.target.value = '';
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 bg-gray-900 border border-gray-700 px-4 py-2 rounded-lg text-sm z-50 shadow-2xl animate-slideIn flex items-center space-x-3`;
    toast.style.color = 'var(--text-primary)';

    const dot = document.createElement('div');
    dot.className = 'w-2 h-2 rounded-full';
    dot.style.backgroundColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : 'var(--accent-primary)';
    dot.style.boxShadow = `0 0 10px ${dot.style.backgroundColor}`;

    toast.prepend(dot);
    toast.textContent = ` ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('animate-slideOut');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const getSortedChildren = (children: any[]) => {
    return [...children].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'modified':
          comparison = new Date(b.modified).getTime() - new Date(a.modified).getTime();
          break;
        case 'size':
          comparison = (b.size || 0) - (a.size || 0);
          break;
        case 'favorite':
          comparison = (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const renderNode = (node: any, depth: number = 0) => {
    // Skip rendering an empty synthetic root node in all cases
    if (node.id === 'root' && (!node.children || node.children.length === 0)) {
      return null;
    }

    if (node.name.startsWith('.') && !showHidden) {
      return null;
    }

    const nodePath = getNodePath(node);
    const isExpanded = expanded.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const isActiveFile = state.activeFile?.id === node.id;
    const isEditing = editingNodeId === node.id;

    const filteredChildren = node.children?.filter((child: any) => {
      if (searchQuery) {
        return child.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    }) || [];

    return (
      <div key={node.id}>
        <div
          className={`flex items-center space-x-2 px-2 py-1.5 cursor-pointer transition-all group ${isSelected
            ? 'bg-theme-accent/20 border-l-2 border-theme-accent'
            : isActiveFile
              ? 'bg-theme-accent/10 border-l-2 border-theme-accent'
              : 'hover:bg-white/5'
            } ${node.name.startsWith('.') ? 'opacity-60' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(e) => handleFileClick(node, e)}
          onDoubleClick={() => node.type === 'directory' && toggleExpand(node.id)}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {node.type === 'directory' && (
            <button
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}

          {node.type === 'directory' ? (
            <FolderIcon size={16} className="text-yellow-500/70 flex-shrink-0" />
          ) : (
            <div className="flex-shrink-0">
              {getFileIcon(node.name)}
            </div>
          )}

          {isEditing ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => handleRename(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(node.id);
                if (e.key === 'Escape') setEditingNodeId(null);
              }}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 font-mono focus:outline-none focus:border-blue-500"
              autoFocus
            />
          ) : (
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-mono truncate ${isActiveFile ? 'text-blue-300' : 'text-gray-300'
                }`}>
                {node.name}
                {isActiveFile && <span className="text-xs text-blue-400 animate-pulse">●</span>}
                {node.name.startsWith('.') && <span className="text-xs text-gray-500 ml-1">(hidden)</span>}
              </span>
            </div>
          )}

          {!isEditing && (
            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startRename(node);
                }}
                className="p-0.5 hover:bg-gray-700 rounded text-gray-400 hover:text-yellow-400"
                title="Rename"
              >
                <Edit3 size={12} />
              </button>
            </div>
          )}
        </div>

        {node.type === 'directory' && isExpanded && filteredChildren.length > 0 && (
          <div>
            {getSortedChildren(filteredChildren).map((child: FileSystemNode) =>
              renderNode(child, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const handleRefresh = () => {
    if (state.rootPath) {
      loadRealDirectory(state.rootPath);
    } else {
      updateFileSystem([...state.fileSystem]);
    }
    showToast('Refreshed file system', 'info');
  };

  // Total visible items in the CURRENT directory (not entire tree)
  const getTotalItems = () => {
    const currentDir = getNodeByPath(state.currentPath);
    if (!currentDir || currentDir.type !== 'directory') return 0;

    const children = currentDir.children || [];

    const visibleChildren = children.filter((child: any) => {
      if (child.name.startsWith('.') && !showHidden) return false;
      if (searchQuery && !child.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    return visibleChildren.length;
  };

  const selectedNode = selectedNodeId ? findNodeById(selectedNodeId) : null;

  // Check if no folder is opened
  const isNoFolderOpened = state.rootPath === null && 
    state.fileSystem.length > 0 && 
    state.fileSystem[0].id === 'root' && 
    (!state.fileSystem[0].children || state.fileSystem[0].children.length === 0);

  // "This folder is empty" only when the *opened* folder (or current folder) is actually empty.
  // When viewing root: use state.fileSystem.length so we don't depend on path matching.
  const norm = (p: string | null) => (p || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const isViewingOpenedFolderRoot =
    !state.currentPath ||
    state.currentPath === '/' ||
    (state.rootPath && norm(state.currentPath) === norm(state.rootPath));
  const isEmpty =
    isViewingOpenedFolderRoot
      ? state.fileSystem.length === 0
      : getTotalItems() === 0;

  // Prevent native context menu in file explorer so only our custom menu shows (no file dialog)
  const handleContainerContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="h-full flex flex-col bg-transparent"
      onContextMenu={handleContainerContextMenu}
    >
      {/* Search and Navigation */}
      <div className="p-2 border-b border-gray-800/50 bg-black/40 flex items-center space-x-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter files..."
            className="w-full pl-8 pr-2 py-1 bg-black/40 border border-gray-800 rounded text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-red-900/50 transition-all font-mono"
          />
        </div>
        <button
          onClick={handleRefresh}
          className="p-1.5 hover:bg-red-900/20 rounded text-gray-500 hover:text-red-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Current path (folder/file opened) */}
      <div className="px-2 py-1.5 border-b border-gray-800/50 bg-black/30">
        <div className="text-[10px] font-mono text-gray-500 truncate" title={state.currentPath || 'No folder opened'}>
          {state.currentPath || 'No folder opened'}
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-2 py-1.5 border-b border-gray-800 flex items-center justify-between bg-black/20">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => openFolder()}
            className="p-2 hover:bg-theme-accent/30 rounded text-theme-accent transition-colors"
            title="Open Folder"
          >
            <FolderOpen size={16} />
          </button>

          <button
            onClick={() => handleNewFile()}
            className="p-2 hover:bg-blue-900/30 rounded text-blue-400 transition-colors"
            title="New File"
          >
            <FilePlus size={16} />
          </button>

          <button
            onClick={() => handleNewFolder()}
            className="p-2 hover:bg-gray-800 rounded text-gray-400 transition-colors"
            title="New Folder"
          >
            <FolderPlus size={16} />
          </button>

          <button
            onClick={handleUpload}
            className="p-2 hover:bg-purple-900/30 rounded text-purple-400 transition-colors"
            title="Upload Files"
          >
            <Upload size={16} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File List */}
        <div className="flex-1 overflow-auto p-1" data-file-explorer-tree>
          {isNoFolderOpened ? (
            // Welcome screen when no folder is opened
            <div className="flex-1 h-full flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <FolderOpen size={80} className="mx-auto mb-6 text-gray-400" />
                <h3 className="text-2xl font-bold text-gray-300 mb-4">
                  Welcome to File Explorer
                </h3>
                <p className="text-gray-500 mb-8">
                  Open a folder to start managing your files and projects
                </p>
                <button
                  onClick={() => openFolder()}
                  className="px-8 py-3 bg-theme-accent hover:bg-theme-accent/80 rounded-lg text-white font-medium transition-all transform hover:scale-105 flex items-center space-x-3 mx-auto"
                >
                  <FolderOpen size={20} />
                  <span>Open Folder</span>
                </button>
                <p className="text-xs text-gray-600 mt-6">
                  You can also create new files and folders after opening a directory
                </p>
              </div>
            </div>
          ) : (
            // Show file system when folder is opened
            <>
              {state.fileSystem.map((node: any) => renderNode(node))}

              {searchQuery && getTotalItems() === 0 && (
                <div className="text-center text-gray-500 mt-12">
                  <Search size={48} className="mx-auto mb-4 text-gray-600" />
                  <div className="text-lg mb-2">No files found for "{searchQuery}"</div>
                  <div className="text-sm text-gray-600">Try a different search term</div>
                </div>
              )}

              {isEmpty && !searchQuery && !isNoFolderOpened && (
                <div className="text-center text-gray-500 mt-12">
                  <FolderIcon size={64} className="mx-auto mb-6 text-gray-600" />
                  <div className="text-xl mb-3">This folder is empty</div>
                  <div className="text-sm text-gray-600 mb-8">Create a new file or folder to get started</div>
                  <div className="flex justify-center space-x-6">
                    <button
                      onClick={() => handleNewFile()}
                      className="p-4 bg-blue-900/20 hover:bg-blue-900/40 rounded-full text-blue-300 transition-all transform hover:scale-110"
                      title="New File"
                    >
                      <FilePlus size={24} />
                    </button>
                    <button
                      onClick={() => handleNewFolder()}
                      className="p-4 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-all transform hover:scale-110"
                      title="New Folder"
                    >
                      <FolderPlus size={24} />
                    </button>
                    <button
                      onClick={handleUpload}
                      className="p-4 bg-purple-900/20 hover:bg-purple-900/40 rounded-full text-purple-300 transition-all transform hover:scale-110"
                      title="Upload"
                    >
                      <Upload size={24} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hidden file input for upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        className="hidden"
      />

      {/* Context Menu */}
      {showContextMenu && contextNodeId && createPortal(
        <div
          data-file-explorer-context-menu
          className="fixed z-[9999] bg-gray-900 border border-gray-700 rounded-lg shadow-lg py-1 min-w-48"
          style={{
            left: Math.min(contextMenuPos.x, window.innerWidth - 250),
            top: Math.min(contextMenuPos.y, window.innerHeight - 400)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setShowContextMenu(false);
              handleNewFile();
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center space-x-2"
          >
            <Plus size={14} className="text-blue-400" />
            <span>New File Here</span>
          </button>

          <button
            onClick={() => {
              setShowContextMenu(false);
              handleNewFolder();
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center space-x-2"
          >
            <FolderPlus size={14} className="text-yellow-400" />
            <span>New Folder Here</span>
          </button>

          <div className="border-t border-gray-700 my-1"></div>

          <button
            onClick={() => {
              const node = findNodeById(contextNodeId);
              if (node) startRename(node);
              setShowContextMenu(false);
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center space-x-2"
          >
            <Edit3 size={14} className="text-yellow-400" />
            <span>Rename</span>
          </button>

          <button
            onClick={() => {
              const node = findNodeById(contextNodeId);
              if (node && node.type === 'file') handleDownload(node);
              setShowContextMenu(false);
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center space-x-2"
          >
            <Download size={14} className="text-green-400" />
            <span>Download</span>
          </button>

          <div className="border-t border-gray-700 my-1"></div>

          <button
            onClick={() => {
              if (contextNodeId) handleDelete(contextNodeId);
              setShowContextMenu(false);
            }}
            className="w-full text-left px-4 py-2 hover:bg-red-900/30 text-red-400 flex items-center space-x-2"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        
        .animate-slideOut {
          animation: slideOut 0.3s ease-in;
        }
      `}</style>
    </div>
  );
};