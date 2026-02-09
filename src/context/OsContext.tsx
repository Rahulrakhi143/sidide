import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';

// Types remain the same
export interface FileSystemNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  size?: number;
  modified: Date;
  parentId?: string;
  children?: FileSystemNode[];
  icon?: React.ReactNode;
  path?: string;
  tags?: string[];
  favorite?: boolean;
  pinned?: boolean;
  locked?: boolean;
  description?: string;
}

interface TerminalHistoryItem {
  command: string;
  output: string;
  timestamp: Date;
  isError?: boolean;
}

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface OSState {
  activeFile: FileSystemNode | null;
  terminalHistory: TerminalHistoryItem[];
  aiMessages: AIMessage[];
  fileSystem: FileSystemNode[];
  currentPath: string;
  rootPath: string | null;
  openTabs: FileSystemNode[];
  outputMessages: { message: string; type: 'info' | 'success' | 'error' | 'warning'; timestamp: Date }[];
}

type OSAction =
  | { type: 'SET_ACTIVE_FILE'; payload: FileSystemNode | null }
  | { type: 'ADD_TERMINAL_COMMAND'; payload: { command: string; output: string; isError?: boolean } }
  | { type: 'CLEAR_TERMINAL' }
  | { type: 'ADD_AI_MESSAGE'; payload: { role: 'user' | 'assistant'; content: string } }
  | { type: 'CLEAR_AI_MESSAGES' }
  | { type: 'UPDATE_FILE_SYSTEM'; payload: FileSystemNode[] }
  | { type: 'SET_CURRENT_PATH'; payload: string }
  | { type: 'CREATE_FILE'; payload: { name: string; content?: string; parentId?: string } }
  | { type: 'CREATE_DIRECTORY'; payload: { name: string; parentId?: string } }
  | { type: 'DELETE_NODE'; payload: string }
  | { type: 'UPDATE_FILE_CONTENT'; payload: { id: string; content: string } }
  | { type: 'UPDATE_NODE'; payload: { id: string; updates: Partial<FileSystemNode> } }
  | { type: 'MOVE_NODE'; payload: { nodeId: string; targetParentId: string } }
  | { type: 'OPEN_TAB'; payload: FileSystemNode }
  | { type: 'CLOSE_TAB'; payload: string }
  | { type: 'CLOSE_ALL_TABS' }
  | { type: 'ADD_OUTPUT_MESSAGE'; payload: { message: string; type: 'info' | 'success' | 'error' | 'warning' } }
  | { type: 'CLEAR_OUTPUT' }
  | { type: 'SET_ROOT_PATH', payload: string | null };

// Changed: Empty initial file system
const initialFileSystem: FileSystemNode[] = [
  {
    id: 'root',
    name: '/',
    type: 'directory',
    modified: new Date(),
    path: '/',
    children: [] // Empty children array
  }
];

const initialState: OSState = {
  activeFile: null,
  terminalHistory: [],
  aiMessages: [],
  fileSystem: initialFileSystem,
  currentPath: '/',
  rootPath: null,
  openTabs: [],
  outputMessages: [],
};

// Enhanced Reducer (same as before)
const osReducer = (state: OSState, action: OSAction): OSState => {
  switch (action.type) {
    case 'SET_ACTIVE_FILE':
      return { ...state, activeFile: action.payload };

    case 'ADD_TERMINAL_COMMAND':
      return {
        ...state,
        terminalHistory: [
          ...state.terminalHistory,
          {
            command: action.payload.command,
            output: action.payload.output,
            isError: action.payload.isError,
            timestamp: new Date(),
          },
        ],
      };

    case 'CLEAR_TERMINAL':
      return { ...state, terminalHistory: [] };

    case 'ADD_AI_MESSAGE':
      return {
        ...state,
        aiMessages: [
          ...state.aiMessages,
          {
            id: Date.now().toString(),
            role: action.payload.role,
            content: action.payload.content,
            timestamp: new Date(),
          },
        ],
      };

    case 'CLEAR_AI_MESSAGES':
      return { ...state, aiMessages: [] };

    case 'UPDATE_FILE_SYSTEM':
      return {
        ...state,
        fileSystem: action.payload,
        // Never auto-select a file when the file system changes;
        // keep the editor empty until the user explicitly opens a file
        activeFile: state.activeFile
      };

    case 'SET_CURRENT_PATH':
      return { ...state, currentPath: action.payload };

    case 'CREATE_FILE': {
      const newFile: FileSystemNode = {
        id: Date.now().toString(),
        name: action.payload.name,
        type: 'file',
        content: action.payload.content || '',
        size: (action.payload.content || '').length,
        modified: new Date(),
        parentId: action.payload.parentId || 'root',
        tags: [],
        favorite: false,
        pinned: false,
        locked: false,
      };

      const updateFileSystem = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.id === action.payload.parentId || (!action.payload.parentId && node.id === 'root')) {
            const children = [...(node.children || []), newFile];
            return {
              ...node,
              children,
              modified: new Date(),
            };
          }
          if (node.children) {
            return {
              ...node,
              children: updateFileSystem(node.children),
            };
          }
          return node;
        });
      };

      return {
        ...state,
        fileSystem: updateFileSystem(state.fileSystem),
      };
    }

    case 'CREATE_DIRECTORY': {
      const newDir: FileSystemNode = {
        id: Date.now().toString(),
        name: action.payload.name,
        type: 'directory',
        modified: new Date(),
        parentId: action.payload.parentId || 'root',
        children: [],
        tags: [],
        favorite: false,
        pinned: false,
        locked: false,
      };

      const updateFileSystem = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.id === action.payload.parentId || (!action.payload.parentId && node.id === 'root')) {
            const children = [...(node.children || []), newDir];
            return {
              ...node,
              children,
              modified: new Date(),
            };
          }
          if (node.children) {
            return {
              ...node,
              children: updateFileSystem(node.children),
            };
          }
          return node;
        });
      };

      return {
        ...state,
        fileSystem: updateFileSystem(state.fileSystem),
      };
    }

    case 'DELETE_NODE': {
      const deleteNodeRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.filter(node => {
          if (node.id === action.payload) return false;
          if (node.children) {
            node.children = deleteNodeRecursive(node.children);
          }
          return true;
        });
      };

      return {
        ...state,
        fileSystem: deleteNodeRecursive(state.fileSystem),
        activeFile: state.activeFile?.id === action.payload ? null : state.activeFile,
      };
    }

    case 'UPDATE_FILE_CONTENT': {
      const updateFileRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.id === action.payload.id && node.type === 'file') {
            return {
              ...node,
              content: action.payload.content,
              size: action.payload.content.length,
              modified: new Date(),
            };
          }
          if (node.children) {
            return {
              ...node,
              children: updateFileRecursive(node.children),
            };
          }
          return node;
        });
      };

      const updatedFileSystem = updateFileRecursive(state.fileSystem);
      const updatedFile = updatedFileSystem
        .flatMap(n => [n, ...(n.children || [])])
        .find(f => f.id === action.payload.id);

      return {
        ...state,
        fileSystem: updatedFileSystem,
        activeFile: updatedFile || state.activeFile,
      };
    }

    case 'UPDATE_NODE': {
      const updateNodeRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.id === action.payload.id) {
            return {
              ...node,
              ...action.payload.updates,
              modified: new Date(),
            };
          }
          if (node.children) {
            return {
              ...node,
              children: updateNodeRecursive(node.children),
            };
          }
          return node;
        });
      };

      const updatedFileSystem = updateNodeRecursive(state.fileSystem);
      const updatedFile = updatedFileSystem
        .flatMap(n => [n, ...(n.children || [])])
        .find(f => f.id === action.payload.id);

      return {
        ...state,
        fileSystem: updatedFileSystem,
        activeFile: updatedFile || state.activeFile,
      };
    }

    case 'MOVE_NODE': {
      const { nodeId, targetParentId } = action.payload;

      // Find the node to move
      let nodeToMove: FileSystemNode | null = null;

      const findAndRemoveNode = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.filter(node => {
          if (node.id === nodeId) {
            nodeToMove = { ...node };
            return false;
          }
          if (node.children) {
            node.children = findAndRemoveNode(node.children);
          }
          return true;
        });
      };

      // Remove from source
      const fileSystemWithoutNode = findAndRemoveNode(state.fileSystem);

      if (!nodeToMove) {
        return state;
      }

      const movedNode: FileSystemNode = {
        ...(nodeToMove as FileSystemNode),
        parentId: targetParentId,
        modified: new Date(),
      };

      // Add to target
      const addToTarget = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.id === targetParentId) {
            return {
              ...node,
              children: [...(node.children || []), movedNode],
              modified: new Date(),
            };
          }
          if (node.children) {
            return {
              ...node,
              children: addToTarget(node.children),
            };
          }
          return node;
        });
      };

      const finalFileSystem = addToTarget(fileSystemWithoutNode);

      return {
        ...state,
        fileSystem: finalFileSystem,
      };
    }

    case 'OPEN_TAB': {
      // Check if tab is already open
      const isAlreadyOpen = state.openTabs.some(tab => tab.id === action.payload.id);
      if (isAlreadyOpen) {
        return {
          ...state,
          activeFile: action.payload,
        };
      }

      return {
        ...state,
        openTabs: [...state.openTabs, action.payload],
        activeFile: action.payload,
      };
    }

    case 'CLOSE_TAB': {
      const tabIndex = state.openTabs.findIndex(tab => tab.id === action.payload);
      if (tabIndex === -1) return state;

      const newTabs = state.openTabs.filter(tab => tab.id !== action.payload);

      // If closing the active tab, switch to another tab
      let newActiveFile = state.activeFile;
      if (state.activeFile?.id === action.payload) {
        if (newTabs.length > 0) {
          // Switch to the next tab, or previous if it was the last one
          const newIndex = tabIndex >= newTabs.length ? newTabs.length - 1 : tabIndex;
          newActiveFile = newTabs[newIndex];
        } else {
          newActiveFile = null;
        }
      }

      return {
        ...state,
        openTabs: newTabs,
        activeFile: newActiveFile,
      };
    }

    case 'CLOSE_ALL_TABS': {
      return {
        ...state,
        openTabs: [],
        activeFile: null,
      };
    }

    case 'ADD_OUTPUT_MESSAGE': {
      return {
        ...state,
        outputMessages: [
          ...state.outputMessages,
          {
            message: action.payload.message,
            type: action.payload.type,
            timestamp: new Date(),
          },
        ],
      };
    }

    case 'CLEAR_OUTPUT': {
      return {
        ...state,
        outputMessages: [],
      };
    }

    case 'SET_ROOT_PATH':
      return { ...state, rootPath: action.payload };

    default:
      return state;
  }
};

// Context
interface OSContextType {
  state: OSState;
  dispatch: React.Dispatch<OSAction>;
  addTerminalCommand: (command: string, output: string, isError?: boolean) => void;
  clearTerminal: () => void;
  addAIMessage: (role: 'user' | 'assistant', content: string) => void;
  clearAIMessages: () => void;
  setActiveFile: (file: FileSystemNode | null) => void;
  updateFileSystem: (fileSystem: FileSystemNode[]) => void;
  setCurrentPath: (path: string) => void;
  setRootPath: (path: string | null) => void;
  executeCommand: (command: string) => void;
  openFile: (filename: string) => void;
  updateFileContent: (id: string, content: string) => void;
  createFile: (name: string, content?: string, parentId?: string, options?: { isBase64?: boolean }) => void;
  createDirectory: (name: string, parentId?: string, targetPath?: string) => void;
  deleteNode: (id: string) => void;
  getNodeByPath: (path: string) => FileSystemNode | null;
  getFileTree: () => FileSystemNode[];
  updateNode: (id: string, updates: Partial<FileSystemNode>) => void;
  moveNode: (nodeId: string, targetParentId: string) => void;
  findNodeById: (id: string) => FileSystemNode | null;
  getParentNode: (id: string) => FileSystemNode | null;
  listDirectory: (path?: string) => FileSystemNode[];
  getCurrentDirectory: () => FileSystemNode | null;
  openTab: (file: FileSystemNode) => void;
  closeTab: (fileId: string) => void;
  closeAllTabs: () => void;
  addOutputMessage: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
  clearOutput: () => void;
  loadRealDirectory: (path: string) => Promise<void>;
  openFolder: () => Promise<void>;
}

const OSContext = createContext<OSContextType | undefined>(undefined);

// Provider
export const OSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(osReducer, initialState);

  // Initialize OS (only once on mount)
  useEffect(() => {
    const initOS = async () => {
      try {
        // Initialize services
        const { initGitService } = await import('../services/GitService');
        const { getSimpleFS } = await import('../services/SimpleFS');
        const fs = getSimpleFS();
        
        // Get home directory from Electron API if available
        const api = (window as any).electronAPI;
        if (api && api.getHomeDirectory) {
          const homeDir = await api.getHomeDirectory();
          
          // DO NOT set default paths here - let user explicitly open a folder
          // This prevents overwriting the user's opened folder path
          // Only initialize Git service with homeDir as fallback
          // Git service will be re-initialized when user opens a folder
          initGitService(fs, homeDir);
          console.log('Git service initialized (will use opened folder path when available):', homeDir);
        } else {
          // If not in Electron, initialize with default path
          initGitService(fs, '/');
          console.log('Git service initialized for default path');
        }
      } catch (error) {
        console.error('Failed to initialize OS:', error);
      }
    };
    initOS();
  }, []);

  // Helper functions
  const addTerminalCommand = (command: string, output: string, isError?: boolean) => {
    dispatch({ type: 'ADD_TERMINAL_COMMAND', payload: { command, output, isError } });
  };

  const clearTerminal = () => {
    dispatch({ type: 'CLEAR_TERMINAL' });
  };

  const addAIMessage = (role: 'user' | 'assistant', content: string) => {
    dispatch({ type: 'ADD_AI_MESSAGE', payload: { role, content } });
  };

  const clearAIMessages = () => {
    dispatch({ type: 'CLEAR_AI_MESSAGES' });
  };

  const setActiveFile = (file: FileSystemNode | null) => {
    dispatch({ type: 'SET_ACTIVE_FILE', payload: file });
  };

  const updateFileSystem = (fileSystem: FileSystemNode[]) => {
    dispatch({ type: 'UPDATE_FILE_SYSTEM', payload: fileSystem });
  };

  const setCurrentPath = (path: string) => {
    dispatch({ type: 'SET_CURRENT_PATH', payload: path });
    window.dispatchEvent(new CustomEvent('update-terminal-path', { detail: { path } }));
  };

  const setRootPath = (path: string | null) => {
    dispatch({ type: 'SET_ROOT_PATH', payload: path });
  };

  const executeCommand = (command: string) => {
    console.log('Executing command:', command);
  };

  const openFile = (filename: string) => {
    const findFile = (nodes: FileSystemNode[]): FileSystemNode | null => {
      for (const node of nodes) {
        if (node.name === filename && node.type === 'file') {
          return node;
        }
        if (node.children) {
          const found = findFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const file = findFile(state.fileSystem);
    if (file) {
      setActiveFile(file);
    }
  };

  const updateFileContent = async (id: string, content: string) => {
    dispatch({ type: 'UPDATE_FILE_CONTENT', payload: { id, content } });

    // Persistence
    const file = findNodeById(id);
    if (file && file.path && (window as any).electronAPI) {
      await (window as any).electronAPI.saveFile(file.path, content);
    }
  };

  const createFile = async (
    name: string,
    content?: string,
    parentId?: string,
    options?: { isBase64?: boolean }
  ) => {
    const api = (window as any).electronAPI;
    if (state.rootPath && api) {
      let parentPath = state.rootPath;
      if (parentId && parentId !== 'root') {
        const parentNode = findNodeById(parentId);
        if (parentNode && parentNode.path) parentPath = parentNode.path;
      }

      const result = await api.createFileOnDisk(
        parentPath,
        name,
        content || '',
        options?.isBase64 ?? false
      );
      if (result.success) {
        await loadRealDirectory(state.rootPath);
        addOutputMessage(`Created file: ${name}`, 'success');
      } else {
        addOutputMessage(`Failed to create file: ${result.error}`, 'error');
        throw new Error(result.error || 'Failed to create file');
      }
    } else {
      dispatch({ type: 'CREATE_FILE', payload: { name, content, parentId } });
    }
  };

  const createDirectory = async (name: string, parentId?: string, targetPath?: string) => {
    const api = (window as any).electronAPI;
    if (state.rootPath && api) {
      // Explicit path (e.g. from "path shown below search bar") wins for empty-folder flow.
      let parentPath =
        targetPath && targetPath.trim() !== ''
          ? targetPath.trim()
          : state.currentPath || state.rootPath;
      if (!targetPath && parentId) {
        const parentNode = findNodeById(parentId);
        if (parentNode?.path) parentPath = parentNode.path;
      }

      const result = await api.createFolderOnDisk(parentPath, name);
      if (result.success) {
        await loadRealDirectory(state.rootPath);
        addOutputMessage(`Created folder: ${name}`, 'success');
      } else {
        addOutputMessage(`Failed to create folder: ${result.error}`, 'error');
      }
    } else {
      dispatch({ type: 'CREATE_DIRECTORY', payload: { name, parentId } });
    }
  };

  const deleteNode = async (id: string) => {
    const node = findNodeById(id);
    const api = (window as any).electronAPI;
    if (state.rootPath && node && node.path && api) {
      const result = await api.deleteFromDisk(node.path);
      if (result.success) {
        await loadRealDirectory(state.rootPath);
        addOutputMessage(`Deleted: ${node.name}`, 'success');
      } else {
        addOutputMessage(`Failed to delete: ${result.error}`, 'error');
      }
    } else {
      dispatch({ type: 'DELETE_NODE', payload: id });
    }
  };

  const updateNode = async (id: string, updates: Partial<FileSystemNode>) => {
    const node = findNodeById(id);
    const api = (window as any).electronAPI;

    if (state.rootPath && node && node.path && updates.name && api) {
      const parentDir = api.path.dirname(node.path);
      const newPath = api.path.join(parentDir, updates.name);

      const result = await api.renameOnDisk(node.path, newPath);
      if (result.success) {
        await loadRealDirectory(state.rootPath);
        addOutputMessage(`Renamed: ${node.name} -> ${updates.name}`, 'success');
      } else {
        addOutputMessage(`Failed to rename: ${result.error}`, 'error');
      }
    } else {
      dispatch({ type: 'UPDATE_NODE', payload: { id, updates } });
    }
  };

  const moveNode = async (nodeId: string, targetParentId: string) => {
    const node = findNodeById(nodeId);
    const targetParent = findNodeById(targetParentId);
    const api = (window as any).electronAPI;

    if (state.rootPath && node && node.path && targetParent && targetParent.path && api) {
      const newPath = api.path.join(targetParent.path, node.name);
      const result = await api.moveOnDisk(node.path, newPath);

      if (result.success) {
        await loadRealDirectory(state.rootPath);
        addOutputMessage(`Moved ${node.name} to ${targetParent.name}`, 'success');
      } else {
        addOutputMessage(`Failed to move: ${result.error}`, 'error');
      }
    } else {
      dispatch({ type: 'MOVE_NODE', payload: { nodeId, targetParentId } });
    }
  };

  const findNodeById = (id: string, nodes: FileSystemNode[] = state.fileSystem): FileSystemNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(id, node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const getParentNode = (id: string): FileSystemNode | null => {
    const findParent = (nodes: FileSystemNode[], parentId?: string): FileSystemNode | null => {
      for (const node of nodes) {
        if (node.id === id) {
          return parentId ? findNodeById(parentId) : null;
        }
        if (node.children) {
          const found = findParent(node.children, node.id);
          if (found) return found;
        }
      }
      return null;
    };
    return findParent(state.fileSystem);
  };

  const getNodeByPath = (path: string): FileSystemNode | null => {
    // Virtual root node that represents the currently opened folder
    const makeRootNode = (): FileSystemNode => ({
      id: 'root',
      name: '/',
      type: 'directory',
      modified: new Date(),
      children: state.fileSystem,
      path: state.rootPath || '/'
    });

    if (!path || path === '/') {
      return makeRootNode();
    }

    // Normalize separators so path comparison works on Windows (e.g. F:\a\b vs F:/a/b)
    const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+/g, '/');
    const normPath = norm(path);
    const normRoot = state.rootPath ? norm(state.rootPath) : '';

    if (normRoot && (normPath === normRoot || normPath.startsWith(normRoot + '/'))) {
      const relativePath = normPath.slice(normRoot.length).replace(/^\/+/, '');
      if (!relativePath) return makeRootNode();
      const parts = relativePath.split('/').filter(p => p);
      let currentNode: FileSystemNode | null = makeRootNode();
      for (const part of parts) {
        if (!currentNode?.children) return null;
        const found: FileSystemNode | undefined = currentNode.children.find((c: FileSystemNode) => c.name === part);
        if (!found) return null;
        currentNode = found;
      }
      return currentNode;
    }

    // Fallback: logical path like /foo/bar
    const relativePath = normPath.replace(/^\/+/, '');
    if (!relativePath) return makeRootNode();

    const parts = relativePath.split('/').filter(p => p);
    let currentNode: FileSystemNode | null = makeRootNode();

    for (const part of parts) {
      if (!currentNode?.children) return null;
      const foundCandidate: FileSystemNode | undefined = currentNode.children.find(child => child.name === part);
      if (!foundCandidate) return null;
      currentNode = foundCandidate;
    }

    return currentNode;
  };

  const getFileTree = () => {
    const flattenNodes = (nodes: FileSystemNode[]): FileSystemNode[] => {
      return nodes.flatMap(node => [node, ...(node.children ? flattenNodes(node.children) : [])]);
    };
    return flattenNodes(state.fileSystem);
  };

  const getCurrentDirectory = (): FileSystemNode | null => {
    return getNodeByPath(state.currentPath);
  };

  const listDirectory = (path?: string): FileSystemNode[] => {
    const node = getNodeByPath(path || state.currentPath);
    if (!node || node.type !== 'directory') {
      return [];
    }
    return node.children || [];
  };

  // Tab management functions
  const openTab = (file: FileSystemNode) => {
    dispatch({ type: 'OPEN_TAB', payload: file });
  };

  const closeTab = (fileId: string) => {
    dispatch({ type: 'CLOSE_TAB', payload: fileId });
  };

  const closeAllTabs = () => {
    dispatch({ type: 'CLOSE_ALL_TABS' });
  };

  const addOutputMessage = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    dispatch({ type: 'ADD_OUTPUT_MESSAGE', payload: { message, type } });
  };

  const clearOutput = () => {
    dispatch({ type: 'CLEAR_OUTPUT' });
  };

  const loadRealDirectory = async (path: string) => {
    try {
      const api = (window as any).electronAPI;
      if (!api) return;

      const result = await api.readDirectory(path);
      if (result.success) {
        dispatch({ type: 'UPDATE_FILE_SYSTEM', payload: result.fileSystem });
        dispatch({ type: 'SET_ROOT_PATH', payload: path });
        dispatch({ type: 'SET_CURRENT_PATH', payload: path });
        
        // Re-initialize Git service with the opened folder path
        try {
          const { initGitService } = await import('../services/GitService');
          const { getSimpleFS } = await import('../services/SimpleFS');
          const fs = getSimpleFS();
          initGitService(fs, path);
          console.log('Git service re-initialized for opened folder:', path);
        } catch (gitError) {
          console.warn('Failed to re-initialize Git service:', gitError);
        }
        
        addOutputMessage(`Loaded directory: ${path}`, 'success');
      } else {
        addOutputMessage(`Error loading directory: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to load real directory:', error);
      addOutputMessage('Failed to load real directory', 'error');
    }
  };

  const openFolder = async () => {
    try {
      const api = (window as any).electronAPI;
      if (!api) return;

      const result = await api.openFolderDialog();
      if (result) {
        dispatch({ type: 'UPDATE_FILE_SYSTEM', payload: result.fileSystem });
        dispatch({ type: 'SET_ROOT_PATH', payload: result.path });
        dispatch({ type: 'SET_CURRENT_PATH', payload: result.path });
        
        // Re-initialize Git service with the opened folder path
        try {
          const { initGitService } = await import('../services/GitService');
          const { getSimpleFS } = await import('../services/SimpleFS');
          const fs = getSimpleFS();
          initGitService(fs, result.path);
          console.log('Git service re-initialized for opened folder:', result.path);
        } catch (gitError) {
          console.warn('Failed to re-initialize Git service:', gitError);
        }
        
        addOutputMessage(`Opened folder: ${result.name}`, 'success');
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
      addOutputMessage('Failed to open folder', 'error');
    }
  };

  // Context value
  const contextValue: OSContextType = {
    state,
    dispatch,
    addTerminalCommand,
    clearTerminal,
    addAIMessage,
    clearAIMessages,
    setActiveFile,
    updateFileSystem,
    setCurrentPath,
    setRootPath,
    executeCommand,
    openFile,
    updateFileContent,
    createFile,
    createDirectory,
    deleteNode,
    getNodeByPath,
    getFileTree,
    updateNode,
    moveNode,
    findNodeById,
    getParentNode,
    listDirectory,
    getCurrentDirectory,
    openTab,
    closeTab,
    closeAllTabs,
    addOutputMessage,
    clearOutput,
    loadRealDirectory,
    openFolder,
  };

  return (
    <OSContext.Provider value={contextValue}>
      {children}
    </OSContext.Provider>
  );
};

// Hook
export const useOS = (): OSContextType => {
  const context = useContext(OSContext);
  if (!context) {
    throw new Error('useOS must be used within an OSProvider');
  }
  return context;
};