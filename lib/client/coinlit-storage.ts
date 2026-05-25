export type AuthMode = "login" | "register";

export type CompletedLesson = {
  id: string;
  title: string;
  courseTitle: string;
  courseId: string;
  completedAt: string;
  coins: number;
  testCorrect: boolean;
};

export type TestResult = {
  title: string;
  score: number;
  total: number;
  completedAt: string;
};

export type ProgressState = {
  completedLessons: CompletedLesson[];
  testResults: TestResult[];
};

export const emptyProgress: ProgressState = {
  completedLessons: [],
  testResults: []
};

const progressKey = "coinlit_progress";

export function readProgress(): ProgressState {
  if (typeof window === "undefined") return emptyProgress;
  const raw = localStorage.getItem(progressKey);
  return raw ? { ...emptyProgress, ...JSON.parse(raw) } : emptyProgress;
}

export function saveProgress(progress: ProgressState) {
  localStorage.setItem(progressKey, JSON.stringify(progress));
  emitProgressUpdated();
}

export function openAuthDialog(mode: AuthMode = "register") {
  window.dispatchEvent(new CustomEvent("coinlit:auth", { detail: { mode } }));
}

export function emitUserUpdated() {
  window.dispatchEvent(new Event("coinlit:user-updated"));
}

export function emitProgressUpdated() {
  window.dispatchEvent(new Event("coinlit:progress-updated"));
}
