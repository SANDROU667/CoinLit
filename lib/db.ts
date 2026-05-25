import mysql, { type Pool } from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var coinlitPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var coinlitSchemaReady: boolean | undefined;
}

export const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  login VARCHAR(60) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  date_of_birth DATE NOT NULL,
  role ENUM('user','admin') DEFAULT 'user',
  coins INT DEFAULT 0,
  streak INT DEFAULT 0,
  blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  level VARCHAR(40) NOT NULL,
  direction VARCHAR(120) NOT NULL,
  price VARCHAR(40) NOT NULL,
  hours INT NOT NULL,
  archived BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS course_blueprints (
  slug VARCHAR(80) PRIMARY KEY,
  description TEXT NOT NULL,
  required_coins INT DEFAULT 0,
  lessons_json JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (slug) REFERENCES courses(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lessons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  position INT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT,
  title VARCHAR(255) NOT NULL,
  questions JSON NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS achievements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  code VARCHAR(80) NOT NULL,
  title VARCHAR(160) NOT NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_achievement (user_id, code),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id VARCHAR(80) NOT NULL,
  course_title VARCHAR(255) NOT NULL,
  lesson_id VARCHAR(120) NOT NULL,
  lesson_title VARCHAR(255) NOT NULL,
  test_correct BOOLEAN DEFAULT FALSE,
  coins INT DEFAULT 0,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_lesson (user_id, lesson_id),
  INDEX idx_lesson_progress_user (user_id),
  INDEX idx_lesson_progress_course (course_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS test_results (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  score INT NOT NULL,
  total INT NOT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_test_results_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS trades (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  trade_date DATE NOT NULL,
  pair_symbol VARCHAR(40) NOT NULL,
  side ENUM('long','short') NOT NULL,
  entry_price DECIMAL(18,8) NOT NULL,
  exit_price DECIMAL(18,8) NOT NULL,
  stop_price DECIMAL(18,8) NOT NULL,
  position_size DECIMAL(20,8) NOT NULL,
  fee DECIMAL(18,8) DEFAULT 0,
  note VARCHAR(500) DEFAULT '',
  pnl DECIMAL(18,8) NOT NULL,
  risk_amount DECIMAL(18,8) NOT NULL,
  r_multiple DECIMAL(12,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_trades_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

export function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!global.coinlitPool) {
    global.coinlitPool = mysql.createPool(process.env.DATABASE_URL);
  }
  return global.coinlitPool;
}

export async function ensureSchema(pool: Pool) {
  if (global.coinlitSchemaReady) return;
  const statements = schema
    .split(";")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await pool.execute(statement);
  }

  try {
    const [indexes] = await pool.query("SHOW INDEX FROM achievements WHERE Key_name = 'uniq_user_achievement'");
    if (!Array.isArray(indexes) || indexes.length === 0) {
      await pool.execute("ALTER TABLE achievements ADD UNIQUE KEY uniq_user_achievement (user_id, code)");
    }
  } catch {
    // Existing databases can contain duplicate historical achievements. Runtime writes still de-dupe by code.
  }

  global.coinlitSchemaReady = true;
}
