import { useState, useEffect } from 'react';
import { OSProvider, useOS } from './context/OsContext';
import { ThemeProvider } from './context/ThemeContext';
import { SplashScreen } from './components/SplashScreen';
import { Workspace } from './components/Workspace';
import { WelcomeScreen } from './components/WelcomeScreen';

type AppPhase = 'splash' | 'welcome' | 'workspace';

interface OpenFolder {
  name: string;
  path: string;
  fileSystem?: any[];
}

function AppContent() {
  const [phase, setPhase] = useState<AppPhase>('splash');
  const { updateFileSystem, setCurrentPath, setRootPath } = useOS();

  // Auto-transition from splash to welcome after splash completes
  useEffect(() => {
    if (phase === 'splash') {
      const timer = setTimeout(() => {
        setPhase('welcome');
      }, 2500); // Match splash screen duration
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const handleOpenFolder = (folder: OpenFolder) => {
    if (folder.fileSystem && folder.fileSystem.length > 0) {
      updateFileSystem(folder.fileSystem);
    }
    setRootPath(folder.path);
    setCurrentPath(folder.path);
    setPhase('workspace');
  };

  // Show splash screen during boot
  if (phase === 'splash') {
    return <SplashScreen />;
  }

  // Show welcome screen if no folder is open
  if (phase === 'welcome') {
    return (
      <WelcomeScreen
        onOpenFolder={handleOpenFolder}
        onCloneRepo={(_url, name) => {
          handleOpenFolder({
            name,
            path: `/home/user/projects/${name}`,
            fileSystem: []
          });
        }}
      />
    );
  }

  // Show workspace with the opened folder
  return <Workspace />;
}

function App() {
  return (
    <ThemeProvider>
      <OSProvider>
        <AppContent />
      </OSProvider>
    </ThemeProvider>
  );
}

export default App;