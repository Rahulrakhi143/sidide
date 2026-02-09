import { useState, useEffect } from 'react';
import { useOS } from '../context/OsContext';
import { 
  Activity, Radio, Zap, Database, Signal, 
  Cpu, MemoryStick, HardDrive, Network, 
  Thermometer, Clock, Battery, AlertCircle,
  RefreshCw, Settings, ChevronUp, ChevronDown,
  BarChart3, Server, Globe, Shield
} from 'lucide-react';

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  storage: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    upload: number;
    download: number;
    connections: number;
  };
  ai: {
    status: 'ready' | 'processing' | 'error' | 'offline';
    tasks: number;
    performance: number;
  };
  uptime: string;
}

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
  read: boolean;
}

export const StatusHUD = () => {
  const { state } = useOS();
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: { usage: 45, cores: 8, temperature: 65 },
    memory: { used: 8.2, total: 16, percentage: 51.25 },
    storage: { used: 256, total: 512, percentage: 50 },
    network: { upload: 12.5, download: 45.3, connections: 24 },
    ai: { status: 'ready', tasks: 3, performance: 98 },
    uptime: '5d 12h 34m'
  });

  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', type: 'info', message: 'System backup completed', timestamp: new Date(Date.now() - 3600000), read: true },
    { id: '2', type: 'success', message: 'AI model training complete', timestamp: new Date(Date.now() - 1800000), read: false },
    { id: '3', type: 'warning', message: 'High CPU temperature detected', timestamp: new Date(Date.now() - 900000), read: false },
    { id: '4', type: 'info', message: 'New file detected in workspace', timestamp: new Date(Date.now() - 300000), read: true },
  ]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'degraded'>('online');

  const fileCount = state.fileSystem.reduce((count, node) => {
    const countNode = (n: any): number => {
      let total = 1;
      if (n.children) {
        total += n.children.reduce((c: number, child: { children?: unknown[] }) => c + countNode(child), 0);
      }
      return total;
    };
    return count + countNode(node);
  }, 0);

  // Mock backend connection for metrics
  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(prev => ({
        cpu: {
          usage: Math.min(100, Math.max(5, prev.cpu.usage + (Math.random() * 10 - 5))),
          cores: prev.cpu.cores,
          temperature: Math.min(90, Math.max(40, prev.cpu.temperature + (Math.random() * 4 - 2)))
        },
        memory: {
          used: Math.min(prev.memory.total, Math.max(2, prev.memory.used + (Math.random() * 0.5 - 0.25))),
          total: prev.memory.total,
          percentage: Math.min(100, Math.max(10, prev.memory.percentage + (Math.random() * 5 - 2.5)))
        },
        storage: {
          used: Math.min(prev.storage.total, prev.storage.used + (Math.random() * 0.1)),
          total: prev.storage.total,
          percentage: Math.min(100, prev.storage.percentage + (Math.random() * 0.1))
        },
        network: {
          upload: Math.max(0, prev.network.upload + (Math.random() * 10 - 5)),
          download: Math.max(0, prev.network.download + (Math.random() * 15 - 7.5)),
          connections: Math.max(0, prev.network.connections + (Math.floor(Math.random() * 5) - 2))
        },
        ai: {
          status: Math.random() > 0.95 ? 'processing' : 'ready',
          tasks: Math.max(0, prev.ai.tasks + (Math.floor(Math.random() * 3) - 1)),
          performance: Math.min(100, Math.max(85, prev.ai.performance + (Math.random() * 3 - 1.5)))
        },
        uptime: prev.uptime
      }));
      setLastUpdate(new Date());
    };

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(updateMetrics, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Connection status simulation
  useEffect(() => {
    const checkConnection = () => {
      const random = Math.random();
      if (random > 0.98) {
        setConnectionStatus('offline');
      } else if (random > 0.9) {
        setConnectionStatus('degraded');
      } else {
        setConnectionStatus('online');
      }
    };

    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  const refreshMetrics = () => {
    setMetrics(prev => ({
      ...prev,
      cpu: { ...prev.cpu, usage: Math.random() * 100 },
      ai: { ...prev.ai, performance: 95 + Math.random() * 5 }
    }));
    setLastUpdate(new Date());
  };

  const getStatusColor = (type: string, value?: number) => {
    switch (type) {
      case 'cpu':
        if (value && value > 80) return 'text-red-400';
        if (value && value > 60) return 'text-yellow-400';
        return 'text-green-400';
      case 'temperature':
        if (value && value > 75) return 'text-red-400';
        if (value && value > 60) return 'text-yellow-400';
        return 'text-green-400';
      case 'ai':
        const aiStatus = metrics.ai.status;
        if (aiStatus === 'error') return 'text-red-400';
        if (aiStatus === 'processing') return 'text-yellow-400';
        return 'text-green-400';
      case 'connection':
        if (connectionStatus === 'offline') return 'text-red-400';
        if (connectionStatus === 'degraded') return 'text-yellow-400';
        return 'text-green-400';
      default:
        return 'text-green-400';
    }
  };

  const getProgressBarColor = (value: number) => {
    if (value > 80) return 'bg-red-500';
    if (value > 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleMetricClick = (metric: string) => {
    if (showDetails === metric) {
      setShowDetails(null);
    } else {
      setShowDetails(metric);
    }
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const formatBytes = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="fixed bottom-6 right-6 backdrop-blur-xl bg-gradient-to-br from-black/90 to-gray-900/90 border border-red-900/30 rounded-xl shadow-2xl transition-all duration-300"
      style={{
        width: isExpanded ? '320px' : '240px',
        boxShadow: '0 0 40px rgba(239, 68, 68, 0.25), inset 0 0 20px rgba(239, 68, 68, 0.05)',
      }}
    >
      {/* Header */}
      <div className="p-3 border-b border-red-900/30 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Server size={16} className="text-red-500" />
            <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${getStatusColor('connection')} animate-pulse`}></div>
          </div>
          <span className="text-sm font-bold text-gray-200">System Status</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={refreshMetrics}
            className="p-1 hover:bg-red-900/30 rounded transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} className="text-gray-400 hover:text-gray-300" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-red-900/30 rounded transition-all"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-gray-400 hover:text-gray-300" />
            ) : (
              <ChevronUp size={14} className="text-gray-400 hover:text-gray-300" />
            )}
          </button>
        </div>
      </div>

      {/* Main Metrics */}
      <div className="p-3 space-y-3">
        {/* CPU */}
        <div 
          className={`p-2 rounded-lg cursor-pointer transition-all ${showDetails === 'cpu' ? 'bg-red-900/20' : 'hover:bg-red-900/10'}`}
          onClick={() => handleMetricClick('cpu')}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <Cpu size={14} className="text-blue-400" />
              <span className="text-xs text-gray-300">CPU</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-xs font-bold ${getStatusColor('cpu', metrics.cpu.usage)}`}>
                {metrics.cpu.usage.toFixed(1)}%
              </span>
              <Thermometer size={12} className={`${getStatusColor('temperature', metrics.cpu.temperature)}`} />
              <span className="text-xs text-gray-500">{metrics.cpu.temperature}°C</span>
            </div>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getProgressBarColor(metrics.cpu.usage)} transition-all duration-500`}
              style={{ width: `${metrics.cpu.usage}%` }}
            ></div>
          </div>
          {showDetails === 'cpu' && (
            <div className="mt-2 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Cores: {metrics.cpu.cores}</span>
                <span>Threads: {metrics.cpu.cores * 2}</span>
              </div>
            </div>
          )}
        </div>

        {/* Memory */}
        <div 
          className={`p-2 rounded-lg cursor-pointer transition-all ${showDetails === 'memory' ? 'bg-red-900/20' : 'hover:bg-red-900/10'}`}
          onClick={() => handleMetricClick('memory')}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <MemoryStick size={14} className="text-purple-400" />
              <span className="text-xs text-gray-300">Memory</span>
            </div>
            <span className={`text-xs font-bold ${getStatusColor('cpu', metrics.memory.percentage)}`}>
              {metrics.memory.percentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getProgressBarColor(metrics.memory.percentage)} transition-all duration-500`}
              style={{ width: `${metrics.memory.percentage}%` }}
            ></div>
          </div>
          {showDetails === 'memory' && (
            <div className="mt-2 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Used: {metrics.memory.used.toFixed(1)}GB</span>
                <span>Total: {metrics.memory.total}GB</span>
              </div>
            </div>
          )}
        </div>

        {/* Storage */}
        <div 
          className={`p-2 rounded-lg cursor-pointer transition-all ${showDetails === 'storage' ? 'bg-red-900/20' : 'hover:bg-red-900/10'}`}
          onClick={() => handleMetricClick('storage')}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <HardDrive size={14} className="text-yellow-400" />
              <span className="text-xs text-gray-300">Storage</span>
            </div>
            <span className="text-xs font-bold text-blue-400">
              {metrics.storage.percentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${metrics.storage.percentage}%` }}
            ></div>
          </div>
          {showDetails === 'storage' && (
            <div className="mt-2 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Used: {formatBytes(metrics.storage.used * 1024 * 1024 * 1024)}</span>
                <span>Free: {formatBytes((metrics.storage.total - metrics.storage.used) * 1024 * 1024 * 1024)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Network */}
        <div 
          className={`p-2 rounded-lg cursor-pointer transition-all ${showDetails === 'network' ? 'bg-red-900/20' : 'hover:bg-red-900/10'}`}
          onClick={() => handleMetricClick('network')}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <Globe size={14} className="text-green-400" />
              <span className="text-xs text-gray-300">Network</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-xs text-gray-400">↓{metrics.network.download.toFixed(1)}Mbps</div>
              <div className="text-xs text-gray-400">↑{metrics.network.upload.toFixed(1)}Mbps</div>
            </div>
          </div>
          {showDetails === 'network' && (
            <div className="mt-2 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Connections: {metrics.network.connections}</span>
                <span className={`${getStatusColor('connection')}`}>
                  {connectionStatus.toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* AI Core */}
        <div 
          className={`p-2 rounded-lg cursor-pointer transition-all ${showDetails === 'ai' ? 'bg-red-900/20' : 'hover:bg-red-900/10'}`}
          onClick={() => handleMetricClick('ai')}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <Zap size={14} className={`${getStatusColor('ai')}`} />
              <span className="text-xs text-gray-300">AI Core</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-xs font-bold ${getStatusColor('ai')}`}>
                {metrics.ai.status.toUpperCase()}
              </span>
              <span className="text-xs text-gray-500">{metrics.ai.tasks} tasks</span>
            </div>
          </div>
          {showDetails === 'ai' && (
            <div className="mt-2 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Performance: {metrics.ai.performance.toFixed(1)}%</span>
                <span className="text-green-400">Active</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-red-900/30 pt-3">
          {/* Files */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database size={14} className="text-cyan-400" />
              <span className="text-xs text-gray-300">Files</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-cyan-400">{fileCount}</span>
              <div className="text-xs text-gray-500">items</div>
            </div>
          </div>

          {/* Uptime */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock size={14} className="text-gray-400" />
              <span className="text-xs text-gray-300">Uptime</span>
            </div>
            <span className="text-xs text-gray-400">{metrics.uptime}</span>
          </div>

          {/* Security */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield size={14} className="text-green-400" />
              <span className="text-xs text-gray-300">Security</span>
            </div>
            <span className="text-xs text-green-400">Protected</span>
          </div>

          {/* Notifications */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-300">Notifications</span>
              <button
                onClick={markAllAsRead}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Mark all read
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {notifications.filter(n => !n.read).slice(0, 3).map(notification => (
                <div
                  key={notification.id}
                  className={`p-2 rounded text-xs ${
                    notification.type === 'error' ? 'bg-red-900/20' :
                    notification.type === 'warning' ? 'bg-yellow-900/20' :
                    notification.type === 'success' ? 'bg-green-900/20' :
                    'bg-blue-900/20'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="text-gray-200">{notification.message}</span>
                    <span className="text-gray-500 text-[10px]">
                      {formatTimeAgo(notification.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-2 border-t border-red-900/30 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor('connection')} animate-pulse`}></div>
          <span className="text-[10px] text-gray-500">
            Updated: {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-6 h-3 rounded-full transition-all ${autoRefresh ? 'bg-red-900' : 'bg-gray-700'}`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-transform ${autoRefresh ? 'transform translate-x-3' : ''}`}></div>
            </div>
            <span className="text-[10px] text-gray-500">Auto</span>
          </label>
        </div>
      </div>

      {/* Connection Status Indicator */}
      <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${getStatusColor('connection')} animate-pulse`}></div>
    </div>
  );
};