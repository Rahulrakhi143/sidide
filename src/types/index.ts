export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
  parentId?: string;
  path: string;
}

export interface Panel {
  id: string;
  visible: boolean;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  zIndex: number;
}

export interface TerminalCommand {
  command: string;
  output: string;
  timestamp: number;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export type OSPhase = 'boot' | 'splash' | 'ready';

export interface OSState {
  phase: OSPhase;
  fileSystem: FileNode[];
  currentFile: string | null;
  panels: {
    fileExplorer: Panel;
    codeEditor: Panel;
    aiAgent: Panel;
    terminal: Panel;
  };
  terminalHistory: TerminalCommand[];
  aiMessages: AIMessage[];
  theme: 'cyberpunk';
}
