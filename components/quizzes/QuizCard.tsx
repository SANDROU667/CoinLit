"use client";

import { useMemo, useState } from "react";
import { readProgress, saveProgress } from "@/lib/client/coinlit-storage";
import type { TestQuestion } from "@/lib/content/learning-content";

export function QuizCard({ title, questions }: { title: string; questions: TestQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const question = questions[index];

  const level = useMemo(() => {
    const ratio = score / questions.length;
    if (ratio < 0.45) return "Новичок";
    if (ratio < 0.75) return "Любитель";
    return "Начинающий инвестор";
  }, [questions.length, score]);

  function choose(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
    if (optionIndex === question.answer) setScore((value) => value + 1);
  }

  async function persistResult() {
    try {
      const response = await fetch("/api/progress/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, score, total: questions.length })
      });
      if (response.ok) {
        const body = (await response.json().catch(() => ({ fallback: false }))) as { fallback?: boolean };
        if (body.fallback) {
          throw new Error("fallback-local");
        }
        window.dispatchEvent(new Event("coinlit:progress-updated"));
        return;
      }
    } catch {
      // Fallback to local-only persistence below.
    }

    const progress = readProgress();
    const nextProgress = {
      completedLessons: progress.completedLessons,
      testResults: [...progress.testResults, { title, score, total: questions.length, completedAt: new Date().toISOString() }]
    };
    saveProgress(nextProgress);
  }

  async function next() {
    if (index + 1 >= questions.length) {
      await persistResult();
      setDone(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
  }

  function reset() {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setDone(false);
  }

  if (done) {
    return (
      <div className="card">
        <span className="chip">Результат</span>
        <h2>{level}</h2>
        <p className="lead">
          Ты набрал {score} из {questions.length}. Чтобы закрепить результат, пройди слабые темы в курсах и повтори тест
          через пару дней.
        </p>
        <button className="btn" onClick={reset}>
          Пройти заново
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <span className="chip">
        {index + 1}/{questions.length}
      </span>
      <h2>{title}</h2>
      <h3>{question.question}</h3>
      <div className="quiz-options">
        {question.options.map((option, optionIndex) => {
          const state =
            selected === null ? "" : optionIndex === question.answer ? "correct" : selected === optionIndex ? "wrong" : "";
          return (
            <button className={`option ${state}`} key={option} onClick={() => choose(optionIndex)}>
              {option}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <>
          <p className="muted">{question.explanation}</p>
          <button className="btn" onClick={next}>
            {index + 1 >= questions.length ? "Показать результат" : "Следующий вопрос"}
          </button>
        </>
      )}
    </div>
  );
}
