import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ThemeColors {
    name: string;
    background: string;
    secondaryBackground: string;
    tertiaryBackground: string;
    border: string;
    text: string;
    mutedText: string;
    accent: string;
    accentSecondary: string;
    glassBackground: string;
    sidebarBackground: string;
    headerBackground: string;
}

export interface Theme {
    id: string;
    name: string;
    colors: ThemeColors;
}

export const themes: Record<string, Theme> = {
    henu: {
        id: 'henu',
        name: 'HENU IDE',
        colors: {
            name: 'HENU IDE',
            background: '#000000',
            secondaryBackground: '#0a0a0a',
            tertiaryBackground: '#121212',
            border: 'rgba(127, 29, 29, 0.3)', // red-900/30
            text: '#e5e7eb', // gray-200
            mutedText: '#9ca3af', // gray-400
            accent: '#ef4444', // red-500
            accentSecondary: '#22d3ee', // cyan-400
            glassBackground: 'rgba(0, 0, 0, 0.6)',
            sidebarBackground: 'rgba(10, 10, 10, 0.8)',
            headerBackground: 'rgba(18, 18, 18, 0.9)',
        }
    },
    matrix: {
        id: 'matrix',
        name: 'Matrix',
        colors: {
            name: 'Matrix',
            background: '#000000',
            secondaryBackground: '#020d02',
            tertiaryBackground: '#051605',
            border: 'rgba(34, 197, 94, 0.3)', // green-500/30
            text: '#4ade80', // green-400
            mutedText: '#166534', // green-800
            accent: '#22c55e', // green-500
            accentSecondary: '#15803d', // green-700
            glassBackground: 'rgba(0, 10, 0, 0.8)',
            sidebarBackground: 'rgba(2, 13, 2, 0.9)',
            headerBackground: 'rgba(5, 22, 5, 0.95)',
        }
    },
    nord: {
        id: 'nord',
        name: 'Nord Night',
        colors: {
            name: 'Nord Night',
            background: '#2e3440',
            secondaryBackground: '#3b4252',
            tertiaryBackground: '#434c5e',
            border: 'rgba(76, 86, 106, 0.5)',
            text: '#d8dee9',
            mutedText: '#9ca3af',
            accent: '#88c0d0', // nord-blue
            accentSecondary: '#81a1c1',
            glassBackground: 'rgba(46, 52, 64, 0.7)',
            sidebarBackground: 'rgba(59, 66, 82, 0.8)',
            headerBackground: 'rgba(67, 76, 94, 0.9)',
        }
    },
    cyberpunk: {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        colors: {
            name: 'Cyberpunk',
            background: '#0d0221',
            secondaryBackground: '#1d0b3b',
            tertiaryBackground: '#2b1055',
            border: 'rgba(240, 0, 255, 0.3)', // neon pink
            text: '#00f0ff', // cyan
            mutedText: '#7000ff', // purple
            accent: '#f000ff', // neon pink
            accentSecondary: '#ffeb3b', // neon yellow
            glassBackground: 'rgba(13, 2, 33, 0.7)',
            sidebarBackground: 'rgba(29, 11, 59, 0.8)',
            headerBackground: 'rgba(43, 16, 85, 0.9)',
        }
    },
    sunset: {
        id: 'sunset',
        name: 'Retrowave',
        colors: {
            name: 'Retrowave',
            background: '#1a0b16',
            secondaryBackground: '#2d132c',
            tertiaryBackground: '#4a192c',
            border: 'rgba(245, 124, 0, 0.3)',
            text: '#ffab40',
            mutedText: '#bf360c',
            accent: '#ff5722',
            accentSecondary: '#e91e63',
            glassBackground: 'rgba(26, 11, 22, 0.7)',
            sidebarBackground: 'rgba(45, 19, 44, 0.8)',
            headerBackground: 'rgba(74, 25, 44, 0.9)',
        }
    }
};

interface ThemeContextType {
    activeTheme: Theme;
    setActiveTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [activeThemeId, setActiveThemeId] = useState<string>(() => {
        return localStorage.getItem('henu-theme') || 'henu';
    });

    const activeTheme = themes[activeThemeId] || themes.henu;

    useEffect(() => {
        localStorage.setItem('henu-theme', activeThemeId);

        // Apply CSS variables to root
        const root = document.documentElement;
        const colors = activeTheme.colors;

        root.style.setProperty('--bg-primary', colors.background);
        root.style.setProperty('--bg-secondary', colors.secondaryBackground);
        root.style.setProperty('--bg-tertiary', colors.tertiaryBackground);
        root.style.setProperty('--border-primary', colors.border);
        root.style.setProperty('--text-primary', colors.text);
        root.style.setProperty('--text-muted', colors.mutedText);
        root.style.setProperty('--accent-primary', colors.accent);
        root.style.setProperty('--accent-secondary', colors.accentSecondary);
        root.style.setProperty('--glass-bg', colors.glassBackground);
        root.style.setProperty('--sidebar-bg', colors.sidebarBackground);
        root.style.setProperty('--header-bg', colors.headerBackground);

        // Also update terminal theme if necessary (optional integration)
    }, [activeThemeId, activeTheme]);

    return (
        <ThemeContext.Provider value={{ activeTheme, setActiveTheme: setActiveThemeId }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
