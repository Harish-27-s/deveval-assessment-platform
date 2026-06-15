export interface RunResult {
  id: number;
  output: any;
  duration: number;
  success: boolean;
  error?: string;
}

export interface RunnerResponse {
  success: boolean;
  results?: RunResult[];
  logs: string[];
  error?: string;
}

const workerCode = `
  self.onmessage = function(e) {
    const { code, functionName, testCases } = e.data;
    const logs = [];
    
    // Override console.log to intercept print statements
    const originalLog = console.log;
    console.log = function(...args) {
      logs.push(args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch(e) {
            return '[Circular Object]';
          }
        }
        return String(arg);
      }).join(' '));
    };

    try {
      // Evaluate user code in the worker context
      // Note: Running in Web Worker is safe as it runs in a sandboxed thread with no access to DOM, cookies, window, or localStorage.
      
      // We will parse the code. To expose functions declared as "function myName()", we assign them to self.
      // E.g., if code defines "function twoSum...", we evaluate it and then check self.twoSum.
      // To ensure normal function declarations are attached to self, we evaluate in global scope.
      
      const evalGlobal = eval;
      evalGlobal(code);

      // Check if function is defined on self or in the global scope of the worker
      let targetFunc = self[functionName];
      if (typeof targetFunc !== 'function') {
        // Fallback: try checking if it's declared in local context of eval (or check the global scope properties)
        if (typeof evalGlobal(functionName) === 'function') {
          targetFunc = evalGlobal(functionName);
        } else {
          throw new Error(\`Function "\${functionName}" is not defined. Please check your function name.\`);
        }
      }

      const results = [];
      for (const tc of testCases) {
        // Deep clone the input arguments so user code doesn't mutate test inputs between iterations
        const inputArgs = JSON.parse(JSON.stringify(tc.input));
        const start = performance.now();
        
        let outVal;
        try {
          outVal = targetFunc(...inputArgs);
          const duration = performance.now() - start;
          results.push({
            id: tc.id,
            output: outVal,
            duration: Math.round(duration * 100) / 100,
            success: true
          });
        } catch(execErr) {
          const duration = performance.now() - start;
          results.push({
            id: tc.id,
            output: null,
            duration: Math.round(duration * 100) / 100,
            success: false,
            error: execErr instanceof Error ? execErr.message : String(execErr)
          });
        }
      }
      
      self.postMessage({ type: 'success', results, logs });
    } catch(err) {
      self.postMessage({ type: 'error', error: err instanceof Error ? err.message : String(err), logs });
    }
  };
`;

export const runJavaScript = (
  code: string,
  functionName: string,
  testCases: { id: number; input: any[] }[],
  timeoutMs: number = 2000
): Promise<RunnerResponse> => {
  return new Promise((resolve) => {
    let worker: Worker | null = null;
    let timer: number | null = null;

    const cleanup = () => {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      worker = new Worker(workerUrl);

      // Timeout watchdog
      timer = window.setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          error: 'Time Limit Exceeded: Your code took too long to run. Please check for infinite loops or improve its time complexity.',
          logs: []
        });
      }, timeoutMs);

      worker.onmessage = (e) => {
        cleanup();
        if (e.data.type === 'success') {
          resolve({
            success: true,
            results: e.data.results,
            logs: e.data.logs
          });
        } else {
          resolve({
            success: false,
            error: e.data.error,
            logs: e.data.logs
          });
        }
      };

      worker.onerror = (err) => {
        cleanup();
        resolve({
          success: false,
          error: err.message || 'Worker compilation error.',
          logs: []
        });
      };

      // Post execution request
      worker.postMessage({ code, functionName, testCases });
    } catch (err) {
      cleanup();
      resolve({
        success: false,
        error: err instanceof Error ? err.message : String(err),
        logs: []
      });
    }
  });
};
