import { useState, useRef, useEffect } from 'react';
import { X, FolderPlus, Loader2 } from 'lucide-react';

// Electron API (exposed via preload.js with context isolation)
const electronAPI = (window as any).electronAPI;

interface NewProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectCreated: (project: { name: string; path: string; fileSystem: any[] }) => void;
}

const projectTemplates = [
    { id: 'blank', name: 'Blank Project', description: 'Empty project with basic structure', icon: '📁' },
    { id: 'html', name: 'Web App (HTML/CSS/JS)', description: 'Simple web application', icon: '🌐' },
    { id: 'react', name: 'React App', description: 'React with Vite (npm required)', icon: '⚛️' },
    { id: 'node', name: 'Node.js Project', description: 'Node.js application', icon: '🟢' },
];

export const NewProjectDialog = ({ isOpen, onClose, onProjectCreated }: NewProjectDialogProps) => {
    const [projectName, setProjectName] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('html');
    const [error, setError] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setProjectName('');
            setError('');
            setIsCreating(false);
            setSelectedTemplate('html');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!projectName.trim()) {
            setError('Please enter a project name');
            return;
        }

        // Validate project name
        const invalidChars = /[<>:"/\\|?*]/;
        if (invalidChars.test(projectName)) {
            setError('Project name contains invalid characters');
            return;
        }

        if (!electronAPI) {
            setError('Electron API not available - run with npm run electron:dev');
            return;
        }

        setIsCreating(true);
        setError('');

        try {
            const result = await electronAPI.createProject(projectName.trim());

            if (result.success) {
                onProjectCreated({
                    name: result.name,
                    path: result.path,
                    fileSystem: result.fileSystem
                });
                onClose();
            } else if (result.canceled) {
                setIsCreating(false);
            } else {
                setError(result.error || 'Failed to create project');
                setIsCreating(false);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create project');
            setIsCreating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-[600px] max-w-[90vw] bg-theme-primary border border-theme rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-theme bg-gradient-to-r from-theme-accent/10 to-transparent">
                    <div className="flex items-center space-x-3">
                        <FolderPlus size={24} className="text-theme-accent" />
                        <div>
                            <h2 className="font-bold text-lg text-theme">Create New Project</h2>
                            <p className="text-xs text-gray-500">Set up a new project on your computer</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isCreating}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6">
                    {/* Project Name */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-theme mb-2">
                            Project Name
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={projectName}
                            onChange={(e) => {
                                setProjectName(e.target.value);
                                setError('');
                            }}
                            placeholder="my-awesome-project"
                            disabled={isCreating}
                            className="w-full bg-theme-secondary border border-theme rounded-lg px-4 py-3 text-theme focus:outline-none focus:ring-2 focus:ring-theme-accent/50 focus:border-theme-accent placeholder-gray-500 disabled:opacity-50"
                            autoFocus
                        />
                        {error && (
                            <p className="text-red-400 text-sm mt-2 flex items-center space-x-1">
                                <span>⚠️</span>
                                <span>{error}</span>
                            </p>
                        )}
                    </div>

                    {/* Template Selection */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-theme mb-2">
                            Project Template
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {projectTemplates.map((template) => (
                                <button
                                    key={template.id}
                                    type="button"
                                    onClick={() => setSelectedTemplate(template.id)}
                                    disabled={isCreating}
                                    className={`p-3 rounded-lg border text-left transition-all ${selectedTemplate === template.id
                                        ? 'border-theme-accent bg-theme-accent/10'
                                        : 'border-theme hover:border-gray-600'
                                        } disabled:opacity-50`}
                                >
                                    <div className="flex items-center space-x-2 mb-1">
                                        <span className="text-xl">{template.icon}</span>
                                        <span className="font-medium text-sm text-theme">{template.name}</span>
                                    </div>
                                    <p className="text-xs text-gray-500">{template.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-blue-300">
                            📍 After clicking "Create Project", you'll be asked to choose a location on your computer where the project folder will be created.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isCreating}
                            className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating || !projectName.trim()}
                            className="flex items-center space-x-2 px-6 py-2.5 bg-theme-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Creating...</span>
                                </>
                            ) : (
                                <>
                                    <FolderPlus size={16} />
                                    <span>Create Project</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
