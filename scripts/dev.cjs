const net = require("node:net");
const fs = require("node:fs/promises");
const { spawn } = require("node:child_process");
const path = require("node:path");

const preferredPort = Number.parseInt(process.env.PORT || "3000", 10);
const maxAttempts = 30;

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "::");
  });
}

async function pickPort(startPort) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset;
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortAvailable(candidate);
    if (free) return candidate;
  }
  return null;
}

async function isProjectDevServerAlreadyRunning() {
  const lockPath = path.resolve(process.cwd(), ".next", "dev", "lock");
  try {
    const handle = await fs.open(lockPath, "r+");
    await handle.close();
    return false;
  } catch (error) {
    if (!error || typeof error !== "object") return false;
    const code = error.code;
    return code === "EBUSY" || code === "EPERM";
  }
}

async function main() {
  const alreadyRunning = await isProjectDevServerAlreadyRunning();
  if (alreadyRunning) {
    console.log("[coinlit] Dev-сервер для этого проекта уже запущен. Останови его и перезапусти команду при необходимости.");
    process.exit(0);
    return;
  }

  const port = await pickPort(preferredPort);
  if (!port) {
    console.error(
      `[coinlit] Не удалось найти свободный порт в диапазоне ${preferredPort}-${preferredPort + maxAttempts - 1}.`
    );
    process.exit(1);
    return;
  }

  if (port !== preferredPort) {
    console.log(`[coinlit] Порт ${preferredPort} занят. Запускаю dev-сервер на ${port}.`);
  } else {
    console.log(`[coinlit] Запускаю dev-сервер на ${port}.`);
  }

  const nextBin = path.resolve(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) }
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error("[coinlit] Не удалось запустить Next.js dev server:", error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error("[coinlit] Ошибка запуска dev-сервера:", error);
  process.exit(1);
});
