import { useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount, loader } from '@monaco-editor/react';
import type * as monacoEditor from 'monaco-editor';

// Configure Monaco loader to use jsdelivr CDN which is more reliable
loader.config({
    paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
    }
});

interface MonacoEditorWrapperProps {
    value: string;
    onChange: (value: string) => void;
    language?: string;
    theme?: 'vs-dark' | 'vs-light' | 'henu-dark';
    fontSize?: number;
    readOnly?: boolean;
    onCursorChange?: (line: number, column: number) => void;
    onSave?: () => void;
}

// Map file extensions to Monaco language identifiers
const extensionToLanguage: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'scss',
    'less': 'less',
    'json': 'json',
    'jsonc': 'json',
    'md': 'markdown',
    'markdown': 'markdown',
    'xml': 'xml',
    'svg': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sql': 'sql',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'ps1': 'powershell',
    'psm1': 'powershell',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'kts': 'kotlin',
    'scala': 'scala',
    'lua': 'lua',
    'r': 'r',
    'R': 'r',
    'dart': 'dart',
    'vue': 'vue',
    'dockerfile': 'dockerfile',
    'Dockerfile': 'dockerfile',
    'graphql': 'graphql',
    'gql': 'graphql',
    'sol': 'sol',
    'toml': 'ini',
    'ini': 'ini',
    'cfg': 'ini',
    'conf': 'ini',
    'env': 'ini',
    'txt': 'plaintext',
    'log': 'plaintext',
};

// Get language from file extension
export const getLanguageFromFilename = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
    return extensionToLanguage[ext] || 'plaintext';
};

// Custom HENU dark theme definition
const defineHenuTheme = (monaco: Monaco) => {
    monaco.editor.defineTheme('henu-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'F97583' },
            { token: 'keyword.control', foreground: 'F97583' },
            { token: 'string', foreground: '9ECBFF' },
            { token: 'string.key', foreground: '9ECBFF' },
            { token: 'string.value', foreground: '9ECBFF' },
            { token: 'number', foreground: 'B5CEA8' },
            { token: 'regexp', foreground: 'D16969' },
            { token: 'operator', foreground: 'D4D4D4' },
            { token: 'namespace', foreground: '4EC9B0' },
            { token: 'type', foreground: '4EC9B0' },
            { token: 'struct', foreground: '4EC9B0' },
            { token: 'class', foreground: '4EC9B0' },
            { token: 'interface', foreground: '4EC9B0' },
            { token: 'enum', foreground: '4EC9B0' },
            { token: 'typeParameter', foreground: '4EC9B0' },
            { token: 'function', foreground: 'DCDCAA' },
            { token: 'function.declaration', foreground: 'DCDCAA' },
            { token: 'member', foreground: 'DCDCAA' },
            { token: 'variable', foreground: '9CDCFE' },
            { token: 'variable.predefined', foreground: '4FC1FF' },
            { token: 'constant', foreground: '4FC1FF' },
            { token: 'parameter', foreground: '9CDCFE' },
            { token: 'property', foreground: '9CDCFE' },
            { token: 'label', foreground: 'C8C8C8' },
            { token: 'tag', foreground: 'F97583' },
            { token: 'attribute.name', foreground: '9CDCFE' },
            { token: 'attribute.value', foreground: 'CE9178' },
            { token: 'delimiter', foreground: 'D4D4D4' },
            { token: 'delimiter.html', foreground: '808080' },
            { token: 'delimiter.xml', foreground: '808080' },
        ],
        colors: {
            'editor.background': '#0D0D0D',
            'editor.foreground': '#E4E4E4',
            'editor.lineHighlightBackground': '#1A1A1A',
            'editor.lineHighlightBorder': '#2D2D2D',
            'editor.selectionBackground': '#FF634755',
            'editor.selectionHighlightBackground': '#FF634733',
            'editor.inactiveSelectionBackground': '#3A3D41',
            'editorCursor.foreground': '#FF6347',
            'editorWhitespace.foreground': '#3B3B3B',
            'editorIndentGuide.background': '#2D2D2D',
            'editorIndentGuide.activeBackground': '#FF634755',
            'editorLineNumber.foreground': '#5A5A5A',
            'editorLineNumber.activeForeground': '#FF6347',
            'editorGutter.background': '#0D0D0D',
            'editorBracketMatch.background': '#FF634733',
            'editorBracketMatch.border': '#FF6347',
            'editor.findMatchBackground': '#FF634755',
            'editor.findMatchHighlightBackground': '#FF634733',
            'scrollbar.shadow': '#000000',
            'scrollbarSlider.background': '#FF634733',
            'scrollbarSlider.hoverBackground': '#FF634755',
            'scrollbarSlider.activeBackground': '#FF634777',
            'minimap.background': '#0D0D0D',
            'minimap.selectionHighlight': '#FF634755',
        }
    });
};

export const MonacoEditorWrapper = ({
    value,
    onChange,
    language = 'plaintext',
    theme = 'henu-dark',
    fontSize = 14,
    readOnly = false,
    onCursorChange,
    onSave,
}: MonacoEditorWrapperProps) => {
    const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;

        // Define custom theme
        defineHenuTheme(monaco);

        // Apply theme
        monaco.editor.setTheme('henu-dark');

        // Add cursor position listener
        editor.onDidChangeCursorPosition((e) => {
            if (onCursorChange) {
                onCursorChange(e.position.lineNumber, e.position.column);
            }
        });

        // Add Ctrl+S save handler
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            if (onSave) {
                onSave();
            }
        });

        // Focus editor
        editor.focus();
    };

    const handleEditorChange = (value: string | undefined) => {
        if (value !== undefined) {
            onChange(value);
        }
    };

    // Update editor options when fontSize changes
    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.updateOptions({ fontSize });
        }
    }, [fontSize]);

    return (
        <Editor
            height="100%"
            language={language}
            value={value}
            theme="vs-dark"
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            loading={
                <div className="flex items-center justify-center h-full bg-gray-950">
                    <div className="flex items-center space-x-3 text-gray-400">
                        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-mono text-sm">Loading editor...</span>
                    </div>
                </div>
            }
            options={{
                fontSize,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                fontLigatures: true,
                lineNumbers: 'on',
                minimap: { enabled: true, scale: 1, showSlider: 'mouseover' },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                wrappingIndent: 'indent',
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                renderLineHighlight: 'all',
                renderWhitespace: 'selection',
                bracketPairColorization: { enabled: true },
                guides: {
                    bracketPairs: true,
                    indentation: true,
                },
                suggest: {
                    showKeywords: true,
                    showSnippets: true,
                    showFunctions: true,
                    showVariables: true,
                },
                quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: false,
                },
                parameterHints: { enabled: true },
                formatOnPaste: true,
                formatOnType: true,
                readOnly,
                contextmenu: true,
                folding: true,
                foldingStrategy: 'indentation',
                showFoldingControls: 'mouseover',
                matchBrackets: 'always',
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                autoSurround: 'languageDefined',
                links: true,
                colorDecorators: true,
                padding: { top: 16, bottom: 16 },
            }}
        />
    );
};

