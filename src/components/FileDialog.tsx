import { useState, useRef, useEffect } from 'react';
import { X, File, Folder, Save, FolderOpen } from 'lucide-react';
import { useOS } from '../context/OsContext';

type DialogType = 'newFile' | 'newFolder' | 'saveAs' | 'openFile' | 'openFolder' | 'goToLine' | 'find' | 'replace' | 'commandPalette';

interface FileDialogProps {
    type: DialogType;
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: (value: string, extra?: string) => void;
}

export const FileDialog = ({ type, isOpen, onClose, onConfirm }: FileDialogProps) => {
    const { state, createFile, createDirectory, getNodeByPath } = useOS();
    const [inputValue, setInputValue] = useState('');
    const [extraValue, setExtraValue] = useState(''); // For replace dialog
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setInputValue('');
            setExtraValue('');
            setError('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!inputValue.trim() && type !== 'commandPalette') {
            setError('Please enter a value');
            return;
        }

        switch (type) {
            case 'newFile':
                // Check if file already exists
                const filePath = state.currentPath === '/'
                    ? `/${inputValue}`
                    : `${state.currentPath}/${inputValue}`;
                const existingFile = getNodeByPath(filePath);
                if (existingFile) {
                    setError('A file with this name already exists');
                    return;
                }
                createFile(inputValue, '');
                onConfirm?.(inputValue);
                break;

            case 'newFolder':
                const folderPath = state.currentPath === '/'
                    ? `/${inputValue}`
                    : `${state.currentPath}/${inputValue}`;
                const existingFolder = getNodeByPath(folderPath);
                if (existingFolder) {
                    setError('A folder with this name already exists');
                    return;
                }
                createDirectory(inputValue);
                onConfirm?.(inputValue);
                break;

            case 'saveAs':
            case 'goToLine':
            case 'find':
                onConfirm?.(inputValue);
                break;

            case 'replace':
                onConfirm?.(inputValue, extraValue);
                break;

            case 'commandPalette':
                onConfirm?.(inputValue);
                break;
        }

        onClose();
    };

    const getDialogConfig = () => {
        switch (type) {
            case 'newFile':
                return {
                    title: 'New File',
                    icon: <File size={20} className="text-blue-400" />,
                    placeholder: 'Enter file name (e.g., index.js)',
                    buttonText: 'Create File',
                    buttonColor: 'bg-blue-600 hover:bg-blue-500'
                };
            case 'newFolder':
                return {
                    title: 'New Folder',
                    icon: <Folder size={20} className="text-yellow-400" />,
                    placeholder: 'Enter folder name',
                    buttonText: 'Create Folder',
                    buttonColor: 'bg-yellow-600 hover:bg-yellow-500'
                };
            case 'saveAs':
                return {
                    title: 'Save As',
                    icon: <Save size={20} className="text-green-400" />,
                    placeholder: 'Enter file name',
                    buttonText: 'Save',
                    buttonColor: 'bg-green-600 hover:bg-green-500'
                };
            case 'openFile':
                return {
                    title: 'Open File',
                    icon: <FolderOpen size={20} className="text-purple-400" />,
                    placeholder: 'Enter file path',
                    buttonText: 'Open',
                    buttonColor: 'bg-purple-600 hover:bg-purple-500'
                };
            case 'goToLine':
                return {
                    title: 'Go to Line',
                    icon: <span className="text-cyan-400 font-mono text-lg">#</span>,
                    placeholder: 'Enter line number',
                    buttonText: 'Go',
                    buttonColor: 'bg-cyan-600 hover:bg-cyan-500'
                };
            case 'find':
                return {
                    title: 'Find',
                    icon: <span className="text-orange-400 font-bold text-lg">🔍</span>,
                    placeholder: 'Search for...',
                    buttonText: 'Find',
                    buttonColor: 'bg-orange-600 hover:bg-orange-500'
                };
            case 'replace':
                return {
                    title: 'Find and Replace',
                    icon: <span className="text-pink-400 font-bold text-lg">↔</span>,
                    placeholder: 'Find...',
                    buttonText: 'Replace All',
                    buttonColor: 'bg-pink-600 hover:bg-pink-500'
                };
            case 'commandPalette':
                return {
                    title: 'Command Palette',
                    icon: <span className="text-theme-accent font-bold text-lg">›</span>,
                    placeholder: 'Type a command...',
                    buttonText: 'Run',
                    buttonColor: 'bg-theme-accent hover:opacity-90'
                };
            default:
                return {
                    title: 'Dialog',
                    icon: null,
                    placeholder: 'Enter value',
                    buttonText: 'OK',
                    buttonColor: 'bg-gray-600 hover:bg-gray-500'
                };
        }
    };

    const config = getDialogConfig();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10001] flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm">
            <div className="w-[500px] max-w-[90vw] bg-theme-primary border border-theme rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-theme bg-theme-secondary/50">
                    <div className="flex items-center space-x-3">
                        {config.icon}
                        <h3 className="font-bold text-theme">{config.title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-4">
                    <div className="space-y-3">
                        <div>
                            <input
                                ref={inputRef}
                                type={type === 'goToLine' ? 'number' : 'text'}
                                value={inputValue}
                                onChange={(e) => {
                                    setInputValue(e.target.value);
                                    setError('');
                                }}
                                placeholder={config.placeholder}
                                className="w-full bg-theme-secondary border border-theme rounded-lg px-4 py-3 text-theme focus:outline-none focus:ring-2 focus:ring-theme-accent/50 focus:border-theme-accent placeholder-gray-500"
                                autoFocus
                            />
                            {error && (
                                <p className="text-red-400 text-sm mt-1">{error}</p>
                            )}
                        </div>

                        {type === 'replace' && (
                            <input
                                type="text"
                                value={extraValue}
                                onChange={(e) => setExtraValue(e.target.value)}
                                placeholder="Replace with..."
                                className="w-full bg-theme-secondary border border-theme rounded-lg px-4 py-3 text-theme focus:outline-none focus:ring-2 focus:ring-theme-accent/50 focus:border-theme-accent placeholder-gray-500"
                            />
                        )}

                        {/* Current Path Info */}
                        {(type === 'newFile' || type === 'newFolder') && (
                            <div className="text-xs text-gray-500">
                                Location: <span className="text-gray-400 font-mono">{state.currentPath}</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-2 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={`px-4 py-2 text-sm text-white rounded-lg font-medium transition-colors ${config.buttonColor}`}
                        >
                            {config.buttonText}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Command Palette with search functionality
interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onAction: (action: string) => void;
}

const commands = [
    { id: 'newProject', label: 'New Project...', category: 'File', shortcut: '' },
    { id: 'newFile', label: 'New File', category: 'File', shortcut: 'Ctrl+N' },
    { id: 'newFolder', label: 'New Folder', category: 'File', shortcut: 'Ctrl+Shift+N' },
    { id: 'openFile', label: 'Open File...', category: 'File', shortcut: 'Ctrl+O' },
    { id: 'openFolder', label: 'Open Folder...', category: 'File', shortcut: 'Ctrl+K Ctrl+O' },
    { id: 'save', label: 'Save', category: 'File', shortcut: 'Ctrl+S' },
    { id: 'saveAs', label: 'Save As...', category: 'File', shortcut: 'Ctrl+Shift+S' },
    { id: 'saveAll', label: 'Save All', category: 'File', shortcut: 'Ctrl+K S' },
    { id: 'cut', label: 'Cut', category: 'Edit', shortcut: 'Ctrl+X' },
    { id: 'copy', label: 'Copy', category: 'Edit', shortcut: 'Ctrl+C' },
    { id: 'paste', label: 'Paste', category: 'Edit', shortcut: 'Ctrl+V' },
    { id: 'selectAll', label: 'Select All', category: 'Edit', shortcut: 'Ctrl+A' },
    { id: 'undo', label: 'Undo', category: 'Edit', shortcut: 'Ctrl+Z' },
    { id: 'redo', label: 'Redo', category: 'Edit', shortcut: 'Ctrl+Y' },
    { id: 'find', label: 'Find', category: 'Edit', shortcut: 'Ctrl+F' },
    { id: 'replace', label: 'Find and Replace', category: 'Edit', shortcut: 'Ctrl+H' },
    { id: 'toggleExplorer', label: 'Toggle Explorer', category: 'View', shortcut: 'Ctrl+B' },
    { id: 'toggleTerminal', label: 'Toggle Terminal', category: 'View', shortcut: 'Ctrl+`' },
    { id: 'toggleAI', label: 'Toggle AI Assistant', category: 'View', shortcut: 'Ctrl+Shift+A' },
    { id: 'goToFile', label: 'Go to File...', category: 'Go', shortcut: 'Ctrl+P' },
    { id: 'goToLine', label: 'Go to Line...', category: 'Go', shortcut: 'Ctrl+G' },
    { id: 'newTerminal', label: 'New Terminal', category: 'Terminal', shortcut: 'Ctrl+Shift+`' },
    { id: 'startDebug', label: 'Run Code', category: 'Run', shortcut: 'Ctrl+R' },
    { id: 'fullscreen', label: 'Toggle Fullscreen', category: 'View', shortcut: 'F11' },
    { id: 'settings', label: 'Open Settings', category: 'Preferences', shortcut: 'Ctrl+,' },
];

export const CommandPalette = ({ isOpen, onClose, onAction }: CommandPaletteProps) => {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const filteredCommands = commands.filter(cmd =>
        cmd.label.toLowerCase().includes(search.toLowerCase()) ||
        cmd.category.toLowerCase().includes(search.toLowerCase())
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter' && filteredCommands.length > 0) {
            e.preventDefault();
            onAction(filteredCommands[selectedIndex].id);
            onClose();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10001] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm">
            <div className="w-[600px] max-w-[90vw] bg-theme-primary border border-theme rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Search Input */}
                <div className="p-3 border-b border-theme">
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setSelectedIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a command or search..."
                        className="w-full bg-transparent text-lg text-theme focus:outline-none placeholder-gray-500"
                    />
                </div>

                {/* Commands List */}
                <div className="max-h-[400px] overflow-auto">
                    {filteredCommands.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                            No commands found
                        </div>
                    ) : (
                        filteredCommands.map((cmd, index) => (
                            <button
                                key={cmd.id}
                                onClick={() => {
                                    onAction(cmd.id);
                                    onClose();
                                }}
                                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${index === selectedIndex
                                    ? 'bg-theme-accent/20 text-theme-accent'
                                    : 'text-theme hover:bg-white/5'
                                    }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <span className="text-xs text-gray-500 w-20">{cmd.category}</span>
                                    <span className="font-medium">{cmd.label}</span>
                                </div>
                                <kbd className="text-xs text-gray-500 font-mono px-2 py-0.5 bg-theme-secondary rounded">
                                    {cmd.shortcut}
                                </kbd>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
