import { useState } from 'react';
import {
    FolderOpen,
    GitBranch,
    Clock,
    Plus,
    Folder,
    ExternalLink,
    Sparkles,
    Code2,
    Terminal,
    Zap,
    ChevronRight,
    X,
    RefreshCw,
    Loader
} from 'lucide-react';
import { NewProjectDialog } from './NewProjectDialog';

// Electron API (exposed via preload.js with context isolation)
const electronAPI = (window as any).electronAPI;

interface WelcomeScreenProps {
    onOpenFolder: (folder: { name: string; path: string; fileSystem?: any[] }) => void;
    onCloneRepo: (url: string, name: string) => void;
}

interface RecentProject {
    name: string;
    path: string;
    lastOpened: Date;
}

export const WelcomeScreen = ({ onOpenFolder, onCloneRepo }: WelcomeScreenProps) => {
    const [showCloneDialog, setShowCloneDialog] = useState(false);
    const [cloneUrl, setCloneUrl] = useState('');
    const [cloneName, setCloneName] = useState('');
    const [isCloning, setIsCloning] = useState(false);
    const [isOpeningFolder, setIsOpeningFolder] = useState(false);
    const [showNewProject, setShowNewProject] = useState(false);

    // Mock recent projects (in a real app, these would come from localStorage or a database)
    const [recentProjects] = useState<RecentProject[]>([
        { name: 'my-react-app', path: '/home/user/projects/my-react-app', lastOpened: new Date(Date.now() - 86400000) },
        { name: 'portfolio-website', path: '/home/user/projects/portfolio', lastOpened: new Date(Date.now() - 172800000) },
        { name: 'api-server', path: '/home/user/projects/api-server', lastOpened: new Date(Date.now() - 259200000) },
    ]);

    const handleOpenFolder = async () => {
        console.log('handleOpenFolder called');
        console.log('electronAPI available:', !!electronAPI);

        if (!electronAPI) {
            // Fallback for non-Electron environment
            console.warn('Not running in Electron, using demo folder');
            onOpenFolder({
                name: 'demo-project',
                path: '/home/user/demo-project'
            });
            return;
        }

        setIsOpeningFolder(true);

        try {
            console.log('Invoking open-folder-dialog...');
            // Open native folder dialog via Electron API
            const result = await electronAPI.openFolderDialog();
            console.log('Dialog result:', result);

            if (result) {
                // Folder was selected
                console.log('Opening folder:', result.name, 'at', result.path);
                onOpenFolder({
                    name: result.name,
                    path: result.path,
                    fileSystem: result.fileSystem
                });
            } else {
                console.log('Dialog was cancelled');
            }
        } catch (error) {
            console.error('Error opening folder:', error);
            alert('Error opening folder: ' + (error as Error).message);
        } finally {
            setIsOpeningFolder(false);
        }
    };

    const handleClone = async () => {
        if (!cloneUrl.trim()) return;

        setIsCloning(true);

        // Extract repo name from URL
        const repoName = cloneName || cloneUrl.split('/').pop()?.replace('.git', '') || 'cloned-repo';

        // Simulate cloning delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        onCloneRepo(cloneUrl, repoName);
        setIsCloning(false);
        setShowCloneDialog(false);
    };

    const formatDate = (date: Date) => {
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center p-8">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-900/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-conic from-red-900/5 via-transparent to-red-900/5 rounded-full blur-2xl"></div>
            </div>

            <div className="relative z-10 max-w-5xl w-full">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="flex items-center justify-center space-x-4 mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-800 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/30">
                            <Code2 size={36} className="text-white" />
                        </div>
                    </div>
                    <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
                        Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">HENU IDE</span>
                    </h1>
                    <p className="text-gray-400 text-lg">
                        The next-generation cloud IDE with AI-powered assistance
                    </p>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Actions */}
                    <div className="space-y-4">
                        <h2 className="text-gray-400 text-sm font-mono uppercase tracking-wider mb-4">Start</h2>

                        {/* Open Folder */}
                        <button
                            onClick={handleOpenFolder}
                            disabled={isOpeningFolder}
                            className="w-full group flex items-center p-5 bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800 hover:border-red-900/50 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-red-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                                {isOpeningFolder ? (
                                    <Loader size={24} className="text-white animate-spin" />
                                ) : (
                                    <FolderOpen size={24} className="text-white" />
                                )}
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-white font-medium text-lg">
                                    {isOpeningFolder ? 'Opening...' : 'Open Folder'}
                                </div>
                                <div className="text-gray-500 text-sm">Browse for a folder on your computer</div>
                            </div>
                            <ChevronRight size={20} className="text-gray-600 group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
                        </button>

                        {/* Clone Repository */}
                        <button
                            onClick={() => setShowCloneDialog(true)}
                            className="w-full group flex items-center p-5 bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800 hover:border-red-900/50 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-red-900/10"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-800 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                                <GitBranch size={24} className="text-white" />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-white font-medium text-lg">Clone Repository</div>
                                <div className="text-gray-500 text-sm">Clone a repository from GitHub, GitLab, etc.</div>
                            </div>
                            <ChevronRight size={20} className="text-gray-600 group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
                        </button>

                        {/* Create New Project */}
                        <button
                            onClick={() => setShowNewProject(true)}
                            className="w-full group flex items-center p-5 bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800 hover:border-red-900/50 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-red-900/10"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                                <Plus size={24} className="text-white" />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-white font-medium text-lg">New Project</div>
                                <div className="text-gray-500 text-sm">Create a new project on your computer</div>
                            </div>
                            <ChevronRight size={20} className="text-gray-600 group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
                        </button>
                    </div>

                    {/* Right Column - Recent Projects */}
                    <div>
                        <h2 className="text-gray-400 text-sm font-mono uppercase tracking-wider mb-4 flex items-center">
                            <Clock size={14} className="mr-2" />
                            Recent Projects
                        </h2>

                        <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
                            {recentProjects.length > 0 ? (
                                <div className="divide-y divide-gray-800">
                                    {recentProjects.map((project, index) => (
                                        <button
                                            key={index}
                                            onClick={() => onOpenFolder({ name: project.name, path: project.path })}
                                            className="w-full group flex items-center p-4 hover:bg-gray-800/50 transition-all duration-200"
                                        >
                                            <Folder size={20} className="text-gray-500 mr-3 flex-shrink-0 group-hover:text-red-400" />
                                            <div className="flex-1 text-left min-w-0">
                                                <div className="text-gray-300 font-mono text-sm truncate group-hover:text-white">
                                                    {project.name}
                                                </div>
                                                <div className="text-gray-600 text-xs truncate">
                                                    {project.path}
                                                </div>
                                            </div>
                                            <div className="text-gray-600 text-xs ml-3 flex-shrink-0">
                                                {formatDate(project.lastOpened)}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-600">
                                    <Clock size={32} className="mx-auto mb-3 opacity-50" />
                                    <div className="text-sm">No recent projects</div>
                                </div>
                            )}
                        </div>

                        {/* Quick Links */}
                        <div className="mt-6 grid grid-cols-3 gap-3">
                            <a
                                href="#"
                                className="flex flex-col items-center p-4 bg-gray-900/30 hover:bg-gray-800/50 border border-gray-800 rounded-lg transition-all group"
                            >
                                <Sparkles size={20} className="text-yellow-500 mb-2 group-hover:scale-110 transition-transform" />
                                <span className="text-gray-400 text-xs">AI Assistant</span>
                            </a>
                            <a
                                href="#"
                                className="flex flex-col items-center p-4 bg-gray-900/30 hover:bg-gray-800/50 border border-gray-800 rounded-lg transition-all group"
                            >
                                <Terminal size={20} className="text-green-500 mb-2 group-hover:scale-110 transition-transform" />
                                <span className="text-gray-400 text-xs">Terminal</span>
                            </a>
                            <a
                                href="#"
                                className="flex flex-col items-center p-4 bg-gray-900/30 hover:bg-gray-800/50 border border-gray-800 rounded-lg transition-all group"
                            >
                                <Zap size={20} className="text-purple-500 mb-2 group-hover:scale-110 transition-transform" />
                                <span className="text-gray-400 text-xs">Extensions</span>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center">
                    <div className="flex items-center justify-center space-x-6 text-gray-600 text-sm">
                        <a href="#" className="hover:text-gray-400 transition-colors flex items-center">
                            <ExternalLink size={14} className="mr-1" />
                            Documentation
                        </a>
                        <span>•</span>
                        <a href="#" className="hover:text-gray-400 transition-colors flex items-center">
                            <ExternalLink size={14} className="mr-1" />
                            GitHub
                        </a>
                        <span>•</span>
                        <span className="text-gray-700">v2.3.0</span>
                    </div>
                </div>
            </div>

            {/* Clone Repository Dialog */}
            {showCloneDialog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-800 rounded-lg flex items-center justify-center">
                                    <GitBranch size={20} className="text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Clone Repository</h3>
                            </div>
                            <button
                                onClick={() => setShowCloneDialog(false)}
                                className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-gray-400 text-sm font-mono mb-2">
                                    Repository URL
                                </label>
                                <input
                                    type="text"
                                    value={cloneUrl}
                                    onChange={(e) => setCloneUrl(e.target.value)}
                                    placeholder="https://github.com/user/repo.git"
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-red-500 placeholder:text-gray-600"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm font-mono mb-2">
                                    Project Name <span className="text-gray-600">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={cloneName}
                                    onChange={(e) => setCloneName(e.target.value)}
                                    placeholder="my-project"
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-red-500 placeholder:text-gray-600"
                                />
                            </div>

                            <div className="bg-gray-950/50 rounded-lg p-4 border border-gray-800">
                                <div className="text-xs text-gray-500 font-mono">
                                    Will be cloned to: <span className="text-gray-400">/home/user/projects/{cloneName || 'repo-name'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
                            <button
                                onClick={() => setShowCloneDialog(false)}
                                className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-mono text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClone}
                                disabled={!cloneUrl.trim() || isCloning}
                                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-lg font-mono text-sm transition-all flex items-center space-x-2"
                            >
                                {isCloning ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        <span>Cloning...</span>
                                    </>
                                ) : (
                                    <>
                                        <GitBranch size={16} />
                                        <span>Clone</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Project Dialog */}
            <NewProjectDialog
                isOpen={showNewProject}
                onClose={() => setShowNewProject(false)}
                onProjectCreated={(project) => {
                    onOpenFolder({
                        name: project.name,
                        path: project.path,
                        fileSystem: project.fileSystem
                    });
                }}
            />
        </div>
    );
};
