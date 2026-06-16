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

    // Inject parameters for test runner serialization
    pyodide.globals.set('__candidate_code__', code);
    pyodide.globals.set('__test_cases_json__', JSON.stringify(testCases));
    pyodide.globals.set('__target_function_name__', functionName);

    const runnerScript = `
import json
import time
import traceback
import sys
import io
import builtins

def run_tests():
    tc_data = json.loads(__test_cases_json__)
    func_name = __target_function_name__
    candidate_code = __candidate_code__
    
    results = []
    original_stdin = sys.stdin
    original_input = builtins.input
    original_stdout = sys.stdout
    
    try:
        for tc in tc_data:
            tc_id = tc['id']
            args = tc['input']
            
            # Serialize arguments to lines of text for stdin
            stdin_lines = []
            for arg in args:
                if isinstance(arg, str):
                    stdin_lines.append(arg)
                elif isinstance(arg, (list, dict)):
                    stdin_lines.append(json.dumps(arg))
                else:
                    stdin_lines.append(str(arg))
            
            stdin_content = "\\n".join(stdin_lines) + "\\n"
            sys.stdin = io.StringIO(stdin_content)
            
            def mocked_input(prompt=""):
                line = sys.stdin.readline()
                if not line:
                    raise EOFError("EOF when reading a line")
                if line.endswith('\\n'):
                    line = line[:-1]
                if line.endswith('\\r'):
                    line = line[:-1]
                return line
            
            builtins.input = mocked_input
            
            # Capture stdout separately for this testcase
            captured_stdout = io.StringIO()
            sys.stdout = captured_stdout
            
            start = time.perf_counter()
            
            # Setup a clean sandboxed namespace for code execution
            sandbox_globals = {
                "__builtins__": builtins,
                "sys": sys,
                "io": io,
                "json": json,
                "time": time,
            }
            # Copy other default globals
            for k, v in globals().items():
                if k not in ["run_tests", "__test_cases_json__", "__target_function_name__", "__candidate_code__"]:
                    sandbox_globals[k] = v
            
            success = True
            error_msg = None
            out_val = None
            
            try:
                exec(candidate_code, sandbox_globals)
                
                # Try getting the function if defined
                func = sandbox_globals.get(func_name)
                if func and callable(func):
                    res = func(*args)
                    if res is not None:
                        out_val = res
                    else:
                        # Fallback to stdout if function returned None but printed
                        stdout_str = captured_stdout.getvalue().strip()
                        if stdout_str:
                            try:
                                out_val = json.loads(stdout_str)
                            except:
                                out_val = stdout_str
                        else:
                            out_val = None
                else:
                    # Standard I/O output processing
                    stdout_str = captured_stdout.getvalue().strip()
                    if stdout_str:
                        try:
                            out_val = json.loads(stdout_str)
                        except:
                            out_val = stdout_str
                    else:
                        out_val = ""
                        
                duration = (time.perf_counter() - start) * 1000
            except Exception as e:
                tb_str = traceback.format_exc()
                duration = (time.perf_counter() - start) * 1000
                success = False
                error_msg = tb_str
            finally:
                sys.stdout = original_stdout
                # Flush stdout log
                val = captured_stdout.getvalue()
                if val:
                    sys.stdout.write(val)
            
            if success:
                results.append({
                    "id": tc_id,
                    "output": out_val,
                    "duration": round(duration, 2),
                    "success": True
                })
            else:
                results.append({
                    "id": tc_id,
                    "output": None,
                    "duration": round(duration, 2),
                    "success": False,
                    "error": error_msg
                })
    finally:
        sys.stdin = original_stdin
        builtins.input = original_input
        sys.stdout = original_stdout
        
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
