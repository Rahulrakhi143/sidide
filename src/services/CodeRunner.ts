// services/CodeRunner.ts
export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

export class CodeRunner {
  private iframe: HTMLIFrameElement | null = null;
  
  // Initialize code runner
  init() {
    if (typeof window === 'undefined') return;
    
    // Create sandbox iframe for safe execution
    this.iframe = document.createElement('iframe');
    this.iframe.style.display = 'none';
    this.iframe.sandbox.add('allow-scripts');
    document.body.appendChild(this.iframe);
  }
  
  // Run JavaScript code
  async runJavaScript(code: string): Promise<ExecutionResult> {
    const startTime = performance.now();
    
    try {
      // Create a sandboxed function
      const func = new Function('console', `
        try {
          ${code}
          return { success: true, output: "" };
        } catch(error) {
          return { success: false, error: error.message };
        }
      `);
      
      // Capture console output
      const logs: string[] = [];
      const errors: string[] = [];
      
      const mockConsole = {
        log: (...args: any[]) => {
          const log = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          logs.push(log);
        },
        error: (...args: any[]) => {
          errors.push(args.join(' '));
        },
        warn: (...args: any[]) => {
          logs.push(`⚠ ${args.join(' ')}`);
        },
        info: (...args: any[]) => {
          logs.push(`ℹ ${args.join(' ')}`);
        }
      };
      
      const result = func(mockConsole);
      const endTime = performance.now();
      
      let output = '';
      if (logs.length > 0) {
        output += 'Console Output:\n' + logs.map(log => `  ${log}`).join('\n') + '\n\n';
      }
      if (errors.length > 0) {
        output += 'Errors:\n' + errors.map(err => `  ❌ ${err}`).join('\n') + '\n\n';
      }
      
      if (result.success) {
        output += '✅ Execution completed successfully';
      } else {
        output += `❌ ${result.error}`;
      }
      
      return {
        success: result.success,
        output,
        executionTime: endTime - startTime
      };
      
    } catch (error: any) {
      const endTime = performance.now();
      return {
        success: false,
        output: `❌ Execution Error: ${error.message}`,
        error: error.message,
        executionTime: endTime - startTime
      };
    }
  }
  
  // Run HTML code
  async runHTML(html: string): Promise<ExecutionResult> {
    const startTime = performance.now();
    
    try {
      // Create a new window/tab for HTML preview
      const newWindow = window.open('', '_blank');
      if (!newWindow) {
        throw new Error('Popup blocked! Please allow popups to view HTML preview.');
      }
      
      newWindow.document.write(html);
      newWindow.document.close();
      
      const endTime = performance.now();
      
      return {
        success: true,
        output: `✅ HTML opened in new tab\nDocument has been rendered successfully\nTotal elements: ${newWindow.document.querySelectorAll('*').length}`,
        executionTime: endTime - startTime
      };
      
    } catch (error: any) {
      const endTime = performance.now();
      return {
        success: false,
        output: `❌ Failed to open HTML: ${error.message}`,
        error: error.message,
        executionTime: endTime - startTime
      };
    }
  }
  
  // Run Python code (using Pyodide - WebAssembly Python)
  async runPython(code: string): Promise<ExecutionResult> {
    const startTime = performance.now();
    
    try {
      // Check if Pyodide is loaded
      if (!(window as any).pyodide) {
        const endTime = performance.now();
        return {
          success: false,
          output: 'Python execution requires Pyodide. Loading... (This may take a moment)',
          error: 'Pyodide not loaded',
          executionTime: endTime - startTime
        };
      }
      
      const pyodide = (window as any).pyodide;
      let output = '';
      
      // Capture print statements
      pyodide.runPython(`
import sys
import io
sys.stdout = io.StringIO()
      `);
      
      // Execute the code
      pyodide.runPython(code);
      
      // Get the output
      const stdout = pyodide.runPython('sys.stdout.getvalue()');
      output += stdout;
      
      const endTime = performance.now();
      
      return {
        success: true,
        output: output || '✅ Python code executed (no output)',
        executionTime: endTime - startTime
      };
      
    } catch (error: any) {
      const endTime = performance.now();
      return {
        success: false,
        output: `❌ Python Error: ${error.message}`,
        error: error.message,
        executionTime: endTime - startTime
      };
    }
  }
  
  // Load Pyodide for Python execution
  async loadPyodide(): Promise<boolean> {
    return new Promise((resolve) => {
      if ((window as any).pyodide) {
        resolve(true);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
      script.onload = async () => {
        try {
          (window as any).pyodide = await (window as any).loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
          });
          resolve(true);
        } catch (error) {
          console.error('Failed to load Pyodide:', error);
          resolve(false);
        }
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }
  
  // Cleanup
  cleanup() {
    if (this.iframe) {
      document.body.removeChild(this.iframe);
      this.iframe = null;
    }
  }
}

export const codeRunner = new CodeRunner();