"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  emptyProgress,
  openAuthDialog,
  readProgress,
  saveProgress,
  type ProgressState
} from "@/lib/client/coinlit-storage";
import {
  courseModules,
  courses,
  glossary,
  type Course,
  type CourseLesson,
  type TestQuestion
} from "@/lib/content/learning-content";

const exitWarning = "Вы уверены, что хотите выйти? Прогресс урока сбросится.";

const rewardByLevel: Record<Course["level"], number> = {
  Base: 20,
  Medium: 30,
  High: 45
};

const termHints: Record<string, string> = {
  BTC: "Bitcoin: децентрализованный цифровой актив с ограниченной эмиссией.",
  ETH: "Ethereum: сеть смарт-контрактов и приложений DeFi.",
  DeFi: glossary.DeFi,
  FOMO: glossary.FOMO,
  DYOR: glossary.DYOR,
  HODL: glossary.HODL,
  STAKING: glossary.STAKING
};

type CoursePlayerProps = {
  courseId: string;
  overrideCourse?: Course;
  overrideLessons?: CourseLesson[];
  standaloneCourse?: boolean;
};

function formatTimer(seconds: number) {
  const safe = Math.max(0, seconds);
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function applyTermHighlights(text: string) {
  let next = text;
  for (const [term, tip] of Object.entries(termHints)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    next = next.replace(regex, `<span class="tooltip-term" data-tip="${tip}">${term}</span>`);
  }
  return next;
}

function normalizeTest(test: TestQuestion | undefined): TestQuestion {
  if (!test) {
    return {
      question: "Какой подход лучше всего закрепляет дисциплину?",
      options: [
        "Решать на эмоциях",
        "Следовать плану, риску и пост-анализу",
        "Игнорировать журнал решений"
      ],
      answer: 1,
      explanation: "Стабильность строится на сценарии, контроле риска и разборе результата."
    };
  }

  const options = Array.isArray(test.options) ? test.options.filter(Boolean).slice(0, 6) : [];
  const safeOptions = options.length >= 2 ? options : ["Вариант 1", "Вариант 2"];
  const safeAnswer = Number.isInteger(test.answer) && test.answer >= 0 && test.answer < safeOptions.length ? test.answer : 0;
  return {
    question: test.question || "Добавьте вопрос урока.",
    options: safeOptions,
    answer: safeAnswer,
    explanation: test.explanation || "Добавьте объяснение правильного ответа."
  };
}

function getTheoryPages(lesson: CourseLesson) {
  const pages = lesson.material
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (lesson.practice.trim()) {
    pages.push(`Практика.\n${lesson.practice.trim()}`);
  }

  if (!pages.length) {
    pages.push("Материал урока пока не заполнен.");
  }

  return pages;
}

export function CoursePlayer({ courseId, overrideCourse, overrideLessons, standaloneCourse = false }: CoursePlayerProps) {
  const router = useRouter();
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [lessonIndex, setLessonIndex] = useState(0);
  const [theoryPage, setTheoryPage] = useState(0);
  const [phase, setPhase] = useState<"theory" | "test">("theory");
  const [timerSec, setTimerSec] = useState(600);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastResult, setLastResult] = useState<"idle" | "failed">("idle");

  const selectedCourse = useMemo(() => {
    if (overrideCourse) return overrideCourse;
    return courses.find((course) => course.id === courseId) ?? null;
  }, [courseId, overrideCourse]);

  const selectedModule = useMemo(() => {
    if (overrideLessons) return { courseId, lessons: overrideLessons };
    return courseModules.find((module) => module.courseId === courseId) ?? null;
  }, [courseId, overrideLessons]);

  const refreshProgress = useCallback(async () => {
    try {
      const response = await fetch("/api/progress", { cache: "no-store" });
      if (!response.ok) throw new Error("unauthorized");
      const data = (await response.json()) as ProgressState & { source?: string };
      if (data.source === "no-db") {
        setProgress(readProgress());
        setIsAuthenticated(true);
        return;
      }
      const nextProgress = { completedLessons: data.completedLessons ?? [], testResults: data.testResults ?? [] };
      setProgress(nextProgress);
      localStorage.setItem("coinlit_progress", JSON.stringify(nextProgress));
      setIsAuthenticated(true);
    } catch {
      setProgress(readProgress());
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    refreshProgress();
    window.addEventListener("coinlit:user-updated", refreshProgress);
    window.addEventListener("coinlit:progress-updated", refreshProgress);
    return () => {
      window.removeEventListener("coinlit:user-updated", refreshProgress);
      window.removeEventListener("coinlit:progress-updated", refreshProgress);
    };
  }, [refreshProgress]);

  const completedIds = useMemo(() => new Set(progress.completedLessons.map((lesson) => lesson.id)), [progress.completedLessons]);

  const completedByCourse = useMemo(() => {
    const map = new Map<string, number>();
    for (const lesson of progress.completedLessons) {
      map.set(lesson.courseId, (map.get(lesson.courseId) ?? 0) + 1);
    }
    return map;
  }, [progress.completedLessons]);

  const baseLessons = courseModules.find((module) => module.courseId === "base")?.lessons.length ?? 0;
  const mediumLessons = courseModules.find((module) => module.courseId === "medium")?.lessons.length ?? 0;
  const baseDone = (completedByCourse.get("base") ?? 0) >= baseLessons;
  const mediumDone = (completedByCourse.get("medium") ?? 0) >= mediumLessons;

  const unlocked = useMemo(() => {
    if (standaloneCourse) return true;
    if (courseId === "base") return true;
    if (courseId === "medium") return baseDone;
    if (courseId === "high") return mediumDone;
    return true;
  }, [courseId, baseDone, mediumDone, standaloneCourse]);

  useEffect(() => {
    if (!selectedModule) return;
    const firstIncomplete = selectedModule.lessons.findIndex((lesson) => !completedIds.has(lesson.id));
    setLessonIndex(firstIncomplete === -1 ? 0 : firstIncomplete);
  }, [completedIds, selectedModule]);

  const activeLesson = selectedModule?.lessons[lessonIndex] ?? null;
  const theoryPages = useMemo(() => (activeLesson ? getTheoryPages(activeLesson) : []), [activeLesson]);
  const displayTitle = activeLesson?.title ?? `Урок ${lessonIndex + 1}`;
  const keyPoints = activeLesson?.keyPoints.length
    ? activeLesson.keyPoints
    : ["Определи цель урока", "Изучи теорию", "Пройди тест и зафиксируй результат"];

  useEffect(() => {
    if (!activeLesson) return;
    setTheoryPage(0);
    setPhase("theory");
    setTimerSec(Math.max(120, activeLesson.minutes * 60));
    setLastResult("idle");
  }, [activeLesson]);

  useEffect(() => {
    if (!activeLesson) return;
    if (completedIds.has(activeLesson.id)) return;

    const lessonDuration = Math.max(120, activeLesson.minutes * 60);
    const timer = window.setInterval(() => {
      setTimerSec((current) => {
        if (current <= 1) {
          setTheoryPage(0);
          setPhase("theory");
          setAnswers((items) => ({ ...items, [activeLesson.id]: -1 }));
          setLastResult("failed");
          return lessonDuration;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeLesson, completedIds]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!activeLesson || completedIds.has(activeLesson.id)) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [activeLesson, completedIds]);

  const handleBack = useCallback(() => {
    if (activeLesson && !completedIds.has(activeLesson.id)) {
      const ok = window.confirm(exitWarning);
      if (!ok) return;
      setTheoryPage(0);
      setPhase("theory");
      setTimerSec(Math.max(120, activeLesson.minutes * 60));
      setAnswers((items) => ({ ...items, [activeLesson.id]: -1 }));
    }
    router.push("/courses");
  }, [activeLesson, completedIds, router]);

  const lessonUnlocked = useMemo(() => {
    if (!selectedModule || !activeLesson) return false;
    if (!unlocked) return false;
    if (lessonIndex === 0) return true;
    return completedIds.has(selectedModule.lessons[lessonIndex - 1].id) || completedIds.has(activeLesson.id);
  }, [activeLesson, completedIds, lessonIndex, selectedModule, unlocked]);

  const testAttempt = attempts[activeLesson?.id ?? ""] ?? 1;
  const test = useMemo(() => {
    const base = normalizeTest(activeLesson?.test);
    if (testAttempt <= 1) return base;
    return {
      ...base,
      question: `Попытка ${testAttempt}. ${base.question}`
    };
  }, [activeLesson, testAttempt]);

  async function completeLesson() {
    if (!selectedCourse || !selectedModule || !activeLesson) return;
    if (!lessonUnlocked) return;

    const selectedAnswer = answers[activeLesson.id];
    if (selectedAnswer === undefined || selectedAnswer < 0) return;

    const isCorrect = selectedAnswer === test.answer;
    if (!isCorrect) {
      setAttempts((prev) => ({ ...prev, [activeLesson.id]: (prev[activeLesson.id] ?? 1) + 1 }));
      setAnswers((prev) => ({ ...prev, [activeLesson.id]: -1 }));
      setLastResult("failed");
      return;
    }

    const reward = rewardByLevel[selectedCourse.level];
    const completedLesson = {
      id: activeLesson.id,
      title: displayTitle,
      courseTitle: selectedCourse.title,
      courseId: selectedCourse.id,
      completedAt: new Date().toISOString(),
      coins: reward,
      testCorrect: true
    };

    if (!isAuthenticated) {
      openAuthDialog("register");
      return;
    }

    try {
      const response = await fetch("/api/progress/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          lessonId: activeLesson.id,
          lessonTitle: displayTitle,
          courseTitle: selectedCourse.title,
          testCorrect: true,
          coins: reward
        })
      });

      if (response.ok) {
        const body = (await response.json().catch(() => ({ fallback: false }))) as { fallback?: boolean };
        if (body.fallback) {
          const next = { ...progress, completedLessons: [...progress.completedLessons, completedLesson] };
          setProgress(next);
          saveProgress(next);
        } else {
          await refreshProgress();
        }

        const nextIndex = lessonIndex + 1;
        if (nextIndex < selectedModule.lessons.length) {
          setLessonIndex(nextIndex);
        }
        return;
      }
    } catch {
      // local fallback below
    }

    const next = { ...progress, completedLessons: [...progress.completedLessons, completedLesson] };
    setProgress(next);
    saveProgress(next);
  }

  if (!selectedCourse || !selectedModule || !activeLesson) {
    return (
      <article className="card" style={{ marginTop: 24 }}>
        <h2>Курс не найден</h2>
        <p className="muted">Проверь ссылку курса или вернись в каталог программы.</p>
        <Link className="btn secondary" href="/courses">
          Назад к курсам
        </Link>
      </article>
    );
  }

  const selectedAnswer = answers[activeLesson.id];
  const lessonDone = completedIds.has(activeLesson.id);
  const canContinueTheory = phase === "theory" && theoryPage < theoryPages.length - 1;

  return (
    <div className="course-player">
      <article className="card glass">
        <div className="course-player-top">
          <button className="btn ghost" type="button" onClick={handleBack}>
            ← Назад
          </button>
          <span className="chip">
            {selectedCourse.level} • урок {lessonIndex + 1}/{selectedModule.lessons.length}
          </span>
          <span className="chip">Таймер: {formatTimer(timerSec)}</span>
        </div>
        <h1>{selectedCourse.title}</h1>
        <p className="muted">{selectedCourse.description}</p>
        {!unlocked && <p className="auth-error">Доступ к этому уровню откроется после полного прохождения предыдущего курса.</p>}
      </article>

      <article className={`lesson-card ${lessonUnlocked ? "" : "locked"}`}>
        <div className="lesson-head">
          <span className="chip">{displayTitle}</span>
          {!lessonUnlocked && <span className="pill">Сначала заверши предыдущий урок</span>}
        </div>

        {phase === "theory" && (
          <>
            <h3>Теория · страница {theoryPage + 1}/{theoryPages.length}</h3>
            <p className="lesson-rich" dangerouslySetInnerHTML={{ __html: applyTermHighlights(theoryPages[theoryPage] ?? "") }} />
            <ul className="lesson-list">
              {keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="hero-actions" style={{ marginTop: 14 }}>
              {canContinueTheory ? (
                <button className="btn" type="button" disabled={!lessonUnlocked} onClick={() => setTheoryPage((value) => value + 1)}>
                  Следующая страница теории
                </button>
              ) : (
                <button className="btn" type="button" disabled={!lessonUnlocked} onClick={() => setPhase("test")}>
                  Перейти к тесту
                </button>
              )}
            </div>
          </>
        )}

        {phase === "test" && (
          <>
            <h3>Тест по уроку · попытка {testAttempt}</h3>
            {lastResult === "failed" && (
              <p className="auth-error">Ответ неверный. Попробуй еще раз, чтобы перейти к следующему уроку.</p>
            )}
            <p>{test.question}</p>
            <div className="quiz-options">
              {test.options.map((option, optionIndex) => {
                const state =
                  selectedAnswer === undefined || selectedAnswer < 0
                    ? ""
                    : optionIndex === test.answer
                      ? "correct"
                      : selectedAnswer === optionIndex
                        ? "wrong"
                        : "";

                return (
                  <button
                    className={`option ${state}`}
                    disabled={!lessonUnlocked || lessonDone}
                    key={option}
                    type="button"
                    onClick={() => setAnswers((items) => ({ ...items, [activeLesson.id]: optionIndex }))}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {selectedAnswer !== undefined && selectedAnswer >= 0 && <p className="muted">{test.explanation}</p>}
            <button
              className="btn"
              type="button"
              data-requires-auth
              disabled={!lessonUnlocked || lessonDone || selectedAnswer === undefined || selectedAnswer < 0}
              onClick={completeLesson}
            >
              {lessonDone ? "Урок завершен" : `Проверить и завершить (+${rewardByLevel[selectedCourse.level]} коинов)`}
            </button>
          </>
        )}
      </article>
    </div>
  );
}
