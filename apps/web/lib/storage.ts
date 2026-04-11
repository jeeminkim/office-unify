import { logDevError } from './utils';
import { RecentResult, SavedPromptTemplate } from './types';

export const STORAGE_KEY_SETTINGS = 'dev_assistant_settings';
export const STORAGE_KEY_DRAFT = 'dev_assistant_draft';
export const STORAGE_KEY_RECENT = 'dev_assistant_recent';
export const STORAGE_KEY_FEEDBACK = 'dev_assistant_feedback';
/** 3단계 피드백(최고/괜찮음/아쉬움) 로컬 카운트 */
export const STORAGE_KEY_FEEDBACK_TIER = 'dev_assistant_feedback_tier';
export const STORAGE_KEY_TEMPLATES = 'dev_assistant_templates';

const MAX_TEMPLATES = 30;

/** 예약: 로컬 설정(비밀 키는 저장하지 않음) */
export type Settings = Record<string, never>;

export type FeedbackStats = {
  helpful: number;
  notHelpful: number;
};

export type FeedbackTier = 'top' | 'ok' | 'weak';

export type FeedbackTierStats = {
  top: number;
  ok: number;
  weak: number;
};

export const getSettings = (): Settings => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return {};
    JSON.parse(raw);
    return {};
  } catch (error) {
    logDevError('설정 파싱 에러 (기본값 사용)', error);
    return {};
  }
};

/** 로컬 설정 키를 유지하되 비밀값은 저장하지 않는다. */
export const saveSettings = () => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({}));
};

export const getDraft = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_DRAFT) || '';
};

export const saveDraft = (draft: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_DRAFT, draft);
};

export const getRecentResults = (): RecentResult[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECENT);
    if (!raw) return [];
    return JSON.parse(raw) as RecentResult[];
  } catch (error) {
    logDevError('최근 결과 파싱 에러', error);
    return [];
  }
};

export const saveRecentResult = (result: Omit<RecentResult, 'id' | 'createdAt'>) => {
  if (typeof window === 'undefined') return;
  try {
    const current = getRecentResults();
    // 중복 제거 (동일한 프롬프트 & 스크립트 타입)
    const filtered = current.filter(r => !(r.prompt === result.prompt && r.taskType === result.taskType));
    
    const newResult: RecentResult = {
      ...result,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };
    
    // 최대 5개 유지
    const updated = [newResult, ...filtered].slice(0, 5);
    localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updated));
  } catch (error) {
    logDevError('최근 결과 저장 에러', error);
  }
};

export const getFeedbackStats = (): FeedbackStats => {
  if (typeof window === 'undefined') return { helpful: 0, notHelpful: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FEEDBACK);
    if (!raw) return { helpful: 0, notHelpful: 0 };
    return JSON.parse(raw) as FeedbackStats;
  } catch (error) {
    logDevError('피드백 내역 파싱 에러', error);
    return { helpful: 0, notHelpful: 0 };
  }
};

export const saveFeedback = (type: 'helpful' | 'notHelpful') => {
  if (typeof window === 'undefined') return;
  try {
    const current = getFeedbackStats();
    current[type] += 1;
    localStorage.setItem(STORAGE_KEY_FEEDBACK, JSON.stringify(current));
  } catch (error) {
    logDevError('피드백 저장 에러', error);
  }
};

export const getFeedbackTierStats = (): FeedbackTierStats => {
  if (typeof window === 'undefined') return { top: 0, ok: 0, weak: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FEEDBACK_TIER);
    if (!raw) return { top: 0, ok: 0, weak: 0 };
    const p = JSON.parse(raw) as Partial<FeedbackTierStats>;
    return {
      top: typeof p.top === 'number' ? p.top : 0,
      ok: typeof p.ok === 'number' ? p.ok : 0,
      weak: typeof p.weak === 'number' ? p.weak : 0,
    };
  } catch (error) {
    logDevError('피드백(3단계) 파싱 에러', error);
    return { top: 0, ok: 0, weak: 0 };
  }
};

export const saveFeedbackTier = (tier: FeedbackTier) => {
  if (typeof window === 'undefined') return;
  try {
    const current = getFeedbackTierStats();
    current[tier] += 1;
    localStorage.setItem(STORAGE_KEY_FEEDBACK_TIER, JSON.stringify(current));
  } catch (error) {
    logDevError('피드백(3단계) 저장 에러', error);
  }
};

// --- 초기화 로직 ---
export const clearDraft = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_DRAFT);
};

export const clearRecentResults = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_RECENT);
};

export const clearAllLocalData = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_SETTINGS);
  localStorage.removeItem(STORAGE_KEY_DRAFT);
  localStorage.removeItem(STORAGE_KEY_RECENT);
  localStorage.removeItem(STORAGE_KEY_FEEDBACK);
  localStorage.removeItem(STORAGE_KEY_FEEDBACK_TIER);
  localStorage.removeItem(STORAGE_KEY_TEMPLATES);
};

export const getSavedTemplates = (): SavedPromptTemplate[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
    if (!raw) return [];
    return JSON.parse(raw) as SavedPromptTemplate[];
  } catch (error) {
    logDevError('템플릿 파싱 에러', error);
    return [];
  }
};

export const savePromptTemplate = (
  entry: Omit<SavedPromptTemplate, 'id' | 'createdAt'>
): SavedPromptTemplate | null => {
  if (typeof window === 'undefined') return null;
  try {
    const current = getSavedTemplates();
    const newItem: SavedPromptTemplate = {
      ...entry,
      id: Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString(),
    };
    const updated = [newItem, ...current].slice(0, MAX_TEMPLATES);
    localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(updated));
    return newItem;
  } catch (error) {
    logDevError('템플릿 저장 에러', error);
    return null;
  }
};

export const deletePromptTemplate = (id: string) => {
  if (typeof window === 'undefined') return;
  try {
    const current = getSavedTemplates();
    const next = current.filter((t) => t.id !== id);
    localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(next));
  } catch (error) {
    logDevError('템플릿 삭제 에러', error);
  }
};
