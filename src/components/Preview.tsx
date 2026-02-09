import { useState, useRef, useEffect, useCallback } from 'react';
import { useOS } from '../context/OsContext';
import {
  Play, Square, RotateCcw, Eye, Maximize2, Smartphone, Tablet,
  Monitor, Play as PlayIcon, RefreshCw, ZoomIn, ZoomOut,
  RotateCw, RotateCcw as RotateCcwIcon, Download, Upload,
  Code, EyeOff, Type, Layers, Smartphone as MobileIcon,
  Tablet as TabletIcon, Monitor as LaptopIcon, Monitor as DesktopIcon,
  Maximize2 as FullscreenIcon, Minus, Plus, Settings,
  Wifi, Battery, Clock, Signal, MoreVertical,
  AlertCircle, CheckCircle, XCircle, Loader2,
  Smartphone as PhoneCall, Smartphone as PhoneOff,
  Volume2, VolumeX, WifiOff, Globe, ExternalLink
} from 'lucide-react';

type DeviceMode = 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'fullscreen';
type DeviceOrientation = 'portrait' | 'landscape';
type PreviewMode = 'live' | 'static' | 'responsive';
type Theme = 'light' | 'dark' | 'system';

const deviceSizes = {
  mobile: {
    portrait: { width: 360, height: 780 },
    landscape: { width: 780, height: 360 },
    label: 'iPhone 14 Pro',
    bezel: 12,
    notch: true,
    statusBar: true
  },
  tablet: {
    portrait: { width: 820, height: 1180 },
    landscape: { width: 1180, height: 820 },
    label: 'iPad Air',
    bezel: 20,
    notch: false,
    statusBar: true
  },
  laptop: {
    portrait: { width: 1440, height: 900 },
    landscape: { width: 1440, height: 900 },
    label: 'MacBook Pro 14"',
    bezel: 15,
    notch: true,
    statusBar: false
  },
  desktop: {
    portrait: { width: 1920, height: 1080 },
    landscape: { width: 1920, height: 1080 },
    label: 'Desktop HD',
    bezel: 1,
    notch: false,
    statusBar: false
  },
  fullscreen: {
    portrait: { width: '100%', height: '100%' },
    landscape: { width: '100%', height: '100%' },
    label: 'Fullscreen',
    bezel: 0,
    notch: false,
    statusBar: false
  },
};

export const Preview = ({ isFullscreen = false }: { isFullscreen?: boolean }) => {
  const { state } = useOS();
  const [isRunning, setIsRunning] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [orientation, setOrientation] = useState<DeviceOrientation>('landscape');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('live');
  const [theme, setTheme] = useState<Theme>('system');
  const [zoom, setZoom] = useState(100);
  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  const [js, setJs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [networkRequests, setNetworkRequests] = useState<any[]>([]);
  const [deviceFrame, setDeviceFrame] = useState(true);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [deviceTime, setDeviceTime] = useState(new Date());
  const [deviceBattery, setDeviceBattery] = useState(85);
  const [deviceSignal, setDeviceSignal] = useState(4);
  const [deviceWifi, setDeviceWifi] = useState(true);
  const [deviceVolume, setDeviceVolume] = useState(70);
  const [interactionHistory, setInteractionHistory] = useState<string[]>([]);
  const [screenshotHistory, setScreenshotHistory] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [previewAreaSize, setPreviewAreaSize] = useState({ width: 0, height: 0 });
  const recordIntervalRef = useRef<NodeJS.Timeout>();
  const deviceTimeIntervalRef = useRef<NodeJS.Timeout>();
  const currentHtmlFilePathRef = useRef<string>('');
  const [devServerUrl, setDevServerUrl] = useState('');

  // Find first HTML file in tree (recursive)
  const findFirstHtmlNode = useCallback((nodes: any[]): any => {
    if (!Array.isArray(nodes)) return null;
    for (const n of nodes) {
      if (n.name && (n.name === 'index.html' || n.name.endsWith('.html'))) return n;
      if (Array.isArray(n.children) && n.children.length) {
        const found = findFirstHtmlNode(n.children);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Keep current HTML file path for "Open in browser"
  useEffect(() => {
    const root = state.fileSystem?.[0];
    const nodes = root?.children ?? state.fileSystem ?? [];
    const htmlNode = findFirstHtmlNode(Array.isArray(nodes) ? nodes : []);
    if (htmlNode && state.rootPath) {
      const sep = state.rootPath.includes('\\') ? '\\' : '/';
      currentHtmlFilePathRef.current = htmlNode.path || `${state.rootPath}${sep}${htmlNode.name}`;
    } else if (htmlNode?.path) {
      currentHtmlFilePathRef.current = htmlNode.path;
    } else {
      currentHtmlFilePathRef.current = '';
    }
  }, [state.fileSystem, state.rootPath, findFirstHtmlNode]);

  // Measure preview area so we can scale device to fit
  useEffect(() => {
    const el = previewAreaRef.current;
    if (!el) return;
    const update = () => {
      if (el) setPreviewAreaSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isRunning]);

  // Initialize device time
  useEffect(() => {
    deviceTimeIntervalRef.current = setInterval(() => {
      setDeviceTime(new Date());
    }, 1000);

    return () => {
      if (deviceTimeIntervalRef.current) {
        clearInterval(deviceTimeIntervalRef.current);
      }
    };
  }, []);

  // Load project files
  useEffect(() => {
    const loadProjectFiles = () => {
      const htmlFile = state.fileSystem.find(f => f.name === 'index.html' || f.name.endsWith('.html'));
      const cssFile = state.fileSystem.find(f => f.name === 'style.css' || f.name.endsWith('.css'));
      const jsFile = state.fileSystem.find(f => f.name === 'script.js' || f.name.endsWith('.js'));

      if (htmlFile) {
        setHtml(htmlFile.content || '');
      } else {
        setHtml(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HENU Preview</title>
    <style>
        ${css || ''}
    </style>
</head>
<body>
    <div style="padding: 2rem; font-family: system-ui, -apple-system, sans-serif;">
        <h1>🎨 Welcome to HENU Preview</h1>
        <p>Create HTML, CSS, and JS files to see your project here!</p>
        <div style="margin-top: 2rem; padding: 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;">
            <h3>💡 Quick Start</h3>
            <ul>
                <li>Create <code>index.html</code> file</li>
                <li>Add <code>style.css</code> for styling</li>
                <li>Include <code>script.js</code> for interactivity</li>
            </ul>
        </div>
    </div>
    <script>
        ${js || ''}
    </script>
</body>
</html>`);
      }

      if (cssFile) {
        setCss(cssFile.content || '');
      }

      if (jsFile) {
        setJs(jsFile.content || '');
      }
    };

    loadProjectFiles();
  }, [state.fileSystem]);

  // Update iframe content
  useEffect(() => {
    if (isRunning && iframeRef.current) {
      setLoading(true);
      setError(null);

      const combinedHtml = `
        <!DOCTYPE html>
        <html lang="en" class="${theme} ${wireframeMode ? 'wireframe' : ''} ${showGrid ? 'grid-overlay' : ''}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Preview - HENU</title>
            <style>
                ${css}
                ${wireframeMode ? `
                    * { outline: 1px solid rgba(255, 0, 0, 0.1) !important; }
                    div, section, article, header, footer, main, nav, aside { background: rgba(0, 100, 255, 0.03) !important; }
                ` : ''}
                ${showGrid ? `
                    body::before {
                        content: '';
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-image: 
                            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
                        background-size: 20px 20px;
                        pointer-events: none;
                        z-index: 9999;
                    }
                ` : ''}
                body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
                .system { color-scheme: normal; }
                .light { color-scheme: light; }
                .dark { color-scheme: dark; }
            </style>
        </head>
        <body>
            ${html}
            <script>
                // Console intercept
                const originalLog = console.log;
                const originalError = console.error;
                const originalWarn = console.warn;
                
                console.log = function(...args) {
                    window.parent.postMessage({ type: 'CONSOLE_LOG', data: args.join(' ') }, '*');
                    originalLog.apply(console, args);
                };
                
                console.error = function(...args) {
                    window.parent.postMessage({ type: 'CONSOLE_ERROR', data: args.join(' ') }, '*');
                    originalError.apply(console, args);
                };
                
                console.warn = function(...args) {
                    window.parent.postMessage({ type: 'CONSOLE_WARN', data: args.join(' ') }, '*');
                    originalWarn.apply(console, args);
                };
                
                // Error handling
                window.addEventListener('error', function(e) {
                    window.parent.postMessage({ 
                        type: 'RUNTIME_ERROR', 
                        data: {
                            message: e.message,
                            filename: e.filename,
                            lineno: e.lineno,
                            colno: e.colno
                        }
                    }, '*');
                });
                
                // Network monitoring
                const originalFetch = window.fetch;
                window.fetch = function(...args) {
                    window.parent.postMessage({ 
                        type: 'NETWORK_REQUEST', 
                        data: {
                            url: args[0],
                            method: 'GET',
                            timestamp: Date.now()
                        }
                    }, '*');
                    return originalFetch.apply(this, args);
                };
                
                // User interaction tracking
                ['click', 'input', 'keydown', 'scroll', 'mouseover'].forEach(eventType => {
                    window.addEventListener(eventType, function(e) {
                        window.parent.postMessage({ 
                            type: 'USER_INTERACTION', 
                            data: {
                                event: eventType,
                                target: e.target?.tagName || 'unknown',
                                timestamp: Date.now()
                            }
                        }, '*');
                    }, { capture: true });
                });
                
                ${js}
            </script>
        </body>
        </html>
      `;

      try {
        const doc = iframeRef.current.contentDocument;
        if (doc) {
          doc.open();
          doc.write(combinedHtml);
          doc.close();
          setLoading(false);
        }
      } catch (err) {
        setError('Failed to load preview');
        setLoading(false);
      }
    }
  }, [html, css, js, isRunning, theme, wireframeMode, showGrid]);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'CONSOLE_LOG') {
        setConsoleOutput(prev => [...prev.slice(-9), `[LOG] ${event.data.data}`]);
      } else if (event.data.type === 'CONSOLE_ERROR') {
        setConsoleOutput(prev => [...prev.slice(-9), `[ERROR] ${event.data.data}`]);
        setError(event.data.data);
      } else if (event.data.type === 'CONSOLE_WARN') {
        setConsoleOutput(prev => [...prev.slice(-9), `[WARN] ${event.data.data}`]);
      } else if (event.data.type === 'RUNTIME_ERROR') {
        setError(`Runtime Error: ${event.data.data.message}`);
        setConsoleOutput(prev => [...prev.slice(-9), `[RUNTIME] ${event.data.data.message}`]);
      } else if (event.data.type === 'NETWORK_REQUEST') {
        setNetworkRequests(prev => [...prev.slice(-4), event.data.data]);
      } else if (event.data.type === 'USER_INTERACTION') {
        setInteractionHistory(prev => [...prev.slice(-4), `${event.data.data.event} on ${event.data.data.target}`]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Recording functionality
  useEffect(() => {
    if (recording) {
      recordIntervalRef.current = setInterval(() => {
        setRecordTime(prev => prev + 1);
      }, 1000);
    } else if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
    }

    return () => {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
    };
  }, [recording]);

  const handleRun = () => {
    setIsRunning(true);
    setConsoleOutput([]);
    setNetworkRequests([]);
    setInteractionHistory([]);
  };

  const handleStop = () => {
    setIsRunning(false);
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }
  };

  const handleReload = () => {
    setIsRunning(false);
    setTimeout(() => setIsRunning(true), 100);
  };

  const openInBrowser = async (browser: 'chrome' | 'edge' | 'default') => {
    const api = (window as any).electronAPI;
    if (!api?.openInBrowser) return;
    const url = devServerUrl.trim();
    const filePath = currentHtmlFilePathRef.current;
    let target = filePath;
    if (url) {
      target = url.startsWith('http') ? url : `http://${url}`;
    }
    if (!target) {
      setError('No HTML file or URL. Open a folder with an HTML file or enter a dev server URL (e.g. http://localhost:5173).');
      return;
    }
    setError(null);
    try {
      await api.openInBrowser(target, browser);
    } catch (e) {
      setError('Could not open browser. Try default browser.');
    }
  };

  const handleScreenshot = () => {
    if (iframeRef.current && previewRef.current) {
      const canvas = document.createElement('canvas');
      const iframe = iframeRef.current;
      const context = canvas.getContext('2d');

      if (context && iframe.contentWindow) {
        const size = deviceSizes[deviceMode][orientation];
        canvas.width = typeof size.width === 'number' ? size.width : 1920;
        canvas.height = typeof size.height === 'number' ? size.height : 1080;

        // This would require proper implementation with html2canvas
        const screenshotUrl = canvas.toDataURL('image/png');
        setScreenshotHistory(prev => [screenshotUrl, ...prev.slice(0, 4)]);

        // Show success message
        setConsoleOutput(prev => [...prev, `[SYSTEM] Screenshot captured: ${deviceMode} ${orientation}`]);
      }
    }
  };

  const handleToggleRecording = () => {
    setRecording(!recording);
    if (!recording) {
      setRecordTime(0);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(200, prev + 10));
  const handleZoomOut = () => setZoom(prev => Math.max(25, prev - 10));
  const handleZoomReset = () => setZoom(100);

  const handleToggleOrientation = () => {
    setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
  };

  const handleDeviceSimulation = (battery: number, signal: number) => {
    setDeviceBattery(battery);
    setDeviceSignal(signal);
    setDeviceWifi(true);
  };

  const size = deviceSizes[deviceMode][orientation];
  const deviceInfo = deviceSizes[deviceMode];

  const deviceW = typeof size.width === 'number' ? size.width : previewAreaSize.width || 1920;
  const deviceH = typeof size.height === 'number' ? size.height : previewAreaSize.height || 1080;
  const fitScale =
    previewAreaSize.width > 0 && previewAreaSize.height > 0 && deviceW > 0 && deviceH > 0
      ? Math.min(previewAreaSize.width / deviceW, previewAreaSize.height / deviceH, 2)
      : 1;
  const effectiveScale = fitScale * (zoom / 100);

  const renderDeviceFrame = () => {
    if (!deviceFrame || deviceMode === 'fullscreen') return null;

    const frameStyle = {
      width: deviceW,
      height: deviceH,
      padding: deviceInfo.bezel,
      boxSizing: 'border-box' as const,
      backgroundColor: '#1a1a1a',
      borderRadius: deviceMode === 'mobile' ? '24px' :
        deviceMode === 'tablet' ? '16px' : '8px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
      position: 'relative' as const,
      overflow: 'hidden',
    };

    const notchStyle = {
      width: '40%',
      height: '20px',
      backgroundColor: '#000',
      position: 'absolute' as const,
      top: deviceInfo.bezel,
      left: '50%',
      transform: 'translateX(-50%)',
      borderRadius: '0 0 12px 12px',
      zIndex: 10,
    };

    const statusBarStyle = {
      height: '24px',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      fontSize: '12px',
      color: '#fff',
      position: 'absolute' as const,
      top: deviceInfo.bezel + (deviceInfo.notch ? 20 : 0),
      left: deviceInfo.bezel,
      right: deviceInfo.bezel,
      zIndex: 5,
    };

    return (
      <div style={frameStyle} className="relative">
        {deviceInfo.notch && <div style={notchStyle} />}
        {deviceInfo.statusBar && (
          <div style={statusBarStyle}>
            <div className="flex items-center space-x-2">
              <span>{deviceTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {deviceMode === 'mobile' && (
                <>
                  <PhoneCall size={10} />
                  <Signal size={10} style={{ opacity: deviceSignal * 0.25 }} />
                  <Wifi size={10} style={{ opacity: deviceWifi ? 1 : 0.3 }} />
                </>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {deviceMode === 'mobile' && (
                <>
                  <Battery size={12} />
                  <span>{deviceBattery}%</span>
                </>
              )}
              <Volume2 size={12} />
            </div>
          </div>
        )}

        {/* Device buttons */}
        {deviceMode === 'mobile' && orientation === 'portrait' && (
          <>
            <div className="absolute left-0 top-1/4 w-1 h-12 bg-gray-800 rounded-r-md"></div>
            <div className="absolute left-0 top-2/4 w-1 h-20 bg-gray-800 rounded-r-md"></div>
            <div className="absolute right-0 top-1/3 w-1 h-16 bg-gray-800 rounded-l-md"></div>
          </>
        )}
      </div>
    );
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-[#0c0c0f] z-50 flex flex-col">
        <div className="p-3 border-b border-white/10 bg-[#0a0a0d]/95 backdrop-blur flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <Eye className="text-red-400" size={16} />
            </div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">Fullscreen Preview</span>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-400">{zoom}%</span>
              <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-500">{size.width}×{size.height}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleReload} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white" title="Reload">
              <RefreshCw size={16} />
            </button>
            <button onClick={handleScreenshot} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white" title="Screenshot">
              <Download size={16} />
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm font-medium"
            >
              Exit Fullscreen
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center overflow-auto bg-[#08080a]">
          {isRunning ? (
            <div className="relative" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}>
              {renderDeviceFrame()}
              <iframe ref={iframeRef} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin" title="Project Preview" />
            </div>
          ) : (
            <div className="text-center max-w-sm">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 border border-white/10 mb-5">
                <PlayIcon size={36} className="text-gray-500" />
              </div>
              <h3 className="text-base font-medium text-gray-300 mb-1">Preview</h3>
              <p className="text-xs text-gray-500 mb-6">Run your project to see it here.</p>
              <button
                onClick={handleRun}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm font-medium"
              >
                <Play size={14} />
                Run Preview
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0c0c0f]" ref={previewRef}>
      {/* Top Control Bar - glass style */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/5 bg-[#0a0a0d]/90 backdrop-blur-md space-y-3">
        {/* Row 1: Title + Run/Stop/Reload + Browsers + URL + Zoom + Tools */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <Eye className="text-red-400" size={14} />
              </div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">Live Preview</span>
              {isRunning && (
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>

            <div className="h-6 w-px bg-white/10" />

            <div className="flex items-center gap-0.5 rounded-lg bg-white/5 border border-white/10 p-0.5">
              <button
                onClick={handleRun}
                disabled={isRunning}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 border border-transparent ${!isRunning ? 'bg-red-500/20 text-red-400 border-red-500/20' : 'text-gray-300 hover:text-white'}`}
                title="Run"
              >
                <Play size={12} strokeWidth={2.5} />
                Run
              </button>
              <button
                onClick={handleStop}
                disabled={!isRunning}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                title="Stop"
              >
                <Square size={12} strokeWidth={2} />
                Stop
              </button>
              <button
                onClick={handleReload}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-white/10 text-gray-400 hover:text-white"
                title="Reload"
              >
                <RotateCcw size={12} />
                Reload
              </button>
            </div>

            {(window as any).electronAPI?.openInBrowser && (
              <>
                <div className="h-6 w-px bg-white/10" />
                <div className="flex items-center gap-0.5 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
                  <Globe size={12} className="text-gray-500" />
                  <button
                    onClick={() => openInBrowser('chrome')}
                    className="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Open in Chrome"
                  >
                    Chrome
                  </button>
                  <button
                    onClick={() => openInBrowser('edge')}
                    className="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Open in Edge"
                  >
                    Edge
                  </button>
                  <button
                    onClick={() => openInBrowser('default')}
                    className="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Default browser"
                  >
                    Default
                  </button>
                </div>
              </>
            )}

            <div className="flex items-center rounded-lg bg-white/5 border border-white/10 pl-2.5 pr-2 py-1 min-w-[160px]">
              <input
                type="text"
                value={devServerUrl}
                onChange={(e) => setDevServerUrl(e.target.value)}
                placeholder="localhost:5173"
                className="bg-transparent text-xs text-gray-300 placeholder-gray-500 flex-1 min-w-0 outline-none"
              />
              <span className="text-[10px] text-gray-600">URL</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-white/5 border border-white/10 overflow-hidden">
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Zoom out"
              >
                <Minus size={14} />
              </button>
              <span className="px-2 py-1 text-[11px] text-gray-400 tabular-nums min-w-[44px] text-center">{zoom}%</span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Zoom in"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={handleZoomReset}
                className="p-1.5 border-l border-white/10 hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                title="Reset zoom"
              >
                <RotateCcwIcon size={12} />
              </button>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setWireframeMode(!wireframeMode)}
                className={`p-2 rounded-lg transition-colors ${wireframeMode ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/10 border border-transparent'}`}
                title="Wireframe"
              >
                <Code size={14} />
              </button>
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-2 rounded-lg transition-colors ${showGrid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/10 border border-transparent'}`}
                title="Grid"
              >
                <Layers size={14} />
              </button>
              <button
                onClick={handleToggleRecording}
                className={`p-2 rounded-lg transition-colors border ${recording ? 'bg-red-500/30 text-red-400 border-red-500/40 animate-pulse' : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10 border-transparent'}`}
                title={recording ? `Recording ${recordTime}s` : 'Record'}
              >
                <Square size={14} />
              </button>
              <button
                onClick={() => setShowMetrics(!showMetrics)}
                className={`p-2 rounded-lg transition-colors border ${showMetrics ? 'bg-white/10 text-gray-300 border-white/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/10 border-transparent'}`}
                title="Size & zoom"
              >
                <Type size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Device + Orientation + Frame + Theme */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider">Device</span>
            <div className="flex items-center gap-0.5 rounded-lg bg-white/5 border border-white/10 p-0.5">
              {(['mobile', 'tablet', 'laptop', 'desktop', 'fullscreen'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDeviceMode(mode)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${deviceMode === mode
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/10 border border-transparent'
                    }`}
                  title={deviceSizes[mode].label}
                >
                  {mode === 'mobile' && <MobileIcon size={12} />}
                  {mode === 'tablet' && <TabletIcon size={12} />}
                  {mode === 'laptop' && <LaptopIcon size={12} />}
                  {mode === 'desktop' && <DesktopIcon size={12} />}
                  {mode === 'fullscreen' && <FullscreenIcon size={12} />}
                  <span className="hidden sm:inline">{mode === 'fullscreen' ? 'Full' : mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                </button>
              ))}
            </div>

            {deviceMode !== 'desktop' && deviceMode !== 'fullscreen' && (
              <button
                onClick={handleToggleOrientation}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white text-[11px] transition-colors"
              >
                <RotateCw size={12} />
                {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
              </button>
            )}

            {deviceMode !== 'fullscreen' && (
              <button
                onClick={() => setDeviceFrame(!deviceFrame)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors ${deviceFrame ? 'bg-white/10 text-gray-300 border border-white/10' : 'text-gray-500 hover:text-gray-300 border border-transparent hover:bg-white/5'}`}
              >
                <Smartphone size={12} />
                Frame
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider">Theme</span>
            <div className="flex items-center gap-0.5 rounded-lg bg-white/5 border border-white/10 p-0.5">
              {(['light', 'dark', 'system'] as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${theme === t ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/10'}`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {deviceMode === 'mobile' && (
              <div className="flex items-center gap-1">
                <button onClick={() => handleDeviceSimulation(100, 4)} className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-emerald-400" title="Full battery & signal">
                  <Battery size={12} />
                </button>
                <button onClick={() => handleDeviceSimulation(20, 1)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400" title="Low battery & signal">
                  <Battery size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div
          ref={previewAreaRef}
          className="flex-1 flex items-center justify-center overflow-auto p-4 bg-[#08080a] relative min-w-0"
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0c0c0f]/80 backdrop-blur-sm z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
                <span className="text-sm text-gray-400">Loading preview…</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-4 right-4 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 max-w-sm z-10">
              <AlertCircle className="text-red-400 shrink-0" size={16} />
              <span className="text-xs text-red-300 flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 p-0.5 rounded">
                <XCircle size={14} />
              </button>
            </div>
          )}

          {isRunning ? (
            deviceMode === 'fullscreen' ? (
              <div className="absolute inset-0 w-full h-full">
                <div className="w-full h-full overflow-hidden bg-white">
                  <iframe
                    ref={iframeRef}
                    className="w-full h-full border-0 block"
                    sandbox="allow-scripts allow-same-origin"
                    title="Project Preview"
                  />
                </div>
              </div>
            ) : (
            <div
              className="flex-shrink-0 transition-all duration-200"
              style={{
                width: Math.round(deviceW * effectiveScale),
                height: Math.round(deviceH * effectiveScale),
              }}
            >
              <div
                className="relative origin-top-left"
                style={{
                  width: deviceW,
                  height: deviceH,
                  transform: `scale(${effectiveScale})`,
                }}
              >
                {deviceFrame ? (
                  <div className="relative w-full h-full">
                    {renderDeviceFrame()}
                    <div
                      className="overflow-hidden absolute bg-white"
                      style={{
                        left: deviceInfo.bezel,
                        top: deviceInfo.bezel,
                        right: deviceInfo.bezel,
                        bottom: deviceInfo.bezel,
                        borderRadius: deviceMode === 'mobile' ? '12px' : deviceMode === 'tablet' ? '10px' : '8px',
                      }}
                    >
                      <iframe
                        ref={iframeRef}
                        className="w-full h-full border-0 block"
                        sandbox="allow-scripts allow-same-origin"
                        title="Project Preview"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full rounded-xl border border-white/10 overflow-hidden bg-white shadow-xl">
                    <iframe
                      ref={iframeRef}
                      className="w-full h-full border-0 block"
                      sandbox="allow-scripts allow-same-origin"
                      title="Project Preview"
                    />
                  </div>
                )}
              </div>
            </div>
            )
          ) : (
            <div className="text-center max-w-sm">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 border border-white/10 mb-5">
                <PlayIcon size={36} className="text-gray-500" />
              </div>
              <h3 className="text-base font-medium text-gray-300 mb-1">Preview</h3>
              <p className="text-xs text-gray-500 mb-6">Run your HTML or open a dev server URL to see it here.</p>
              <button
                onClick={handleRun}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm font-medium transition-colors"
              >
                <Play size={14} strokeWidth={2.5} />
                Run Preview
              </button>
            </div>
          )}

          {showMetrics && isRunning && (
            <div className="absolute bottom-4 left-4 rounded-xl bg-black/80 backdrop-blur border border-white/10 px-3 py-2 text-[11px] space-y-1">
              <div className="flex gap-3 text-gray-400">
                <span>Size: <span className="text-gray-300">{size.width}×{size.height}</span></span>
                <span>Zoom: <span className="text-gray-300">{zoom}%</span></span>
                <span>Mode: <span className="text-gray-300">{deviceMode}</span></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};