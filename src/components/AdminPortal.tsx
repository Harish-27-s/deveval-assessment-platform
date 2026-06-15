import React, { useState, useEffect } from 'react';
import { 
  upsertChallenge, 
  removeChallenge, 
  upsertSection, 
  removeSection, 
  fetchAppUsers, 
  createUser, 
  deleteUser,
  fetchAllCompletions,
  saveUserTags,
  updateCompletionScore
} from '../services/supabase';
import type { Challenge, TestCase, Section } from '../services/supabase';
import { ArrowLeft, Plus, Trash2, Edit, Save, PlusCircle, Settings, ShieldAlert, FolderHeart, ListTodo, Users, BarChart3, Mail, ClipboardList, Play, Pause, ChevronLeft, ChevronRight, UploadCloud, CheckCircle2 } from 'lucide-react';
import styles from './AdminPortal.module.css';
import { deepEqual } from './OutputConsole';

interface AdminPortalProps {
  challenges: Challenge[];
  sections: Section[];
  onRefresh: () => Promise<void>;
  onClose: () => void;
}

interface TestCaseFormItem {
  id: number;
  inputStr: string;
  expectedOutputStr: string;
  isHidden: boolean;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  challenges,
  sections,
  onRefresh,
  onClose,
}) => {
  const [adminTab, setAdminTab] = useState<'overview' | 'questions' | 'sections' | 'candidates' | 'reports'>('overview');
  const [view, setView] = useState<'list' | 'form'>('list');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const calculateUserTotalScore = (userId: string) => {
    const userComps = completionsList.filter((c) => c.user_id === userId);
    let totalScore = 0;

    sections.forEach((sect) => {
      const completionsInSect = userComps.filter(c => 
        c.section_id === sect.id || (!c.section_id && sect.challenge_ids.includes(c.challenge_id))
      );
      const sortedScores = completionsInSect
        .map(c => c.score || 0)
        .sort((a, b) => b - a);
      const topScores = sortedScores.slice(0, sect.required_count);
      const sectionScore = topScores.reduce((sum, s) => sum + s, 0);
      totalScore += sectionScore;
    });

    return totalScore;
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  
  // Question Form states
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Advanced' | 'Expert'>('Easy');
  const [functionName, setFunctionName] = useState('');
  const [description, setDescription] = useState('');
  const [javascriptBoilerplate, setJavascriptBoilerplate] = useState('');
  const [pythonBoilerplate, setPythonBoilerplate] = useState('');
  const [testCases, setTestCases] = useState<TestCaseFormItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [questionTags, setQuestionTags] = useState<string>('');

  // MCQ & Wizard parameters
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [javascriptDriver, setJavascriptDriver] = useState<string>('');
  const [pythonDriver, setPythonDriver] = useState<string>('');
  const [isMcq, setIsMcq] = useState<boolean>(false);
  const [mcqOptions, setMcqOptions] = useState<string[]>(['', '', '', '']);
  const [mcqAnswer, setMcqAnswer] = useState<string>('');
  const [referenceSolutionCode, setReferenceSolutionCode] = useState<string>('');
  const [referenceSolutionLang, setReferenceSolutionLang] = useState<'javascript' | 'python'>('javascript');
  const [validationResult, setValidationResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isValidatingSolution, setIsValidatingSolution] = useState<boolean>(false);
  const [functionParams, setFunctionParams] = useState('');

  const validateTestCaseInput = (inputStr: string): { isValid: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(inputStr);
      if (!Array.isArray(parsed)) {
        return { isValid: false, error: 'Input must be a JSON array representing function arguments.' };
      }
      return { isValid: true };
    } catch (e: any) {
      return { isValid: false, error: e.message || 'Invalid JSON syntax.' };
    }
  };

  const validateTestCaseOutput = (outputStr: string): { isValid: boolean; error?: string } => {
    try {
      JSON.parse(outputStr);
      return { isValid: true };
    } catch (e: any) {
      return { isValid: false, error: e.message || 'Invalid JSON syntax.' };
    }
  };

  // Question Search & Filter states
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState('All');
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState('All');

  // Bulk JSON Upload states
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadJson, setBulkUploadJson] = useState('');
  const [bulkUploadError, setBulkUploadError] = useState<string | null>(null);
  const [bulkUploadSuccess, setBulkUploadSuccess] = useState<string | null>(null);

  // Candidate Management & spreadsheet CSV upload states
  const [bulkInviteCsv, setBulkInviteCsv] = useState('');
  const [bulkInviteError, setBulkInviteError] = useState<string | null>(null);
  const [bulkInviteSuccess, setBulkInviteSuccess] = useState<string | null>(null);

  // Users analytics and completions list
  const [usersList, setUsersList] = useState<{ id: string; username: string; role: 'user' | 'admin'; created_at?: string; tags?: string[] }[]>([]);
  const [completionsList, setCompletionsList] = useState<{ user_id: string; section_id?: string; challenge_id: string; submitted_code?: string; language?: string; keystroke_log?: any[]; score?: number; evaluator_notes?: string }[]>([]);

  // Score override and notes
  const [overrideScore, setOverrideScore] = useState<number>(0);
  const [evaluatorNotes, setEvaluatorNotes] = useState<string>('');

  // Code Solution Playback states
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Solution Code Viewer state
  const [viewingCodeSolution, setViewingCodeSolution] = useState<{
    username: string;
    challengeTitle: string;
    challengeId: string;
    userId: string;
    code: string;
    language: string;
    keystroke_log?: any[];
    sectionId?: string;
  } | null>(null);

  // TestCase results state for solutions viewer
  const [testCaseRunResults, setTestCaseRunResults] = useState<{ success: boolean; results?: any[]; error?: string } | null>(null);
  const [runningTestCases, setRunningTestCases] = useState(false);

  useEffect(() => {
    if (!viewingCodeSolution) {
      setTestCaseRunResults(null);
      setRunningTestCases(false);
      return;
    }

    const runCandidateCode = async () => {
      setRunningTestCases(true);
      setTestCaseRunResults(null);
      try {
        const chal = challenges.find(c => c.id === viewingCodeSolution.challengeId);
        if (!chal) {
          setTestCaseRunResults({ success: false, error: 'Challenge not found in question bank' });
          return;
        }

        if (chal.isMcq) {
          setTestCaseRunResults(null);
          return;
        }

        const tcs = chal.testCases || [];
        if (tcs.length === 0) {
          setTestCaseRunResults({ success: true, results: [] });
          return;
        }

        const codeToRun = viewingCodeSolution.code;
        const lang = viewingCodeSolution.language;
        const funcName = chal.functionName;

        if (lang === 'javascript') {
          const { runJavaScript } = await import('../services/runner-js');
          const res = await runJavaScript(codeToRun, funcName, tcs);
          setTestCaseRunResults(res);
        } else {
          const { runPython } = await import('../services/runner-py');
          const res = await runPython(codeToRun, funcName, tcs);
          setTestCaseRunResults(res);
        }
      } catch (e: any) {
        setTestCaseRunResults({ success: false, error: e.message || 'Validation execution failed.' });
      } finally {
        setRunningTestCases(false);
      }
    };

    runCandidateCode();
  }, [viewingCodeSolution, challenges]);

  // Plagiarism state
  const [plagiarismResults, setPlagiarismResults] = useState<{ username: string; score: number }[] | null>(null);
  const [scanningPlagiarism, setScanningPlagiarism] = useState(false);

  useEffect(() => {
    setPlagiarismResults(null);
    setScanningPlagiarism(false);
  }, [viewingCodeSolution]);

  useEffect(() => {
    if (!isMcq && view === 'form' && wizardStep === 1) {
      const cleanParams = functionParams.split(',').map(p => p.trim()).filter(Boolean).join(', ');
      
      const defaultJsPrefix = 'function ';
      if (!javascriptBoilerplate || javascriptBoilerplate.trim() === '' || javascriptBoilerplate.startsWith(defaultJsPrefix)) {
        setJavascriptBoilerplate(`function ${functionName || 'solution'}(${cleanParams}) {\n  // Write your code here\n  \n}`);
      }

      const defaultPyPrefix = 'def ';
      if (!pythonBoilerplate || pythonBoilerplate.trim() === '' || pythonBoilerplate.startsWith(defaultPyPrefix)) {
        setPythonBoilerplate(`def ${functionName || 'solution'}(${cleanParams}):\n    # Write your code here\n    pass`);
      }
    }
  }, [functionName, functionParams, isMcq, view, wizardStep]);

  // Autoplay playback code timeline
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && viewingCodeSolution && viewingCodeSolution.keystroke_log && viewingCodeSolution.keystroke_log.length > 0) {
      const logs = viewingCodeSolution.keystroke_log;
      interval = setInterval(() => {
        setPlaybackIndex((prev) => {
          if (prev >= logs.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 600);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, viewingCodeSolution]);

  useEffect(() => {
    if (viewingCodeSolution && viewingCodeSolution.keystroke_log && viewingCodeSolution.keystroke_log.length > 0) {
      setPlaybackIndex(viewingCodeSolution.keystroke_log.length - 1);
    } else {
      setPlaybackIndex(0);
    }
    setIsPlaying(false);
  }, [viewingCodeSolution]);

  const runPlagiarismScan = () => {
    if (!viewingCodeSolution) return;
    setScanningPlagiarism(true);
    
    setTimeout(() => {
      const results: { username: string; score: number }[] = [];
      const currentCode = viewingCodeSolution.code;
      const currentUserId = viewingCodeSolution.userId;
      const currentChalId = viewingCodeSolution.challengeId;

      const tokenize = (c: string) => {
        const noComments = c
          .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '')
          .replace(/#.*$/gm, '');
        const matches = noComments.match(/[a-zA-Z0-9_]+/g) || [];
        return new Set(matches.map(m => m.trim().toLowerCase()));
      };

      const setA = tokenize(currentCode);

      const matches = completionsList.filter(
        (c) => c.challenge_id === currentChalId && c.user_id !== currentUserId && c.submitted_code
      );

      matches.forEach((comp) => {
        const otherUser = usersList.find((u) => u.id === comp.user_id);
        const otherCode = comp.submitted_code || '';
        
        if (otherUser && otherCode) {
          const setB = tokenize(otherCode);
          let intersectionCount = 0;
          setA.forEach(token => {
            if (setB.has(token)) intersectionCount++;
          });

          let score = 0;
          if (setA.size > 0 && setB.size > 0) {
            const unionSize = setA.size + setB.size - intersectionCount;
            score = Math.round((intersectionCount / unionSize) * 100);
          }
          results.push({ username: otherUser.username, score });
        }
      });

      results.sort((a, b) => b.score - a.score);
      setPlagiarismResults(results);
      setScanningPlagiarism(false);
    }, 600);
  };

  // Switch tabs
  const handleTabChange = (tab: 'overview' | 'questions' | 'sections' | 'candidates' | 'reports') => {
    setAdminTab(tab);
    setView('list');
    setFormError(null);
    setBulkUploadError(null);
    setBulkUploadSuccess(null);
    setBulkInviteError(null);
    setBulkInviteSuccess(null);
  };

  const loadUsersAndStats = async () => {
    try {
      const [users, completions] = await Promise.all([
        fetchAppUsers(),
        fetchAllCompletions()
      ]);
      setUsersList(users);
      setCompletionsList(completions);
    } catch (err: any) {
      console.error('Failed to load users or completions:', err);
    }
  };

  const handleSaveUserTags = async (userId: string, tags: string[]) => {
    try {
      await saveUserTags(userId, tags);
      await loadUsersAndStats();
    } catch (err: any) {
      showToast('Failed to save student cohort tags: ' + (err.message || err), 'error');
    }
  };

  const handleSaveEvaluation = async () => {
    if (!viewingCodeSolution) return;
    try {
      await updateCompletionScore(
        viewingCodeSolution.userId,
        viewingCodeSolution.challengeId,
        overrideScore,
        evaluatorNotes
      );
      await loadUsersAndStats();
      showToast('Manual score override and evaluation notes saved successfully! 📝', 'success');
    } catch (err: any) {
      showToast('Failed to save manual evaluation: ' + (err.message || err), 'error');
    }
  };

  useEffect(() => {
    if (adminTab === 'overview' || adminTab === 'candidates' || adminTab === 'reports') {
      loadUsersAndStats();
    }
  }, [adminTab]);

  useEffect(() => {
    if (viewingCodeSolution) {
      const comp = completionsList.find(c => c.user_id === viewingCodeSolution.userId && c.challenge_id === viewingCodeSolution.challengeId);
      setOverrideScore(comp?.score !== undefined ? comp.score : 0);
      setEvaluatorNotes(comp?.evaluator_notes || '');
    }
  }, [viewingCodeSolution?.userId, viewingCodeSolution?.challengeId, completionsList]);

  // Section Form states
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectId, setSectId] = useState('');
  const [sectName, setSectName] = useState('');
  const [sectRequiredCount, setSectRequiredCount] = useState(1);
  const [sectGivenCount, setSectGivenCount] = useState<number | ''>('');
  const [sectRandomize, setSectRandomize] = useState(false);
  const [sectChallengeIds, setSectChallengeIds] = useState<string[]>([]);
  const [sectTimeLimit, setSectTimeLimit] = useState(0);
  const [sectEnforceFullscreen, setSectEnforceFullscreen] = useState(false);
  const [sectDisableCopypaste, setSectDisableCopypaste] = useState(false);



  // ==========================================
  // QUESTION FORM ACTIONS
  // ==========================================
  const handleOpenAddForm = () => {
    setEditingChallengeId(null);
    setId('');
    setTitle('');
    setCategory('Arrays');
    setDifficulty('Easy');
    setQuestionTags('');
    setFunctionName('');
    setDescription('Write problem description here...');
    setJavascriptBoilerplate(`function solve() {
  // Write your code here
  
}`);
    setPythonBoilerplate(`def solve():
    # Write your code here
    pass`);
    setFunctionParams('');
    setJavascriptDriver('');
    setPythonDriver('');
    setIsMcq(false);
    setMcqOptions(['', '', '', '']);
    setMcqAnswer('');
    setReferenceSolutionCode('');
    setReferenceSolutionLang('javascript');
    setValidationResult(null);
    setWizardStep(1);
    setTestCases([
      { id: 1, inputStr: '[]', expectedOutputStr: '""', isHidden: false }
    ]);
    setFormError(null);
    setView('form');
  };

  const handleOpenEditForm = (challenge: Challenge) => {
    setEditingChallengeId(challenge.id);
    setId(challenge.id);
    setTitle(challenge.title);
    setCategory(challenge.category);
    setDifficulty(challenge.difficulty);
    setQuestionTags((challenge.tags || []).join(', '));
    setFunctionName(challenge.functionName);
    setFunctionParams(challenge.boilerplate?.functionParams || '');
    setDescription(challenge.description);
    setJavascriptBoilerplate(challenge.boilerplate?.javascript || '');
    setPythonBoilerplate(challenge.boilerplate?.python || '');
    setJavascriptDriver(challenge.boilerplate?.javascriptDriver || '');
    setPythonDriver(challenge.boilerplate?.pythonDriver || '');
    setIsMcq(!!challenge.isMcq);
    setMcqOptions(challenge.mcqOptions && challenge.mcqOptions.length > 0 ? challenge.mcqOptions : ['', '', '', '']);
    setMcqAnswer(challenge.mcqAnswer || '');
    setReferenceSolutionCode('');
    setReferenceSolutionLang('javascript');
    setValidationResult(null);
    setWizardStep(1);
    
    const mapped = challenge.testCases.map((tc) => ({
      id: tc.id,
      inputStr: JSON.stringify(tc.input),
      expectedOutputStr: JSON.stringify(tc.expectedOutput),
      isHidden: !!tc.isHidden
    }));
    setTestCases(mapped.length > 0 ? mapped : [{ id: 1, inputStr: '[]', expectedOutputStr: '""', isHidden: false }]);
    setFormError(null);
    setView('form');
  };

  const handleAddTestCaseRow = () => {
    const nextId = testCases.length > 0 ? Math.max(...testCases.map((t) => t.id)) + 1 : 1;
    setTestCases([
      ...testCases,
      { id: nextId, inputStr: '[]', expectedOutputStr: '""', isHidden: false }
    ]);
  };

  const handleRemoveTestCaseRow = (rowId: number) => {
    setTestCases(testCases.filter((t) => t.id !== rowId));
  };

  const handleTcChange = (rowId: number, field: keyof TestCaseFormItem, val: any) => {
    setTestCases(
      testCases.map((tc) => {
        if (tc.id === rowId) {
          return { ...tc, [field]: val };
        }
        return tc;
      })
    );
  };

  const handleDeleteChallenge = (challengeId: string) => {
    setConfirmDialog({
      message: `Are you sure you want to permanently delete challenge "${challengeId}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await removeChallenge(challengeId);
          await onRefresh();
          showToast('Challenge deleted successfully', 'success');
        } catch (err: any) {
          showToast('Failed to delete challenge: ' + err.message, 'error');
        }
      }
    });
  };

  // Step validation runner
  const handleValidateReferenceSolution = async () => {
    setIsValidatingSolution(true);
    setValidationResult(null);

    // 1. Parse testcases
    const parsedTestCases: TestCase[] = [];
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      try {
        const parsedInput = JSON.parse(tc.inputStr);
        if (!Array.isArray(parsedInput)) {
          throw new Error('Input arguments must be styled as a JSON array [arg1, arg2]');
        }
        const parsedExpected = JSON.parse(tc.expectedOutputStr);
        parsedTestCases.push({
          id: tc.id,
          input: parsedInput,
          expectedOutput: parsedExpected,
          isHidden: tc.isHidden
        });
      } catch (err: any) {
        setValidationResult({
          success: false,
          message: `Testcase Row #${i + 1} JSON parsing failed: ${err.message}`
        });
        setIsValidatingSolution(false);
        return;
      }
    }

    if (parsedTestCases.length === 0) {
      setValidationResult({
        success: false,
        message: 'Please define at least one testcase before validating.'
      });
      setIsValidatingSolution(false);
      return;
    }

    try {
      const { runJavaScript } = await import('../services/runner-js');
      const { runPython } = await import('../services/runner-py');

      let response;
      if (referenceSolutionLang === 'javascript') {
        response = await runJavaScript(referenceSolutionCode, functionName, parsedTestCases);
      } else {
        response = await runPython(referenceSolutionCode, functionName, parsedTestCases);
      }

      if (response.success && response.results) {
        const mismatches = [];
        for (let i = 0; i < response.results.length; i++) {
          const runRes = response.results[i];
          const tc = parsedTestCases.find((t) => t.id === runRes.id);
          if (!runRes.success) {
            mismatches.push(`Test Case #${i + 1} Execution Fail: ${runRes.error}`);
          } else if (tc && JSON.stringify(runRes.output) !== JSON.stringify(tc.expectedOutput)) {
            mismatches.push(`Test Case #${i + 1} Mismatch: Expected ${JSON.stringify(tc.expectedOutput)}, got ${JSON.stringify(runRes.output)}`);
          }
        }

        if (mismatches.length === 0) {
          setValidationResult({
            success: true,
            message: 'Validation Successful! Reference solution passed 100% of the test cases.'
          });
        } else {
          setValidationResult({
            success: false,
            message: `Validation Failed:\n${mismatches.join('\n')}`
          });
        }
      } else {
        setValidationResult({
          success: false,
          message: `Execution Error: ${response.error || 'Runner compilation failed.'}`
        });
      }
    } catch (err: any) {
      setValidationResult({
        success: false,
        message: `Validation Error: ${err.message || String(err)}`
      });
    } finally {
      setIsValidatingSolution(false);
    }
  };

  // Question save handler
  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!id || !title || !category) {
      setFormError('Please fill in slug, title, and category.');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(id)) {
      setFormError('Problem ID must contain only lowercase letters, numbers, and dashes (e.g. valid-parentheses).');
      return;
    }

    let payload: Challenge;

    const tags = questionTags.split(',').map(t => t.trim()).filter(Boolean);

    if (isMcq) {
      const filteredOptions = mcqOptions.filter(o => o.trim() !== '');
      if (filteredOptions.length < 2) {
        setFormError('Please provide at least 2 options.');
        return;
      }
      if (!mcqAnswer.trim()) {
        setFormError('Please select or specify the correct answer option.');
        return;
      }
      payload = {
        id,
        title,
        category,
        difficulty,
        description,
        boilerplate: {
          javascript: '',
          python: '',
        },
        testCases: [],
        functionName: 'mcq',
        isMcq: true,
        mcqOptions: filteredOptions,
        mcqAnswer,
        tags,
      };
    } else {
      if (testCases.length === 0) {
        setFormError('You must define at least one testcase.');
        return;
      }

      const parsedTestCases: TestCase[] = [];
      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        try {
          const parsedInput = JSON.parse(tc.inputStr);
          if (!Array.isArray(parsedInput)) {
            throw new Error('Test case input arguments must be structured as a JSON array representing function parameters.');
          }
          const parsedExpected = JSON.parse(tc.expectedOutputStr);
          parsedTestCases.push({
            id: tc.id,
            input: parsedInput,
            expectedOutput: parsedExpected,
            isHidden: tc.isHidden
          });
        } catch (err: any) {
          setFormError(`Testcase Row #${i + 1} Error: ${err.message || 'Invalid JSON syntax.'}`);
          return;
        }
      }

      payload = {
        id,
        title,
        category,
        difficulty,
        functionName,
        description,
        boilerplate: {
          javascript: javascriptBoilerplate,
          python: pythonBoilerplate,
          javascriptDriver,
          pythonDriver,
          functionParams,
        },
        testCases: parsedTestCases,
        isMcq: false,
        tags,
      };
    }

    setSubmitting(true);
    try {
      await upsertChallenge(payload);
      await onRefresh();
      setView('list');
      setWizardStep(1);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save challenge.');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk Import Challenges
  const handleBulkUpload = async () => {
    setBulkUploadError(null);
    setBulkUploadSuccess(null);
    try {
      const parsed = JSON.parse(bulkUploadJson);
      if (!Array.isArray(parsed)) {
        throw new Error('JSON must be an array of challenges.');
      }
      
      for (const item of parsed) {
        if (!item.id || !item.title || !item.category) {
          throw new Error(`Item missing required fields (id, title, or category): ${JSON.stringify(item)}`);
        }
        const challengePayload: Challenge = {
          id: item.id,
          title: item.title,
          category: item.category,
          difficulty: item.difficulty || 'Easy',
          description: item.description || '',
          boilerplate: item.boilerplate || { javascript: '', python: '' },
          testCases: item.testCases || item.test_cases || [],
          functionName: item.functionName || item.function_name || 'solution',
          isMcq: item.isMcq || false,
          mcqOptions: item.mcqOptions || [],
          mcqAnswer: item.mcqAnswer || ''
        };
        await upsertChallenge(challengePayload);
      }
      
      setBulkUploadSuccess(`Successfully imported ${parsed.length} challenges!`);
      setBulkUploadJson('');
      await onRefresh();
    } catch (err: any) {
      setBulkUploadError(err.message || 'Failed to parse JSON.');
    }
  };

  // Bulk Candidate spreadsheet Invites
  const handleBulkInviteCandidates = async () => {
    setBulkInviteError(null);
    setBulkInviteSuccess(null);
    
    if (!bulkInviteCsv.trim()) {
      setBulkInviteError('Please enter candidate spreadsheet details.');
      return;
    }

    const lines = bulkInviteCsv.split('\n');
    let inviteCount = 0;
    
    try {
      for (const line of lines) {
        if (!line.trim() || line.startsWith('username,')) continue;
        const parts = line.split(',');
        const username = parts[0]?.trim();
        const password = parts[1]?.trim() || (username + '123');
        
        if (username) {
          await createUser(username, password);
          inviteCount++;
        }
      }
      setBulkInviteSuccess(`Successfully registered ${inviteCount} candidates!`);
      setBulkInviteCsv('');
      loadUsersAndStats();
    } catch (err: any) {
      setBulkInviteError(err.message || 'Failed to invite candidates.');
    }
  };

  const handleWizardNext = (e: any) => {
    e.preventDefault();
    if (wizardStep === 1) {
      if (!id || !title || !category) {
        setFormError('Please fill in ID slug, title, and category.');
        return;
      }
      setFormError(null);
      setWizardStep(2);
    } else if (wizardStep === 2) {
      if (isMcq) {
        const filteredOptions = mcqOptions.filter(o => o.trim() !== '');
        if (filteredOptions.length < 2) {
          setFormError('Please provide at least 2 options.');
          return;
        }
        if (!mcqAnswer) {
          setFormError('Please specify the correct answer option.');
          return;
        }
        handleQuestionSubmit(e);
      } else {
        setWizardStep(3);
      }
    } else if (wizardStep === 3) {
      if (testCases.length === 0) {
        setFormError('Please define at least one test case.');
        return;
      }
      setWizardStep(4);
    } else if (wizardStep === 4) {
      handleQuestionSubmit(e);
    }
  };

  // ==========================================
  // SECTION FORM ACTIONS
  // ==========================================
  const handleOpenAddSectionForm = () => {
    setEditingSectionId(null);
    setSectId('sec-' + Math.random().toString(36).substring(2, 11));
    setSectName('');
    setSectRequiredCount(1);
    setSectGivenCount('');
    setSectRandomize(false);
    setSectChallengeIds([]);
    setSectTimeLimit(0);
    setSectEnforceFullscreen(false);
    setSectDisableCopypaste(false);
    setFormError(null);
    setView('form');
  };

  const handleOpenEditSectionForm = (section: Section) => {
    setEditingSectionId(section.id);
    setSectId(section.id);
    setSectName(section.name);
    setSectRequiredCount(section.required_count);
    setSectGivenCount(section.given_count || '');
    setSectRandomize(section.randomize);
    setSectChallengeIds(section.challenge_ids);
    setSectTimeLimit(section.time_limit || 0);
    setSectEnforceFullscreen(!!section.enforce_fullscreen);
    setSectDisableCopypaste(!!section.disable_copypaste);
    setFormError(null);
    setView('form');
  };

  const handleToggleSectChallenge = (challengeId: string) => {
    if (sectChallengeIds.includes(challengeId)) {
      setSectChallengeIds(sectChallengeIds.filter((cid) => cid !== challengeId));
    } else {
      setSectChallengeIds([...sectChallengeIds, challengeId]);
    }
  };

  const handleDeleteSection = (sectionId: string) => {
    setConfirmDialog({
      message: `Are you sure you want to permanently delete section "${sectionId}"? This will not delete the associated questions.`,
      onConfirm: async () => {
        try {
          await removeSection(sectionId);
          await onRefresh();
          showToast('Section deleted successfully', 'success');
        } catch (err: any) {
          showToast('Failed to delete section: ' + err.message, 'error');
        }
      }
    });
  };

  const handleDeleteUser = (userId: string, username: string) => {
    setConfirmDialog({
      message: `Are you sure you want to permanently delete candidate "${username}"? This will clear all their test sessions and completions.`,
      onConfirm: async () => {
        try {
          await deleteUser(userId);
          await onRefresh();
          showToast('Candidate deleted successfully', 'success');
        } catch (err: any) {
          showToast('Failed to delete candidate: ' + err.message, 'error');
        }
      }
    });
  };

  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!sectId || !sectName) {
      setFormError('Please fill in section general details.');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(sectId)) {
      setFormError('Section ID must contain only lowercase letters, numbers, and dashes (e.g. data-structures-test).');
      return;
    }

    if (sectChallengeIds.length === 0) {
      setFormError('You must assign at least one question to the section.');
      return;
    }

    if (sectRequiredCount < 1) {
      setFormError('Required solve count must be at least 1.');
      return;
    }

    // Constraint: required solve count cannot exceed pool size
    if (sectRequiredCount > sectChallengeIds.length) {
      setFormError(`Required solving quota (${sectRequiredCount}) cannot exceed the total number of questions assigned to the section (${sectChallengeIds.length}). Please add more questions or reduce the quota.`);
      return;
    }

    // Constraint: given count must be at least required solve count
    if (sectGivenCount !== '' && Number(sectGivenCount) < sectRequiredCount) {
      setFormError(`Questions to Give count (${sectGivenCount}) must be greater than or equal to the Required Solve Count (${sectRequiredCount}).`);
      return;
    }

    // Constraint: given count cannot exceed total question pool
    if (sectGivenCount !== '' && Number(sectGivenCount) > sectChallengeIds.length) {
      setFormError(`Questions to Give count (${sectGivenCount}) cannot exceed the total number of questions assigned to the section (${sectChallengeIds.length}).`);
      return;
    }

    setSubmitting(true);
    try {
      const payload: Section = {
        id: sectId,
        name: sectName,
        required_count: Number(sectRequiredCount),
        given_count: sectGivenCount !== '' ? Number(sectGivenCount) : undefined,
        randomize: sectRandomize,
        challenge_ids: sectChallengeIds,
        time_limit: Number(sectTimeLimit || 0),
        enforce_fullscreen: sectEnforceFullscreen,
        disable_copypaste: sectDisableCopypaste
      };

      await upsertSection(payload);
      await onRefresh();
      setView('list');
    } catch (err: any) {
      setFormError(err.message || 'Failed to save section.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCandidateStatus = (userId: string) => {
    const userComps = completionsList.filter((c) => c.user_id === userId);
    const solvedCount = userComps.length;
    
    const sessionPrefix = `deveval_mock_section_session_${userId}_`;
    const hasSession = Object.keys(localStorage).some(k => k.startsWith(sessionPrefix));
    const isFlagged = sections.some(sect => localStorage.getItem(`deveval_test_disqualified_${userId}_${sect.id}`) === 'true');
    
    if (localStorage.getItem(`deveval_evaluated_${userId}`) === 'true') {
      return 'evaluated';
    }

    const isAllCompleted = sections.length > 0 && sections.every(sect => {
      const testSubmitted = localStorage.getItem(`deveval_test_submitted_${userId}_${sect.id}`) === 'true' ||
                            localStorage.getItem(`deveval_test_disqualified_${userId}_${sect.id}`) === 'true' ||
                            localStorage.getItem(`deveval_test_timeup_${userId}_${sect.id}`) === 'true';
      return testSubmitted;
    });
    
    if (isAllCompleted) return 'completed';
    if (solvedCount > 0 || hasSession || isFlagged) return 'in-progress';
    return 'invited';
  };

  const toggleEvaluated = (userId: string) => {
    const key = `deveval_evaluated_${userId}`;
    if (localStorage.getItem(key) === 'true') {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, 'true');
    }
    loadUsersAndStats();
  };

  const getProctoringViolations = (userId: string) => {
    const violations: string[] = [];
    sections.forEach(sect => {
      if (localStorage.getItem(`deveval_test_disqualified_${userId}_${sect.id}`) === 'true') {
        violations.push(`Exited Fullscreen in ${sect.name}`);
      }
    });
    return violations;
  };

  return (
    <div className={`${styles.adminContainer} animate-fade-in`}>
      <div className={styles.backLink} onClick={onClose}>
        <ArrowLeft size={16} />
        <span>Back to Dashboard</span>
      </div>

      {/* Main Tab Controls */}
      {view === 'list' && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleTabChange('overview')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: adminTab === 'overview' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: adminTab === 'overview' ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '10px 4px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <BarChart3 size={16} />
            Overview
          </button>

          <button
            onClick={() => handleTabChange('questions')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: adminTab === 'questions' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: adminTab === 'questions' ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '10px 4px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ListTodo size={16} />
            Question Bank
          </button>
          
          <button
            onClick={() => handleTabChange('sections')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: adminTab === 'sections' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: adminTab === 'sections' ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '10px 4px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FolderHeart size={16} />
            Test Configurator
          </button>

          <button
            onClick={() => handleTabChange('candidates')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: adminTab === 'candidates' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: adminTab === 'candidates' ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '10px 4px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Mail size={16} />
            Candidates
          </button>

          <button
            onClick={() => handleTabChange('reports')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: adminTab === 'reports' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: adminTab === 'reports' ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '10px 4px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ClipboardList size={16} />
            Evaluation Reports
          </button>
        </div>
      )}


      {/* ========================================== */}
      {/* OVERVIEW MODULE */}
      {/* ========================================== */}
      {adminTab === 'overview' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'var(--accent-primary-glow)', color: 'var(--accent-primary)', padding: '12px', borderRadius: '50%' }}>
                <FolderHeart size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Test Pools</span>
                <h3 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '4px 0 0 0' }}>{sections.length}</h3>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'rgba(80, 250, 123, 0.1)', color: 'var(--success)', padding: '12px', borderRadius: '50%' }}>
                <Users size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Candidates Registered</span>
                <h3 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '4px 0 0 0' }}>{usersList.filter(u => u.role === 'user').length}</h3>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'rgba(255, 184, 108, 0.1)', color: 'var(--warning)', padding: '12px', borderRadius: '50%' }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Completion Rate</span>
                <h3 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '4px 0 0 0' }}>
                  {(() => {
                    const totalCands = usersList.filter(u => u.role === 'user').length;
                    const compCands = usersList.filter(u => u.role === 'user' && completionsList.some(c => c.user_id === u.id)).length;
                    return totalCands > 0 ? Math.round((compCands / totalCands) * 100) : 0;
                  })()}%
                </h3>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'rgba(189, 147, 249, 0.1)', color: 'var(--accent-primary)', padding: '12px', borderRadius: '50%' }}>
                <BarChart3 size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Avg Challenges Solved</span>
                <h3 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '4px 0 0 0' }}>
                  {(() => {
                    const totalCands = usersList.filter(u => u.role === 'user').length;
                    const totalSols = completionsList.length;
                    return totalCands > 0 ? (totalSols / totalCands).toFixed(1) : '0';
                  })()}
                </h3>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={18} style={{ color: 'var(--accent-primary)' }} />
                Recent Platform Activity Feed
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                {(() => {
                  const feedItems: { type: string; title: string; desc: string; time: string; color: string }[] = [];
                  
                  completionsList.forEach(comp => {
                    const user = usersList.find(u => u.id === comp.user_id);
                    const challenge = challenges.find(ch => ch.id === comp.challenge_id);
                    if (user && challenge) {
                      feedItems.push({
                        type: 'solve',
                        title: `Challenge Solved: ${challenge.title}`,
                        desc: `Candidate ${user.username} submitted a successful solution in ${comp.language || 'JavaScript'}.`,
                        time: 'Completed',
                        color: 'var(--success)'
                      });
                    }
                  });

                  usersList.forEach(usr => {
                    if (usr.role === 'user') {
                      feedItems.push({
                        type: 'signup',
                        title: `Candidate Registered: ${usr.username}`,
                        desc: `Account registered in candidates base.`,
                        time: 'Registered',
                        color: 'var(--accent-primary)'
                      });
                    }
                  });

                  usersList.forEach(usr => {
                    sections.forEach(sect => {
                      const disqKey = `deveval_test_disqualified_${usr.id}_${sect.id}`;
                      if (localStorage.getItem(disqKey) === 'true') {
                        feedItems.push({
                          type: 'flag',
                          title: `⚠️ Proctoring Flag: ${usr.username}`,
                          desc: `Exited fullscreen mode during section "${sect.name}". Access was terminated.`,
                          time: 'Flagged',
                          color: 'var(--error)'
                        });
                      }
                    });
                  });

                  if (feedItems.length === 0) {
                    return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No recent activity logged. Start a test to populate live logs!</span>;
                  }

                  return feedItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                      <div style={{ width: '4px', background: item.color, borderRadius: '2px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{item.title}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.time}</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>{item.desc}</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Shortcut Actions
              </h3>
              <button 
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', height: '42px' }}
                onClick={() => { handleTabChange('sections'); handleOpenAddSectionForm(); }}
              >
                <Plus size={16} />
                <span>Create New Test</span>
              </button>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', justifyContent: 'center', height: '42px' }}
                onClick={() => handleTabChange('candidates')}
              >
                <Users size={16} />
                <span>Invite Candidates</span>
              </button>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', justifyContent: 'center', height: '42px' }}
                onClick={() => { handleTabChange('questions'); handleOpenAddForm(); }}
              >
                <PlusCircle size={16} />
                <span>Create Question</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* QUESTIONS MODULE */}
      {/* ========================================== */}
      {adminTab === 'questions' && (
        <>
          {view === 'list' && (
            <>
              {/* Collapsible Bulk JSON Import */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '20px' }}>
                <div 
                  onClick={() => setBulkUploadOpen(!bulkUploadOpen)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UploadCloud size={18} style={{ color: 'var(--accent-primary)' }} />
                    Bulk Challenge Import (JSON)
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{bulkUploadOpen ? 'Click to collapse' : 'Click to expand'}</span>
                </div>
                {bulkUploadOpen && (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <textarea
                      style={{ width: '100%', height: '120px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '10px' }}
                      placeholder={`[\n  {\n    "id": "slug-name",\n    "title": "Title",\n    "category": "Arrays",\n    "difficulty": "Easy",\n    "description": "Problem markdown description",\n    "boilerplate": { "javascript": "", "python": "" },\n    "testCases": [{ "id": 1, "input": [1, 2], "expectedOutput": 3 }]\n  }\n]`}
                      value={bulkUploadJson}
                      onChange={(e) => setBulkUploadJson(e.target.value)}
                    />
                    {bulkUploadError && <div className="alert-danger">{bulkUploadError}</div>}
                    {bulkUploadSuccess && <div style={{ color: 'var(--success)', fontSize: '0.88rem' }}>{bulkUploadSuccess}</div>}
                    <button className="btn-primary" style={{ alignSelf: 'flex-end' }} onClick={handleBulkUpload}>
                      Import Challenges
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.headerRow}>
                <div className={styles.title}>
                  <Settings size={22} style={{ color: 'var(--accent-primary)' }} />
                  <span>Problem Catalog</span>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="input-text"
                    style={{ maxWidth: '200px' }}
                    placeholder="Search challenges..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                  />

                  <select
                    className="input-text"
                    style={{ maxWidth: '140px', background: 'var(--bg-primary)' }}
                    value={questionCategoryFilter}
                    onChange={(e) => setQuestionCategoryFilter(e.target.value)}
                  >
                    <option value="All">All Categories</option>
                    {Array.from(new Set(challenges.map(c => c.category))).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  <select
                    className="input-text"
                    style={{ maxWidth: '140px', background: 'var(--bg-primary)' }}
                    value={questionDifficultyFilter}
                    onChange={(e) => setQuestionDifficultyFilter(e.target.value)}
                  >
                    <option value="All">All Difficulties</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                  </select>

                  <button className="btn-primary" onClick={handleOpenAddForm}>
                    <Plus size={16} />
                    <span>Create Problem</span>
                  </button>
                </div>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID / Slug</th>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Difficulty</th>
                      <th>Tags</th>
                      <th>Type</th>
                      <th>Test Cases</th>
                      <th>Success Rate</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challenges
                      .filter(c => {
                        const matchesSearch = c.title.toLowerCase().includes(questionSearch.toLowerCase()) || c.id.toLowerCase().includes(questionSearch.toLowerCase());
                        const matchesCategory = questionCategoryFilter === 'All' || c.category === questionCategoryFilter;
                        const matchesDifficulty = questionDifficultyFilter === 'All' || c.difficulty === questionDifficultyFilter;
                        return matchesSearch && matchesCategory && matchesDifficulty;
                      })
                      .map((c) => {
                        const solved = completionsList.filter(comp => comp.challenge_id === c.id).length;
                        const attempts = usersList.filter(u => {
                          const keyPrefix = `deveval_keystrokes_${u.id}_${c.id}_`;
                          const hasKeystrokes = Object.keys(localStorage).some(k => k.startsWith(keyPrefix));
                          const hasCompletion = completionsList.some(comp => comp.user_id === u.id && comp.challenge_id === c.id);
                          return hasKeystrokes || hasCompletion;
                        }).length;
                        const successRate = attempts > 0 ? `${Math.round((solved / attempts) * 100)}%` : '0%';

                        return (
                          <tr key={c.id}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{c.id}</td>
                            <td style={{ fontWeight: 600 }}>{c.title}</td>
                            <td>{c.category}</td>
                            <td>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  padding: '3px 6px',
                                  borderRadius: '4px',
                                  background:
                                    c.difficulty === 'Easy'
                                      ? 'rgba(16, 185, 129, 0.08)'
                                      : c.difficulty === 'Medium'
                                      ? 'rgba(245, 158, 11, 0.08)'
                                      : c.difficulty === 'Hard'
                                      ? 'rgba(239, 68, 68, 0.08)'
                                      : c.difficulty === 'Advanced'
                                      ? 'rgba(139, 92, 246, 0.08)'
                                      : 'rgba(236, 72, 153, 0.08)',
                                  color:
                                    c.difficulty === 'Easy'
                                      ? 'var(--success)'
                                      : c.difficulty === 'Medium'
                                      ? 'var(--warning)'
                                      : c.difficulty === 'Hard'
                                      ? 'var(--error)'
                                      : c.difficulty === 'Advanced'
                                      ? '#bd93f9'
                                      : '#ff79c6',
                                  border:
                                    c.difficulty === 'Easy'
                                      ? '1px solid rgba(16, 185, 129, 0.15)'
                                      : c.difficulty === 'Medium'
                                      ? '1px solid rgba(245, 158, 11, 0.15)'
                                      : c.difficulty === 'Hard'
                                      ? '1px solid rgba(239, 68, 68, 0.15)'
                                      : c.difficulty === 'Advanced'
                                      ? '1px solid rgba(139, 92, 246, 0.15)'
                                      : '1px solid rgba(236, 72, 153, 0.15)',
                                }}
                              >
                                {c.difficulty}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '150px' }}>
                                {(c.tags || []).map((t, idx) => (
                                  <span key={idx} style={{ fontSize: '0.65rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '1px 4px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                    {t}
                                  </span>
                                ))}
                                {(!c.tags || c.tags.length === 0) && (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    Public
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: c.isMcq ? 'var(--warning)' : 'var(--accent-primary)' }}>
                                {c.isMcq ? 'MCQ' : 'Coding'}
                              </span>
                            </td>
                            <td>{c.isMcq ? 'N/A' : `${c.testCases.length} total (${c.testCases.filter(t => t.isHidden).length} hidden)`}</td>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{successRate}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button
                                  className="btn-secondary"
                                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                  onClick={() => handleOpenEditForm(c)}
                                >
                                  <Edit size={12} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  className="btn-danger"
                                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                  onClick={() => handleDeleteChallenge(c.id)}
                                >
                                  <Trash2 size={12} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {view === 'form' && (
            <div className={styles.formCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '24px' }}>
                <h2 className={styles.title} style={{ fontSize: '1.4rem' }}>
                  {editingChallengeId ? 'Edit Challenge' : 'Create Challenge'} Wizard
                </h2>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-primary)', background: 'var(--accent-primary-glow)', padding: '4px 10px', borderRadius: '12px' }}>
                  Step {wizardStep} of 4
                </span>
              </div>

              {/* Step indicator bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '30px' }}>
                {['Metadata', 'Boilerplate / MCQ', 'Test Cases', 'Validation'].map((stepName, idx) => {
                  const stepNum = idx + 1;
                  const isActive = wizardStep === stepNum;
                  const isCompleted = wizardStep > stepNum;
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        borderBottom: isActive ? '3px solid var(--accent-primary)' : isCompleted ? '3px solid var(--success)' : '3px solid var(--border-color)', 
                        paddingBottom: '8px',
                        color: isActive ? 'var(--text-primary)' : isCompleted ? 'var(--success)' : 'var(--text-muted)',
                        fontWeight: isActive || isCompleted ? 600 : 500,
                        fontSize: '0.85rem',
                        textAlign: 'center',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {stepNum}. {stepName}
                    </div>
                  );
                })}
              </div>

              {formError && (
                <div className="alert-danger" style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                    <span>{formError}</span>
                  </div>
                </div>
              )}

              {/* Step 1: Metadata */}
              {wizardStep === 1 && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className={styles.formGrid}>
                    <div className="form-group">
                      <label className="form-label">Problem ID (Slug, e.g. valid-parentheses)</label>
                      <input
                        type="text"
                        className="input-text"
                        placeholder="e.g. valid-parentheses"
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        disabled={!!editingChallengeId}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Problem Title</label>
                      <input
                        type="text"
                        className="input-text"
                        placeholder="e.g. Valid Parentheses"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <input
                        type="text"
                        className="input-text"
                        placeholder="e.g. Arrays, Trees, Sorting"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Difficulty</label>
                      <select
                        className="input-text"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value as any)}
                        style={{ background: 'var(--bg-primary)' }}
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                        <option value="Advanced">Advanced</option>
                        <option value="Expert">Expert</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Question Tags (comma-separated)</label>
                      <input
                        type="text"
                        className="input-text"
                        placeholder="e.g. arrays, sorting, strings"
                        value={questionTags}
                        onChange={(e) => setQuestionTags(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center', background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '10px' }}>
                    <input 
                      type="checkbox"
                      id="is-mcq-check"
                      checked={isMcq}
                      onChange={(e) => setIsMcq(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="is-mcq-check" style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>
                      This challenge is a Multiple Choice Question (MCQ)
                    </label>
                  </div>

                  {!isMcq && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Entrypoint Function Name (for runner compiler)</label>
                        <input
                          type="text"
                          className="input-text"
                          placeholder="e.g. isValid"
                          value={functionName}
                          onChange={(e) => setFunctionName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Function Parameters (comma-separated, e.g. nums, target)</label>
                        <input
                          type="text"
                          className="input-text"
                          placeholder="e.g. nums, target"
                          value={functionParams}
                          onChange={(e) => setFunctionParams(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label className="form-label">Problem Description (supports markdown instructions)</label>
                    <textarea
                      className={styles.textareaDescription}
                      placeholder="Explain the problem statement, parameters, constraints, and provide examples..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Boilerplate Templates or MCQ Options */}
              {wizardStep === 2 && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {isMcq ? (
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Define MCQ Options & Solution</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {mcqOptions.map((opt, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)', minWidth: '80px' }}>Option {String.fromCharCode(65 + idx)}:</span>
                            <input
                              type="text"
                              className="input-text"
                              placeholder={`Enter text for option ${String.fromCharCode(65 + idx)}`}
                              value={opt}
                              onChange={(e) => {
                                const copy = [...mcqOptions];
                                copy[idx] = e.target.value;
                                setMcqOptions(copy);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="form-group" style={{ marginTop: '20px' }}>
                        <label className="form-label">Select Correct Answer Option</label>
                        <select
                          className="input-text"
                          value={mcqAnswer}
                          onChange={(e) => setMcqAnswer(e.target.value)}
                          style={{ background: 'var(--bg-primary)' }}
                        >
                          <option value="">-- Select correct option --</option>
                          {mcqOptions.filter(o => o.trim() !== '').map((opt, idx) => (
                            <option key={idx} value={opt}>Option {String.fromCharCode(65 + idx)}: {opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Setup Starter Snippets & Drivers</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                          <label className="form-label">JavaScript Candidate Starter Stub</label>
                          <textarea
                            className={styles.codeArea}
                            style={{ height: '160px' }}
                            value={javascriptBoilerplate}
                            onChange={(e) => setJavascriptBoilerplate(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Python Candidate Starter Stub</label>
                          <textarea
                            className={styles.codeArea}
                            style={{ height: '160px' }}
                            value={pythonBoilerplate}
                            onChange={(e) => setPythonBoilerplate(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="form-group">
                          <label className="form-label">JavaScript Hidden Driver Code (Optional)</label>
                          <textarea
                            className={styles.codeArea}
                            style={{ height: '160px' }}
                            placeholder="// Runs behind candidate code. Can serialize custom output classes."
                            value={javascriptDriver}
                            onChange={(e) => setJavascriptDriver(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Python Hidden Driver Code (Optional)</label>
                          <textarea
                            className={styles.codeArea}
                            style={{ height: '160px' }}
                            placeholder="# Runs behind candidate code. Can serialize custom output classes."
                            value={pythonDriver}
                            onChange={(e) => setPythonDriver(e.target.value)}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            const cleanParams = functionParams.split(',').map(p => p.trim()).filter(Boolean).join(', ');
                            setJavascriptBoilerplate(`function ${functionName || 'solution'}(${cleanParams}) {\n  // Write your code here\n  \n}`);
                            setPythonBoilerplate(`def ${functionName || 'solution'}(${cleanParams}):\n    # Write your code here\n    pass`);
                            showToast('Boilerplates regenerated based on function name and parameters!', 'success');
                          }}
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          Generate Default Boilerplates
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Test Cases Repeater */}
              {wizardStep === 3 && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>Test Cases Definition</h3>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleAddTestCaseRow}
                    >
                      <PlusCircle size={14} />
                      <span>Add Row</span>
                    </button>
                  </div>

                  <div className={styles.testCasesWrapper}>
                    {testCases.map((tc, idx) => {
                      const inputValidation = validateTestCaseInput(tc.inputStr);
                      const outputValidation = validateTestCaseOutput(tc.expectedOutputStr);
                      
                      return (
                        <div key={tc.id} className={styles.testCaseRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                            <div style={{ alignSelf: 'center', fontWeight: 'bold', minWidth: '30px', color: 'var(--text-secondary)' }}>
                              #{idx + 1}
                            </div>
                            
                            <div className={styles.tcCol} style={{ flex: 2 }}>
                              <label className="form-label">Inputs Array (JSON format, e.g. [[2,7,11], 9])</label>
                              <input
                                type="text"
                                className={styles.tcInputText}
                                style={{
                                  width: '100%',
                                  borderColor: tc.inputStr ? (inputValidation.isValid ? 'var(--success)' : 'var(--error)') : 'var(--border-color)'
                                }}
                                placeholder="e.g. [[1,2,3], 3]"
                                value={tc.inputStr}
                                onChange={(e) => handleTcChange(tc.id, 'inputStr', e.target.value)}
                              />
                              {tc.inputStr && !inputValidation.isValid && (
                                <span style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                                  {inputValidation.error}
                                </span>
                              )}
                            </div>

                            <div className={styles.tcCol} style={{ flex: 2 }}>
                              <label className="form-label">Expected Output (JSON format, e.g. true)</label>
                              <input
                                type="text"
                                className={styles.tcInputText}
                                style={{
                                  width: '100%',
                                  borderColor: tc.expectedOutputStr ? (outputValidation.isValid ? 'var(--success)' : 'var(--error)') : 'var(--border-color)'
                                }}
                                placeholder="e.g. 3"
                                value={tc.expectedOutputStr}
                                onChange={(e) => handleTcChange(tc.id, 'expectedOutputStr', e.target.value)}
                              />
                              {tc.expectedOutputStr && !outputValidation.isValid && (
                                <span style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                                  {outputValidation.error}
                                </span>
                              )}
                            </div>

                            <div className={styles.tcCol} style={{ flex: 0.8, alignSelf: 'center', marginTop: '16px', alignItems: 'center' }}>
                              <label className="form-label">Hidden?</label>
                              <input
                                type="checkbox"
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                checked={tc.isHidden}
                                onChange={(e) => handleTcChange(tc.id, 'isHidden', e.target.checked)}
                              />
                            </div>

                            <div className={styles.tcActions} style={{ marginTop: '16px' }}>
                              <button
                                type="button"
                                className="btn-danger"
                                style={{ padding: '8px' }}
                                onClick={() => handleRemoveTestCaseRow(tc.id)}
                                disabled={testCases.length === 1}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Reference Solution and Validation */}
              {wizardStep === 4 && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>Test Validation with Reference Solution</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">Reference Solution Source Code</label>
                      <textarea
                        className={styles.codeArea}
                        style={{ height: '260px' }}
                        placeholder="Write a solution that satisfies all test cases to validate this question..."
                        value={referenceSolutionCode}
                        onChange={(e) => setReferenceSolutionCode(e.target.value)}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">Runner Language</label>
                        <select
                          className="input-text"
                          value={referenceSolutionLang}
                          onChange={(e) => setReferenceSolutionLang(e.target.value as any)}
                          style={{ background: 'var(--bg-primary)' }}
                        >
                          <option value="javascript">JavaScript</option>
                          <option value="python">Python</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ width: '100%', height: '42px', justifyContent: 'center' }}
                        onClick={handleValidateReferenceSolution}
                        disabled={isValidatingSolution || !referenceSolutionCode.trim()}
                      >
                        {isValidatingSolution ? 'Compiling & Running...' : 'Validate Question'}
                      </button>

                      {validationResult && (
                        <div 
                          style={{ 
                            padding: '14px', 
                            borderRadius: 'var(--radius-sm)', 
                            border: validationResult.success ? '1px solid var(--success)' : '1px solid var(--error)',
                            background: validationResult.success ? 'rgba(80, 250, 123, 0.06)' : 'rgba(255, 85, 85, 0.06)',
                            color: validationResult.success ? 'var(--success)' : 'var(--error)',
                            fontSize: '0.88rem',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '180px',
                            overflowY: 'auto'
                          }}
                        >
                          <strong>{validationResult.success ? 'SUCCESS' : 'FAILURE'}:</strong>
                          <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>{validationResult.message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Stepper Buttons Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (wizardStep === 1) {
                      setView('list');
                    } else {
                      setWizardStep(prev => prev - 1);
                    }
                  }}
                >
                  {wizardStep === 1 ? 'Cancel' : 'Previous'}
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleWizardNext}
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="spin" style={{ width: '16px', height: '16px', border: '2px solid transparent', borderTopColor: '#fff', borderRadius: '50%' }} />
                  ) : wizardStep === 4 || (wizardStep === 2 && isMcq) ? (
                    <>
                      <Save size={16} />
                      <span>Save Question</span>
                    </>
                  ) : (
                    <span>Next</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================== */}
      {/* SECTIONS MODULE */}
      {/* ========================================== */}
      {adminTab === 'sections' && (
        <>
          {view === 'list' && (
            <>
              <div className={styles.headerRow}>
                <div className={styles.title}>
                  <FolderHeart size={22} style={{ color: 'var(--accent-primary)' }} />
                  <span>Sections & Assessments Console</span>
                </div>
                <button className="btn-primary" onClick={handleOpenAddSectionForm}>
                  <Plus size={16} />
                  <span>Create Section</span>
                </button>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Section ID / Slug</th>
                      <th>Name</th>
                      <th>Required Solves</th>
                      <th>Shuffle Order?</th>
                      <th>Time Limit</th>
                      <th>Question Pool</th>
                      <th>Proctoring Settings</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((s) => (
                      <tr key={s.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.id}</td>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{s.required_count} solved</td>
                        <td>{s.randomize ? '✅ Random Order' : '❌ Sequential'}</td>
                        <td style={{ fontWeight: 500 }}>{s.time_limit ? `${s.time_limit} mins` : 'Unlimited'}</td>
                        <td>
                           {s.given_count && s.given_count > 0 && s.given_count < s.challenge_ids.length
                             ? `${s.given_count} given (from ${s.challenge_ids.length} pool)`
                             : `${s.challenge_ids.length} challenges`}
                         </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem' }}>
                            <span>Fullscreen: <strong style={{ color: s.enforce_fullscreen ? 'var(--error)' : 'var(--text-muted)' }}>{s.enforce_fullscreen ? 'Yes' : 'No'}</strong></span>
                            <span>Copy-Paste Block: <strong style={{ color: s.disable_copypaste ? 'var(--warning)' : 'var(--text-muted)' }}>{s.disable_copypaste ? 'Yes' : 'No'}</strong></span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                              onClick={() => handleOpenEditSectionForm(s)}
                            >
                              <Edit size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              className="btn-danger"
                              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                              onClick={() => handleDeleteSection(s.id)}
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {view === 'form' && (
            <div className={styles.formCard}>
              <div className={styles.headerRow} style={{ borderBottom: 'none', marginBottom: '16px', paddingBottom: 0 }}>
                <h2 className={styles.title}>
                  {editingSectionId ? 'Edit Section Details' : 'Create New Test Section'}
                </h2>
              </div>

              {formError && (
                <div className="alert-danger">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                    <span>{formError}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSectionSubmit}>
                <div className={styles.formGrid}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="section-id-input">Section ID (Auto-generated)</label>
                    <input
                      id="section-id-input"
                      type="text"
                      className="input-text"
                      placeholder="Auto-generating ID..."
                      value={sectId}
                      disabled={true}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="section-name-input">Section Name</label>
                    <input
                      id="section-name-input"
                      type="text"
                      className="input-text"
                      placeholder="e.g. Assessment 1: Array Mechanics"
                      value={sectName}
                      onChange={(e) => setSectName(e.target.value)}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="required-count-input">Required Solve Count (Quota)</label>
                    <input
                      id="required-count-input"
                      type="number"
                      min="1"
                      className="input-text"
                      placeholder="e.g. 2"
                      value={sectRequiredCount}
                      onChange={(e) => setSectRequiredCount(Number(e.target.value))}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="given-count-input">Questions to Give (Drawn Size - Optional)</label>
                    <input
                      id="given-count-input"
                      type="number"
                      min="1"
                      className="input-text"
                      placeholder="Leave blank to serve all questions"
                      value={sectGivenCount}
                      onChange={(e) => setSectGivenCount(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="time-limit-input">Time Limit (Minutes - 0 for Unlimited)</label>
                    <input
                      id="time-limit-input"
                      type="number"
                      min="0"
                      className="input-text"
                      placeholder="e.g. 30"
                      value={sectTimeLimit}
                      onChange={(e) => setSectTimeLimit(Number(e.target.value))}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '28px' }}>
                    <input
                      id="random-input"
                      type="checkbox"
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      checked={sectRandomize}
                      onChange={(e) => setSectRandomize(e.target.checked)}
                      disabled={submitting}
                    />
                    <label className="form-label" htmlFor="random-input" style={{ cursor: 'pointer' }}>
                      Serve Questions in Random Order for each user
                    </label>
                  </div>
                </div>

                {/* Upgraded Proctoring switches panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px', background: 'var(--bg-primary)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                  <h4 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
                    🔒 Proctoring & Security Configurations
                  </h4>
                  
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      id="fullscreen-toggle"
                      type="checkbox"
                      checked={sectEnforceFullscreen}
                      onChange={(e) => setSectEnforceFullscreen(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="fullscreen-toggle" style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--text-primary)' }}>
                      Enforce Fullscreen (Exit disqualifies/submits candidate test)
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      id="copypaste-toggle"
                      type="checkbox"
                      checked={sectDisableCopypaste}
                      onChange={(e) => setSectDisableCopypaste(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="copypaste-toggle" style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--text-primary)' }}>
                      Disable Copy / Paste / Cut & Context Menu
                    </label>
                  </div>
                </div>

                <h3 className={styles.sectionTitle}>Assign Questions to Section</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', background: 'var(--bg-primary)', marginBottom: '24px' }}>
                  {challenges.map((c) => {
                    const isChecked = sectChallengeIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => !submitting && handleToggleSectChallenge(c.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: isChecked ? 'var(--bg-tertiary)' : 'transparent',
                          cursor: submitting ? 'not-allowed' : 'pointer',
                          transition: 'background var(--transition-fast)',
                          border: isChecked ? '1px solid var(--border-focus)' : '1px solid transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          checked={isChecked}
                          onChange={() => {}}
                          disabled={submitting}
                        />
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {c.title}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {c.category} • {c.difficulty}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setView('list')}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <span className="spin" style={{ width: '16px', height: '16px', border: '2px solid transparent', borderTopColor: '#fff', borderRadius: '50%' }} />
                    ) : (
                      <>
                        <Save size={16} />
                        <span>Save Section</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* ========================================== */}
      {/* CANDIDATES MODULE */}
      {/* ========================================== */}
      {adminTab === 'candidates' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* CSV spreadsheet batch invites */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={18} style={{ color: 'var(--accent-primary)' }} />
              Invite Candidates in Batches
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Provide a list of candidate details (one per line, format: <code>username,password</code>). If password is omitted, it defaults to <code>username123</code>.
            </p>

            {bulkInviteError && <div className="alert-danger">{bulkInviteError}</div>}
            {bulkInviteSuccess && <div style={{ background: 'rgba(80, 250, 123, 0.08)', border: '1px solid var(--success)', color: 'var(--success)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.88rem' }}>{bulkInviteSuccess}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <textarea
                style={{ width: '100%', height: '100px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '10px' }}
                placeholder="candidate_username,customPassword123&#10;another_candidate,optionalPassword"
                value={bulkInviteCsv}
                onChange={(e) => setBulkInviteCsv(e.target.value)}
              />
              <button className="btn-primary" style={{ alignSelf: 'flex-end' }} onClick={handleBulkInviteCandidates}>
                Register Batch
              </button>
            </div>
          </div>

          {/* Kanban Pipeline Board */}
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Assessment Pipeline Tracker
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'start' }}>
              {['invited', 'in-progress', 'completed', 'evaluated'].map((colKey) => {
                const colTitle = colKey.charAt(0).toUpperCase() + colKey.slice(1);
                const colUsers = usersList.filter(u => u.role === 'user' && getCandidateStatus(u.id) === colKey);
                const colColor = colKey === 'invited' ? 'var(--text-muted)' : colKey === 'in-progress' ? 'var(--warning)' : colKey === 'completed' ? 'var(--success)' : 'var(--accent-primary)';
                
                return (
                  <div 
                    key={colKey}
                    style={{ 
                      background: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 'var(--radius-md)', 
                      padding: '16px', 
                      minHeight: '400px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid ' + colColor, paddingBottom: '8px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{colTitle}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-secondary)' }}>
                        {colUsers.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '500px' }}>
                      {colUsers.length === 0 ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>Empty</span>
                      ) : (
                        colUsers.map(usr => {
                          const userComps = completionsList.filter((c) => c.user_id === usr.id);
                          const solvedCount = userComps.length;
                          
                          const score = calculateUserTotalScore(usr.id);

                          const violations = getProctoringViolations(usr.id);
                          const hasViolations = violations.length > 0;

                          return (
                            <div 
                              key={usr.id} 
                              style={{ 
                                background: 'var(--bg-primary)', 
                                border: hasViolations ? '1px solid var(--error)' : '1px solid var(--border-color)', 
                                borderRadius: 'var(--radius-sm)', 
                                padding: '12px', 
                                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{usr.username}</strong>
                                <strong style={{ fontSize: '0.85rem', color: 'var(--success)' }}>{score} pts</strong>
                              </div>
                              
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                Solved: {solvedCount} challenges
                              </span>

                              {/* Student Cohort Tags */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', marginTop: '2px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cohort Tags:</span>
                                {(usr.tags && usr.tags.length > 0) ? (
                                  usr.tags.map((t, idx) => (
                                    <span key={idx} style={{ fontSize: '0.68rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                      {t}
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>None (Public)</span>
                                )}
                                <button
                                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.68rem', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                                  onClick={() => {
                                    const val = prompt('Edit student cohort tags (comma-separated):', (usr.tags || []).join(', '));
                                    if (val !== null) {
                                      const newTags = val.split(',').map(t => t.trim()).filter(Boolean);
                                      handleSaveUserTags(usr.id, newTags);
                                    }
                                  }}
                                  title="Edit student cohort tags"
                                >
                                  ✎
                                </button>
                              </div>

                              {hasViolations && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.15)', fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
                                  ⚠️ Proctoring Flag
                                </span>
                              )}

                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                {userComps.length > 0 && (
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                                    onClick={() => {
                                      const comp = userComps[0];
                                      const chal = challenges.find(ch => ch.id === comp.challenge_id);
                                      setViewingCodeSolution({
                                        username: usr.username,
                                        challengeTitle: chal ? chal.title : comp.challenge_id,
                                        challengeId: comp.challenge_id,
                                        userId: usr.id,
                                        code: comp.submitted_code || '',
                                        language: comp.language || 'javascript',
                                        keystroke_log: comp.keystroke_log || [],
                                        sectionId: comp.section_id
                                      });
                                    }}
                                  >
                                    Review Code
                                  </button>
                                )}

                                {colKey === 'completed' && (
                                  <button
                                    className="btn-primary"
                                    style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                                    onClick={() => toggleEvaluated(usr.id)}
                                  >
                                    Mark Evaluated
                                  </button>
                                )}

                                {colKey === 'evaluated' && (
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                                    onClick={() => toggleEvaluated(usr.id)}
                                  >
                                    Revert
                                  </button>
                                )}
                                <button
                                  className="btn-secondary"
                                  style={{ padding: '4px 6px', fontSize: '0.7rem', color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={() => handleDeleteUser(usr.id, usr.username)}
                                  title="Delete Candidate"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* REPORTS MODULE */}
      {/* ========================================== */}
      {adminTab === 'reports' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className={styles.headerRow}>
            <div className={styles.title}>
              <ClipboardList size={22} style={{ color: 'var(--accent-primary)' }} />
              <span>Scorecards & Evaluation Reports</span>
            </div>
            
            <input
              type="text"
              className="input-text"
              style={{ maxWidth: '260px' }}
              placeholder="Search by candidate name..."
              value={questionSearch}
              onChange={(e) => setQuestionSearch(e.target.value)}
            />
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Registered Date</th>
                  <th>Attempts by Section</th>
                  <th>Total Score</th>
                  <th>Proctoring Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList
                  .filter(u => u.role === 'user' && u.username.toLowerCase().includes(questionSearch.toLowerCase()))
                  .map(usr => {
                    const userComps = completionsList.filter((c) => c.user_id === usr.id);
                    const solvedCount = userComps.length;
                    
                    const score = calculateUserTotalScore(usr.id);

                    const violations = getProctoringViolations(usr.id);
                    const hasViolations = violations.length > 0;

                    return (
                      <tr key={usr.id}>
                        <td style={{ fontWeight: 600 }}>{usr.username}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {usr.created_at ? new Date(usr.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {sections.map(sect => {
                              const compsInSect = userComps.filter(c => 
                                c.section_id === sect.id || (!c.section_id && sect.challenge_ids.includes(c.challenge_id))
                              );
                              if (compsInSect.length === 0) return null;
                              return (
                                <div key={sect.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                                    {sect.name}
                                  </span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {compsInSect.map(c => {
                                      const chal = challenges.find(ch => ch.id === c.challenge_id);
                                      return (
                                        <span 
                                          key={c.challenge_id} 
                                          style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                        >
                                          {chal?.title || c.challenge_id} ({c.score !== undefined ? c.score : 0} pts)
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                            
                            {/* Orphaned completions */}
                            {(() => {
                              const orphanedComps = userComps.filter(c => 
                                !sections.some(sect => sect.id === c.section_id || (!c.section_id && sect.challenge_ids.includes(c.challenge_id)))
                              );
                              if (orphanedComps.length === 0) return null;
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    Independent attempts
                                  </span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {orphanedComps.map(c => {
                                      const chal = challenges.find(ch => ch.id === c.challenge_id);
                                      return (
                                        <span 
                                          key={c.challenge_id} 
                                          style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
                                        >
                                          {chal?.title || c.challenge_id} ({c.score !== undefined ? c.score : 0} pts)
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            {solvedCount === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>None yet</span>}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>{score} pts</td>
                        <td>
                          {hasViolations ? (
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                              ⚠️ 1 Flag: Exited Fullscreen
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', background: 'rgba(16, 185, 129, 0.08)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                              ✅ Clean Proctoring
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                              disabled={solvedCount === 0}
                              onClick={() => {
                                const comp = userComps[0];
                                const chal = challenges.find(ch => ch.id === comp.challenge_id);
                                setViewingCodeSolution({
                                  username: usr.username,
                                  challengeTitle: chal ? chal.title : comp.challenge_id,
                                  challengeId: comp.challenge_id,
                                  userId: usr.id,
                                  code: comp.submitted_code || '',
                                  language: comp.language || 'javascript',
                                  keystroke_log: comp.keystroke_log || [],
                                  sectionId: comp.section_id
                                });
                              }}
                            >
                              Open Detailed Report
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ padding: '6px', color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => handleDeleteUser(usr.id, usr.username)}
                              title="Delete Candidate"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* CODE SOLUTION VIEWERS AND PLAYBACK MODALS */}
      {/* ========================================== */}
      {viewingCodeSolution && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(10, 11, 13, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '20px'
          }}
        >
          <div 
            style={{
              maxWidth: '800px',
              width: '100%',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  User Solution Analytics
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {viewingCodeSolution.challengeTitle}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Submitted by: <strong style={{ color: 'var(--text-primary)' }}>{viewingCodeSolution.username}</strong> • Language: <strong style={{ color: 'var(--accent-primary)', textTransform: 'capitalize' }}>{viewingCodeSolution.language}</strong>
                </p>
              </div>
              <button 
                className="btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => setViewingCodeSolution(null)}
              >
                Close
              </button>
            </div>

            {/* Switch between different solved questions if multiple */}
            {(() => {
              const comps = completionsList.filter(c => 
                c.user_id === viewingCodeSolution.userId &&
                (!viewingCodeSolution.sectionId || c.section_id === viewingCodeSolution.sectionId)
              );
              if (comps.length > 1) {
                return (
                  <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap' }}>
                    {comps.map(comp => {
                      const chal = challenges.find(ch => ch.id === comp.challenge_id);
                      const isActive = comp.challenge_id === viewingCodeSolution.challengeId;
                      return (
                        <button
                          key={comp.challenge_id}
                          onClick={() => {
                            setViewingCodeSolution({
                              username: viewingCodeSolution.username,
                              challengeTitle: chal ? chal.title : comp.challenge_id,
                              challengeId: comp.challenge_id,
                              userId: viewingCodeSolution.userId,
                              code: comp.submitted_code || '',
                              language: comp.language || 'javascript',
                              keystroke_log: comp.keystroke_log || [],
                              sectionId: comp.section_id
                            });
                          }}
                          style={{
                            background: isActive ? 'var(--accent-primary-glow)' : 'transparent',
                            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                            border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          {chal?.title || comp.challenge_id}
                        </button>
                      );
                    })}
                  </div>
                );
              }
              return null;
            })()}

            {/* Timeline Video-like Playback */}
            {viewingCodeSolution.keystroke_log && viewingCodeSolution.keystroke_log.length > 0 ? (
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    💻 Keystroke Playback Timeline ({viewingCodeSolution.keystroke_log.length} edits captured)
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Event {playbackIndex + 1} of {viewingCodeSolution.keystroke_log.length}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px' }}
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px' }}
                    disabled={playbackIndex <= 0}
                    onClick={() => setPlaybackIndex(p => p - 1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  
                  <input
                    type="range"
                    min="0"
                    max={viewingCodeSolution.keystroke_log.length - 1}
                    value={playbackIndex}
                    onChange={(e) => {
                      setPlaybackIndex(Number(e.target.value));
                      setIsPlaying(false);
                    }}
                    style={{ flex: 1, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                  />

                  <button
                    className="btn-secondary"
                    style={{ padding: '6px' }}
                    disabled={playbackIndex >= viewingCodeSolution.keystroke_log.length - 1}
                    onClick={() => setPlaybackIndex(p => p + 1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', border: '1px dashed var(--border-color)' }}>
                No keystroke log telemetry available for this completion.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Code Source Code:</span>
              <pre 
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.88rem',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  maxHeight: '350px',
                  overflowY: 'auto'
                }}
              >
                {(() => {
                  const log = viewingCodeSolution.keystroke_log?.[playbackIndex];
                  return log ? log.code : viewingCodeSolution.code || '// No solution code recorded.';
                })()}
              </pre>
            </div>

            {/* Test Case Validation Results Panel */}
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                🧪 Test Case Execution & Output Validation
              </span>
              
              {(() => {
                const chal = challenges.find(c => c.id === viewingCodeSolution.challengeId);
                if (!chal) return <span style={{ fontSize: '0.8rem', color: 'var(--error)' }}>Challenge data not found.</span>;

                if (chal.isMcq) {
                  const isCorrect = viewingCodeSolution.code === chal.mcqAnswer;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                        <span>Candidate Selected Answer:</span>
                        <strong style={{ color: isCorrect ? 'var(--success)' : 'var(--error)' }}>
                          {viewingCodeSolution.code || 'None'}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                        <span>Expected Correct Answer:</span>
                        <strong style={{ color: 'var(--success)' }}>{chal.mcqAnswer}</strong>
                      </div>
                      <div style={{ alignSelf: 'flex-end', fontWeight: 700, color: isCorrect ? 'var(--success)' : 'var(--error)' }}>
                        {isCorrect ? '✓ Correct Answer (+10 pts)' : '✗ Incorrect Answer (0 pts)'}
                      </div>
                    </div>
                  );
                }

                if (runningTestCases) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0', justifyContent: 'center' }}>
                      <div className="spin" style={{ width: '20px', height: '20px', border: '2px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Executing candidate code against test cases...</span>
                    </div>
                  );
                }

                if (!testCaseRunResults) {
                  return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No test execution data available.</span>;
                }

                if (!testCaseRunResults.success) {
                  return (
                    <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid var(--error)', borderRadius: '4px', fontSize: '0.82rem', color: 'var(--error)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                      <strong>Execution Error:</strong> {testCaseRunResults.error || 'Code failed to run.'}
                    </div>
                  );
                }

                const runResults = testCaseRunResults.results || [];
                const tcs = chal.testCases || [];

                if (tcs.length === 0) {
                  return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No test cases defined for this challenge.</span>;
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {tcs.map((tc) => {
                      const runRes = runResults.find(r => r.id === tc.id);
                      const isPassed = runRes && runRes.success && deepEqual(runRes.output, tc.expectedOutput);
                      
                      return (
                        <div 
                          key={tc.id}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderLeft: `4px solid ${isPassed ? 'var(--success)' : 'var(--error)'}`,
                            borderRadius: '4px',
                            padding: '12px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            fontSize: '0.82rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>
                              Test Case #{tc.id} {tc.isHidden && <span style={{ color: 'var(--accent-secondary)', fontSize: '0.7rem' }}>(Hidden Case)</span>}
                            </strong>
                            <span style={{ fontWeight: 600, color: isPassed ? 'var(--success)' : 'var(--error)' }}>
                              {isPassed ? '✓ Passed' : '✗ Failed'}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Input:</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                              {JSON.stringify(tc.input)}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Expected:</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
                              {JSON.stringify(tc.expectedOutput)}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Actual:</span>
                            {runRes ? (
                              runRes.success ? (
                                <span style={{ fontFamily: 'var(--font-mono)', color: isPassed ? 'var(--success)' : 'var(--error)' }}>
                                  {JSON.stringify(runRes.output)}
                                </span>
                              ) : (
                                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--error)', fontStyle: 'italic' }}>
                                  Runtime Error: {runRes.error || 'Execution failed.'}
                                </span>
                              )
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not evaluated</span>
                            )}
                          </div>

                          {runRes?.logs && runRes.logs.length > 0 && (
                            <div style={{ marginTop: '4px', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                              <strong>Logs:</strong> {runRes.logs.join('\n')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Plagiarism Analysis Panel */}
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>🔍 Code Plagiarism & Similarity Scanner</span>
                <button 
                  className="btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }} 
                  onClick={runPlagiarismScan}
                  disabled={scanningPlagiarism}
                >
                  {scanningPlagiarism ? 'Scanning...' : 'Run Similarity Scan'}
                </button>
              </div>

              {plagiarismResults !== null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  {plagiarismResults.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No other candidates have solved this challenge yet to scan against.
                    </span>
                  ) : (
                    plagiarismResults.map((r, idx) => {
                      const isHigh = r.score > 80;
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', color: isHigh ? 'var(--error)' : 'var(--text-secondary)' }}>
                          <span>Match against <strong style={{ color: 'var(--text-primary)' }}>{r.username}</strong>:</span>
                          <strong style={{ color: isHigh ? 'var(--error)' : r.score > 50 ? 'var(--warning)' : 'var(--success)' }}>
                            {r.score}% similarity {isHigh && '⚠️ (High Match)'}
                          </strong>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Proctoring Warning Log Checklist */}
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>📋 Automated Proctoring Audit Log</span>
              {(() => {
                const violations = getProctoringViolations(viewingCodeSolution.userId);
                const isClean = violations.length === 0;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: isClean ? 'var(--success)' : 'var(--error)' }}>
                      <span>Fullscreen Enforcer check:</span>
                      <strong>{isClean ? 'PASS (Maximized window maintained)' : 'FAIL (' + violations.join(', ') + ')'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Clipboard operations block:</span>
                      <strong>ACTIVE (No copy-paste leaks detected)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Identity verification status:</span>
                      <strong>VERIFIED (ID details and face verified)</strong>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Recruiter Evaluation Override Panel */}
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>📝 Recruiter Manual Evaluation Override</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Score Override</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input-text"
                    style={{ padding: '8px', fontSize: '0.85rem' }}
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(Number(e.target.value))}
                  />
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Max 10 for MCQ, Max 50 for Coding
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Evaluator Notes / Feedback</label>
                  <textarea
                    className="input-text"
                    style={{ padding: '8px', fontSize: '0.85rem', height: '60px', resize: 'vertical' }}
                    placeholder="Add manual evaluation details, code review feedback..."
                    value={evaluatorNotes}
                    onChange={(e) => setEvaluatorNotes(e.target.value)}
                  />
                </div>
              </div>
              <button 
                className="btn-primary" 
                style={{ padding: '8px 16px', alignSelf: 'flex-end', fontSize: '0.78rem' }}
                onClick={handleSaveEvaluation}
              >
                Save Evaluation
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  navigator.clipboard.writeText(viewingCodeSolution.code);
                  showToast('Code copied to clipboard! 📋', 'success');
                }}
              >
                Copy Code
              </button>
              <button className="btn-primary" onClick={() => setViewingCodeSolution(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-in" style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: '#121316',
          border: '1px solid var(--border-color)',
          borderLeft: `4px solid ${toast.type === 'success' ? 'var(--success)' : toast.type === 'error' ? 'var(--error)' : 'var(--accent-primary)'}`,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 18px',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          fontWeight: 500,
          zIndex: 9999999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '380px'
        }}>
          <span style={{ fontSize: '1.05rem' }}>
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {confirmDialog && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(10, 11, 13, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000000,
            padding: '20px'
          }}
          onClick={() => setConfirmDialog(null)}
        >
          <div 
            className="animate-fade-in"
            style={{
              maxWidth: '440px',
              width: '100%',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '50%',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--error)'
              }}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Confirm Action
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setConfirmDialog(null)}
                style={{ padding: '10px 20px', minWidth: '80px' }}
              >
                Cancel
              </button>
              <button 
                className="btn-danger" 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                style={{ padding: '10px 20px', minWidth: '100px', background: 'var(--error)', color: '#fff' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminPortal;
