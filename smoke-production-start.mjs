import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "../..");
const prisma = new PrismaClient();
const cmsModels = [
  ["profile", () => prisma.profile.findMany({ orderBy: { id: "asc" } })],
  ["projects", () => prisma.project.findMany({ orderBy: { id: "asc" } })],
  ["projectImages", () => prisma.projectImage.findMany({ orderBy: { id: "asc" } })],
  ["serviceCategories", () => prisma.serviceCategory.findMany({ orderBy: { id: "asc" } })],
  ["services", () => prisma.service.findMany({ orderBy: { id: "asc" } })],
  ["skills", () => prisma.skill.findMany({ orderBy: { id: "asc" } })],
  ["resumes", () => prisma.resume.findMany({ orderBy: { id: "asc" } })],
  ["siteSettings", () => prisma.siteSettings.findMany({ orderBy: { id: "asc" } })],
  ["socialLinks", () => prisma.socialLink.findMany({ orderBy: { id: "asc" } })],
];

let interruptedBy;
let child;
let failure;
let initialCmsSnapshot;
const recordInterrupt = (signal) => { interruptedBy ??= signal; };
const onSigint = () => recordInterrupt("SIGINT");
const onSigterm = () => recordInterrupt("SIGTERM");
process.on("SIGINT", onSigint);
process.on("SIGTERM", onSigterm);

function getTomlSection(toml, sectionName) {
  let isCurrentSection = false;
  const lines = [];

  for (const line of toml.split(/\r?\n/)) {
    const section = /^\[([^\]]+)\]$/.exec(line.trim());
    if (section) {
      if (isCurrentSection) break;
      isCurrentSection = section[1] === sectionName;
      continue;
    }
    if (isCurrentSection) lines.push(line);
  }

  if (!isCurrentSection) throw new Error(`Missing artifact configuration section [${sectionName}].`);
  return lines.join("\n");
}

function getTomlArray(section, key) {
  const line = section.split(/\r?\n/).find((entry) => entry.trim().startsWith(`${key} =`));
  const value = line?.trim().slice(`${key} =`.length).trim();
  if (!value) throw new Error(`Missing ${key} in production artifact configuration.`);
  return JSON.parse(value);
}

function getTomlStringEnvironment(section) {
  const environment = {};
  for (const line of section.split(/\r?\n/)) {
    const assignment = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"([^"]*)"\s*$/.exec(line);
    if (assignment) environment[assignment[1]] = assignment[2];
  }
  return environment;
}

function getPackageScriptName(args, packageName) {
  if (
    args[0] !== "pnpm" ||
    args[1] !== "--filter" ||
    args[2] !== packageName ||
    args[3] !== "run" ||
    args.length !== 5
  ) {
    throw new Error(
      "The production build and run commands must call a named script in this portfolio package so the safety check can inspect it.",
    );
  }
  return args[4];
}

function assertNoProductionDatabaseMutation(command, label) {
  const forbidden = [
    /\bmigrate\w*\b/i,
    /\bdb\s+push\b/i,
    /\bdb\s+execute\b/i,
    /\bdb:(?:push|migrate)\b/i,
  ];
  if (forbidden.some((pattern) => pattern.test(command))) {
    throw new Error(
      `The production ${label} command contains a database schema mutation: ${command}`,
    );
  }
}

async function getUnusedPort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise((resolveClose) => server.close(resolveClose));
    throw new Error("Could not reserve a temporary TCP port for the startup check.");
  }
  await new Promise((resolveClose, reject) => {
    server.close((error) => error ? reject(error) : resolveClose());
  });
  return address.port;
}

async function snapshotCms() {
  const cms = Object.fromEntries(
    await Promise.all(cmsModels.map(async ([name, load]) => [name, await load()])),
  );
  const profile = cms.profile.find((row) => row.id === "singleton");
  const settings = cms.siteSettings.find((row) => row.id === "singleton");

  if (!profile || !settings) {
    throw new Error(
      "The selected development database is not initialized. Initialize it through the normal development setup before running this check.",
    );
  }

  const fingerprint = createHash("sha256").update(JSON.stringify(cms)).digest("hex");
  return { fingerprint, profileName: profile.name };
}

function waitForExit(childProcess, timeoutMs) {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) return Promise.resolve(true);

  return new Promise((resolveExit) => {
    const finish = (exited) => {
      clearTimeout(timer);
      childProcess.off("exit", onExit);
      resolveExit(exited);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    childProcess.once("exit", onExit);
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) finish(true);
  });
}

async function stopServer(childProcess) {
  if (!childProcess?.pid) return;
  const signalGroup = (signal) => {
    try {
      process.kill(-childProcess.pid, signal);
    } catch {
      try {
        childProcess.kill(signal);
      } catch {
        // The process may have exited between the status check and the signal.
      }
    }
  };

  if (await waitForExit(childProcess, 0)) return;
  signalGroup("SIGTERM");
  if (await waitForExit(childProcess, 5000)) return;
  signalGroup("SIGKILL");
  await waitForExit(childProcess, 2000);
}

async function request(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHttp200(url, label, processHandle, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus;
  let lastError;

  while (Date.now() < deadline) {
    if (interruptedBy) throw new Error(`Startup check interrupted by ${interruptedBy}.`);
    if (processHandle.spawnError) throw new Error(`Could not start the production command: ${processHandle.spawnError.message}`);
    if (processHandle.exitCode !== null || processHandle.signalCode !== null) {
      const exitStatus = processHandle.exitCode !== null
        ? `code ${processHandle.exitCode}`
        : `signal ${processHandle.signalCode}`;
      throw new Error(`The configured production start command exited early with ${exitStatus}.`);
    }

    try {
      const response = await request(url);
      if (response.status === 200) return response;
      lastStatus = response.status;
      await response.body?.cancel().catch(() => {});
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 400));
  }

  const reason = lastStatus ? `last HTTP status was ${lastStatus}` : `last request failed (${lastError?.name ?? "unknown error"})`;
  throw new Error(`${label} did not return HTTP 200 before the timeout; ${reason}.`);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
  })[character]);
}

async function run() {
  if (process.env.PORTFOLIO_SMOKE_DATABASE !== "development") {
    throw new Error(
      "Refusing to start the production command without explicit development-database confirmation. Set PORTFOLIO_SMOKE_DATABASE=development.",
    );
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set for the development database.");
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT_ID) {
    throw new Error("Refusing to run this development-database check from a production environment.");
  }

  const [artifactToml, packageJsonText] = await Promise.all([
    readFile(resolve(packageRoot, ".replit-artifact/artifact.toml"), "utf8"),
    readFile(resolve(packageRoot, "package.json"), "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonText);
  const buildArgs = getTomlArray(getTomlSection(artifactToml, "services.production.build"), "args");
  const runArgs = getTomlArray(getTomlSection(artifactToml, "services.production.run"), "args");
  const buildScriptName = getPackageScriptName(buildArgs, packageJson.name);
  const runScriptName = getPackageScriptName(runArgs, packageJson.name);
  const buildScript = packageJson.scripts[buildScriptName];
  const runScript = packageJson.scripts[runScriptName];
  if (!buildScript || !runScript) throw new Error("The artifact production command references a missing package script.");

  assertNoProductionDatabaseMutation(`${buildArgs.join(" ")} ${buildScript}`, "build");
  assertNoProductionDatabaseMutation(`${runArgs.join(" ")} ${runScript}`, "start");

  const healthPath = getTomlSection(artifactToml, "services.production.health.startup")
    .split(/\r?\n/)
    .map((line) => /^\s*path\s*=\s*"([^"]+)"\s*$/.exec(line))
    .find(Boolean)?.[1];
  if (!healthPath) throw new Error("The artifact production startup health path is missing.");

  initialCmsSnapshot = await snapshotCms();
  const port = await getUnusedPort();
  const productionEnvironment = getTomlStringEnvironment(
    getTomlSection(artifactToml, "services.production.run.env"),
  );
  const childEnvironment = {
    ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
    ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
    ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
    ...productionEnvironment,
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: String(port),
  };

  child = spawn(runArgs[0], runArgs.slice(1), {
    cwd: workspaceRoot,
    detached: true,
    stdio: "ignore",
    env: childEnvironment,
  });
  child.spawnError = null;
  child.once("error", (error) => { child.spawnError = error; });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHttp200(new URL(healthPath, baseUrl), "The readiness endpoint", child, 60_000);
  const homepage = await waitForHttp200(new URL("/", baseUrl), "The homepage", child, 15_000);
  const homepageHtml = await homepage.text();
  const firstName = initialCmsSnapshot.profileName.trim().split(/\s+/)[0];
  if (!firstName || (!homepageHtml.includes(firstName) && !homepageHtml.includes(escapeHtml(firstName)))) {
    throw new Error("The homepage returned HTTP 200 but did not render the existing CMS profile name.");
  }
}

try {
  await run();
} catch (error) {
  failure = error instanceof Error ? error : new Error(String(error));
} finally {
  await stopServer(child);
  if (initialCmsSnapshot) {
    try {
      const finalCmsSnapshot = await snapshotCms();
      if (finalCmsSnapshot.fingerprint !== initialCmsSnapshot.fingerprint) {
        throw new Error("CMS content changed during production startup; the startup command must not seed or reset content.");
      }
    } catch (error) {
      const snapshotFailure = error instanceof Error ? error : new Error(String(error));
      failure = failure
        ? new Error(`${failure.message} Additionally, the CMS preservation check failed: ${snapshotFailure.message}`)
        : snapshotFailure;
    }
  }
  await prisma.$disconnect();
  process.off("SIGINT", onSigint);
  process.off("SIGTERM", onSigterm);
}

if (failure) {
  console.error(`Production startup smoke check failed: ${failure.message}`);
  process.exitCode = interruptedBy ? 128 + (interruptedBy === "SIGINT" ? 2 : 15) : 1;
} else {
  console.log("Production startup smoke check passed: readiness and homepage returned HTTP 200; CMS content was preserved.");
}