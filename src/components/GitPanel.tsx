import { useState, useEffect } from 'react';
import {
    GitBranch as GitBranchIcon,
    GitCommit,
    Plus,
    Check,
    X,
    RefreshCw,
    Upload,
    Download,
    Clock,
    User,
    FileText,
    RotateCcw,
    Undo2,
    Search,
    Trash2
} from 'lucide-react';
import { getGitService, GitStatus, GitCommit as GitCommitType, GitBranch } from '../services/GitService';

export const GitPanel = () => {
    const [status, setStatus] = useState<GitStatus | null>(null);
    const [commits, setCommits] = useState<GitCommitType[]>([]);
    const [branches, setBranches] = useState<GitBranch[]>([]);
    const [commitMessage, setCommitMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRepo, setIsRepo] = useState<boolean | null>(null);
    const [showBranchDialog, setShowBranchDialog] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');
    const [activeTab, setActiveTab] = useState<'changes' | 'commits' | 'branches'>('changes');
    const [selectedDiff, setSelectedDiff] = useState<{ path: string, content: string } | null>(null);

    const gitService = getGitService();

    useEffect(() => {
        loadGitData();
    }, []);

    const loadGitData = async () => {
        if (!gitService) {
            setIsRepo(false);
            return;
        }

        setIsLoading(true);
        try {
            const hasRepo = await gitService.isRepo();
            setIsRepo(hasRepo);

            if (hasRepo) {
                const [statusData, commitsData, branchesData] = await Promise.all([
                    gitService.getStatus(),
                    gitService.log(20),
                    gitService.listBranches()
                ]);

                setStatus(statusData);
                setCommits(commitsData);
                setBranches(branchesData);
            }
        } catch (error) {
            console.error('Failed to load git data:', error);
            setIsRepo(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInit = async () => {
        if (!gitService) return;
        setIsLoading(true);
        try {
            await gitService.init();
            await loadGitData();
            showToast('Repository initialized', 'success');
        } catch (error) {
            showToast('Failed to initialize repository', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleShowDiff = async (filepath: string) => {
        if (!gitService) return;
        try {
            const diff = await gitService.diff(filepath);
            setSelectedDiff({ path: filepath, content: diff });
        } catch (error) {
            showToast('Failed to load diff', 'error');
        }
    };

    const handleStageFile = async (filepath: string) => {
        if (!gitService) return;

        try {
            await gitService.add(filepath);
            await loadGitData();
            showToast('File staged', 'success');
            window.dispatchEvent(new CustomEvent('git-changed'));
        } catch (error) {
            showToast('Failed to stage file', 'error');
        }
    };

    const handleUnstageFile = async (filepath: string) => {
        if (!gitService) return;

        try {
            await gitService.reset(filepath);
            await loadGitData();
            showToast('File unstaged', 'success');
            window.dispatchEvent(new CustomEvent('git-changed'));
        } catch (error) {
            showToast('Failed to unstage file', 'error');
        }
    };

    const handleUnstageAll = async () => {
        if (!gitService) return;

        try {
            await gitService.unstageAll();
            await loadGitData();
            showToast('All files unstaged', 'success');
        } catch (error) {
            showToast('Failed to unstage all', 'error');
        }
    };

    const handleDiscardChanges = async (filepath: string) => {
        if (!gitService) return;

        if (!confirm(`Are you sure you want to discard changes in ${filepath}? This cannot be undone.`)) return;

        try {
            await gitService.discardChanges(filepath);
            await loadGitData();
            showToast('Changes discarded', 'success');
            window.dispatchEvent(new CustomEvent('git-changed'));
        } catch (error) {
            showToast('Failed to discard changes', 'error');
        }
    };

    const handleStageAll = async () => {
        if (!gitService || !status) return;

        try {
            const allFiles = [...status.modified, ...status.untracked];
            await gitService.add(allFiles);
            await loadGitData();
            showToast('All files staged', 'success');
            window.dispatchEvent(new CustomEvent('git-changed'));
        } catch (error) {
            showToast('Failed to stage files', 'error');
        }
    };

    const handleCommit = async () => {
        if (!gitService || !commitMessage.trim()) return;

        try {
            await gitService.commit(commitMessage);
            setCommitMessage('');
            await loadGitData();
            showToast('Changes committed', 'success');
            window.dispatchEvent(new CustomEvent('git-changed'));
        } catch (error) {
            showToast('Failed to commit', 'error');
        }
    };

    const handlePush = async () => {
        if (!gitService) return;

        try {
            await gitService.push();
            await loadGitData();
            showToast('Pushed to remote', 'success');
        } catch (error) {
            showToast('Failed to push', 'error');
        }
    };

    const handlePull = async () => {
        if (!gitService) return;

        setIsLoading(true);
        try {
            await gitService.pull();
            await loadGitData();
            showToast('Pulled from remote', 'success');
        } catch (error: any) {
            showToast(`Pull failed: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async () => {
        if (!gitService) return;

        setIsLoading(true);
        try {
            showToast('Syncing changes...', 'success');
            await gitService.pull();
            await gitService.push();
            await loadGitData();
            showToast('Repository synced successfully', 'success');
        } catch (error: any) {
            showToast(`Sync failed: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateBranch = async () => {
        if (!gitService || !newBranchName.trim()) return;

        try {
            await gitService.createBranch(newBranchName, true);
            setNewBranchName('');
            setShowBranchDialog(false);
            await loadGitData();
            showToast(`Branch '${newBranchName}' created`, 'success');
        } catch (error) {
            showToast('Failed to create branch', 'error');
        }
    };

    const handleCheckoutBranch = async (branchName: string) => {
        if (!gitService) return;

        try {
            await gitService.checkout(branchName);
            await loadGitData();
            showToast(`Switched to '${branchName}'`, 'success');
        } catch (error) {
            showToast('Failed to checkout branch', 'error');
        }
    };

    const handleDeleteBranch = async (branchName: string) => {
        if (!gitService) return;

        if (!confirm(`Are you sure you want to delete branch '${branchName}'?`)) return;

        try {
            await gitService.deleteBranch(branchName);
            await loadGitData();
            showToast(`Branch '${branchName}' deleted`, 'success');
        } catch (error) {
            showToast('Failed to delete branch', 'error');
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 px-4 py-2 rounded text-sm z-50 ${type === 'success' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
            }`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    if (isRepo === false) {
        return (
            <div className="h-full flex items-center justify-center bg-gradient-to-b from-gray-900/90 to-black/90 p-4">
                <div className="text-center text-gray-500">
                    <GitBranchIcon size={64} className="mx-auto mb-4 opacity-20" />
                    <div className="font-mono text-lg mb-2">Git Not Initialized</div>
                    <div className="text-sm text-gray-600 max-w-md mx-auto mb-4">
                        Initialize a Git repository to start tracking changes
                    </div>
                    <button
                        onClick={handleInit}
                        disabled={isLoading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white rounded font-mono text-sm flex items-center space-x-2 mx-auto"
                    >
                        {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                        <span>Initialize Repository</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gradient-to-b from-gray-900/90 to-black/90">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900/90">
                <div className="flex items-center space-x-3">
                    <GitBranchIcon size={20} className="text-red-400" />
                    <span className="text-gray-300 font-mono text-sm">
                        {status?.branch || 'main'}
                    </span>
                    {status && (status.ahead > 0 || status.behind > 0) && (
                        <span className="text-xs text-gray-500">
                            ↑{status.ahead} ↓{status.behind}
                        </span>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={handlePull}
                        className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-blue-400"
                        title="Pull"
                    >
                        <Download size={16} />
                    </button>
                    <button
                        onClick={handlePush}
                        className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-green-400"
                        title="Push"
                    >
                        <Upload size={16} />
                    </button>
                    <button
                        onClick={handleSync}
                        className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-purple-400"
                        title="Sync (Pull & Push)"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={loadGitData}
                        className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-300"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 bg-gray-900/50">
                {(['changes', 'commits', 'branches'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-mono capitalize ${activeTab === tab
                            ? 'text-red-400 border-b-2 border-red-500'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
                {activeTab === 'changes' && (
                    <div className="space-y-4">
                        {/* Commit Message */}
                        {status && status.staged.length > 0 && (
                            <div className="space-y-2">
                                <textarea
                                    value={commitMessage}
                                    onChange={(e) => setCommitMessage(e.target.value)}
                                    placeholder="Commit message..."
                                    className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-gray-300 font-mono text-sm focus:outline-none focus:border-red-500 resize-none"
                                    rows={3}
                                />
                                <button
                                    onClick={handleCommit}
                                    disabled={!commitMessage.trim()}
                                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded font-mono text-sm flex items-center justify-center space-x-2"
                                >
                                    <GitCommit size={16} />
                                    <span>Commit</span>
                                </button>
                            </div>
                        )}

                        {/* Staged Changes */}
                        {status && status.staged.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm text-gray-400 font-mono">
                                        Staged Changes ({status.staged.length})
                                    </div>
                                    <button
                                        onClick={handleUnstageAll}
                                        className="text-xs text-red-400 hover:text-red-300 font-mono flex items-center space-x-1"
                                    >
                                        <Undo2 size={12} />
                                        <span>Unstage All</span>
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {status.staged.map((file) => (
                                        <div
                                            key={file}
                                            className="flex items-center justify-between p-2 bg-gray-900/50 rounded hover:bg-gray-900 group"
                                        >
                                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                <Check size={14} className="text-green-400 flex-shrink-0" />
                                                <span className="text-gray-300 font-mono text-xs truncate">{file}</span>
                                            </div>
                                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleUnstageFile(file)}
                                                    className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400"
                                                    title="Unstage"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Modified Files */}
                        {status && status.modified.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm text-gray-400 font-mono">
                                        Modified ({status.modified.length})
                                    </div>
                                    <button
                                        onClick={handleStageAll}
                                        className="text-xs text-red-400 hover:text-red-300 font-mono"
                                    >
                                        Stage All
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {status.modified.map((file) => (
                                        <div
                                            key={file}
                                            className="flex items-center justify-between p-2 bg-gray-900/50 rounded hover:bg-gray-900 group"
                                        >
                                            <div
                                                className="flex items-center space-x-2 flex-1 min-w-0 cursor-pointer"
                                                onClick={() => handleShowDiff(file)}
                                            >
                                                <FileText size={14} className="text-yellow-400 flex-shrink-0" />
                                                <span className="text-gray-300 font-mono text-xs truncate">{file}</span>
                                            </div>
                                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleShowDiff(file); }}
                                                    className="p-1 hover:bg-gray-800 rounded text-gray-400"
                                                    title="View Diff"
                                                >
                                                    <Search size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDiscardChanges(file); }}
                                                    className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400"
                                                    title="Discard Changes"
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleStageFile(file); }}
                                                    className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-green-400"
                                                    title="Stage"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Untracked Files */}
                        {status && status.untracked.length > 0 && (
                            <div>
                                <div className="text-sm text-gray-400 font-mono mb-2">
                                    Untracked ({status.untracked.length})
                                </div>
                                <div className="space-y-1">
                                    {status.untracked.map((file) => (
                                        <div
                                            key={file}
                                            className="flex items-center justify-between p-2 bg-gray-900/50 rounded hover:bg-gray-900"
                                        >
                                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                <FileText size={14} className="text-gray-500 flex-shrink-0" />
                                                <span className="text-gray-400 font-mono text-xs truncate">{file}</span>
                                            </div>
                                            <button
                                                onClick={() => handleStageFile(file)}
                                                className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-green-400"
                                                title="Stage"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {status && status.modified.length === 0 && status.staged.length === 0 && status.untracked.length === 0 && (
                            <div className="text-center text-gray-600 py-8">
                                <Check size={48} className="mx-auto mb-2 opacity-20" />
                                <div className="font-mono text-sm">No changes</div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'commits' && (
                    <div className="space-y-2">
                        {commits.map((commit) => (
                            <div
                                key={commit.oid}
                                className="p-3 bg-gray-900/50 rounded hover:bg-gray-900 border border-gray-800"
                            >
                                <div className="flex items-start justify-between mb-1">
                                    <div className="text-gray-300 font-mono text-sm flex-1">{commit.message}</div>
                                </div>
                                <div className="flex items-center space-x-4 text-xs text-gray-500 font-mono">
                                    <div className="flex items-center space-x-1">
                                        <User size={12} />
                                        <span>{commit.author}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <Clock size={12} />
                                        <span>{new Date(commit.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-gray-600">{commit.oid.substring(0, 7)}</div>
                                </div>
                            </div>
                        ))}
                        {commits.length === 0 && (
                            <div className="text-center text-gray-600 py-8">
                                <GitCommit size={48} className="mx-auto mb-2 opacity-20" />
                                <div className="font-mono text-sm">No commits yet</div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'branches' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => setShowBranchDialog(true)}
                            className="w-full px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 rounded font-mono text-sm flex items-center justify-center space-x-2"
                        >
                            <Plus size={16} />
                            <span>New Branch</span>
                        </button>

                        <div className="space-y-1">
                            {branches.map((branch) => (
                                <div
                                    key={branch.name}
                                    className={`flex items-center justify-between p-3 rounded ${branch.current
                                        ? 'bg-red-900/20 border border-red-900/30'
                                        : 'bg-gray-900/50 hover:bg-gray-900'
                                        }`}
                                >
                                    <div className="flex items-center space-x-2">
                                        <GitBranchIcon
                                            size={16}
                                            className={branch.current ? 'text-red-400' : 'text-gray-500'}
                                        />
                                        <span className={`font-mono text-sm ${branch.current ? 'text-red-400' : 'text-gray-300'
                                            }`}>
                                            {branch.name}
                                        </span>
                                        {branch.current && (
                                            <span className="text-xs text-gray-500">(current)</span>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {!branch.current && (
                                            <>
                                                <button
                                                    onClick={() => handleCheckoutBranch(branch.name)}
                                                    className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-blue-400 font-mono text-xs"
                                                    title="Checkout"
                                                >
                                                    Checkout
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteBranch(branch.name)}
                                                    className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400"
                                                    title="Delete Branch"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* New Branch Dialog */}
            {showBranchDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-96">
                        <h3 className="text-lg font-mono text-gray-300 mb-4">Create New Branch</h3>
                        <input
                            type="text"
                            value={newBranchName}
                            onChange={(e) => setNewBranchName(e.target.value)}
                            placeholder="Branch name..."
                            className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-gray-300 font-mono text-sm focus:outline-none focus:border-red-500 mb-4"
                            autoFocus
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={handleCreateBranch}
                                disabled={!newBranchName.trim()}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded font-mono text-sm"
                            >
                                Create
                            </button>
                            <button
                                onClick={() => {
                                    setShowBranchDialog(false);
                                    setNewBranchName('');
                                }}
                                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-mono text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Diff Overlay */}
            {selectedDiff && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-8">
                    <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-4xl h-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
                            <div className="flex items-center space-x-3">
                                <FileText size={18} className="text-yellow-400" />
                                <span className="text-gray-200 font-mono text-sm font-semibold">{selectedDiff.path}</span>
                            </div>
                            <button
                                onClick={() => setSelectedDiff(null)}
                                className="p-2 hover:bg-gray-800 rounded-full text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 font-mono text-sm bg-gray-950">
                            {selectedDiff.content.split('\n').map((line, i) => {
                                let bgColor = '';
                                let textColor = 'text-gray-400';
                                if (line.startsWith('+')) {
                                    bgColor = 'bg-green-900/20';
                                    textColor = 'text-green-400';
                                } else if (line.startsWith('-')) {
                                    bgColor = 'bg-red-900/20';
                                    textColor = 'text-red-400';
                                } else if (line.startsWith(' ')) {
                                    textColor = 'text-gray-500';
                                }

                                return (
                                    <div key={i} className={`whitespace-pre px-4 py-0.5 rounded ${bgColor} ${textColor}`}>
                                        <span className="w-8 inline-block opacity-30 select-none text-right mr-4">{i + 1}</span>
                                        {line}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/50 flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    handleDiscardChanges(selectedDiff.path);
                                    setSelectedDiff(null);
                                }}
                                className="px-4 py-2 bg-gray-800 hover:bg-red-900/40 text-gray-300 hover:text-red-300 rounded font-mono text-xs transition-all"
                            >
                                Discard Changes
                            </button>
                            <button
                                onClick={() => {
                                    handleStageFile(selectedDiff.path);
                                    setSelectedDiff(null);
                                }}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-mono text-xs transition-all"
                            >
                                Stage Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
