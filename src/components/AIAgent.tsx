import { useState, useRef, useEffect } from 'react';
import { useOS } from '../context/OsContext';
import {
  Send, Zap, Bug, Info, RefreshCw, Sparkles,
  Code, Terminal, FileCode, Cpu, Brain, Wrench,
  ChevronDown, Copy, Check, ThumbsUp, ThumbsDown,
  Globe, Server, Wifi, WifiOff
} from 'lucide-react';

// AI रिस्पॉन्स टाइप्स
interface AIResponse {
  type: 'code' | 'explanation' | 'suggestion' | 'error';
  content: string;
  language?: string;
  suggestions?: string[];
}

// Ollama मॉडल इंटरफेस
interface OllamaModel {
  name: string;
  size: string;
  digest: string;
}

export const AIAgent = () => {
  const { state, addAIMessage, executeCommand, openFile, updateFileContent } = useOS();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState('qwen2.5:3b');
  const [temperature, setTemperature] = useState(0.7);
  const [showOptions, setShowOptions] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState('http://localhost:11434');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.aiMessages]);

  // Ollama कनेक्शन चेक करें
  useEffect(() => {
    checkOllamaConnection();
  }, []);

  const checkOllamaConnection = async () => {
    try {
      const response = await fetch(`${apiEndpoint}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.models || []);
        setOllamaStatus('connected');

        // अगर selected model available नहीं है, तो पहला available model select करें
        const modelExists = data.models?.some((model: OllamaModel) =>
          model.name.includes(selectedModel.split(':')[0])
        );

        if (!modelExists && data.models?.length > 0) {
          setSelectedModel(data.models[0].name);
        }
      } else {
        setOllamaStatus('disconnected');
      }
    } catch (error) {
      console.error('Ollama connection error:', error);
      setOllamaStatus('disconnected');
    }
  };

  const fetchAvailableModels = async () => {
    setIsLoadingModels(true);
    await checkOllamaConnection();
    setIsLoadingModels(false);
  };

  // Ollama API के माध्यम से रिस्पॉन्स जेनरेट करें
  const generateAIResponse = async (userMessage: string): Promise<AIResponse> => {
    try {
      const systemPrompt = `You are a helpful AI coding assistant. You specialize in:
1. Code optimization and improvements
2. Debugging and error fixing
3. Code explanation and documentation
4. Refactoring suggestions
5. Best practices and patterns

Always respond in a clear, concise manner. Format code with proper syntax highlighting.
User query: ${userMessage}`;

      const response = await fetch(`${apiEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: systemPrompt,
          stream: false,
          options: {
            temperature: temperature,
            num_predict: 1024,
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.1
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();

      // रिस्पॉन्स को पार्स करें
      const aiResponse = data.response;

      // रिस्पॉन्स टाइप डिटेक्ट करें
      if (aiResponse.toLowerCase().includes('error') || aiResponse.toLowerCase().includes('bug')) {
        return {
          type: 'error',
          content: aiResponse
        };
      } else if (
        aiResponse.includes('```') ||
        aiResponse.includes('function') ||
        aiResponse.includes('const ') ||
        aiResponse.includes('let ') ||
        aiResponse.includes('var ')
      ) {
        return {
          type: 'code',
          content: aiResponse,
          language: 'javascript'
        };
      } else if (
        aiResponse.toLowerCase().includes('explain') ||
        aiResponse.toLowerCase().includes('means') ||
        aiResponse.toLowerCase().includes('how ')
      ) {
        return {
          type: 'explanation',
          content: aiResponse
        };
      } else {
        return {
          type: 'suggestion',
          content: aiResponse
        };
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw error;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing || ollamaStatus !== 'connected') return;

    const userMessage = input.trim();
    setInput('');
    addAIMessage('user', userMessage);
    setIsProcessing(true);

    try {
      const aiResponse = await generateAIResponse(userMessage);

      // AI रिस्पॉन्स को फॉर्मेट करें
      let formattedResponse = '';

      switch (aiResponse.type) {
        case 'code':
          formattedResponse = `💻 **Code Suggestion**\n\n\`\`\`${aiResponse.language || 'javascript'}\n${aiResponse.content}\n\`\`\``;
          if (aiResponse.suggestions) {
            formattedResponse += `\n\n**Suggestions:**\n${aiResponse.suggestions.map(s => `• ${s}`).join('\n')}`;
          }
          break;
        case 'error':
          formattedResponse = `🔧 **Debug Suggestion**\n\n${aiResponse.content}`;
          break;
        case 'explanation':
          formattedResponse = `📚 **Explanation**\n\n${aiResponse.content}`;
          break;
        default:
          formattedResponse = `🤖 **AI Assistant**\n\n${aiResponse.content}`;
      }

      formattedResponse += `\n\n---\n*Model: ${selectedModel} | Temp: ${temperature}*`;

      addAIMessage('assistant', formattedResponse);
    } catch (error) {
      addAIMessage('assistant', '❌ Error connecting to Ollama. Make sure Ollama is running locally with:\n```bash\nollama serve\n```\nAnd the model is pulled:\n```bash\nollama pull qwen2.5:3b\n```');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    if (ollamaStatus !== 'connected') {
      addAIMessage('assistant', 'Ollama is not connected. Please start Ollama service first.');
      return;
    }

    addAIMessage('user', action);
    setIsProcessing(true);

    try {
      let prompt = '';

      switch (action) {
        case 'Optimize Code':
          prompt = 'Optimize this code for better performance and readability. Provide only the optimized code with comments.';
          break;
        case 'Debug Code':
          prompt = 'Find and fix bugs in this code. Explain what was wrong and how to fix it.';
          break;
        case 'Explain Code':
          prompt = 'Explain this code in simple terms. What does it do and how does it work?';
          break;
        case 'Refactor Code':
          prompt = 'Refactor this code to be more maintainable. Follow best practices.';
          break;
        case 'Run Tests':
          prompt = 'Write unit tests for this code. Use Jest testing framework.';
          break;
        default:
          prompt = action;
      }

      const aiResponse = await generateAIResponse(prompt);
      let formattedResponse = '';

      switch (aiResponse.type) {
        case 'code':
          formattedResponse = `🚀 **${action}**\n\n\`\`\`${aiResponse.language || 'javascript'}\n${aiResponse.content}\n\`\`\``;
          break;
        default:
          formattedResponse = `🚀 **${action}**\n\n${aiResponse.content}`;
      }

      formattedResponse += `\n\n---\n*Model: ${selectedModel}*`;

      addAIMessage('assistant', formattedResponse);

      // ऑटो-एक्जीक्यूट ऑप्शन्स
      if (action === 'Optimize Code' && state.activeFile) {
        setTimeout(() => {
          updateFileContent(state.activeFile!.id, '// Optimized by AI\n' + state.activeFile!.content);
        }, 500);
      }

    } catch (error) {
      addAIMessage('assistant', '❌ Failed to process request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderMessageContent = (content: string) => {
    const codeBlocks = content.split(/```(\w+)?\n([\s\S]*?)```/g);

    return (
      <div className="space-y-2">
        {codeBlocks.map((part, index) => {
          if (index % 3 === 0) {
            // Regular text
            const lines = part.split('\n');
            return lines.map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return <div key={`${index}-${i}`} className="font-bold text-red-300">{line.slice(2, -2)}</div>;
              }
              if (line.includes('✅')) {
                return <div key={`${index}-${i}`} className="text-green-400 flex items-center"><Check size={12} className="mr-1" /> {line}</div>;
              }
              if (line.includes('❌')) {
                return <div key={`${index}-${i}`} className="text-red-400 flex items-center"><Wrench size={12} className="mr-1" /> {line}</div>;
              }
              return <div key={`${index}-${i}`} className="text-gray-300">{line || <br />}</div>;
            });
          } else if (index % 3 === 1) {
            // Language identifier
            return null;
          } else {
            // Code block
            const language = codeBlocks[index - 1] || 'javascript';
            const codeId = `code-${index}`;
            return (
              <div key={codeId} className="relative group">
                <div className="flex justify-between items-center bg-gray-900 px-3 py-1 text-xs text-gray-400 rounded-t">
                  <span>{language}</span>
                  <button
                    onClick={() => copyToClipboard(part, codeId)}
                    className="flex items-center space-x-1 hover:text-white transition-colors"
                  >
                    {copiedId === codeId ? (
                      <>
                        <Check size={12} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-black p-3 rounded-b overflow-x-auto text-sm font-mono">
                  <code>{part}</code>
                </pre>
              </div>
            );
          }
        })}
      </div>
    );
  };

  const handleRetryConnection = async () => {
    setOllamaStatus('checking');
    await checkOllamaConnection();
  };

  return (
    <div className="h-full flex flex-col bg-theme-primary">
      {/* Header */}
      <div className="p-3 border-b border-theme bg-theme-secondary/50 backdrop-blur-md">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center space-x-2">
            <Brain size={16} className="text-theme-accent" />
            <div className="text-sm text-theme font-bold font-mono tracking-tight">AI Co-Developer</div>
            <div className={`flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full ${ollamaStatus === 'connected' ? 'bg-green-900/30 text-green-400' :
                ollamaStatus === 'disconnected' ? 'bg-red-900/30 text-red-400' :
                  'bg-yellow-900/30 text-yellow-400'
              }`}>
              {ollamaStatus === 'connected' ? <Wifi size={10} /> : <WifiOff size={10} />}
              <span>{ollamaStatus === 'connected' ? 'Ollama Connected' :
                ollamaStatus === 'disconnected' ? 'Ollama Disconnected' : 'Checking...'}</span>
            </div>
          </div>
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <span>Options</span>
            <ChevronDown size={12} className={showOptions ? 'rotate-180 transition-transform' : ''} />
          </button>
        </div>

        {showOptions && (
          <div className="mt-3 p-3 bg-gray-900/50 rounded border border-gray-800 space-y-3">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-gray-400">Ollama Connection</label>
                <button
                  onClick={handleRetryConnection}
                  className="text-xs flex items-center space-x-1 text-gray-400 hover:text-white transition-colors"
                >
                  <RefreshCw size={10} />
                  <span>Reconnect</span>
                </button>
              </div>
              <div className="flex space-x-2 mb-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    className="w-full bg-black/60 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
                    placeholder="http://localhost:11434"
                  />
                </div>
                <button
                  onClick={fetchAvailableModels}
                  disabled={isLoadingModels}
                  className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 disabled:opacity-50"
                >
                  {isLoadingModels ? 'Loading...' : 'Refresh Models'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">AI Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-black/60 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300"
                disabled={availableModels.length === 0}
              >
                {availableModels.length === 0 ? (
                  <option value="">No models available</option>
                ) : (
                  availableModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name} ({model.size})
                    </option>
                  ))
                )}
              </select>
              <div className="text-xs text-gray-500 mt-1">
                {availableModels.length === 0 ? (
                  <span className="text-red-400">
                    Pull model: <code className="bg-black px-1">ollama pull qwen2.5:3b</code>
                  </span>
                ) : (
                  `${availableModels.length} model(s) available`
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Creativity: {temperature.toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-red-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status Banner */}
        {ollamaStatus === 'disconnected' && (
          <div className="mt-3 p-2 bg-red-900/20 border border-red-800/40 rounded">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Server size={12} className="text-red-400" />
                <span className="text-xs text-red-300">Ollama not running</span>
              </div>
              <button
                onClick={() => executeCommand('ollama serve')}
                className="text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded"
              >
                Start Ollama
              </button>
            </div>
            <div className="text-xs text-red-400/70 mt-1">
              Run: <code className="bg-black/50 px-1">ollama serve</code> in terminal
            </div>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-3 gap-2 mt-3 p-1">
          {[
            { label: 'Optimize', icon: <Zap size={14} />, action: 'Optimize Code' },
            { label: 'Debug', icon: <Bug size={14} />, action: 'Debug Code' },
            { label: 'Explain', icon: <Info size={14} />, action: 'Explain Code' },
            { label: 'Refactor', icon: <RefreshCw size={14} />, action: 'Refactor Code' },
            { label: 'Tests', icon: <Terminal size={14} />, action: 'Run Tests' },
            { label: 'Docs', icon: <FileCode size={14} />, action: 'README.md', isFile: true },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => item.isFile ? openFile(item.action) : handleQuickAction(item.action)}
              disabled={isProcessing || (!item.isFile && ollamaStatus !== 'connected')}
              className="flex flex-col items-center p-2 bg-theme-accent/10 hover:bg-theme-accent/20 border border-theme rounded text-[10px] text-theme-accent transition-all disabled:opacity-50 group uppercase font-bold tracking-tighter"
            >
              <div className="group-hover:scale-110 transition-transform mb-1">{item.icon}</div>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {state.aiMessages.length === 0 && (
          <div className="text-center text-gray-500 text-sm font-mono mt-8">
            <div className="relative inline-block mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-red-900/20 to-purple-900/20 rounded-full flex items-center justify-center">
                <Cpu size={32} className="text-red-500/60" />
                {ollamaStatus === 'connected' && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center animate-pulse">
                    <Server size={12} />
                  </div>
                )}
              </div>
            </div>
            <div className="text-gray-400 mb-2">
              {ollamaStatus === 'connected' ? 'Ollama AI Ready' : 'AI Agent Offline'}
            </div>
            <div className="text-xs text-gray-600 max-w-xs mx-auto">
              {ollamaStatus === 'connected'
                ? 'Ask for code reviews, debugging help, optimizations, or explanations'
                : 'Start Ollama service to enable AI features'}
            </div>
            {ollamaStatus === 'disconnected' && (
              <div className="mt-4 p-3 bg-gray-900/50 rounded border border-gray-800">
                <div className="text-xs text-gray-400 mb-2">Setup Instructions:</div>
                <div className="text-left text-xs font-mono space-y-1">
                  <div className="flex items-center">
                    <span className="text-green-400 mr-2">1.</span>
                    <code className="bg-black px-2 py-1 rounded">ollama serve</code>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-400 mr-2">2.</span>
                    <code className="bg-black px-2 py-1 rounded">ollama pull qwen2.5:3b</code>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-400 mr-2">3.</span>
                    <span className="text-gray-400">Refresh models above</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {state.aiMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
          >
            <div
              className={`max-w-[90%] px-4 py-3 rounded-xl ${msg.role === 'user'
                  ? 'bg-gradient-to-r from-red-900/40 to-red-800/30 text-red-100 border border-red-800/50'
                  : 'bg-gradient-to-r from-gray-900/70 to-gray-800/60 text-gray-300 border border-gray-800/50'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {msg.role === 'user' ? (
                    <>
                      <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
                        <span className="text-xs">YOU</span>
                      </div>
                      <span className="text-xs font-mono opacity-60">Developer</span>
                    </>
                  ) : (
                    <>
                      <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                        <Cpu size={12} />
                      </div>
                      <span className="text-xs font-mono opacity-60">Ollama AI</span>
                    </>
                  )}
                </div>
                <span className="text-xs opacity-40">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {renderMessageContent(msg.content)}
              </div>
              {msg.role === 'assistant' && (
                <div className="flex justify-end space-x-2 mt-3 pt-2 border-t border-gray-800/30">
                  <button
                    onClick={() => copyToClipboard(msg.content, msg.id)}
                    className="text-xs flex items-center space-x-1 text-gray-400 hover:text-white transition-colors"
                  >
                    <Copy size={10} />
                    <span>Copy</span>
                  </button>
                  <button className="text-xs flex items-center space-x-1 text-gray-400 hover:text-green-400 transition-colors">
                    <ThumbsUp size={10} />
                    <span>Helpful</span>
                  </button>
                  <button className="text-xs flex items-center space-x-1 text-gray-400 hover:text-red-400 transition-colors">
                    <ThumbsDown size={10} />
                    <span>Not helpful</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-gradient-to-r from-gray-900/70 to-gray-800/60 border border-gray-800/50 px-4 py-3 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <div className="text-sm text-gray-400 font-mono">
                  Processing with {selectedModel.split(':')[0]}...
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                Querying Ollama AI model locally...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-theme bg-theme-secondary/80 backdrop-blur-xl">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={
              ollamaStatus === 'connected'
                ? "Ask anything..."
                : "Agent offline"
            }
            className="flex-1 bg-theme-primary/50 border border-theme rounded-lg px-4 py-2.5 text-sm text-theme placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-theme-accent transition-all"
            disabled={isProcessing || ollamaStatus !== 'connected'}
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim() || ollamaStatus !== 'connected'}
            className="px-4 py-2.5 bg-theme-accent hover:opacity-90 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-all flex items-center space-x-2 font-bold shadow-lg shadow-theme-accent/20"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="flex justify-between mt-2">
          <div className="text-xs text-gray-500">
            {ollamaStatus === 'connected' ? (
              <>
                Press <kbd className="px-1 py-0.5 bg-gray-900 rounded text-xs">Enter</kbd> to send
                <kbd className="px-1 py-0.5 bg-gray-900 rounded text-xs ml-2">Shift + Enter</kbd> for new line
              </>
            ) : (
              <span className="text-red-400">
                Connect Ollama to enable AI features
              </span>
            )}
          </div>
          {ollamaStatus === 'connected' && (
            <div className="text-xs text-gray-500 font-mono">
              {selectedModel} • {temperature.toFixed(1)} temp
            </div>
          )}
        </div>
      </div>
    </div>
  );
};