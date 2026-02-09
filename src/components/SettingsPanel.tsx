import { useState, useEffect } from 'react';
import {
    X, Settings as SettingsIcon, Palette, Type, Save, Terminal,
    Keyboard, Monitor, Zap, RotateCcw, Check, User, LogOut, Shield
} from 'lucide-react';
import { useTheme, themes } from '../context/ThemeContext';
import { supabase } from '../services/supabase';

// Settings types
interface AppSettings {
    // Appearance
    theme: string;
    fontSize: number;
    fontFamily: string;
    lineHeight: number;

    // Editor
    autoSave: boolean;
    autoSaveDelay: number;
    wordWrap: boolean;
    minimap: boolean;
    lineNumbers: boolean;
    bracketMatching: boolean;

    // Terminal
    terminalFontSize: number;
    terminalShell: string;
    terminalCursorStyle: 'block' | 'line' | 'underline';

    // General
    animations: boolean;
    soundEffects: boolean;
}

const defaultSettings: AppSettings = {
    theme: 'henu',
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
    lineHeight: 1.6,
    autoSave: true,
    autoSaveDelay: 2000,
    wordWrap: true,
    minimap: true,
    lineNumbers: true,
    bracketMatching: true,
    terminalFontSize: 13,
    terminalShell: 'henu',
    terminalCursorStyle: 'line',
    animations: true,
    soundEffects: false,
};

const fontFamilies = [
    'JetBrains Mono',
    'Fira Code',
    'Source Code Pro',
    'Cascadia Code',
    'Monaco',
    'Consolas',
    'SF Mono',
    'Ubuntu Mono',
];

const keyboardShortcuts = [
    { action: 'Save File', keys: 'Ctrl + S' },
    { action: 'New File', keys: 'Ctrl + N' },
    { action: 'Open File', keys: 'Ctrl + O' },
    { action: 'Close Tab', keys: 'Ctrl + W' },
    { action: 'Find', keys: 'Ctrl + F' },
    { action: 'Replace', keys: 'Ctrl + H' },
    { action: 'Run Code', keys: 'Ctrl + R' },
    { action: 'Toggle Terminal', keys: 'Ctrl + `' },
    { action: 'Command Palette', keys: 'Ctrl + Shift + P' },
    { action: 'Format Code', keys: 'Shift + Alt + F' },
    { action: 'Go to Line', keys: 'Ctrl + G' },
    { action: 'Next Tab', keys: 'Ctrl + Tab' },
    { action: 'Previous Tab', keys: 'Ctrl + Shift + Tab' },
    { action: 'Toggle Sidebar', keys: 'Ctrl + B' },
    { action: 'Zoom In', keys: 'Ctrl + +' },
    { action: 'Zoom Out', keys: 'Ctrl + -' },
];

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTab = 'appearance' | 'editor' | 'terminal' | 'shortcuts' | 'account';

export const SettingsPanel = ({ isOpen, onClose }: SettingsPanelProps) => {
    const { setActiveTheme } = useTheme();
    const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
    const [settings, setSettings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('henu_settings');
        if (saved) {
            try {
                return { ...defaultSettings, ...JSON.parse(saved) };
            } catch {
                return defaultSettings;
            }
        }
        return defaultSettings;
    });
    const [hasChanges, setHasChanges] = useState(false);
    const [savedMessage, setSavedMessage] = useState(false);

    // Save settings to localStorage
    useEffect(() => {
        localStorage.setItem('henu_settings', JSON.stringify(settings));
    }, [settings]);

    const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);

        // Apply theme immediately
        if (key === 'theme') {
            setActiveTheme(value as string);
        }
    };

    const resetSettings = () => {
        setSettings(defaultSettings);
        setActiveTheme(defaultSettings.theme);
        setHasChanges(true);
    };

    const saveSettings = () => {
        localStorage.setItem('henu_settings', JSON.stringify(settings));
        setHasChanges(false);
        setSavedMessage(true);
        setTimeout(() => setSavedMessage(false), 2000);
    };

    const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
        { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
        { id: 'editor', label: 'Editor', icon: <Type size={16} /> },
        { id: 'terminal', label: 'Terminal', icon: <Terminal size={16} /> },
        { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={16} /> },
        { id: 'account', label: 'Account', icon: <User size={16} /> },
    ];

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-[800px] max-w-[90vw] h-[600px] max-h-[80vh] bg-theme-primary border border-theme rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-theme bg-theme-secondary/50">
                    <div className="flex items-center space-x-3">
                        <SettingsIcon size={20} className="text-theme-accent" />
                        <h2 className="text-lg font-bold text-theme">Settings</h2>
                    </div>
                    <div className="flex items-center space-x-2">
                        {savedMessage && (
                            <div className="flex items-center space-x-1 text-green-400 text-sm animate-in fade-in">
                                <Check size={14} />
                                <span>Saved!</span>
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-48 border-r border-theme bg-theme-secondary/30 py-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center space-x-3 px-4 py-2.5 text-sm transition-all ${activeTab === tab.id
                                    ? 'bg-theme-accent/20 text-theme-accent border-r-2 border-theme-accent'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Settings Content */}
                    <div className="flex-1 overflow-auto p-6">
                        {/* Appearance Tab */}
                        {activeTab === 'appearance' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold text-theme mb-4 flex items-center space-x-2">
                                        <Monitor size={16} className="text-theme-accent" />
                                        <span>Theme</span>
                                    </h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {Object.values(themes).map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => updateSetting('theme', t.id)}
                                                className={`p-3 rounded-lg border transition-all ${settings.theme === t.id
                                                    ? 'border-theme-accent bg-theme-accent/10'
                                                    : 'border-theme hover:border-gray-600'
                                                    }`}
                                            >
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <div
                                                        className="w-4 h-4 rounded-full"
                                                        style={{ backgroundColor: t.colors.accent }}
                                                    />
                                                    <span className="text-sm font-medium text-theme">{t.name}</span>
                                                </div>
                                                <div className="flex space-x-1">
                                                    <div className="w-6 h-3 rounded" style={{ backgroundColor: t.colors.background }} />
                                                    <div className="w-6 h-3 rounded" style={{ backgroundColor: t.colors.accent }} />
                                                    <div className="w-6 h-3 rounded" style={{ backgroundColor: t.colors.border }} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-theme mb-4 flex items-center space-x-2">
                                        <Type size={16} className="text-theme-accent" />
                                        <span>Typography</span>
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Font Family</label>
                                            <select
                                                value={settings.fontFamily}
                                                onChange={(e) => updateSetting('fontFamily', e.target.value)}
                                                className="w-full bg-theme-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme focus:outline-none focus:ring-1 focus:ring-theme-accent"
                                            >
                                                {fontFamilies.map(font => (
                                                    <option key={font} value={font}>{font}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Font Size: {settings.fontSize}px</label>
                                                <input
                                                    type="range"
                                                    min="10"
                                                    max="24"
                                                    value={settings.fontSize}
                                                    onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
                                                    className="w-full accent-theme-accent"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Line Height: {settings.lineHeight}</label>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="2.5"
                                                    step="0.1"
                                                    value={settings.lineHeight}
                                                    onChange={(e) => updateSetting('lineHeight', parseFloat(e.target.value))}
                                                    className="w-full accent-theme-accent"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-theme mb-4 flex items-center space-x-2">
                                        <Zap size={16} className="text-theme-accent" />
                                        <span>Effects</span>
                                    </h3>
                                    <div className="space-y-3">
                                        <label className="flex items-center justify-between p-3 bg-theme-secondary/50 rounded-lg cursor-pointer group hover:bg-white/5">
                                            <span className="text-sm text-theme">Enable Animations</span>
                                            <input
                                                type="checkbox"
                                                checked={settings.animations}
                                                onChange={(e) => updateSetting('animations', e.target.checked)}
                                                className="w-5 h-5 rounded accent-theme-accent"
                                            />
                                        </label>
                                        <label className="flex items-center justify-between p-3 bg-theme-secondary/50 rounded-lg cursor-pointer group hover:bg-white/5">
                                            <span className="text-sm text-theme">Sound Effects</span>
                                            <input
                                                type="checkbox"
                                                checked={settings.soundEffects}
                                                onChange={(e) => updateSetting('soundEffects', e.target.checked)}
                                                className="w-5 h-5 rounded accent-theme-accent"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Editor Tab */}
                        {activeTab === 'editor' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold text-theme mb-4 flex items-center space-x-2">
                                        <Save size={16} className="text-theme-accent" />
                                        <span>Auto Save</span>
                                    </h3>
                                    <div className="space-y-4">
                                        <label className="flex items-center justify-between p-3 bg-theme-secondary/50 rounded-lg cursor-pointer hover:bg-white/5">
                                            <span className="text-sm text-theme">Enable Auto Save</span>
                                            <input
                                                type="checkbox"
                                                checked={settings.autoSave}
                                                onChange={(e) => updateSetting('autoSave', e.target.checked)}
                                                className="w-5 h-5 rounded accent-theme-accent"
                                            />
                                        </label>
                                        {settings.autoSave && (
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">
                                                    Auto Save Delay: {settings.autoSaveDelay / 1000}s
                                                </label>
                                                <input
                                                    type="range"
                                                    min="500"
                                                    max="10000"
                                                    step="500"
                                                    value={settings.autoSaveDelay}
                                                    onChange={(e) => updateSetting('autoSaveDelay', parseInt(e.target.value))}
                                                    className="w-full accent-theme-accent"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-theme mb-4">Editor Features</h3>
                                    <div className="space-y-3">
                                        <label className="flex items-center justify-between p-3 bg-theme-secondary/50 rounded-lg cursor-pointer hover:bg-white/5">
                                            <span className="text-sm text-theme">Word Wrap</span>
                                            <input
                                                type="checkbox"
                                                checked={settings.wordWrap}
                                                onChange={(e) => updateSetting('wordWrap', e.target.checked)}
                                                className="w-5 h-5 rounded accent-theme-accent"
                                            />
                                        </label>
                                        <label className="flex items-center justify-between p-3 bg-theme-secondary/50 rounded-lg cursor-pointer hover:bg-white/5">
                                            <span className="text-sm text-theme">Show Minimap</span>
                                            <input
                                                type="checkbox"
                                                checked={settings.minimap}
                                                onChange={(e) => updateSetting('minimap', e.target.checked)}
                                                className="w-5 h-5 rounded accent-theme-accent"
                                            />
                                        </label>
                                        <label className="flex items-center justify-between p-3 bg-theme-secondary/50 rounded-lg cursor-pointer hover:bg-white/5">
                                            <span className="text-sm text-theme">Line Numbers</span>
                                            <input
                                                type="checkbox"
                                                checked={settings.lineNumbers}
                                                onChange={(e) => updateSetting('lineNumbers', e.target.checked)}
                                                className="w-5 h-5 rounded accent-theme-accent"
                                            />
                                        </label>
                                        <label className="flex items-center justify-between p-3 bg-theme-secondary/50 rounded-lg cursor-pointer hover:bg-white/5">
                                            <span className="text-sm text-theme">Bracket Matching</span>
                                            <input
                                                type="checkbox"
                                                checked={settings.bracketMatching}
                                                onChange={(e) => updateSetting('bracketMatching', e.target.checked)}
                                                className="w-5 h-5 rounded accent-theme-accent"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Terminal Tab */}
                        {activeTab === 'terminal' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold text-theme mb-4 flex items-center space-x-2">
                                        <Terminal size={16} className="text-theme-accent" />
                                        <span>Terminal Settings</span>
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">
                                                Terminal Font Size: {settings.terminalFontSize}px
                                            </label>
                                            <input
                                                type="range"
                                                min="10"
                                                max="20"
                                                value={settings.terminalFontSize}
                                                onChange={(e) => updateSetting('terminalFontSize', parseInt(e.target.value))}
                                                className="w-full accent-theme-accent"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Default Shell</label>
                                            <select
                                                value={settings.terminalShell}
                                                onChange={(e) => updateSetting('terminalShell', e.target.value)}
                                                className="w-full bg-theme-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme focus:outline-none focus:ring-1 focus:ring-theme-accent"
                                            >
                                                <option value="henu">🔥 HENU Shell</option>
                                                <option value="powershell">⚡ PowerShell</option>
                                                <option value="bash">🐧 Bash</option>
                                                <option value="zsh">🚀 Zsh</option>
                                                <option value="cmd">📦 CMD</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Cursor Style</label>
                                            <div className="flex space-x-2">
                                                {(['block', 'line', 'underline'] as const).map(style => (
                                                    <button
                                                        key={style}
                                                        onClick={() => updateSetting('terminalCursorStyle', style)}
                                                        className={`flex-1 p-3 rounded-lg border text-sm capitalize transition-all ${settings.terminalCursorStyle === style
                                                            ? 'border-theme-accent bg-theme-accent/10 text-theme-accent'
                                                            : 'border-theme text-gray-400 hover:border-gray-600'
                                                            }`}
                                                    >
                                                        {style}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Shortcuts Tab */}
                        {activeTab === 'shortcuts' && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-theme mb-4 flex items-center space-x-2">
                                    <Keyboard size={16} className="text-theme-accent" />
                                    <span>Keyboard Shortcuts</span>
                                </h3>
                                <div className="space-y-1">
                                    {keyboardShortcuts.map((shortcut, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 group"
                                        >
                                            <span className="text-sm text-theme">{shortcut.action}</span>
                                            <kbd className="px-2 py-1 bg-theme-secondary border border-theme rounded text-xs font-mono text-gray-400 group-hover:text-theme-accent group-hover:border-theme-accent transition-colors">
                                                {shortcut.keys}
                                            </kbd>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Account Tab */}
                        {activeTab === 'account' && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-bold text-theme mb-4 flex items-center space-x-2">
                                    <User size={16} className="text-theme-accent" />
                                    <span>Account Protocol</span>
                                </h3>

                                <div className="p-4 bg-theme-secondary/50 rounded-lg border border-theme">
                                    <div className="flex items-center space-x-4 mb-6">
                                        <div className="w-16 h-16 rounded-full bg-theme-accent/20 flex items-center justify-center border-2 border-theme-accent shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                            <User size={32} className="text-theme-accent" />
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-white tracking-tight">Active Session</div>
                                            <div className="text-sm text-gray-400">Secure Industrial Access</div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-black/30 rounded border border-white/5">
                                            <div className="flex items-center space-x-3 text-sm text-gray-300">
                                                <Shield size={16} className="text-blue-400" />
                                                <span>Security Level</span>
                                            </div>
                                            <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">LEVEL_01</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-black/30 rounded border border-white/5 text-sm text-gray-300">
                                            <div className="flex items-center space-x-3">
                                                <Zap size={16} className="text-yellow-400" />
                                                <span>Session Status</span>
                                            </div>
                                            <span className="text-xs font-mono text-green-400">ENCRYPTED</span>
                                        </div>
                                    </div>

                                    <div className="mt-8">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center justify-center space-x-3 p-3 bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 rounded-lg text-red-500 transition-all font-bold tracking-widest text-xs uppercase"
                                        >
                                            <LogOut size={16} />
                                            <span>Terminate Session</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-theme bg-theme-secondary/50">
                    <button
                        onClick={resetSettings}
                        className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        <RotateCcw size={14} />
                        <span>Reset to Defaults</span>
                    </button>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveSettings}
                            disabled={!hasChanges}
                            className="flex items-center space-x-2 px-4 py-2 bg-theme-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={14} />
                            <span>Save Changes</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Hook to use settings throughout the app
export const useSettings = () => {
    const [settings, setSettings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('henu_settings');
        if (saved) {
            try {
                return { ...defaultSettings, ...JSON.parse(saved) };
            } catch {
                return defaultSettings;
            }
        }
        return defaultSettings;
    });

    useEffect(() => {
        const handleStorage = () => {
            const saved = localStorage.getItem('henu_settings');
            if (saved) {
                try {
                    setSettings({ ...defaultSettings, ...JSON.parse(saved) });
                } catch {
                    // Ignore
                }
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return settings;
};
