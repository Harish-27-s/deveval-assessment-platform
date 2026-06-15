import { createClient } from '@supabase/supabase-js';
import { challenges as defaultChallenges } from '../data/challenges';
import type { Challenge, TestCase } from '../data/challenges';
export type { Challenge, TestCase };

// Unified User interface
export interface AppUser {
  uid: string;
  email: string;
  role: 'user' | 'admin';
  tags?: string[];
}

// Section interface
export interface Section {
  id: string;
  name: string;
  required_count: number;
  randomize: boolean;
  challenge_ids: string[];
  time_limit: number; // Duration in minutes (0 for unlimited)
  enforce_fullscreen: boolean;
  disable_copypaste: boolean;
  given_count?: number; // Total questions randomly presented to candidates
}

// 1. Supabase Config Detection
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Initialize Supabase Client if configured
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

console.log(`[DevEval Engine] Running with ${isSupabaseConfigured ? 'PRODUCTION (Supabase Connected)' : 'LOCAL DEV (LocalStorage Simulator)'} backend.`);

// ==========================================
// MOCK SIMULATOR DATABASE LAYER
// ==========================================
const MOCK_USERS_KEY = 'deveval_mock_users';
const MOCK_CHALLENGES_KEY = 'deveval_mock_challenges';
const MOCK_SECTIONS_KEY = 'deveval_mock_sections';
const MOCK_COMPLETIONS_KEY_PREFIX = 'deveval_mock_completions_';
const MOCK_COMPLETION_DETAILS_PREFIX = 'deveval_mock_completion_details_';
const MOCK_USER_SECTION_SESSION_PREFIX = 'deveval_mock_section_session_';

const getMockUsers = (): any[] => {
  const data = localStorage.getItem(MOCK_USERS_KEY);
  let list = data ? JSON.parse(data) : [];
  // Pre-seed Hari$h admin in LocalStorage if not present
  if (!list.some((u: any) => u.username === 'Hari$h')) {
    list.push({
      uid: 'admin_harish',
      id: 'admin_harish',
      username: 'Hari$h',
      password: 'Hari$h07',
      role: 'admin',
      created_at: new Date().toISOString()
    });
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(list));
  }
  return list;
};



const getMockChallenges = (): Challenge[] => {
  const data = localStorage.getItem(MOCK_CHALLENGES_KEY);
  if (data === null) {
    localStorage.setItem(MOCK_CHALLENGES_KEY, JSON.stringify(defaultChallenges));
    return defaultChallenges;
  }
  try {
    const list = JSON.parse(data);
    if (list.length === 0) return [];
    const hasTags = list.some((c: any) => c.tags && c.tags.length > 0);
    if (!hasTags) {
      localStorage.setItem(MOCK_CHALLENGES_KEY, JSON.stringify(defaultChallenges));
      return defaultChallenges;
    }
    return list;
  } catch (e) {
    localStorage.setItem(MOCK_CHALLENGES_KEY, JSON.stringify(defaultChallenges));
    return defaultChallenges;
  }
};

const saveMockChallenges = (list: Challenge[]) => {
  localStorage.setItem(MOCK_CHALLENGES_KEY, JSON.stringify(list));
};

// Default seeded sections
const defaultSections: Section[] = [
  {
    id: 'arrays-strings',
    name: 'Arrays & Strings Practice',
    required_count: 2,
    randomize: true,
    challenge_ids: ['two-sum', 'reverse-string', 'palindrome-number', 'valid-parentheses'],
    time_limit: 30,
    enforce_fullscreen: false,
    disable_copypaste: true
  },
  {
    id: 'basic-math',
    name: 'Math Practice Pool',
    required_count: 1,
    randomize: false,
    challenge_ids: ['palindrome-number', 'fibonacci-number'],
    time_limit: 15,
    enforce_fullscreen: false,
    disable_copypaste: false
  }
];

const getMockSections = (): Section[] => {
  const data = localStorage.getItem(MOCK_SECTIONS_KEY);
  if (data === null) {
    localStorage.setItem(MOCK_SECTIONS_KEY, JSON.stringify(defaultSections));
    return defaultSections;
  }
  return JSON.parse(data);
};

const saveMockSections = (list: Section[]) => {
  localStorage.setItem(MOCK_SECTIONS_KEY, JSON.stringify(list));
};

// Fisher-Yates array shuffling utility
const shuffleArray = (array: string[]): string[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};


// ==========================================
// UNIFIED AUTH & DB SERVICES
// ==========================================

// Subscribe to Authentication Status
export const subscribeAuth = (callback: (user: AppUser | null) => void): (() => void) => {
  let lastSessionStr: string | null = 'deveval_uninitialized';

  const checkSession = () => {
    try {
      const sessionStr = localStorage.getItem('deveval_session');
      if (sessionStr !== lastSessionStr) {
        lastSessionStr = sessionStr;
        if (sessionStr) {
          try {
            callback(JSON.parse(sessionStr));
          } catch (err) {
            console.error('[DevEval Engine] Failed to parse session JSON:', err);
            localStorage.removeItem('deveval_session');
            callback(null);
          }
        } else {
          callback(null);
        }
      }
    } catch (err) {
      console.error('[DevEval Engine] LocalStorage check failed:', err);
      callback(null);
    }
  };

  checkSession();

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'deveval_session') {
      checkSession();
    }
  };

  window.addEventListener('storage', handleStorageChange);
  const interval = setInterval(checkSession, 500);

  return () => {
    window.removeEventListener('storage', handleStorageChange);
    clearInterval(interval);
  };
};

// Register User (Repurposed for backwards compatibility)
export const registerUser = async (username: string, password: string): Promise<AppUser> => {
  await createUser(username, password);
  return loginUser(username, password);
};

// Log In User
export const loginUser = async (usernameInput: string, passwordInput: string): Promise<AppUser> => {
  const username = usernameInput.trim();
  const password = passwordInput;

  if (isSupabaseConfigured && supabase) {
    // Auto-seed Hari$h admin in Supabase if not present
    if (username === 'Hari$h' && password === 'Hari$h07') {
      try {
        const { data: existing } = await supabase
          .from('app_users')
          .select('*')
          .eq('username', 'Hari$h')
          .maybeSingle();

        if (!existing) {
          await supabase.from('app_users').insert({
            username: 'Hari$h',
            password: 'Hari$h07',
            role: 'admin'
          });
          console.log('[DevEval Engine] Auto-seeded admin user Hari$h in PostgreSQL.');
        }
      } catch (err) {
        console.warn('[DevEval Engine] Failed to auto-seed admin user in PostgreSQL:', err);
      }
    }

    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error('Invalid username or password.');
    }

    const sessionUser: AppUser = {
      uid: data.id,
      email: data.username, // Map username to email property
      role: data.role as 'user' | 'admin',
      tags: data.tags || JSON.parse(localStorage.getItem(`deveval_user_tags_${data.id}`) || '[]')
    };

    localStorage.setItem('deveval_session', JSON.stringify(sessionUser));
    return sessionUser;
  } else {
    // Mock Login
    const users = getMockUsers();
    const found = users.find((u) => u.username === username && u.password === password);
    
    if (!found) {
      throw new Error('Invalid username or password.');
    }

    const sessionUser: AppUser = {
      uid: found.uid || found.id,
      email: found.username,
      role: found.role,
      tags: JSON.parse(localStorage.getItem(`deveval_user_tags_${found.uid || found.id}`) || '[]')
    };

    localStorage.setItem('deveval_session', JSON.stringify(sessionUser));
    return sessionUser;
  }
};

// Log Out User
export const logoutUser = async (): Promise<void> => {
  localStorage.removeItem('deveval_session');
};

// Fetch All Custom App Users
export const fetchAppUsers = async (): Promise<{ id: string; username: string; role: 'user' | 'admin'; created_at?: string; tags?: string[] }[]> => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, username, role, created_at, tags')
        .order('username', { ascending: true });
      if (!error && data) {
        return data.map(d => ({
          ...d,
          tags: d.tags || JSON.parse(localStorage.getItem(`deveval_user_tags_${d.id}`) || '[]')
        })) as any[];
      }
    } catch (e) {
      console.warn('Supabase tags column missing, falling back to localStorage user tags.');
    }

    const { data, error } = await supabase
      .from('app_users')
      .select('id, username, role, created_at')
      .order('username', { ascending: true });
    if (error) throw error;
    return (data || []).map((u: any) => ({
      ...u,
      tags: JSON.parse(localStorage.getItem(`deveval_user_tags_${u.id}`) || '[]')
    }));
  } else {
    const users = getMockUsers();
    return users.map((u) => ({
      id: u.uid || u.id,
      username: u.username,
      role: u.role,
      created_at: u.created_at || new Date().toISOString(),
      tags: JSON.parse(localStorage.getItem(`deveval_user_tags_${u.uid || u.id}`) || '[]')
    }));
  }
};

export const saveUserTags = async (userId: string, tags: string[]): Promise<void> => {
  localStorage.setItem(`deveval_user_tags_${userId}`, JSON.stringify(tags));
  
  // Also update session if editing self
  const session = localStorage.getItem('deveval_session');
  if (session) {
    try {
      const parsed = JSON.parse(session);
      if (parsed.uid === userId) {
        parsed.tags = tags;
        localStorage.setItem('deveval_session', JSON.stringify(parsed));
      }
    } catch (e) {
      console.error('Failed to update session tags:', e);
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('app_users')
        .update({ tags })
        .eq('id', userId);
    } catch (err) {
      console.warn('[Supabase] Failed to save tags in PostgreSQL column, saved locally instead:', err);
    }
  }
};

// Create a User (Admin Only)
export const createUser = async (usernameInput: string, passwordInput: string): Promise<void> => {
  const username = usernameInput.trim();
  const password = passwordInput;
  if (!username || !password) {
    throw new Error('Username and password are required.');
  }

  if (isSupabaseConfigured && supabase) {
    const { data: existing } = await supabase
      .from('app_users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      throw new Error('A user with this username already exists.');
    }

    const { error } = await supabase
      .from('app_users')
      .insert({
        username,
        password,
        role: 'user'
      });
    if (error) throw error;
  } else {
    const users = getMockUsers();
    if (users.some((u) => u.username === username)) {
      throw new Error('A user with this username already exists.');
    }

    const mockUid = 'mock_uid_' + Math.random().toString(36).substring(2, 9);
    const newUser = {
      uid: mockUid,
      id: mockUid,
      username,
      password,
      role: 'user' as const,
      created_at: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  }
};

// Delete a User (Admin Only)
export const deleteUser = async (userId: string): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    const { data: user } = await supabase
      .from('app_users')
      .select('username')
      .eq('id', userId)
      .maybeSingle();

    if (user && user.username === 'Hari$h') {
      throw new Error('The primary admin account cannot be deleted.');
    }

    // Clean up related session tracking first
    const { error: sessionError } = await supabase
      .from('user_section_sessions')
      .delete()
      .eq('user_id', userId);
    if (sessionError) {
      console.error('Error removing user section sessions:', sessionError);
    }

    // Clean up related completions first
    const { error: completionsError } = await supabase
      .from('completions')
      .delete()
      .eq('user_id', userId);
    if (completionsError) {
      console.error('Error removing completions for deleted user:', completionsError);
    }

    const { error } = await supabase
      .from('app_users')
      .delete()
      .eq('id', userId);
    if (error) throw error;
  } else {
    let users = getMockUsers();
    const found = users.find((u) => (u.uid === userId || u.id === userId));
    if (found && found.username === 'Hari$h') {
      throw new Error('The primary admin account cannot be deleted.');
    }
    users = users.filter((u) => (u.uid !== userId && u.id !== userId));
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  }

  // Clean up localStorage keys for the deleted user
  localStorage.removeItem(`deveval_user_tags_${userId}`);
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.includes(`_${userId}_`) ||
      key.startsWith(`deveval_test_started_${userId}_`) ||
      key.startsWith(`deveval_test_submitted_${userId}_`) ||
      key.startsWith(`deveval_test_disqualified_${userId}_`) ||
      key.startsWith(`deveval_test_timeup_${userId}_`)
    )) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
};

// Fetch All Completions
export const fetchAllCompletions = async (): Promise<{ user_id: string; section_id?: string; challenge_id: string; submitted_code?: string; language?: string; keystroke_log?: any[]; score?: number; evaluator_notes?: string }[]> => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('completions')
        .select('user_id, section_id, challenge_id, submitted_code, language, keystroke_log, score, evaluator_notes');
      if (!error && data) {
        return data.map((d: any) => ({
          ...d,
          score: d.score !== undefined && d.score !== null ? d.score : parseInt(localStorage.getItem(`deveval_completion_score_${d.user_id}_${d.challenge_id}`) || '0', 10),
          evaluator_notes: d.evaluator_notes || localStorage.getItem(`deveval_completion_notes_${d.user_id}_${d.challenge_id}`) || ''
        }));
      }
    } catch (e) {
      console.warn('Supabase completions section_id or score columns missing, falling back to legacy query.');
    }

    try {
      const { data, error } = await supabase
        .from('completions')
        .select('user_id, challenge_id, submitted_code, language, keystroke_log, score, evaluator_notes');
      if (!error && data) {
        return data.map((d: any) => ({
          ...d,
          score: d.score !== undefined && d.score !== null ? d.score : parseInt(localStorage.getItem(`deveval_completion_score_${d.user_id}_${d.challenge_id}`) || '0', 10),
          evaluator_notes: d.evaluator_notes || localStorage.getItem(`deveval_completion_notes_${d.user_id}_${d.challenge_id}`) || ''
        }));
      }
    } catch (e) {
      console.warn('Supabase completions score columns missing, falling back to LocalStorage.');
    }

    const { data, error } = await supabase
      .from('completions')
      .select('user_id, challenge_id, submitted_code, language, keystroke_log');
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      score: parseInt(localStorage.getItem(`deveval_completion_score_${d.user_id}_${d.challenge_id}`) || '0', 10),
      evaluator_notes: localStorage.getItem(`deveval_completion_notes_${d.user_id}_${d.challenge_id}`) || ''
    }));
  } else {
    const completions: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MOCK_COMPLETIONS_KEY_PREFIX)) {
        const suffix = key.substring(MOCK_COMPLETIONS_KEY_PREFIX.length);
        const underscoreIdx = suffix.indexOf('_');
        let userId = suffix;
        let sectionId = '';
        if (underscoreIdx !== -1) {
          userId = suffix.substring(0, underscoreIdx);
          sectionId = suffix.substring(underscoreIdx + 1);
        }
        
        const saved = localStorage.getItem(key);
        if (saved) {
          const solvedIds: string[] = JSON.parse(saved);
          const detailsKey = MOCK_COMPLETION_DETAILS_PREFIX + userId + (sectionId ? `_${sectionId}` : '');
          const detailsStr = localStorage.getItem(detailsKey);
          const details = detailsStr ? JSON.parse(detailsStr) : {};
          
          solvedIds.forEach((cid) => {
            completions.push({ 
              user_id: userId, 
              section_id: sectionId,
              challenge_id: cid,
              submitted_code: details[cid]?.submitted_code,
              language: details[cid]?.language,
              keystroke_log: details[cid]?.keystroke_log || [],
              score: details[cid]?.score || 0,
              evaluator_notes: details[cid]?.evaluator_notes || ''
            });
          });
        }
      }
    }
    return completions;
  }
};

// Database to TypeScript mapping for challenges
const mapDbToChallenge = (dbItem: any): Challenge => {
  return {
    id: dbItem.id,
    title: dbItem.title,
    category: dbItem.category,
    difficulty: dbItem.difficulty,
    description: dbItem.description,
    boilerplate: dbItem.boilerplate || {},
    testCases: dbItem.test_cases || [],
    functionName: dbItem.function_name,
    isMcq: dbItem.boilerplate?.isMcq || false,
    mcqOptions: dbItem.boilerplate?.mcqOptions || [],
    mcqAnswer: dbItem.boilerplate?.mcqAnswer || '',
    tags: dbItem.tags || [],
  };
};

// TypeScript to Database mapping for challenges
const mapChallengeToDb = (challenge: Challenge): any => {
  return {
    id: challenge.id,
    title: challenge.title,
    category: challenge.category,
    difficulty: challenge.difficulty,
    description: challenge.description,
    boilerplate: {
      ...(challenge.boilerplate || {}),
      isMcq: challenge.isMcq,
      mcqOptions: challenge.mcqOptions,
      mcqAnswer: challenge.mcqAnswer,
    },
    test_cases: challenge.testCases,
    function_name: challenge.functionName,
    tags: challenge.tags || []
  };
};

// Fetch All Challenges
export const fetchChallenges = async (): Promise<Challenge[]> => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .order('title', { ascending: true });

    if (error) throw error;
    
    return data ? data.map(mapDbToChallenge) : [];
  } else {
    return getMockChallenges();
  }
};

// Add or Update Challenge (Admin only)
export const upsertChallenge = async (challenge: Challenge): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    const dbPayload = mapChallengeToDb(challenge);
    const { error } = await supabase
      .from('challenges')
      .upsert(dbPayload);

    if (error) throw error;
  } else {
    const list = getMockChallenges();
    const idx = list.findIndex((c) => c.id === challenge.id);
    if (idx !== -1) {
      list[idx] = challenge;
    } else {
      list.push(challenge);
    }
    saveMockChallenges(list);
  }
};

// Delete Challenge (Admin only)
export const removeChallenge = async (id: string): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } else {
    const list = getMockChallenges();
    const filtered = list.filter((c) => c.id !== id);
    saveMockChallenges(filtered);
  }
};

// Fetch User's Solved Challenge IDs for a specific section
export const fetchUserCompletions = async (uid: string, sectionId: string = ''): Promise<string[]> => {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('completions').select('challenge_id').eq('user_id', uid);
      if (sectionId) {
        query = query.eq('section_id', sectionId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map((d: any) => d.challenge_id);
      }
    } catch (e) {
      console.warn('[Supabase] Failed to fetch completions with section_id filter, trying fallback without it.');
    }
    // Fallback if section_id column does not exist
    const { data, error } = await supabase.from('completions').select('challenge_id').eq('user_id', uid);
    if (error) throw error;
    return data ? data.map((d: any) => d.challenge_id) : [];
  } else {
    const data = localStorage.getItem(MOCK_COMPLETIONS_KEY_PREFIX + uid + (sectionId ? `_${sectionId}` : ''));
    return data ? JSON.parse(data) : [];
  }
};

// Fetch User's Completion Details for a specific section (with scores and evaluator notes)
export const fetchUserCompletionDetails = async (uid: string, sectionId: string = ''): Promise<{ challenge_id: string; section_id?: string; score?: number; evaluator_notes?: string }[]> => {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('completions').select('challenge_id, score, evaluator_notes, section_id').eq('user_id', uid);
      if (sectionId) {
        query = query.eq('section_id', sectionId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map((d: any) => ({
          challenge_id: d.challenge_id,
          section_id: d.section_id,
          score: d.score !== undefined && d.score !== null ? d.score : parseInt(localStorage.getItem(`deveval_completion_score_${uid}_${d.challenge_id}`) || '0', 10),
          evaluator_notes: d.evaluator_notes || localStorage.getItem(`deveval_completion_notes_${uid}_${d.challenge_id}`) || ''
        }));
      }
    } catch (e) {
      console.warn('Supabase completions section_id or score columns missing, falling back to legacy fetch.');
    }

    try {
      const { data, error } = await supabase.from('completions').select('challenge_id, score, evaluator_notes').eq('user_id', uid);
      if (!error && data) {
        return data.map((d: any) => ({
          challenge_id: d.challenge_id,
          score: d.score !== undefined && d.score !== null ? d.score : parseInt(localStorage.getItem(`deveval_completion_score_${uid}_${d.challenge_id}`) || '0', 10),
          evaluator_notes: d.evaluator_notes || localStorage.getItem(`deveval_completion_notes_${uid}_${d.challenge_id}`) || ''
        }));
      }
    } catch (e) {
      console.warn('Supabase completions score columns missing, falling back to legacy query.');
    }

    const { data, error } = await supabase
      .from('completions')
      .select('user_id, challenge_id, submitted_code, language, keystroke_log');
    if (error) throw error;
    return (data || []).map((d: any) => ({
      challenge_id: d.challenge_id,
      score: parseInt(localStorage.getItem(`deveval_completion_score_${uid}_${d.challenge_id}`) || '0', 10),
      evaluator_notes: localStorage.getItem(`deveval_completion_notes_${uid}_${d.challenge_id}`) || ''
    }));
  } else {
    const key = MOCK_COMPLETION_DETAILS_PREFIX + uid + (sectionId ? `_${sectionId}` : '');
    const detailsStr = localStorage.getItem(key);
    const details = detailsStr ? JSON.parse(detailsStr) : {};
    const list = await fetchUserCompletions(uid, sectionId);
    return list.map((cid) => ({
      challenge_id: cid,
      section_id: details[cid]?.section_id || sectionId,
      score: details[cid]?.score || 0,
      evaluator_notes: details[cid]?.evaluator_notes || ''
    }));
  }
};

// Save a User's Completed Challenge
export const saveUserCompletion = async (
  uid: string,
  challengeId: string,
  code: string,
  lang: string,
  keystrokes: any[],
  score: number = 0,
  evaluatorNotes: string = '',
  sectionId: string = ''
): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('completions')
        .upsert({
          user_id: uid,
          section_id: sectionId || '',
          challenge_id: challengeId,
          submitted_code: code,
          language: lang,
          keystroke_log: keystrokes,
          score: score,
          evaluator_notes: evaluatorNotes
        });
      if (error) throw error;
    } catch (err) {
      // Fallback if Postgres section_id or score columns do not exist
      const { error } = await supabase
        .from('completions')
        .upsert({
          user_id: uid,
          challenge_id: challengeId,
          submitted_code: code,
          language: lang,
          keystroke_log: keystrokes
        });
      if (error) throw error;
      localStorage.setItem(`deveval_completion_score_${uid}_${challengeId}`, score.toString());
      localStorage.setItem(`deveval_completion_notes_${uid}_${challengeId}`, evaluatorNotes);
    }
  } else {
    const list = await fetchUserCompletions(uid, sectionId);
    if (!list.includes(challengeId)) {
      list.push(challengeId);
      localStorage.setItem(MOCK_COMPLETIONS_KEY_PREFIX + uid + (sectionId ? `_${sectionId}` : ''), JSON.stringify(list));
    }
    const detailsKey = MOCK_COMPLETION_DETAILS_PREFIX + uid + (sectionId ? `_${sectionId}` : '');
    const detailsStr = localStorage.getItem(detailsKey);
    const details = detailsStr ? JSON.parse(detailsStr) : {};
    details[challengeId] = {
      submitted_code: code,
      language: lang,
      keystroke_log: keystrokes,
      score,
      evaluator_notes: evaluatorNotes,
      section_id: sectionId
    };
    localStorage.setItem(detailsKey, JSON.stringify(details));
  }
};

export const updateCompletionScore = async (
  uid: string,
  challengeId: string,
  score: number,
  evaluatorNotes: string,
  sectionId: string = ''
): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('completions').update({
        score: score,
        evaluator_notes: evaluatorNotes
      }).eq('user_id', uid).eq('challenge_id', challengeId);
      if (sectionId) {
        query = query.eq('section_id', sectionId);
      }
      const { error } = await query;
      if (error) throw error;
    } catch (err) {
      console.warn('[Supabase] Failed to update PostgreSQL score columns, writing locally:', err);
      localStorage.setItem(`deveval_completion_score_${uid}_${challengeId}`, score.toString());
      localStorage.setItem(`deveval_completion_notes_${uid}_${challengeId}`, evaluatorNotes);
    }
  } else {
    const key = MOCK_COMPLETION_DETAILS_PREFIX + uid + (sectionId ? `_${sectionId}` : '');
    const detailsStr = localStorage.getItem(key);
    const details = detailsStr ? JSON.parse(detailsStr) : {};
    if (details[challengeId]) {
      details[challengeId].score = score;
      details[challengeId].evaluator_notes = evaluatorNotes;
      localStorage.setItem(key, JSON.stringify(details));
    }
  }
};


// ==========================================
// SECTIONS & ASSESSMENT SERVICES
// ==========================================

// Fetch All Sections
export const fetchSections = async (): Promise<Section[]> => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    
    return (data || []).map((s: any) => {
      const localGivenCount = localStorage.getItem(`deveval_section_given_count_${s.id}`);
      return {
        ...s,
        given_count: s.given_count !== undefined && s.given_count !== null 
          ? s.given_count 
          : (localGivenCount ? parseInt(localGivenCount, 10) : undefined)
      };
    });
  } else {
    return getMockSections();
  }
};

// Upsert Section (Admin only)
export const upsertSection = async (section: Section): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('sections')
        .upsert(section);

      if (error) throw error;
    } catch (err) {
      console.warn('[Supabase] Failed to upsert section with given_count, trying fallback without given_count:', err);
      const { given_count, ...fallbackSection } = section;
      const { error } = await supabase
        .from('sections')
        .upsert(fallbackSection);
      if (error) throw error;
      if (section.given_count !== undefined) {
        localStorage.setItem(`deveval_section_given_count_${section.id}`, section.given_count.toString());
      }
    }
  } else {
    const list = getMockSections();
    const idx = list.findIndex((s) => s.id === section.id);
    if (idx !== -1) {
      list[idx] = section;
    } else {
      list.push(section);
    }
    saveMockSections(list);
  }
};

// Remove Section (Admin only)
export const removeSection = async (id: string): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    // 1. Clean up user_section_sessions referencing this section to prevent foreign key errors
    const { error: sessionError } = await supabase
      .from('user_section_sessions')
      .delete()
      .eq('section_id', id);

    if (sessionError) {
      console.error('Error removing user section sessions:', sessionError);
    }

    // 2. Clean up completions referencing this section
    try {
      const { error: completionsError } = await supabase
        .from('completions')
        .delete()
        .eq('section_id', id);
      if (completionsError) {
        console.error('Error removing completions for deleted section:', completionsError);
      }
    } catch (err) {
      console.warn('Failed to delete completions with section_id filter on section deletion:', err);
    }

    // 3. Delete the section
    const { error } = await supabase
      .from('sections')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } else {
    const list = getMockSections();
    const filtered = list.filter((s) => s.id !== id);
    saveMockSections(filtered);
  }

  // 4. Sweep clean local storage keys for this section on the local machine
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && (key.endsWith(`_${id}`) || key.includes(`_${id}_`))) {
      localStorage.removeItem(key);
    }
  }
};

// Get or Initialize User-Specific Shuffled Challenge Order for a Section
export const getOrInitializeSectionSession = async (
  userId: string,
  section: Section
): Promise<string[]> => {
  const sessionKey = `${MOCK_USER_SECTION_SESSION_PREFIX}${userId}_${section.id}`;
  
  if (isSupabaseConfigured && supabase) {
    // Check if session exists in PostgreSQL table
    const { data, error } = await supabase
      .from('user_section_sessions')
      .select('assigned_challenge_ids')
      .eq('user_id', userId)
      .eq('section_id', section.id)
      .maybeSingle();

    if (!error && data && data.assigned_challenge_ids) {
      return data.assigned_challenge_ids as string[];
    }

    // Otherwise, generate assigned list
    let assignedIds = [...section.challenge_ids];
    if (section.randomize) {
      assignedIds = shuffleArray(assignedIds);
    }
    
    // Slice to given_count if configured and valid
    if (section.given_count && section.given_count > 0 && section.given_count < assignedIds.length) {
      assignedIds = assignedIds.slice(0, section.given_count);
    }

    // Write to postgres database
    const { error: insertError } = await supabase
      .from('user_section_sessions')
      .upsert({
        user_id: userId,
        section_id: section.id,
        assigned_challenge_ids: assignedIds
      });

    if (insertError) {
      console.error('Failed to save user section session in database:', insertError);
    }
    
    return assignedIds;
  } else {
    // Local Mock Session Storage
    const data = localStorage.getItem(sessionKey);
    if (data) {
      return JSON.parse(data);
    }

    let assignedIds = [...section.challenge_ids];
    if (section.randomize) {
      assignedIds = shuffleArray(assignedIds);
    }
    
    // Slice to given_count if configured and valid
    if (section.given_count && section.given_count > 0 && section.given_count < assignedIds.length) {
      assignedIds = assignedIds.slice(0, section.given_count);
    }

    localStorage.setItem(sessionKey, JSON.stringify(assignedIds));
    return assignedIds;
  }
};

// Fetch User's Assigned Section Session Shuffled Order
export const fetchUserSectionSession = async (userId: string, sectionId: string): Promise<string[]> => {
  const sessionKey = `${MOCK_USER_SECTION_SESSION_PREFIX}${userId}_${sectionId}`;
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('user_section_sessions')
        .select('assigned_challenge_ids')
        .eq('user_id', userId)
        .eq('section_id', sectionId)
        .maybeSingle();
      if (!error && data && data.assigned_challenge_ids) {
        return data.assigned_challenge_ids as string[];
      }
    } catch (e) {
      console.warn('Failed to fetch user section session from Postgres, falling back to local:', e);
    }
  }
  const data = localStorage.getItem(sessionKey);
  return data ? JSON.parse(data) : [];
};
