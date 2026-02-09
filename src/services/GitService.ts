import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

export interface GitStatus {
    branch: string;
    modified: string[];
    staged: string[];
    untracked: string[];
    ahead: number;
    behind: number;
}

export interface GitFileStatus {
    path: string;
    status: 'modified' | 'added' | 'deleted' | 'untracked' | 'staged';
}

export interface GitCommit {
    oid: string;
    message: string;
    author: string;
    timestamp: number;
}

export interface GitBranch {
    name: string;
    current: boolean;
    commit: string;
}

export class GitService {
    private fs: any;
    private dir: string;

    constructor(fs: any, dir: string) {
        this.fs = fs;
        this.dir = dir;
    }

    /**
     * Initialize a new Git repository
     */
    async init(): Promise<void> {
        try {
            await git.init({
                fs: this.fs,
                dir: this.dir,
                defaultBranch: 'main'
            });
        } catch (error) {
            console.error('Git init failed:', error);
            throw error;
        }
    }

    /**
     * Get current repository status
     */
    async getStatus(): Promise<GitStatus> {
        try {
            const branch = await this.getCurrentBranch();
            const statusMatrix = await git.statusMatrix({
                fs: this.fs,
                dir: this.dir
            });

            const modified: string[] = [];
            const staged: string[] = [];
            const untracked: string[] = [];

            for (const [filepath, headStatus, workdirStatus, stageStatus] of statusMatrix) {
                // Skip .git directory
                if (filepath.startsWith('.git/')) continue;

                // Untracked files
                if (headStatus === 0 && workdirStatus === 2 && stageStatus === 0) {
                    untracked.push(filepath);
                }
                // Modified files
                else if (headStatus === 1 && workdirStatus === 2 && stageStatus === 1) {
                    modified.push(filepath);
                }
                // Staged files
                else if (stageStatus === 2) {
                    staged.push(filepath);
                }
            }

            return {
                branch,
                modified,
                staged,
                untracked,
                ahead: 0, // TODO: Implement remote tracking
                behind: 0
            };
        } catch (error) {
            console.error('Get status failed:', error);
            return {
                branch: 'main',
                modified: [],
                staged: [],
                untracked: [],
                ahead: 0,
                behind: 0
            };
        }
    }

    /**
     * Get file status
     */
    async getFileStatus(filepath: string): Promise<GitFileStatus | null> {
        try {
            const status = await git.status({
                fs: this.fs,
                dir: this.dir,
                filepath
            });

            let fileStatus: GitFileStatus['status'] = 'untracked';

            if (status === 'modified') fileStatus = 'modified';
            else if (status === 'added') fileStatus = 'added';
            else if (status === '*deleted') fileStatus = 'deleted';
            else if (status === '*added') fileStatus = 'staged';

            return {
                path: filepath,
                status: fileStatus
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Stage files for commit
     */
    async add(filepath: string | string[]): Promise<void> {
        try {
            const files = Array.isArray(filepath) ? filepath : [filepath];

            for (const file of files) {
                await git.add({
                    fs: this.fs,
                    dir: this.dir,
                    filepath: file
                });
            }
        } catch (error) {
            console.error('Git add failed:', error);
            throw error;
        }
    }

    /**
     * Unstage files
     */
    async reset(filepath: string): Promise<void> {
        try {
            await git.resetIndex({
                fs: this.fs,
                dir: this.dir,
                filepath
            });
        } catch (error) {
            console.error('Git reset failed:', error);
            throw error;
        }
    }

    /**
     * Unstage all files
     */
    async unstageAll(): Promise<void> {
        try {
            const status = await this.getStatus();
            for (const file of status.staged) {
                await this.reset(file);
            }
        } catch (error) {
            console.error('Git unstage all failed:', error);
            throw error;
        }
    }

    /**
     * Discard changes for a file (checkout)
     */
    async discardChanges(filepath: string): Promise<void> {
        try {
            await git.checkout({
                fs: this.fs,
                dir: this.dir,
                filepaths: [filepath],
                force: true
            });
        } catch (error) {
            console.error('Git discard changes failed:', error);
            throw error;
        }
    }

    /**
     * Commit staged changes
     */
    async commit(message: string, author?: { name: string; email: string }): Promise<string> {
        try {
            const defaultAuthor = {
                name: author?.name || 'HENU User',
                email: author?.email || 'user@henu.dev'
            };

            const sha = await git.commit({
                fs: this.fs,
                dir: this.dir,
                message,
                author: defaultAuthor
            });

            return sha;
        } catch (error) {
            console.error('Git commit failed:', error);
            throw error;
        }
    }

    /**
     * Get commit history
     */
    async log(depth: number = 10): Promise<GitCommit[]> {
        try {
            const commits = await git.log({
                fs: this.fs,
                dir: this.dir,
                depth
            });

            return commits.map(commit => ({
                oid: commit.oid,
                message: commit.commit.message,
                author: commit.commit.author.name,
                timestamp: commit.commit.author.timestamp * 1000
            }));
        } catch (error) {
            console.error('Git log failed:', error);
            return [];
        }
    }

    /**
     * Get current branch name
     */
    async getCurrentBranch(): Promise<string> {
        try {
            const branch = await git.currentBranch({
                fs: this.fs,
                dir: this.dir,
                fullname: false
            });
            return branch || 'main';
        } catch (error) {
            return 'main';
        }
    }

    /**
     * List all branches
     */
    async listBranches(): Promise<GitBranch[]> {
        try {
            const branches = await git.listBranches({
                fs: this.fs,
                dir: this.dir
            });

            const currentBranch = await this.getCurrentBranch();

            return branches.map(name => ({
                name,
                current: name === currentBranch,
                commit: '' // TODO: Get commit SHA
            }));
        } catch (error) {
            console.error('List branches failed:', error);
            return [];
        }
    }

    /**
     * Create a new branch
     */
    async createBranch(name: string, checkout: boolean = true): Promise<void> {
        try {
            await git.branch({
                fs: this.fs,
                dir: this.dir,
                ref: name
            });

            if (checkout) {
                await this.checkout(name);
            }
        } catch (error) {
            console.error('Create branch failed:', error);
            throw error;
        }
    }

    /**
     * Checkout a branch
     */
    async checkout(branch: string): Promise<void> {
        try {
            await git.checkout({
                fs: this.fs,
                dir: this.dir,
                ref: branch
            });
        } catch (error) {
            console.error('Checkout failed:', error);
            throw error;
        }
    }

    /**
     * Delete a branch
     */
    async deleteBranch(name: string): Promise<void> {
        try {
            await git.deleteBranch({
                fs: this.fs,
                dir: this.dir,
                ref: name
            });
        } catch (error) {
            console.error('Delete branch failed:', error);
            throw error;
        }
    }

    /**
     * Push to remote
     */
    async push(remote: string = 'origin', branch?: string): Promise<void> {
        try {
            const currentBranch = branch || await this.getCurrentBranch();

            await git.push({
                fs: this.fs,
                http,
                dir: this.dir,
                remote,
                ref: currentBranch,
                onAuth: () => ({ username: '', password: '' }) // TODO: Implement auth
            });
        } catch (error) {
            console.error('Git push failed:', error);
            throw error;
        }
    }

    /**
     * Pull from remote
     */
    async pull(remote: string = 'origin', branch?: string): Promise<void> {
        try {
            const currentBranch = branch || await this.getCurrentBranch();

            await git.pull({
                fs: this.fs,
                http,
                dir: this.dir,
                remote,
                ref: currentBranch,
                singleBranch: true,
                onAuth: () => ({ username: '', password: '' }) // TODO: Implement auth
            });
        } catch (error) {
            console.error('Git pull failed:', error);
            throw error;
        }
    }

    /**
     * Clone a repository
     */
    async clone(url: string, dir?: string): Promise<void> {
        try {
            await git.clone({
                fs: this.fs,
                http,
                dir: dir || this.dir,
                url,
                singleBranch: true,
                depth: 1
            });
        } catch (error) {
            console.error('Git clone failed:', error);
            throw error;
        }
    }

    /**
     * Get diff for a file
     */
    async diff(filepath: string): Promise<string> {
        try {
            // Get HEAD version
            const headCommit = await git.resolveRef({
                fs: this.fs,
                dir: this.dir,
                ref: 'HEAD'
            });

            const { blob: headBlob } = await git.readBlob({
                fs: this.fs,
                dir: this.dir,
                oid: headCommit,
                filepath
            });

            const headContent = new TextDecoder().decode(headBlob);

            // Get working directory version
            const workdirContent = await this.fs.promises.readFile(
                `${this.dir}/${filepath}`,
                'utf8'
            );

            // Simple diff (you can use a diff library for better formatting)
            return this.generateSimpleDiff(headContent, workdirContent);
        } catch (error) {
            console.error('Git diff failed:', error);
            return '';
        }
    }

    /**
     * Generate simple diff
     */
    private generateSimpleDiff(oldContent: string, newContent: string): string {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');

        let diff = '';
        const maxLines = Math.max(oldLines.length, newLines.length);

        for (let i = 0; i < maxLines; i++) {
            const oldLine = oldLines[i] || '';
            const newLine = newLines[i] || '';

            if (oldLine !== newLine) {
                if (oldLine) diff += `- ${oldLine}\n`;
                if (newLine) diff += `+ ${newLine}\n`;
            } else {
                diff += `  ${oldLine}\n`;
            }
        }

        return diff;
    }

    /**
     * Check if directory is a git repository
     */
    async isRepo(): Promise<boolean> {
        try {
            await git.resolveRef({
                fs: this.fs,
                dir: this.dir,
                ref: 'HEAD'
            });
            return true;
        } catch (error) {
            return false;
        }
    }
}

// Singleton instance
let gitServiceInstance: GitService | null = null;

export const initGitService = (fs: any, dir: string): GitService => {
    gitServiceInstance = new GitService(fs, dir);
    return gitServiceInstance;
};

export const getGitService = (): GitService | null => {
    return gitServiceInstance;
};
