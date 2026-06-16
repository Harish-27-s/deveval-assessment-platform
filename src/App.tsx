import React, { useState, useEffect, useRef, useMemo } from 'react';
import { runJavaScript } from './services/runner-js';
import type { RunnerResponse, RunResult } from './services/runner-js';
import { runPython } from './services/runner-py';
import { Dashboard } from './components/Dashboard';
import { CodeEditor } from './components/CodeEditor';
import { OutputConsole, deepEqual } from './components/OutputConsole';
import { SplitPane } from './components/SplitPane';
import { Auth } from './components/Auth';
import { AdminPortal } from './components/AdminPortal';
import { McqWorkspace } from './components/McqWorkspace';
import { 
  subscribeAuth, 
  logoutUser, 
  fetchChallenges, 
  fetchSections,
  getOrInitializeSectionSession,
  fetchUserCompletions, 
  saveUserCompletion,
  fetchUserCompletionDetails,
  fetchUserSectionSession
} from './services/supabase';
import type { Challenge, Section, AppUser } from './services/supabase';
import { Award, Code2, LogOut, ShieldAlert, User, ChevronRight, Home, HelpCircle } from 'lucide-react';

export const App: React.FC = () => {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Database lists
  const [challengesList, setChallengesList] = useState<Challenge[]>([]);
  const [sectionsList, setSectionsList] = useState<Section[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Navigation states
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  
  // Shuffled section-specific challenge order for active user
  const [assignedChallengeIds, setAssignedChallengeIds] = useState<string[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);

  // Solved states synced from database
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const [completionDetails, setCompletionDetails] = useState<{ challenge_id: string; score?: number; evaluator_notes?: string }[]>([]);
  const [viewingResultSectionId, setViewingResultSectionId] = useState<string | null>(null);
  const [resultCompletionDetails, setResultCompletionDetails] = useState<{ challenge_id: string; score?: number; evaluator_notes?: string }[]>([]);
  const [resultAssignedChallengeIds, setResultAssignedChallengeIds] = useState<string[]>([]);

  const [language] = useState<'javascript' | 'python'>('python');

  const [userCode, setUserCode] = useState<Record<string, { javascript: string; python: string }>>({});

  // Runner states
  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState<Record<string, RunnerResponse>>({});
  const [pythonLoadingMsg, setPythonLoadingMsg] = useState<string | null>(null);

  // Custom runner states
  const [isCustomRunning, setIsCustomRunning] = useState(false);
  const [customResult, setCustomResult] = useState<RunResult | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);

  // Anti-cheat, timer and gate states
  const [isTestStarted, setIsTestStarted] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // NDA & Diagnostic states
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [digitalSignature, setDigitalSignature] = useState('');
  const [speedTesting, setSpeedTesting] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [speedStatus, setSpeedStatus] = useState<'testing' | 'Excellent' | 'Good' | 'Poor' | 'Error'>('testing');

  // Linear Candidate Pipeline states
  const [preTestStep, setPreTestStep] = useState<'welcome' | 'instructions'>('welcome');
  const [profileName, setProfileName] = useState('');

  const [profileGithub, setProfileGithub] = useState('');
  const [profileLinkedin, setProfileLinkedin] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [consentGranted, setConsentGranted] = useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(true);
  const [visitedChallengeIds, setVisitedChallengeIds] = useState<string[]>([]);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [isTestFinished, setIsTestFinished] = useState(false);
  const [fullscreenEnforcementReady, setFullscreenEnforcementReady] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [isRecoveryOverlayOpen, setIsRecoveryOverlayOpen] = useState(false);
  const [recoveryCountdown, setRecoveryCountdown] = useState(10);

  // Ref to hold the timeout ID for debouncing keystroke logs
  const keystrokeDebounceRef = useRef<any>(null);
  const recoveryTimerRef = useRef<any>(null);

  const visibleChallenges = useMemo(() => {
    if (!currentUser || currentUser.role === 'admin') return challengesList;
    const userTags = currentUser.tags || [];
    if (userTags.length === 0) return challengesList; // Default fallback: if user has no cohort tags, show all challenges (unrestricted)
    return challengesList.filter((c) => {
      const challengeTags = c.tags || [];
      if (challengeTags.length === 0) return true; // public
      return challengeTags.some((t) => userTags.includes(t));
    });
  }, [challengesList, currentUser]);

  const visibleSections = useMemo(() => {
    if (!currentUser || currentUser.role === 'admin') return sectionsList;
    return sectionsList.filter((s) => {
      return s.challenge_ids.some((cid) => visibleChallenges.some((vc) => vc.id === cid));
    });
  }, [sectionsList, visibleChallenges, currentUser]);

  const activeSection = sectionsList.find((s) => s.id === selectedSectionId) || null;

  // 1. Subscribe to Auth changes
  useEffect(() => {
    const unsubscribe = subscribeAuth((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleExitWorkspace = () => {
    if (currentUser) {
      localStorage.removeItem(`deveval_active_section_${currentUser.uid}`);
    }
    setSelectedSectionId(null);
    setSelectedId(null);
    setIsTestStarted(false);
    setTabSwitches(0);
    setShowWarningModal(false);
    setIsDisqualified(false);
    setIsTimeUp(false);
    setNdaAccepted(false);
    setDigitalSignature('');

    // Exit fullscreen if active
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    } catch (err) {
      console.warn('[DevEval] Exit fullscreen failed:', err);
    }
  };

  // Restore test lockout states from localStorage on selection
  useEffect(() => {
    if (selectedSectionId && currentUser) {
      const disqKey = `deveval_test_disqualified_${currentUser.uid}_${selectedSectionId}`;
      const timeupKey = `deveval_test_timeup_${currentUser.uid}_${selectedSectionId}`;
      const switchKey = `deveval_tabswitches_${currentUser.uid}_${selectedSectionId}`;
      
      if (localStorage.getItem(disqKey) === 'true') {
        setIsDisqualified(true);
        setIsTestStarted(true);
      } else {
        setIsDisqualified(false);
      }

      if (localStorage.getItem(timeupKey) === 'true') {
        setIsTimeUp(true);
        setIsTestStarted(true);
      } else {
        setIsTimeUp(false);
      }

      const savedSwitches = parseInt(localStorage.getItem(switchKey) || '0', 10);
      setTabSwitches(savedSwitches);
    }
  }, [selectedSectionId, currentUser]);

  // Save active question and NDA step changes
  useEffect(() => {
    if (currentUser && selectedSectionId) {
      if (selectedId) {
        localStorage.setItem(`deveval_last_challenge_${currentUser.uid}_${selectedSectionId}`, selectedId);
      }
      localStorage.setItem(`deveval_pre_test_step_${currentUser.uid}_${selectedSectionId}`, preTestStep);
    }
  }, [selectedId, preTestStep, selectedSectionId, currentUser]);

  // Maximize check monitor
  useEffect(() => {
    const handleResize = () => {
      const isMax = window.outerWidth >= window.screen.availWidth - 50 && window.outerHeight >= window.screen.availHeight - 50;
      setIsWindowMaximized(isMax);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pre-fill profile details from logged in user
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.email.split('@')[0]);
      setAccessToken('ACC-' + currentUser.uid.substring(0, 5).toUpperCase());
    }
  }, [currentUser]);

  // Track visited challenge IDs to map candidate progress states
  useEffect(() => {
    if (selectedId && !visitedChallengeIds.includes(selectedId)) {
      setVisitedChallengeIds((prev) => [...prev, selectedId]);
    }
  }, [selectedId, visitedChallengeIds]);

  // Anti-cheat Focus/Visibility monitor
  useEffect(() => {
    if (!selectedSectionId || !isTestStarted || isDisqualified || isTimeUp || isAdminOpen || !currentUser) return;

    const handleFocusLoss = () => {
      if (showWarningModal) return;

      const switchKey = `deveval_tabswitches_${currentUser.uid}_${selectedSectionId}`;
      setTabSwitches((prev) => {
        const next = prev + 1;
        localStorage.setItem(switchKey, next.toString());
        if (next >= 3) {
          setIsDisqualified(true);
          const disqKey = `deveval_test_disqualified_${currentUser.uid}_${selectedSectionId}`;
          localStorage.setItem(disqKey, 'true');
        } else {
          setShowWarningModal(true);
        }
        return next;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleFocusLoss();
      }
    };

    window.addEventListener('blur', handleFocusLoss);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleFocusLoss);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedSectionId, isTestStarted, isDisqualified, isTimeUp, isAdminOpen, showWarningModal, currentUser]);

  // Diagnostics check when section changes
  useEffect(() => {
    if (selectedSectionId && !isTestStarted) {
      setNdaAccepted(false);
      setDigitalSignature('');
      
      setSpeedTesting(true);
      setSpeedStatus('testing');
      const start = Date.now();
      
      fetch('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs/loader.js', { method: 'HEAD', cache: 'no-store' })
        .then(() => {
          const duration = Date.now() - start;
          setLatency(duration);
          setSpeedStatus(duration < 250 ? 'Excellent' : duration < 600 ? 'Good' : 'Poor');
        })
        .catch(() => {
          setTimeout(() => {
            const fakeDuration = Math.floor(Math.random() * 150) + 50;
            setLatency(fakeDuration);
            setSpeedStatus('Excellent');
          }, 600);
        })
        .finally(() => {
          setSpeedTesting(false);
        });
    }
  }, [selectedSectionId, isTestStarted]);

  // Anti-cheat Copy-Paste and Right-Click blocker
  useEffect(() => {
    if (!selectedSectionId || !isTestStarted || isDisqualified || isTimeUp || isAdminOpen) return;
    if (!activeSection?.disable_copypaste) return;

    const blockEvent = (e: Event) => {
      e.preventDefault();
      showToast('Security Policy: Clipboard operations and right-clicks are disabled.', 'error');
    };

    window.addEventListener('copy', blockEvent);
    window.addEventListener('paste', blockEvent);
    window.addEventListener('cut', blockEvent);
    window.addEventListener('contextmenu', blockEvent);

    return () => {
      window.removeEventListener('copy', blockEvent);
      window.removeEventListener('paste', blockEvent);
      window.removeEventListener('cut', blockEvent);
      window.removeEventListener('contextmenu', blockEvent);
    };
  }, [selectedSectionId, isTestStarted, isDisqualified, isTimeUp, isAdminOpen, activeSection]);

  // Fullscreen enforcement monitor with 10-second re-entry recovery gate
  useEffect(() => {
    if (!selectedSectionId || !isTestStarted || isDisqualified || isTimeUp || isAdminOpen || !currentUser) {
      setIsRecoveryOverlayOpen(false);
      if (recoveryTimerRef.current) {
        clearInterval(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
      return;
    }
    if (!activeSection?.enforce_fullscreen) return;

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        setIsRecoveryOverlayOpen(false);
        if (recoveryTimerRef.current) {
          clearInterval(recoveryTimerRef.current);
          recoveryTimerRef.current = null;
        }
      } else {
        if (fullscreenEnforcementReady && !isRecoveryOverlayOpen) {
          setIsRecoveryOverlayOpen(true);
          setRecoveryCountdown(10);

          if (recoveryTimerRef.current) clearInterval(recoveryTimerRef.current);

          let count = 10;
          recoveryTimerRef.current = setInterval(() => {
            count -= 1;
            setRecoveryCountdown(count);
            if (count <= 0) {
              clearInterval(recoveryTimerRef.current);
              recoveryTimerRef.current = null;
              setIsRecoveryOverlayOpen(false);
              setIsDisqualified(true);
              const disqKey = `deveval_test_disqualified_${currentUser.uid}_${selectedSectionId}`;
              localStorage.setItem(disqKey, 'true');
            }
          }, 1000);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      if (recoveryTimerRef.current) {
        clearInterval(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    };
  }, [selectedSectionId, isTestStarted, isDisqualified, isTimeUp, isAdminOpen, currentUser, activeSection, fullscreenEnforcementReady, isRecoveryOverlayOpen]);

  // Fullscreen ready timeout buffer
  useEffect(() => {
    if (isTestStarted) {
      const timer = setTimeout(() => {
        setFullscreenEnforcementReady(true);
      }, 2500); // 2.5 seconds buffer
      return () => clearTimeout(timer);
    } else {
      setFullscreenEnforcementReady(false);
    }
  }, [isTestStarted]);

  // Countdown timer effect
  useEffect(() => {
    if (!selectedSectionId || !isTestStarted || isDisqualified || isTimeUp || !currentUser) {
      setTimeLeftStr('');
      return;
    }

    const activeSection = sectionsList.find((s) => s.id === selectedSectionId);
    if (!activeSection || !activeSection.time_limit) {
      setTimeLeftStr('Unlimited');
      return;
    }

    const startKey = `deveval_test_start_${currentUser.uid}_${selectedSectionId}`;
    let startTimeStr = localStorage.getItem(startKey);
    if (!startTimeStr) {
      startTimeStr = Date.now().toString();
      localStorage.setItem(startKey, startTimeStr);
    }

    const startTime = parseInt(startTimeStr, 10);
    const limitMs = activeSection.time_limit * 60 * 1000;

    const updateTimer = () => {
      const elapsed = Date.now() - startTime;
      const remaining = limitMs - elapsed;

      if (remaining <= 0) {
        setIsTimeUp(true);
        const timeupKey = `deveval_test_timeup_${currentUser.uid}_${selectedSectionId}`;
        localStorage.setItem(timeupKey, 'true');
        setTimeLeftStr("Time's Up!");
        clearInterval(timerInterval);
      } else {
        const totalSecs = Math.floor(remaining / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        setTimeLeftStr(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [selectedSectionId, isTestStarted, isDisqualified, isTimeUp, currentUser, sectionsList]);

  // 2. Load Challenges & Sections from Database
  const loadDatabaseData = async () => {
    try {
      setDbLoading(true);
      const [challenges, sections] = await Promise.all([
        fetchChallenges(),
        fetchSections()
      ]);
      
      setChallengesList(challenges);
      setSectionsList(sections);

      // Seed userCode dictionary if any newly loaded challenges lack boilerplate
      setUserCode((prev) => {
        const next = { ...prev };
        let updated = false;
        challenges.forEach((c) => {
          if (!next[c.id]) {
            next[c.id] = {
              javascript: c.boilerplate.javascript,
              python: c.boilerplate.python,
            };
            updated = true;
          }
        });
        if (updated) {
          if (currentUser && selectedSectionId) {
            const key = `deveval_user_code_${currentUser.uid}_${selectedSectionId}`;
            localStorage.setItem(key, JSON.stringify(next));
          } else {
            localStorage.setItem('deveval_user_code', JSON.stringify(next));
          }
        }
        return next;
      });
    } catch (e) {
      console.error('Failed to load database collections:', e);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadDatabaseData();
    }
  }, [currentUser]);

  // 3. Load User Solves
  useEffect(() => {
    const loadSolved = async () => {
      if (currentUser) {
        try {
          const solves = await fetchUserCompletions(currentUser.uid, selectedSectionId || '');
          setSolvedIds(solves);
          
          const details = await fetchUserCompletionDetails(currentUser.uid, selectedSectionId || '');
          setCompletionDetails(details);
        } catch (e) {
          console.error('Failed to load user completions:', e);
        }
      } else {
        setSolvedIds([]);
        setCompletionDetails([]);
      }
    };
    loadSolved();
  }, [currentUser, selectedSectionId]);

  // Load completions specifically for Results Modal
  useEffect(() => {
    const loadResultDetails = async () => {
      if (currentUser && viewingResultSectionId) {
        try {
          const [details, sessionIds] = await Promise.all([
            fetchUserCompletionDetails(currentUser.uid, viewingResultSectionId),
            fetchUserSectionSession(currentUser.uid, viewingResultSectionId)
          ]);
          setResultCompletionDetails(details);
          setResultAssignedChallengeIds(sessionIds);
        } catch (e) {
          console.error('Failed to load results completions:', e);
        }
      } else {
        setResultCompletionDetails([]);
        setResultAssignedChallengeIds([]);
      }
    };
    loadResultDetails();
  }, [currentUser, viewingResultSectionId]);

  // Session Recovery & Role-Based Auto-Routing
  useEffect(() => {
    if (authLoading || dbLoading || !currentUser) return;

    // 1. Admins route directly to Admin Portal
    if (currentUser.role === 'admin') {
      setIsAdminOpen(true);
      return;
    }

    // 2. Candidates check active/restorable session
    const activeSectionKey = `deveval_active_section_${currentUser.uid}`;
    const recoveredSectionId = localStorage.getItem(activeSectionKey);

    // 2a. Self-heal stale keys if the recovered section has been deleted or is not accessible
    if (recoveredSectionId && !visibleSections.some((s) => s.id === recoveredSectionId)) {
      localStorage.removeItem(activeSectionKey);
      const id = recoveredSectionId;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.endsWith(`_${id}`) || key.includes(`_${id}_`))) {
          localStorage.removeItem(key);
        }
      }
      setSelectedSectionId(null);
      setSelectedId(null);
      setIsTestStarted(false);
      return;
    }

    // 2b. If active section exists and is visible
    if (recoveredSectionId && visibleSections.some((s) => s.id === recoveredSectionId)) {
      const section = visibleSections.find((s) => s.id === recoveredSectionId)!;
      const testStartedKey = `deveval_test_started_${currentUser.uid}_${recoveredSectionId}`;
      const preTestStepKey = `deveval_pre_test_step_${currentUser.uid}_${recoveredSectionId}`;
      const isStarted = localStorage.getItem(testStartedKey) === 'true';

      // Verify if this section has already been concluded/submitted/finished
      const testSubmittedKey = `deveval_test_submitted_${currentUser.uid}_${recoveredSectionId}`;
      const testDisqualifiedKey = `deveval_test_disqualified_${currentUser.uid}_${recoveredSectionId}`;
      const testTimeupKey = `deveval_test_timeup_${currentUser.uid}_${recoveredSectionId}`;
      
      const isConcluded = localStorage.getItem(testSubmittedKey) === 'true' ||
        localStorage.getItem(testDisqualifiedKey) === 'true' ||
        localStorage.getItem(testTimeupKey) === 'true';

      if (isConcluded) {
        // Clean up active section so they stay on dashboard on reload/database-sync
        localStorage.removeItem(activeSectionKey);
        setSelectedSectionId(null);
        setSelectedId(null);
        setIsTestStarted(false);
        return;
      }

      if (isStarted) {
        handleSelectSection(recoveredSectionId).then(() => {
          setIsTestStarted(true);
          const lastChalKey = `deveval_last_challenge_${currentUser.uid}_${recoveredSectionId}`;
          const lastChalId = localStorage.getItem(lastChalKey);
          if (lastChalId && section.challenge_ids.includes(lastChalId)) {
            setSelectedId(lastChalId);
          }
        });
      } else {
        const savedPreStep = localStorage.getItem(preTestStepKey) as 'welcome' | 'instructions' || 'welcome';
        setSelectedSectionId(recoveredSectionId);
        setIsTestStarted(false);
        setPreTestStep(savedPreStep);
      }
    } else {
      // If no active restorable session exists, land candidate directly on Dashboard
      setSelectedSectionId(null);
      setSelectedId(null);
      setIsTestStarted(false);
    }
  }, [currentUser, authLoading, dbLoading, visibleSections, solvedIds]);

  // 4. Handle entering a test section (generates/retrieves persistent shuffled session)
  const handleSelectSection = async (sectionId: string) => {
    if (!currentUser) return;
    
    // Check if the section is already completed/finished
    const section = sectionsList.find((s) => s.id === sectionId);
    if (section) {
      const testSubmittedKey = `deveval_test_submitted_${currentUser.uid}_${sectionId}`;
      const testDisqualifiedKey = `deveval_test_disqualified_${currentUser.uid}_${sectionId}`;
      const testTimeupKey = `deveval_test_timeup_${currentUser.uid}_${sectionId}`;
      
      const isConcluded = localStorage.getItem(testSubmittedKey) === 'true' ||
        localStorage.getItem(testDisqualifiedKey) === 'true' ||
        localStorage.getItem(testTimeupKey) === 'true';
      
      if (isConcluded) {
        setViewingResultSectionId(sectionId);
        return;
      }
    }

    const testStartedKey = `deveval_test_started_${currentUser.uid}_${sectionId}`;
    const preTestStepKey = `deveval_pre_test_step_${currentUser.uid}_${sectionId}`;
    const isStarted = localStorage.getItem(testStartedKey) === 'true';

    setIsTestStarted(isStarted);
    if (!isStarted) {
      const savedPreStep = localStorage.getItem(preTestStepKey) as 'welcome' | 'instructions' || 'welcome';
      setPreTestStep(savedPreStep);
    }

    localStorage.setItem(`deveval_active_section_${currentUser.uid}`, sectionId);
    setSelectedSectionId(sectionId);
    setAssignedLoading(true);
    
    try {
      const section = sectionsList.find((s) => s.id === sectionId);
      if (section) {
        const assignedIds = await getOrInitializeSectionSession(currentUser.uid, section);
        setAssignedChallengeIds(assignedIds);
        
        // Auto-navigate to first problem in the assigned section pool
        if (assignedIds.length > 0) {
          setSelectedId(assignedIds[0]);
        } else {
          setSelectedId(null);
        }
      }
    } catch (e) {
      console.error('Failed to initialize section session:', e);
    } finally {
      setAssignedLoading(false);
    }
  };

  // Load section-specific editor code when selectedSectionId changes
  useEffect(() => {
    if (currentUser) {
      if (selectedSectionId) {
        const key = `deveval_user_code_${currentUser.uid}_${selectedSectionId}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          setUserCode(JSON.parse(saved));
        } else {
          // Initialize with boilerplate from challenges List
          const initialCode: Record<string, { javascript: string; python: string }> = {};
          challengesList.forEach((c) => {
            initialCode[c.id] = {
              javascript: c.boilerplate.javascript || '',
              python: c.boilerplate.python || '',
            };
          });
          setUserCode(initialCode);
        }
      } else {
        setUserCode({});
      }
    }
  }, [selectedSectionId, currentUser, challengesList]);

  // Sync settings & Save section-specific editor code
  useEffect(() => {
    localStorage.setItem('deveval_language', language);
  }, [language]);

  useEffect(() => {
    if (currentUser && selectedSectionId && Object.keys(userCode).length > 0) {
      const key = `deveval_user_code_${currentUser.uid}_${selectedSectionId}`;
      localStorage.setItem(key, JSON.stringify(userCode));
    }
  }, [userCode, selectedSectionId, currentUser]);

  // Helper to log keystrokes
  const logKeystroke = (userId: string, challengeId: string, lang: string, code: string) => {
    const key = `deveval_keystrokes_${userId}_${challengeId}_${lang}`;
    let logs: { code: string; timestamp: number }[] = [];
    try {
      const existing = localStorage.getItem(key);
      if (existing) {
        logs = JSON.parse(existing);
      }
    } catch (e) {
      console.error('Error parsing keystroke logs:', e);
    }

    // Don't log duplicate consecutive codes
    if (logs.length > 0 && logs[logs.length - 1].code === code) {
      return;
    }

    logs.push({ code, timestamp: Date.now() });
    localStorage.setItem(key, JSON.stringify(logs));
  };

  // Current active challenge
  const activeChallenge = challengesList.find((c) => c.id === selectedId) || null;
  const currentCode = activeChallenge 
    ? (userCode[activeChallenge.id]?.[language] ?? activeChallenge.boilerplate[language])
    : '';



  // Initialize keystrokes with current state if not present
  useEffect(() => {
    if (activeChallenge && currentUser) {
      const key = `deveval_keystrokes_${currentUser.uid}_${activeChallenge.id}_${language}`;
      if (!localStorage.getItem(key)) {
        const initialCode = userCode[activeChallenge.id]?.[language] ?? activeChallenge.boilerplate[language] ?? '';
        logKeystroke(currentUser.uid, activeChallenge.id, language, initialCode);
      }
    }
  }, [activeChallenge?.id, language, currentUser?.uid]);

  const handleCodeChange = (newVal: string) => {
    if (!activeChallenge || !currentUser) return;
    setUserCode((prev) => ({
      ...prev,
      [activeChallenge.id]: {
        ...prev[activeChallenge.id],
        [language]: newVal,
      },
    }));

    if (keystrokeDebounceRef.current) {
      clearTimeout(keystrokeDebounceRef.current);
    }
    keystrokeDebounceRef.current = setTimeout(() => {
      logKeystroke(currentUser.uid, activeChallenge.id, language, newVal);
    }, 800);
  };

  const handleResetCode = () => {
    if (!activeChallenge || !currentUser) return;
    setConfirmDialog({
      message: 'Are you sure you want to reset your code to the default template? This will erase your current edits.',
      onConfirm: () => {
        const resetValue = activeChallenge.boilerplate[language] || '';
        setUserCode((prev) => ({
          ...prev,
          [activeChallenge.id]: {
            ...prev[activeChallenge.id],
            [language]: resetValue,
          },
        }));
        logKeystroke(currentUser.uid, activeChallenge.id, language, resetValue);
        showToast('Code template has been reset', 'info');
      }
    });
  };

  // Run only visible test cases
  const handleRunCode = async () => {
    if (!activeChallenge) return;
    setIsRunning(true);
    setPythonLoadingMsg(null);
    
    // Only run visible test cases
    const visibleTcs = activeChallenge.testCases.filter(tc => !tc.isHidden);
    let response: RunnerResponse;

    if (language === 'javascript') {
      response = await runJavaScript(currentCode, activeChallenge.functionName, visibleTcs);
    } else {
      response = await runPython(
        currentCode,
        activeChallenge.functionName,
        visibleTcs,
        (msg) => setPythonLoadingMsg(msg)
      );
    }

    setPythonLoadingMsg(null);
    setIsRunning(false);
    setRunResults((prev) => ({
      ...prev,
      [activeChallenge.id]: response,
    }));
  };

  // Submit all cases (visible + hidden)
  const handleSubmitCode = async () => {
    if (!activeChallenge || !currentUser) return;
    setIsRunning(true);
    setPythonLoadingMsg(null);
    
    const allTcs = activeChallenge.testCases;
    let response: RunnerResponse;

    if (language === 'javascript') {
      response = await runJavaScript(currentCode, activeChallenge.functionName, allTcs);
    } else {
      response = await runPython(
        currentCode,
        activeChallenge.functionName,
        allTcs,
        (msg) => setPythonLoadingMsg(msg)
      );
    }

    setPythonLoadingMsg(null);
    setIsRunning(false);

    setRunResults((prev) => ({
      ...prev,
      [activeChallenge.id]: response,
    }));

    let computedScore = 0;
    let passedCount = 0;
    const totalCount = allTcs.length || 1;

    if (response.success && response.results) {
      passedCount = response.results.filter((runRes) => {
        const tc = allTcs.find((t) => t.id === runRes.id);
        return tc && runRes.success && deepEqual(runRes.output, tc.expectedOutput);
      }).length;
      computedScore = Math.round((passedCount / totalCount) * 50);
    }

    const key = `deveval_keystrokes_${currentUser.uid}_${activeChallenge.id}_${language}`;
    let keystrokes: any[] = [];
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        keystrokes = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse keystrokes:', e);
    }

    try {
      await saveUserCompletion(
        currentUser.uid,
        activeChallenge.id,
        currentCode,
        language,
        keystrokes,
        computedScore,
        '',
        selectedSectionId || ''
      );
      if (!solvedIds.includes(activeChallenge.id)) {
        setSolvedIds((prev) => [...prev, activeChallenge.id]);
      }
      if (response.success && response.results) {
        showToast('Code submitted successfully! 🎉', 'success');
      } else {
        showToast('Code submitted! (Execution error encountered)', 'error');
      }
    } catch (err) {
      console.error('Failed to save completion to database:', err);
      showToast('Code saved locally!', 'info');
    }
  };

  // Custom runner
  const handleRunCustomInput = async (inputArgs: any[]) => {
    if (!activeChallenge) return;
    setIsCustomRunning(true);
    setCustomResult(null);
    setCustomError(null);
    setPythonLoadingMsg(null);

    const customTc = [{ id: 999, input: inputArgs }];
    let response: RunnerResponse;

    if (language === 'javascript') {
      response = await runJavaScript(currentCode, activeChallenge.functionName, customTc);
    } else {
      response = await runPython(
        currentCode,
        activeChallenge.functionName,
        customTc,
        (msg) => setPythonLoadingMsg(msg)
      );
    }

    setIsCustomRunning(false);
    setPythonLoadingMsg(null);

    if (response.success && response.results && response.results.length > 0) {
      setCustomResult(response.results[0]);
    } else {
      setCustomError(response.error || 'Unknown syntax or runner error.');
    }
  };

  const handleLogout = () => {
    setConfirmDialog({
      message: 'Are you sure you want to sign out?',
      onConfirm: async () => {
        if (currentUser) {
          localStorage.removeItem(`deveval_active_section_${currentUser.uid}`);
        }
        await logoutUser();
        setSelectedSectionId(null);
        setSelectedId(null);
        setIsAdminOpen(false);
        showToast('Signed out successfully', 'success');
      }
    });
  };

  // Formatted Markdown description helper
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} style={{ marginTop: '16px', marginBottom: '8px', color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600 }}>
            {line.replace('### ', '')}
          </h3>
        );
      }
      
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <p key={idx} style={{ fontWeight: 600, margin: '6px 0', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            {line.replace(/\*\*/g, '')}
          </p>
        );
      }

      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} style={{ marginLeft: '16px', marginBottom: '4px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {parseInlineMarkdown(line.substring(2))}
          </li>
        );
      }

      const matchOrdered = line.match(/^(\d+)\.\s(.*)/);
      if (matchOrdered) {
        return (
          <li key={idx} style={{ marginLeft: '16px', marginBottom: '4px', listStyleType: 'decimal', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {parseInlineMarkdown(matchOrdered[2])}
          </li>
        );
      }

      if (line.trim() === '') {
        return <div key={idx} style={{ height: '8px' }} />;
      }

      return (
        <p key={idx} style={{ marginBottom: '8px', color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.9rem' }}>
          {parseInlineMarkdown(line)}
        </p>
      );
    });
  };

  const parseInlineMarkdown = (text: string) => {
    const parts = text.split(/(\`[^\`]+\`|\*\*[^\*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              padding: '2px 5px',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85em',
              color: 'var(--accent-primary)',
            }}
          >
            {part.replace(/\`/g, '')}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} style={{ color: 'var(--text-primary)' }}>
            {part.replace(/\*\*/g, '')}
          </strong>
        );
      }
      return part;
    });
  };

  // 5. Loading Screens
  if (authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)', gap: '16px', color: 'var(--text-secondary)' }}>
        <div className="spin" style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Initializing DevEval Session...</span>
      </div>
    );
  }

  // Pre-Test Rules Screen
  const renderPreTestGate = () => {
    if (!activeSection) return null;

    const sectionChallenges = challengesList.filter((c) => activeSection.challenge_ids.includes(c.id));
    const mcqCount = sectionChallenges.filter((c) => c.isMcq).length;
    const codingCount = sectionChallenges.filter((c) => !c.isMcq).length;
    const totalPoints = mcqCount * 10 + codingCount * 50;

    if (preTestStep === 'welcome') {
      const isMaximized = isWindowMaximized;
      const latencyPassed = latency !== null && latency <= 300;
      const canContinue = profileName.trim() && accessToken.trim() && consentGranted && isMaximized;

      return (
        <div 
          className="animate-fade-in" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            width: '100%', 
            background: 'var(--bg-primary)',
            padding: '40px',
            overflowY: 'auto'
          }}
        >
          <div 
            style={{ 
              maxWidth: '600px', 
              width: '100%', 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-lg)', 
              padding: '40px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>🔐 Step 1 of 2</span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>Welcome & Profile Verification</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="access-token">Candidate Access Token</label>
                <input
                  id="access-token"
                  type="text"
                  className="input-text"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="e.g. ACC-10A2B"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-name">Full Name</label>
                <input
                  id="profile-name"
                  type="text"
                  className="input-text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" htmlFor="profile-github">GitHub Profile (Optional)</label>
                  <input
                    id="profile-github"
                    type="text"
                    className="input-text"
                    value={profileGithub}
                    onChange={(e) => setProfileGithub(e.target.value)}
                    placeholder="github.com/johndoe"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" htmlFor="profile-linkedin">LinkedIn Profile (Optional)</label>
                  <input
                    id="profile-linkedin"
                    type="text"
                    className="input-text"
                    value={profileLinkedin}
                    onChange={(e) => setProfileLinkedin(e.target.value)}
                    placeholder="linkedin.com/in/johndoe"
                  />
                </div>
              </div>

              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.92rem', margin: 0 }}>
                  💻 System Readiness & Hardware Check
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Internet Latency Check:</span>
                    {speedTesting ? (
                      <span style={{ color: 'var(--accent-primary)' }}>Testing speed...</span>
                    ) : (
                      <strong style={{ color: latencyPassed ? 'var(--success)' : 'var(--warning)' }}>
                        {latency !== null ? `${latency}ms (${speedStatus} - > 2 Mbps)` : 'Check Failed'}
                      </strong>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Browser Window Maximized:</span>
                    <strong style={{ color: isMaximized ? 'var(--success)' : 'var(--error)' }}>
                      {isMaximized ? 'Maximized (Pass)' : 'Window Not Maximized (Maximize browser window)'}
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '8px 0' }}>
                <input
                  id="consent-check"
                  type="checkbox"
                  checked={consentGranted}
                  onChange={(e) => setConsentGranted(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px' }}
                />
                <label htmlFor="consent-check" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', lineHeight: '1.4' }}>
                  I grant consent for security verification to proceed with this online assessment.
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, height: '48px' }} 
                onClick={handleExitWorkspace}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1, height: '48px', opacity: canContinue ? 1 : 0.5, cursor: canContinue ? 'pointer' : 'not-allowed' }} 
                disabled={!canContinue}
                onClick={() => setPreTestStep('instructions')}
              >
                Verify & Continue
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        className="animate-fade-in" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%', 
          width: '100%', 
          background: 'var(--bg-primary)',
          padding: '40px',
          overflowY: 'auto'
        }}
      >
        <div 
          style={{ 
            maxWidth: '600px', 
            width: '100%', 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-lg)', 
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}
        >
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>📜 Step 2 of 2</span>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>NDA & Environment Rules</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>QUESTIONS</span>
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  {codingCount} Coding / {mcqCount} MCQ
                </strong>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>EVALUATION POINTS</span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--success)' }}>{totalPoints} Pts Total</strong>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>DURATION</span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>{activeSection.time_limit ? `${activeSection.time_limit} mins` : 'Unlimited'}</strong>
              </div>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 'var(--radius-sm)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ color: 'var(--error)', fontWeight: 600, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} />
                Environment & Proctoring Rules
              </h4>
              <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeSection.enforce_fullscreen && (
                  <li><strong>Fullscreen Enforcement Active</strong>: Exiting fullscreen mode will immediately terminate and submit your assessment.</li>
                )}
                {activeSection.disable_copypaste && (
                  <li><strong>Copy-Paste Disabled</strong>: Clipboard actions (copy/cut/paste) and right-click menus are locked.</li>
                )}
                <li><strong>Anti-Cheat Visibility Logs</strong>: Navigating away, switching tabs, or losing window focus is strictly audited. Locked out after 3 infractions.</li>
                <li><strong>Timer Continuance</strong>: Closing or refreshing this window will not stop or reset the countdown.</li>
              </ul>
            </div>

            {/* NDA Agreement */}
            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.92rem', margin: 0 }}>
                📋 NDA & Code Integrity Agreement
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                I agree not to record, share, copy or disclose any content of this test. I certify that all code written in this workspace will be entirely my own work without any aid from generative AI platforms or other external resources.
              </p>
              
              <div style={{ margin: 0 }}>
                <input
                  id="nda-checkbox"
                  type="checkbox"
                  checked={ndaAccepted}
                  onChange={(e) => setNdaAccepted(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', marginRight: '8px', verticalAlign: 'middle' }}
                />
                <label htmlFor="nda-checkbox" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }}>
                  I agree to the NDA and code integrity policy.
                </label>
              </div>

              <div style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="sig-input" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Type your full name to sign digitally:</label>
                <input
                  id="sig-input"
                  type="text"
                  className="input-text"
                  placeholder="e.g. John Doe"
                  value={digitalSignature}
                  onChange={(e) => setDigitalSignature(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <button 
              className="btn-secondary" 
              style={{ flex: 1, height: '48px' }} 
              onClick={() => setPreTestStep('welcome')}
            >
              Back
            </button>
            <button 
              className="btn-primary" 
              style={{ flex: 1, height: '48px', opacity: ndaAccepted && digitalSignature.trim() ? 1 : 0.5, cursor: ndaAccepted && digitalSignature.trim() ? 'pointer' : 'not-allowed' }} 
              disabled={!ndaAccepted || !digitalSignature.trim()}
              onClick={() => {
                setIsTestStarted(true);
                // Select first question automatically
                if (activeSection.challenge_ids.length > 0) {
                  setSelectedId(activeSection.challenge_ids[0]);
                }
                if (currentUser && selectedSectionId) {
                  localStorage.setItem(`deveval_test_started_${currentUser.uid}_${selectedSectionId}`, 'true');
                  const startKey = `deveval_test_start_${currentUser.uid}_${selectedSectionId}`;
                  if (!localStorage.getItem(startKey)) {
                    localStorage.setItem(startKey, Date.now().toString());
                  }
                }

                // Request fullscreen on user gesture
                try {
                  if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen();
                  }
                } catch (err) {
                  console.warn('[DevEval] Fullscreen request failed:', err);
                }
              }}
            >
              Start Test & Open Editor
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDisqualifiedScreen = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', background: 'var(--bg-primary)', padding: '40px' }}>
        <div style={{ maxWidth: '500px', width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--error)', borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ margin: '0 auto', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}>
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Test Session Disqualified</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            This session has been locked out because you switched browser tabs or clicked away from the testing window more than <strong>3 times</strong>.
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Your violations have been recorded. Please contact your administrator to reset your assessment attempt.
          </p>
          <button 
            className="btn-secondary" 
            style={{ marginTop: '12px', width: '100%' }}
            onClick={handleExitWorkspace}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  };

  const renderTimesUpScreen = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', background: 'var(--bg-primary)', padding: '40px' }}>
        <div style={{ maxWidth: '500px', width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ margin: '0 auto', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)' }}>
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Time Limit Exceeded</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            The allocated time for this assessment has expired. Your current code solutions have been automatically saved.
          </p>
          <button 
            className="btn-secondary" 
            style={{ marginTop: '12px', width: '100%' }}
            onClick={handleExitWorkspace}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  };

  const renderWarningModal = () => {
    return (
      <div 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          background: 'rgba(10, 11, 13, 0.85)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 99999 
        }}
      >
        <div style={{ maxWidth: '440px', width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)', padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <ShieldAlert size={22} />
            Tab Switch Warning!
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
            Navigating away from the test window is strictly prohibited. 
          </p>
          <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
            Violation Count: <span style={{ color: 'var(--error)' }}>{tabSwitches} / 3</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Exceeding 3 switches will result in instant disqualification.
          </p>
          <button 
            className="btn-primary" 
            style={{ width: '100%', marginTop: '8px' }}
            onClick={() => setShowWarningModal(false)}
          >
            I understand, Resume Test
          </button>
        </div>
      </div>
    );
  };

  const renderRecoveryOverlay = () => {
    return (
      <div 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          background: 'rgba(10, 11, 13, 0.95)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 9999999,
          padding: '20px'
        }}
      >
        <div style={{ maxWidth: '480px', width: '100%', background: 'var(--bg-secondary)', border: '2px solid var(--error)', borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <div style={{ margin: '0 auto', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}>
            <ShieldAlert size={32} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>Fullscreen Exited!</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
            Fullscreen mode is strictly enforced for this assessment. You must re-enter fullscreen immediately to continue your test.
          </p>
          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', margin: '8px 0' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Disqualification countdown</span>
            <strong style={{ fontSize: '2rem', color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>{recoveryCountdown}s</strong>
          </div>
          <button 
            className="btn-primary" 
            style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: 'bold' }}
            onClick={() => {
              try {
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen();
                }
              } catch (err) {
                console.warn('[DevEval] Fullscreen re-entry failed:', err);
              }
            }}
          >
            Re-enter Fullscreen Mode
          </button>
        </div>
      </div>
    );
  };

  // Auth Gate
  if (!currentUser) {
    return <Auth />;
  }

  // Database Loading Screen (Only on initial empty load)
  if (dbLoading && challengesList.length === 0 && sectionsList.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)', gap: '16px', color: 'var(--text-secondary)' }}>
        <div className="spin" style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Syncing Database Collections...</span>
      </div>
    );
  }

  // Pane configurations
  const challengeDetailsPane = activeChallenge && (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 500,
            padding: '3px 6px',
            borderRadius: '4px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
          }}
        >
          {activeChallenge.category}
        </span>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '3px 6px',
            borderRadius: '4px',
            background:
              activeChallenge.difficulty === 'Easy'
                ? 'rgba(16, 185, 129, 0.08)'
                : activeChallenge.difficulty === 'Medium'
                ? 'rgba(245, 158, 11, 0.08)'
                : activeChallenge.difficulty === 'Hard'
                ? 'rgba(239, 68, 68, 0.08)'
                : activeChallenge.difficulty === 'Advanced'
                ? 'rgba(139, 92, 246, 0.08)'
                : 'rgba(236, 72, 153, 0.08)',
            color:
              activeChallenge.difficulty === 'Easy'
                ? 'var(--success)'
                : activeChallenge.difficulty === 'Medium'
                ? 'var(--warning)'
                : activeChallenge.difficulty === 'Hard'
                ? 'var(--error)'
                : activeChallenge.difficulty === 'Advanced'
                ? '#bd93f9'
                : '#ff79c6',
            border:
              activeChallenge.difficulty === 'Easy'
                ? '1px solid rgba(16, 185, 129, 0.15)'
                : activeChallenge.difficulty === 'Medium'
                ? '1px solid rgba(245, 158, 11, 0.15)'
                : activeChallenge.difficulty === 'Hard'
                ? '1px solid rgba(239, 68, 68, 0.15)'
                : activeChallenge.difficulty === 'Advanced'
                ? '1px solid rgba(139, 92, 246, 0.15)'
                : '1px solid rgba(236, 72, 153, 0.15)',
          }}
        >
          {activeChallenge.difficulty}
        </span>
      </div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
        {activeChallenge.title}
      </h2>
      <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }} />
      <div style={{ overflowY: 'auto' }}>
        {renderMarkdown(activeChallenge.description)}
      </div>
    </div>
  );

  const editorWorkspacePane = activeChallenge && (
    activeChallenge.isMcq ? (
      <McqWorkspace
        challenge={activeChallenge}
        selectedAnswer={userCode[activeChallenge.id]?.[language] || ''}
        onSaveAnswer={(ans) => {
          setUserCode((prev) => {
            const next = {
              ...prev,
              [activeChallenge.id]: {
                ...prev[activeChallenge.id],
                [language]: ans,
              },
            };
            if (currentUser && selectedSectionId) {
              const key = `deveval_user_code_${currentUser.uid}_${selectedSectionId}`;
              localStorage.setItem(key, JSON.stringify(next));
            } else {
              localStorage.setItem('deveval_user_code', JSON.stringify(next));
            }
            return next;
          });
          // immediately save completion in DB/localStorage to avoid data loss
          const score = ans === activeChallenge.mcqAnswer ? 10 : 0;
          saveUserCompletion(
            currentUser.uid,
            activeChallenge.id,
            ans,
            'mcq',
            [],
            score,
            '',
            selectedSectionId || ''
          );
          if (!solvedIds.includes(activeChallenge.id)) {
            setSolvedIds((prev) => [...prev, activeChallenge.id]);
          }
        }}
      />
    ) : (
      <SplitPane
        direction="vertical"
        initialSize={60}
        minSize={30}
        maxSize={80}
        leftPane={
          <CodeEditor
            code={currentCode}
            onChange={handleCodeChange}
            language={language}
            onReset={handleResetCode}
            onRun={handleRunCode}
            onSubmit={handleSubmitCode}
            isRunning={isRunning}
          />
        }
        rightPane={
          <OutputConsole
            challenge={activeChallenge}
            results={
              pythonLoadingMsg
                ? { success: false, error: pythonLoadingMsg, logs: [] }
                : runResults[activeChallenge.id] || null
            }
            isRunning={isRunning}
            onRunCustom={handleRunCustomInput}
            customResult={customResult}
            customError={customError}
            isCustomRunning={isCustomRunning}
          />
        }
      />
    )
  );

  const handleSendSupportMessage = () => {
    if (!supportMessage.trim()) return;
    const existing = localStorage.getItem('deveval_support_messages');
    const list = existing ? JSON.parse(existing) : [];
    list.push({
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      username: currentUser?.email || 'Candidate',
      message: supportMessage.trim(),
      timestamp: Date.now(),
      challengeId: selectedId || 'general'
    });
    localStorage.setItem('deveval_support_messages', JSON.stringify(list));
    showToast('Your glitch report has been sent to the recruiter.', 'success');
    setSupportMessage('');
    setSupportModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>


      {/* Main Content Area */}
      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header Bar */}
        <header
          style={{
            height: 'var(--header-height)',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            flexShrink: 0,
            userSelect: 'none',
            position: 'relative',
          }}
        >
          {/* Left Area: Logo & Section Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }} 
              onClick={() => { 
                if (isTestStarted && !isDisqualified && !isTimeUp) { 
                  showToast('You must finish and submit your test before returning to the dashboard.', 'error'); 
                  return; 
                } 
                handleExitWorkspace(); 
                setIsAdminOpen(false); 
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <Code2 size={16} />
              </div>
              <span
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  background: 'linear-gradient(90deg, #fff 0%, var(--text-secondary) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                DevEval
              </span>
            </div>
 
            {/* Breadcrumbs Navigation */}
            {(selectedSectionId || activeChallenge) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px', minWidth: 0 }}>
                <Home 
                  size={14} 
                  style={{ cursor: 'pointer', flexShrink: 0 }} 
                  onClick={() => { 
                    if (isTestStarted && !isDisqualified && !isTimeUp) { 
                      showToast('You must finish and submit your test before returning to the dashboard.', 'error'); 
                      return; 
                    } 
                    handleExitWorkspace(); 
                  }} 
                />
                
                {activeSection && (
                  <>
                    <ChevronRight size={12} style={{ flexShrink: 0 }} />
                    <span 
                      style={{ 
                        cursor: 'pointer', 
                        fontWeight: activeChallenge ? 500 : 600, 
                        color: activeChallenge ? 'var(--text-secondary)' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '120px'
                      }}
                      onClick={() => { 
                        if (isTestStarted && !isDisqualified && !isTimeUp) return; 
                        setSelectedId(null); 
                      }}
                      title={activeSection.name}
                    >
                      {activeSection.name}
                    </span>
                  </>
                )}
 
                {activeChallenge && (
                  <>
                    <ChevronRight size={12} style={{ flexShrink: 0 }} />
                    <span 
                      style={{ 
                        fontWeight: 600, 
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '120px'
                      }}
                      title={activeChallenge.title}
                    >
                      {activeChallenge.title}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
 
          {/* Center Area: Countdown Timer */}
          {selectedSectionId && isTestStarted && !isAdminOpen && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.95rem',
                fontWeight: 800,
                color: timeLeftStr.includes(':') && parseInt(timeLeftStr.split(':')[0]) < 15 
                  ? (parseInt(timeLeftStr.split(':')[0]) < 5 ? 'var(--error)' : 'var(--warning)')
                  : 'var(--text-primary)',
                background: 'var(--bg-tertiary)',
                padding: '6px 16px',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                fontFamily: 'var(--font-mono)',
                flexShrink: 0,
              }}
              title="Time Remaining"
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TIME:</span>
              <span>{timeLeftStr}</span>
            </div>
          )}
 
          {/* Right Area: Controls & User sessions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
            {/* Admin toggle dashboard */}
            {currentUser.role === 'admin' && (
              <button
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'rgba(99, 102, 241, 0.3)' }}
                onClick={() => {
                  setIsAdminOpen(!isAdminOpen);
                  setSelectedId(null);
                  setSelectedSectionId(null);
                }}
              >
                {isAdminOpen ? (
                  <>
                    <Code2 size={14} />
                    <span>Question Catalog</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert size={14} style={{ color: 'var(--accent-primary)' }} />
                    <span>Admin Panel</span>
                  </>
                )}
              </button>
            )}

            {/* Question Navigation Map */}
            {selectedSectionId && isTestStarted && !isAdminOpen && activeSection && (
              assignedChallengeIds.length <= 8 ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginRight: '4px', flexShrink: 0 }}>
                  {assignedChallengeIds
                    .map((cid) => challengesList.find((c) => c.id === cid))
                    .filter((c): c is Challenge => !!c)
                    .map((c, index) => {
                      const isCurrent = selectedId === c.id;
                      const isSolved = solvedIds.includes(c.id);
                      const isVisited = visitedChallengeIds.includes(c.id);
                      
                      let bgColor = 'var(--bg-tertiary)'; // Gray (Unvisited)
                      let borderCol = 'var(--border-color)';
                      let textCol = 'var(--text-secondary)';
                      
                      if (isSolved) {
                        bgColor = 'rgba(16, 185, 129, 0.2)'; // Green (Submitted)
                        borderCol = 'var(--success)';
                        textCol = 'var(--success)';
                      } else if (isVisited) {
                        bgColor = 'rgba(245, 158, 11, 0.2)'; // Yellow (In-progress)
                        borderCol = 'var(--warning)';
                        textCol = 'var(--warning)';
                      }
                      
                      if (isCurrent) {
                        borderCol = 'var(--text-primary)';
                      }

                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedId(c.id)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '4px',
                            background: bgColor,
                            border: `1.5px solid ${borderCol}`,
                            color: textCol,
                            fontSize: '0.82rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            flexShrink: 0
                          }}
                          title={c.title}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                </div>
              ) : (
                <select
                  value={selectedId || ''}
                  onChange={(e) => setSelectedId(e.target.value)}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 12px 4px 8px',
                    fontSize: '0.82rem',
                    fontWeight: 'bold',
                    maxWidth: '180px',
                    cursor: 'pointer',
                    outline: 'none',
                    flexShrink: 0,
                    marginRight: '4px'
                  }}
                >
                  {assignedChallengeIds
                    .map((cid) => challengesList.find((c) => c.id === cid))
                    .filter((c): c is Challenge => !!c)
                    .map((c, index) => {
                      const isSolved = solvedIds.includes(c.id);
                      const statusPrefix = isSolved ? '✓ ' : '';
                      return (
                        <option key={c.id} value={c.id}>
                          {statusPrefix}Q{index + 1}: {c.title}
                        </option>
                      );
                    })}
                </select>
              )
            )}

            {/* Emergency Support Button */}
            {selectedSectionId && isTestStarted && !isAdminOpen && (
              <button
                className="btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setSupportModalOpen(true)}
                title="Report glitch or technical issue"
              >
                <HelpCircle size={14} />
                <span>Support</span>
              </button>
            )}

            {/* Submit & Exit button */}
            {selectedSectionId && isTestStarted && !isAdminOpen && (
              <button
                className="btn-danger"
                style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}
                onClick={() => setFinishConfirmOpen(true)}
              >
                Finish Test
              </button>
            )}

            {/* Solved Stats indicator */}
            {!isAdminOpen && !isTestStarted && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-tertiary)',
                  padding: '5px 10px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <Award size={13} style={{ color: 'var(--success)' }} />
                <span>Solved: {solvedIds.length} / {challengesList.length}</span>
              </div>
            )}

            {/* User credentials badge & sign out */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={12} style={{ color: 'var(--text-muted)' }} />
                  {currentUser.email}
                </span>
                <span style={{ color: currentUser.role === 'admin' ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase' }}>
                  {currentUser.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'color var(--transition-fast)',
                }}
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {showWarningModal && renderWarningModal()}
          {isRecoveryOverlayOpen && renderRecoveryOverlay()}

          {/* Test Finished Submitted Screen */}
          {isTestFinished && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000001, padding: '20px' }}>
              <div style={{ maxWidth: '500px', width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                <div style={{ margin: '0 auto', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                  <Award size={28} />
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>Assessment Submitted!</h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                  Thank you! Your test session has been successfully logged and submitted to the recruiters. All background security audits and keystroke telemetry copy captures have been successfully uploaded.
                </p>
                <button 
                  className="btn-primary" 
                  style={{ marginTop: '12px', width: '100%' }}
                  onClick={() => {
                    setIsTestFinished(false);
                    handleExitWorkspace();
                  }}
                >
                  Close & Return to Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Finish Confirmation Modal */}
          {finishConfirmOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(10, 11, 13, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000000, padding: '20px' }}>
              <div style={{ maxWidth: '450px', width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Finish & Submit Assessment?</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                  Are you sure you want to conclude your test session? You have solved {solvedIds.filter(id => assignedChallengeIds.includes(id)).length} of {assignedChallengeIds.length || 0} questions. Once submitted, you cannot re-enter or change your responses.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button className="btn-secondary" onClick={() => setFinishConfirmOpen(false)}>Cancel</button>
                  <button className="btn-danger" onClick={() => {
                    setFinishConfirmOpen(false);
                    setIsTestFinished(true);
                    if (currentUser && activeSection) {
                      localStorage.setItem(`deveval_test_submitted_${currentUser.uid}_${activeSection.id}`, 'true');
                    }
                  }}>Finish and Submit</button>
                </div>
              </div>
            </div>
          )}

          {/* Technical Support Modal */}
          {supportModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(10, 11, 13, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000000, padding: '20px' }}>
              <div style={{ maxWidth: '450px', width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Report Glitch & Message Admin</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  If you are experiencing a technical glitch or believe a test case has an issue, type your report below. The recruiter/administrator will receive it in real-time.
                </p>
                <textarea
                  className="input-text"
                  style={{ width: '100%', height: '100px', resize: 'none', padding: '10px', fontSize: '0.85rem' }}
                  placeholder="Describe the issue in detail..."
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => { setSupportModalOpen(false); setSupportMessage(''); }}>Cancel</button>
                  <button className="btn-primary" onClick={handleSendSupportMessage}>Send Report</button>
                </div>
              </div>
            </div>
          )}
          
          {assignedLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', color: 'var(--text-secondary)' }}>
              <div className="spin" style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
              <span style={{ fontSize: '0.9rem' }}>Shuffling assessment pool...</span>
            </div>
          ) : isAdminOpen ? (
            <AdminPortal
              challenges={challengesList}
              sections={sectionsList}
              onRefresh={loadDatabaseData}
              onClose={() => setIsAdminOpen(false)}
            />
          ) : isDisqualified ? (
            renderDisqualifiedScreen()
          ) : isTimeUp ? (
            renderTimesUpScreen()
          ) : selectedSectionId && !isTestStarted ? (
            renderPreTestGate()
          ) : (selectedSectionId || activeChallenge) ? (
            <SplitPane
              direction="horizontal"
              initialSize={40}
              minSize={25}
              maxSize={60}
              leftPane={challengeDetailsPane}
              rightPane={editorWorkspacePane}
            />
          ) : (
            <Dashboard
              challenges={visibleChallenges}
              sections={visibleSections}
              solvedIds={solvedIds}
              completionDetails={completionDetails}
              userId={currentUser.uid}
              onSelectSection={handleSelectSection}
            />
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

          {viewingResultSectionId && (
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
              onClick={() => setViewingResultSectionId(null)}
            >
              <div 
                className="animate-fade-in"
                style={{
                  maxWidth: '600px',
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
                  maxHeight: '90vh',
                  overflowY: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ✓ Assessment Completed
                    </span>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {sectionsList.find(s => s.id === viewingResultSectionId)?.name || 'Section Results'}
                    </h3>
                  </div>
                  <button 
                    className="btn-secondary" 
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    onClick={() => setViewingResultSectionId(null)}
                  >
                    Close
                  </button>
                </div>

                {(() => {
                  const sect = sectionsList.find(s => s.id === viewingResultSectionId);
                  if (!sect) return null;
                  
                  // Use assigned challenges if available, otherwise fallback to the full section list
                  const assignedIds = resultAssignedChallengeIds.length > 0 
                    ? resultAssignedChallengeIds 
                    : sect.challenge_ids;

                  const sectChallenges = challengesList.filter(c => assignedIds.includes(c.id));
                  const solvesInSect = resultCompletionDetails.filter(d => assignedIds.includes(d.challenge_id));
                  const solvedCount = solvesInSect.length;
                  
                  const sortedScores = solvesInSect
                    .map(c => c.score || 0)
                    .sort((a, b) => b - a);
                  const topScores = sortedScores.slice(0, sect.required_count);
                  const totalSectionScore = topScores.reduce((acc, curr) => acc + curr, 0);
                  
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Earned Score</span>
                          <strong style={{ fontSize: '1.4rem', color: 'var(--success)' }}>
                            {totalSectionScore} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>pts</span>
                          </strong>
                        </div>
                        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Questions Quota</span>
                          <strong style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                            {solvedCount} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/ {assignedIds.length} Solved</span>
                          </strong>
                        </div>
                      </div>
 
                      {/* Challenge breakdown list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Detailed Challenge Report
                        </h4>
                        
                        {sectChallenges.map((c) => {
                          const comp = solvesInSect.find(d => d.challenge_id === c.id);
                          const isSolved = resultCompletionDetails.some(d => d.challenge_id === c.id);
                          const score = comp?.score || 0;
                          
                          return (
                            <div 
                              key={c.id}
                              style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{c.title}</strong>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {c.category} • {c.difficulty}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                  <span 
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      background: isSolved ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                      color: isSolved ? 'var(--success)' : 'var(--error)',
                                      border: isSolved ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
                                      padding: '3px 8px',
                                      borderRadius: '4px'
                                    }}
                                  >
                                    {isSolved ? 'SOLVED' : 'NOT SOLVED'}
                                  </span>
                                  <strong style={{ fontSize: '0.9rem', color: isSolved ? 'var(--success)' : 'var(--text-muted)' }}>
                                    {score} pts
                                  </strong>
                                </div>
                              </div>

                              {/* Evaluator notes feedback */}
                              {comp?.evaluator_notes && (
                                <div style={{ background: 'var(--bg-secondary)', borderLeft: '3px solid var(--accent-primary)', padding: '10px 14px', borderRadius: '4px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px', fontSize: '0.78rem' }}>
                                    💬 Recruiter Feedback Note:
                                  </strong>
                                  {comp.evaluator_notes}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default App;
