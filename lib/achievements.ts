export type AchievementItem = {
  code: string;
  title: string;
  date: string;
};

export type AchievementLesson = {
  completedAt: string;
};

const lessonMilestoneNames = [
  "Первый ритм",
  "Рабочая дисциплина",
  "База без хаоса",
  "Термины под контролем",
  "Чистый чек-лист",
  "Спокойный вход",
  "Контроль риска",
  "Дневник решений",
  "Анти-FOMO",
  "План до сделки",
  "Безопасный кошелек",
  "Фундамент собран",
  "Рыночный режим",
  "Карта капитала",
  "Размер позиции",
  "Уровни без шума",
  "Ордер под контролем",
  "Ребаланс готов",
  "Стресс-сценарий",
  "Дисциплина сделки",
  "Пульс портфеля",
  "Системный подход",
  "Защита просадки",
  "Medium-ритм",
  "Контекст сильнее шума",
  "Ликвидность видна",
  "Риск-модель",
  "Процесс устойчив",
  "Проверка гипотез",
  "План выхода",
  "Стабильный журнал",
  "Фильтр сигналов",
  "Данные вместо эмоций",
  "Режим аналитика",
  "Качество решений",
  "Портфельная логика",
  "Макро-контекст",
  "Ончейн-взгляд",
  "Сценарное мышление",
  "Playbook собран",
  "Метрики ясны",
  "Кэш-резерв",
  "Защита прибыли",
  "IPS-черновик",
  "Аудит стратегии",
  "Профессиональный ритм",
  "Контроль плеча",
  "Сигналы отфильтрованы",
  "Глубина рынка",
  "Ошибки разобраны",
  "Волатильность приручена",
  "Долгий горизонт",
  "Капитал защищен",
  "Система выдержки",
  "План на цикл",
  "Метод без суеты",
  "Точность входа",
  "Дисциплина выхода",
  "Командный центр",
  "Высокий стандарт",
  "Ревизия процесса",
  "Связка факторов",
  "Контур защиты",
  "Проверяемая стратегия",
  "Зрелый инвестор",
  "Стратегический режим",
  "Полный обзор",
  "Процесс масштабируется",
  "Финальный аудит",
  "CoinLit-мастер",
  "Полная траектория"
];

function formatLessonCount(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} уроков`;
  if (last === 1) return `${count} урок`;
  if (last >= 2 && last <= 4) return `${count} урока`;
  return `${count} уроков`;
}

export function getLessonMilestoneTitle(lessonCount: number) {
  const index = Math.max(0, Math.floor(lessonCount / 2) - 1);
  const fallbackName = `Маршрут ${Math.floor(index / lessonMilestoneNames.length) + 1}`;
  const name = lessonMilestoneNames[index] ?? fallbackName;
  return `${formatLessonCount(lessonCount)}: ${name}`;
}

export function buildLessonMilestoneAchievements(lessons: AchievementLesson[]): AchievementItem[] {
  const chronological = lessons
    .filter((lesson) => lesson.completedAt)
    .slice()
    .sort((left, right) => new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime());

  const achievements: AchievementItem[] = [];
  for (let count = 2; count <= chronological.length; count += 2) {
    const milestoneLesson = chronological[count - 1];
    achievements.push({
      code: `lessons_${count}`,
      title: getLessonMilestoneTitle(count),
      date: milestoneLesson.completedAt
    });
  }

  return achievements;
}
