import { useState } from 'react';
import { Terminal as TerminalIcon, FileOutput, X, Minimize2 } from 'lucide-react';
import { TerminalXterm } from './TerminalXterm';
import { useOS } from '../context/OsContext';

interface BottomPanelProps {
    onCollapse?: () => void;
    isActive?: boolean;
    onClick?: () => void;
}

type BottomTab = 'terminal' | 'output' | 'problems';

export const BottomPanel = ({ onCollapse, onClick }: BottomPanelProps) => {
    const { state, clearOutput } = useOS();
    const [activeTab, setActiveTab] = useState<BottomTab>('terminal');
    const [problems] = useState<{ type: 'error' | 'warning' | 'info', message: string, file?: string, line?: number }[]>([]);

    const outputMessages = state.outputMessages;

    const tabs: { id: BottomTab, label: string, icon: React.ReactNode, badge?: number }[] = [
        { id: 'terminal', label: 'Terminal', icon: <TerminalIcon size={14} /> },
        { id: 'output', label: 'Output', icon: <FileOutput size={14} />, badge: outputMessages.length > 0 ? outputMessages.length : undefined },
        { id: 'problems', label: 'Problems', icon: <span className="text-xs">⚠</span>, badge: problems.length > 0 ? problems.length : undefined },
    ];

    const handleClearOutput = () => {
        clearOutput();
    };

    const getMessageTypeColor = (type: 'info' | 'success' | 'error' | 'warning') => {
        switch (type) {
            case 'success': return 'text-green-400';
            case 'error': return 'text-red-400';
            case 'warning': return 'text-yellow-400';
            default: return 'text-gray-300';
        }
    };

    const getMessageIcon = (type: 'info' | 'success' | 'error' | 'warning') => {
        switch (type) {
            case 'success': return '✓';
            case 'error': return '✗';
            case 'warning': return '⚠';
            default: return '›';
        }
    };

    return (
        <div className="h-full flex flex-col bg-theme-primary" onClick={onClick}>
            {/* Tab Bar */}
            <div className="flex items-center justify-between border-b border-theme bg-theme-secondary/50">
                <div className="flex items-center">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center space-x-2 px-4 py-2 text-sm font-mono transition-all border-b-2 ${activeTab === tab.id
                                ? 'text-theme-accent border-theme-accent bg-theme-accent/5'
                                : 'text-theme-muted border-transparent hover:text-theme hover:bg-white/5'
                                }`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.badge && (
                                <span className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full ${tab.id === 'output' ? 'bg-theme-accent' : 'bg-yellow-600'
                                    } text-white`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Panel Controls */}
                <div className="flex items-center space-x-1 px-2">
                    {activeTab === 'output' && (
                        <button
                            onClick={handleClearOutput}
                            className="p-1.5 hover:bg-gray-800 rounded text-gray-500 hover:text-gray-300 transition-colors"
                            title="Clear Output"
                        >
                            <X size={14} />
                        </button>
                    )}
                    {onCollapse && (
                        <button
                            onClick={onCollapse}
                            className="p-1.5 hover:bg-gray-800 rounded text-gray-500 hover:text-gray-300 transition-colors"
                            title="Minimize Panel"
                        >
                            <Minimize2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Content - keep all mounted so Terminal/Output don't clear on tab switch */}
            <div className="flex-1 overflow-hidden relative">
                <div
                    className="h-full overflow-hidden"
                    style={{ display: activeTab === 'terminal' ? 'block' : 'none' }}
                    aria-hidden={activeTab !== 'terminal'}
                >
                    <TerminalXterm />
                </div>

                <div
                    className="h-full overflow-auto p-4 font-mono text-sm absolute inset-0"
                    style={{ display: activeTab === 'output' ? 'block' : 'none' }}
                    aria-hidden={activeTab !== 'output'}
                >
                    {outputMessages.length === 0 ? (
                        <div className="text-gray-600 text-center py-8">
                            <div className="mb-4">Output will appear here after running the code.</div>
                            <div className="text-xs space-y-1">
                                <div>✓ Click <span className="text-green-400">Run</span> or press <kbd className="px-1 bg-gray-800 rounded">Ctrl+R</kbd></div>
                                <div>✓ For HTML files, a new tab will open</div>
                                <div>✓ For Python, Pyodide will be loaded automatically</div>
                                <div>✓ For JavaScript, code runs in sandboxed environment</div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {outputMessages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={`flex items-start space-x-2 ${getMessageTypeColor(msg.type)}`}
                                >
                                    <span className="flex-shrink-0">{getMessageIcon(msg.type)}</span>
                                    <span className="flex-1 whitespace-pre-wrap">{msg.message}</span>
                                    <span className="text-gray-600 text-xs flex-shrink-0">
                                        {msg.timestamp.toLocaleTimeString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div
                    className="h-full overflow-auto p-4 font-mono text-sm absolute inset-0"
                    style={{ display: activeTab === 'problems' ? 'block' : 'none' }}
                    aria-hidden={activeTab !== 'problems'}
                >
                    {problems.length === 0 ? (
                        <div className="text-gray-600 text-center py-8">
                            No problems detected in the workspace.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {problems.map((problem, index) => (
                                <div
                                    key={index}
                                    className={`flex items-start space-x-2 p-2 rounded ${problem.type === 'error' ? 'bg-red-900/20 text-red-400' :
                                        problem.type === 'warning' ? 'bg-yellow-900/20 text-yellow-400' :
                                            'bg-blue-900/20 text-blue-400'
                                        }`}
                                >
                                    <span>
                                        {problem.type === 'error' ? '✗' : problem.type === 'warning' ? '⚠' : 'ℹ'}
                                    </span>
                                    <div className="flex-1">
                                        <div>{problem.message}</div>
                                        {problem.file && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                {problem.file}
                                                {problem.line && `:${problem.line}`}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
