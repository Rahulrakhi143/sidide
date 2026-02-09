// Simple in-memory file system for Git operations
// This is a minimal implementation for demonstration
// In production, you'd want to use LightningFS or BrowserFS

export class SimpleFS {
    private files: Map<string, string | Uint8Array> = new Map();
    private directories: Set<string> = new Set();

    constructor() {
        // Initialize with default directories
        this.addDirectory('/');
        this.addDirectory('/workspace');
    }

    private normalizePath(path: string): string {
        if (!path) return '/';
        // Replace backslashes with forward slashes
        let normalized = path.replace(/\\/g, '/');

        // Ensure it starts with a / if it doesn't look like a drive letter path
        // but isomorphic-git often uses absolute paths provided in 'dir'
        // If it starts with a drive letter, keep it but use forward slashes

        // Remove trailing slash except for root
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }

    private throwError(code: string, path: string, normalized?: string) {
        const error = new Error(`${code}: no such file or directory, ${path}${normalized ? ` (normalized: ${normalized})` : ''}`) as any;
        error.code = code;
        error.path = path;
        throw error;
    }

    private addDirectory(path: string) {
        const normalized = this.normalizePath(path);
        const parts = normalized.split('/');
        let current = '';
        for (const part of parts) {
            if (part === '') {
                if (current === '') current = '/';
                else continue;
            } else {
                // If current is / and part starts, don't double slash
                if (current === '/') current = '/' + part;
                else if (current.includes(':') && !current.includes('/')) current = current + '/' + part; // handle E: -> E:/
                else current += (current ? '/' : '') + part;
            }
            if (current) this.directories.add(current);
        }
    }

    promises = {
        readFile: async (path: string, encoding?: string): Promise<string | Buffer> => {
            const normalized = this.normalizePath(path);
            const content = this.files.get(normalized);
            if (content === undefined) {
                this.throwError('ENOENT', path, normalized);
            }
            return encoding === 'utf8' ? (content as any) : (typeof content === 'string' ? Buffer.from(content) : content as any);
        },

        writeFile: async (path: string, data: any): Promise<void> => {
            const normalized = this.normalizePath(path);
            let content: string | Uint8Array;
            if (typeof data === 'string') {
                content = data;
            } else if (data instanceof Uint8Array) {
                content = data;
            } else {
                content = data.toString();
            }
            this.files.set(normalized, content as any);

            // Ensure parent directories exist
            const lastSlash = normalized.lastIndexOf('/');
            if (lastSlash > 0) {
                this.addDirectory(normalized.substring(0, lastSlash));
            } else if (lastSlash === 0) {
                this.directories.add('/');
            }
        },

        unlink: async (path: string): Promise<void> => {
            this.files.delete(path);
        },

        readdir: async (path: string): Promise<string[]> => {
            const normalized = this.normalizePath(path);
            const prefix = normalized === '/' ? '/' : `${normalized}/`;
            const entries = new Set<string>();

            // Add files
            for (const f of this.files.keys()) {
                if (f.startsWith(prefix)) {
                    const rest = f.substring(prefix.length);
                    const firstPart = rest.split('/')[0];
                    if (firstPart) entries.add(firstPart);
                }
            }

            // Add directories
            for (const d of this.directories) {
                if (d.startsWith(prefix) && d !== normalized) {
                    const rest = d.substring(prefix.length);
                    const firstPart = rest.split('/')[0];
                    if (firstPart) entries.add(firstPart);
                }
            }

            return Array.from(entries);
        },

        mkdir: async (path: string, options?: { recursive?: boolean }): Promise<void> => {
            const normalized = this.normalizePath(path);
            if (options?.recursive) {
                this.addDirectory(normalized);
            } else {
                this.directories.add(normalized);
                // Also ensure parent exists
                const lastSlash = normalized.lastIndexOf('/');
                if (lastSlash > 0) {
                    this.addDirectory(normalized.substring(0, lastSlash));
                }
            }
        },

        rmdir: async (path: string): Promise<void> => {
            // Remove all files in directory
            const prefix = path.endsWith('/') ? path : `${path}/`;
            const toDelete = Array.from(this.files.keys()).filter(f => f.startsWith(prefix));
            toDelete.forEach(f => this.files.delete(f));
        },

        stat: async (path: string): Promise<any> => {
            const normalized = this.normalizePath(path);
            const now = Date.now();

            // Check if it's a file
            const fileContent = this.files.get(normalized);
            if (fileContent !== undefined) {
                return {
                    isDirectory: () => false,
                    isFile: () => true,
                    isSymbolicLink: () => false,
                    size: typeof fileContent === 'string' ? fileContent.length : (fileContent as any).length || 0,
                    mtimeMs: now,
                    ctimeMs: now,
                    birthtimeMs: now,
                    mode: 0o644
                };
            }

            // Check if it's a directory
            if (this.directories.has(normalized)) {
                return {
                    isDirectory: () => true,
                    isFile: () => false,
                    isSymbolicLink: () => false,
                    size: 0,
                    mtimeMs: now,
                    ctimeMs: now,
                    birthtimeMs: now,
                    mode: 0o755
                };
            }

            // Check if any files/dirs have this as prefix
            const prefix = normalized === '/' ? '/' : `${normalized}/`;
            const hasChildren = Array.from(this.files.keys()).some(f => f.startsWith(prefix)) ||
                Array.from(this.directories).some(d => d.startsWith(prefix) && d !== normalized);

            if (hasChildren) {
                this.directories.add(normalized);
                return {
                    isDirectory: () => true,
                    isFile: () => false,
                    isSymbolicLink: () => false,
                    size: 0,
                    mtimeMs: now,
                    ctimeMs: now,
                    birthtimeMs: now,
                    mode: 0o755
                };
            }

            this.throwError('ENOENT', path, normalized);
        },

        lstat: async (path: string): Promise<any> => {
            return this.promises.stat(path);
        },

        readlink: async (_path: string): Promise<string> => {
            throw new Error('Symlinks not supported');
        },

        symlink: async (_target: string, _path: string): Promise<void> => {
            throw new Error('Symlinks not supported');
        },

        chmod: async (_path: string, _mode: number): Promise<void> => {
            // No-op
        },
    };

    // Synchronous methods (for compatibility)
    readFileSync(path: string, encoding?: string): string | Buffer {
        const normalized = this.normalizePath(path);
        const content = this.files.get(normalized);
        if (content === undefined) {
            this.throwError('ENOENT', path, normalized);
        }
        return encoding === 'utf8' ? (content as any) : (typeof content === 'string' ? Buffer.from(content) : content as any);
    }

    writeFileSync(path: string, data: any): void {
        const normalized = this.normalizePath(path);
        let content: string | Uint8Array;
        if (typeof data === 'string') {
            content = data;
        } else if (data instanceof Uint8Array) {
            content = data;
        } else {
            content = data.toString();
        }
        this.files.set(normalized, content as any);

        // Ensure parent directories exist
        const lastSlash = normalized.lastIndexOf('/');
        if (lastSlash > 0) {
            this.addDirectory(normalized.substring(0, lastSlash));
        } else if (lastSlash === 0) {
            this.directories.add('/');
        }
    }

    existsSync(path: string): boolean {
        const normalized = this.normalizePath(path);
        return this.files.has(normalized) || this.directories.has(normalized);
    }

    readdirSync(path: string): string[] {
        const normalized = this.normalizePath(path);
        const prefix = normalized === '/' ? '/' : `${normalized}/`;
        const entries = new Set<string>();

        // Add files
        for (const f of this.files.keys()) {
            if (f.startsWith(prefix)) {
                const rest = f.substring(prefix.length);
                const firstPart = rest.split('/')[0];
                if (firstPart) entries.add(firstPart);
            }
        }

        // Add directories
        for (const d of this.directories) {
            if (d.startsWith(prefix) && d !== normalized) {
                const rest = d.substring(prefix.length);
                const firstPart = rest.split('/')[0];
                if (firstPart) entries.add(firstPart);
            }
        }

        return Array.from(entries);
    }

    statSync(path: string): any {
        const normalized = this.normalizePath(path);
        const now = Date.now();

        const fileContent = this.files.get(normalized);
        if (fileContent !== undefined) {
            return {
                isDirectory: () => false,
                isFile: () => true,
                isSymbolicLink: () => false,
                size: typeof fileContent === 'string' ? fileContent.length : (fileContent as any).length || 0,
                mtimeMs: now,
                ctimeMs: now,
                birthtimeMs: now,
                mode: 0o644
            };
        }

        if (this.directories.has(normalized)) {
            return {
                isDirectory: () => true,
                isFile: () => false,
                isSymbolicLink: () => false,
                size: 0,
                mtimeMs: now,
                ctimeMs: now,
                birthtimeMs: now,
                mode: 0o755
            };
        }

        const prefix = normalized === '/' ? '/' : `${normalized}/`;
        const hasChildren = Array.from(this.files.keys()).some(f => f.startsWith(prefix)) ||
            Array.from(this.directories).some(d => d.startsWith(prefix) && d !== normalized);

        if (hasChildren) {
            this.directories.add(normalized);
            return {
                isDirectory: () => true,
                isFile: () => false,
                isSymbolicLink: () => false,
                size: 0,
                mtimeMs: now,
                ctimeMs: now,
                birthtimeMs: now,
                mode: 0o755
            };
        }

        this.throwError('ENOENT', path, normalized);
    }

    lstatSync(path: string): any {
        return this.statSync(path);
    }

    mkdirSync(path: string, options?: { recursive?: boolean }): void {
        const normalized = this.normalizePath(path);
        if (options?.recursive) {
            this.addDirectory(normalized);
        } else {
            this.directories.add(normalized);
            const lastSlash = normalized.lastIndexOf('/');
            if (lastSlash > 0) {
                this.addDirectory(normalized.substring(0, lastSlash));
            }
        }
    }

    rmdirSync(path: string): void {
        const normalized = this.normalizePath(path);
        const prefix = normalized === '/' ? '/' : `${normalized}/`;
        const toDelete = Array.from(this.files.keys()).filter(f => f.startsWith(prefix));
        toDelete.forEach(f => this.files.delete(f));
        this.directories.delete(normalized);
    }

    unlinkSync(path: string): void {
        const normalized = this.normalizePath(path);
        this.files.delete(normalized);
    }
}

// Singleton instance
let fsInstance: SimpleFS | null = null;

export const getSimpleFS = (): SimpleFS => {
    if (!fsInstance) {
        fsInstance = new SimpleFS();
    }
    return fsInstance;
};
