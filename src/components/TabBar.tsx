import { X } from 'lucide-react';
import { FileSystemNode } from '../context/OsContext';

interface TabBarProps {
    tabs: FileSystemNode[];
    activeTabId: string | null;
    onTabClick: (file: FileSystemNode) => void;
    onTabClose: (file: FileSystemNode, e: React.MouseEvent) => void;
    dirtyTabs: Set<string>;
}

export const TabBar = ({ tabs, activeTabId, onTabClick, onTabClose, dirtyTabs }: TabBarProps) => {
    const getFileIcon = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'js':
            case 'jsx':
                return '📜';
            case 'ts':
            case 'tsx':
                return '📘';
            case 'html':
                return '🌐';
            case 'css':
                return '🎨';
            case 'json':
                return '📋';
            case 'md':
                return '📝';
            case 'py':
                return '🐍';
            default:
                return '📄';
        }
    };

    if (tabs.length === 0) return null;

    return (
        <div className="flex items-center bg-gradient-to-r from-gray-900/90 to-black/90 border-b border-red-900/30 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const isDirty = dirtyTabs.has(tab.id);

                return (
                    <div
                        key={tab.id}
                        onClick={() => onTabClick(tab)}
                        className={`
              group relative flex items-center space-x-2 px-4 py-2.5 cursor-pointer
              border-r border-gray-800/50 min-w-[120px] max-w-[200px]
              transition-all duration-200
              ${isActive
                                ? 'bg-black/60 text-red-400 border-b-2 border-b-red-500'
                                : 'bg-transparent text-gray-400 hover:bg-gray-900/50 hover:text-gray-300'
                            }
            `}
                    >
                        {/* File Icon */}
                        <span className="text-sm flex-shrink-0">{getFileIcon(tab.name)}</span>

                        {/* File Name */}
                        <span className="text-xs font-mono truncate flex-1">
                            {tab.name}
                        </span>

                        {/* Dirty Indicator or Close Button */}
                        <div className="flex-shrink-0 flex items-center">
                            {isDirty && (
                                <div
                                    className="w-2 h-2 rounded-full bg-yellow-500 mr-1"
                                    title="Unsaved changes"
                                />
                            )}
                            <button
                                onClick={(e) => onTabClose(tab, e)}
                                className={`
                  p-0.5 rounded hover:bg-red-900/30 transition-colors
                  ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                `}
                                title="Close tab"
                            >
                                <X size={12} className="text-gray-500 hover:text-red-400" />
                            </button>
                        </div>

                        {/* Active Tab Indicator */}
                        {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 via-red-400 to-red-500" />
                        )}
                    </div>
                );
            })}

            {/* Tab Count Indicator */}
            {tabs.length > 5 && (
                <div className="px-3 py-2 text-xs text-gray-600 font-mono flex-shrink-0">
                    {tabs.length} tabs
                </div>
            )}
        </div>
    );
};
