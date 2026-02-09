import { FileNode } from '../types';

export class VirtualFileSystem {
  private files: Map<string, FileNode> = new Map();
  private root: FileNode;

  constructor() {
    this.root = {
      id: 'root',
      name: 'root',
      type: 'folder',
      children: [],
      path: '/',
    };
    this.files.set('root', this.root);
    this.initializeDefaultProject();
  }

  private initializeDefaultProject() {
    this.createFile('/index.html', '<html>\n  <body>\n    <h1>HENU IDE</h1>\n  </body>\n</html>');
    this.createFile('/style.css', 'body {\n  margin: 0;\n  font-family: monospace;\n}');
    this.createFile('/script.js', 'console.log("HENU IDE Initialized");');
  }

  private generateId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createFile(path: string, content: string = ''): FileNode | null {
    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) return null;

    const parentPath = '/' + parts.join('/');
    const parent = this.getNodeByPath(parentPath) || this.root;

    if (parent.type !== 'folder') return null;

    const newFile: FileNode = {
      id: this.generateId(),
      name: fileName,
      type: 'file',
      content,
      parentId: parent.id,
      path,
    };

    if (!parent.children) parent.children = [];
    parent.children.push(newFile);
    this.files.set(newFile.id, newFile);

    return newFile;
  }

  createFolder(path: string): FileNode | null {
    const parts = path.split('/').filter(Boolean);
    const folderName = parts.pop();
    if (!folderName) return null;

    const parentPath = '/' + parts.join('/');
    const parent = this.getNodeByPath(parentPath) || this.root;

    if (parent.type !== 'folder') return null;

    const newFolder: FileNode = {
      id: this.generateId(),
      name: folderName,
      type: 'folder',
      children: [],
      parentId: parent.id,
      path,
    };

    if (!parent.children) parent.children = [];
    parent.children.push(newFolder);
    this.files.set(newFolder.id, newFolder);

    return newFolder;
  }

  getNodeByPath(path: string): FileNode | null {
    if (path === '/' || path === '') return this.root;

    const parts = path.split('/').filter(Boolean);
    let current = this.root;

    for (const part of parts) {
      if (!current.children) return null;
      const found = current.children.find(child => child.name === part);
      if (!found) return null;
      current = found;
    }

    return current;
  }

  getNodeById(id: string): FileNode | null {
    return this.files.get(id) || null;
  }

  updateFileContent(id: string, content: string): boolean {
    const file = this.files.get(id);
    if (file && file.type === 'file') {
      file.content = content;
      return true;
    }
    return false;
  }

  deleteNode(id: string): boolean {
    const node = this.files.get(id);
    if (!node || node.id === 'root') return false;

    const parent = node.parentId ? this.files.get(node.parentId) : null;
    if (parent && parent.children) {
      parent.children = parent.children.filter(child => child.id !== id);
    }

    if (node.type === 'folder' && node.children) {
      node.children.forEach(child => this.deleteNode(child.id));
    }

    this.files.delete(id);
    return true;
  }

  renameNode(id: string, newName: string): boolean {
    const node = this.files.get(id);
    if (!node || node.id === 'root') return false;

    const pathParts = node.path.split('/');
    pathParts[pathParts.length - 1] = newName;
    node.name = newName;
    node.path = pathParts.join('/');

    return true;
  }

  getFileTree(): FileNode[] {
    return this.root.children || [];
  }

  getAllFiles(): FileNode[] {
    return Array.from(this.files.values());
  }
}
