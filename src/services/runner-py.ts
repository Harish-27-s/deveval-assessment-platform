import type { RunnerResponse } from './runner-js';

// Declare global properties for TypeScript compilation
declare global {
  interface Window {
    loadPyodide?: any;
    pyodideInstance?: any;
  }
}

let pyodideLoadingPromise: Promise<any> | null = null;

const loadPyodideScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.loadPyodide) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Pyodide WebAssembly script from CDN. Check your internet connection.'));
    document.head.appendChild(script);
  });
};

export const initPyodide = async (onProgress?: (msg: string) => void): Promise<any> => {
  if (window.pyodideInstance) {
    return window.pyodideInstance;
  }

  if (pyodideLoadingPromise) {
    return pyodideLoadingPromise;
  }

  pyodideLoadingPromise = (async () => {
    if (onProgress) onProgress('Downloading Python WASM runtime...');
    await loadPyodideScript();

    if (onProgress) onProgress('Initializing Python environment...');
    const pyodide = await window.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
    });

    // Override built-ins like input() to prevent generic OS I/O Errors and guide candidates
    try {
      await pyodide.runPythonAsync(`
import builtins
def friendly_input(*args, **kwargs):
    raise RuntimeError("input() is not supported in this non-interactive environment. Please write your solution to accept parameters instead.")
builtins.input = friendly_input
      `);
    } catch (e) {
      console.warn('Failed to override builtins.input in Pyodide:', e);
    }

    window.pyodideInstance = pyodide;
    if (onProgress) onProgress('Python ready.');
    return pyodide;
  })();

  return pyodideLoadingPromise;
};

/**
 * Strips Pyodide internals and dynamic testing wrapper elements from python error messages / tracebacks.
 * Keeps stack frames pointing directly to candidate's line numbers in their custom code.
 */
export const cleanPythonError = (errorMsg: string): string => {
  if (!errorMsg) return errorMsg;
  
  const lines = errorMsg.split('\n');
  const cleanedLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if it's a file stack frame line
    if (line.startsWith('  File "')) {
      // 1. Skip Pyodide/Python base interpreter runtime files
      if (
        line.includes('_pyodide') || 
        line.includes('/lib/python') || 
        line.includes('eval_code_async') || 
        line.includes('CodeRunner')
      ) {
        // Skip code line context if it exists
        if (i + 1 < lines.length && (lines[i + 1].startsWith('    ') || lines[i + 1].includes('CodeRunner(') || lines[i + 1].includes('coroutine = eval('))) {
          i++;
        }
        // Skip caret line if it exists
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('^')) {
          i++;
        }
        continue;
      }
      
      // 2. Skip our dynamic test case executor runner script stack frames
      if (line.includes('in run_tests')) {
        // Skip code line context if it exists
        if (i + 1 < lines.length && lines[i + 1].startsWith('    ')) {
          i++;
        }
        // Skip caret line if it exists
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('^')) {
          i++;
        }
        continue;
      }
    }
    
    cleanedLines.push(line);
  }
  
  return cleanedLines.join('\n').trim();
};

export const runPython = async (
  code: string,
  functionName: string,
  testCases: { id: number; input: any[] }[],
  onProgress?: (msg: string) => void
): Promise<RunnerResponse> => {
  const logs: string[] = [];
  
  try {
    const pyodide = await initPyodide(onProgress);

    // Set up stdout to capture print() calls
    pyodide.setStdout({
      batched: (text: string) => {
        logs.push(text);
      },
    });
    
    pyodide.setStderr({
      batched: (text: string) => {
        logs.push(`[stderr] ${text}`);
      },
    });

    // Run the user's Python code to load function definitions into globals
    await pyodide.runPythonAsync(code);

    // Inject parameters for test runner serialization
    pyodide.globals.set('__test_cases_json__', JSON.stringify(testCases));
    pyodide.globals.set('__target_function_name__', functionName);

    const runnerScript = `
import json
import time
import traceback

def run_tests():
    tc_data = json.loads(__test_cases_json__)
    func = globals().get(__target_function_name__)
    
    if not func:
        return json.dumps({
            "success": False, 
            "error": f"Function '{__target_function_name__}' was not found. Please verify your function definition."
        })
    
    results = []
    for tc in tc_data:
        tc_id = tc['id']
        args = tc['input']
        
        start = time.perf_counter()
        try:
            # Call user function with unpacked arguments
            out_val = func(*args)
            duration = (time.perf_counter() - start) * 1000
            results.append({
                "id": tc_id,
                "output": out_val,
                "duration": round(duration, 2),
                "success": True
            })
        except Exception as e:
            tb_str = traceback.format_exc()
            duration = (time.perf_counter() - start) * 1000
            results.append({
                "id": tc_id,
                "output": None,
                "duration": round(duration, 2),
                "success": False,
                "error": tb_str
            })
            
    return json.dumps({"success": True, "results": results})

run_tests()
`;

    const runnerJsonResult = await pyodide.runPythonAsync(runnerScript);
    const parsed = JSON.parse(runnerJsonResult);

    if (!parsed.success) {
      return {
        success: false,
        error: cleanPythonError(parsed.error),
        logs,
      };
    }

    // Clean errors inside individual test case execution details
    const cleanedResults = parsed.results.map((r: any) => {
      if (!r.success && r.error) {
        return {
          ...r,
          error: cleanPythonError(r.error),
        };
      }
      return r;
    });

    return {
      success: true,
      results: cleanedResults,
      logs,
    };
  } catch (err: any) {
    return {
      success: false,
      error: cleanPythonError(err.message || String(err)),
      logs,
    };
  }
};
