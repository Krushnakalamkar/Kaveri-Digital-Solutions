import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { formatSeedFailure, withSeedOperation } from "../prisma/seed-errors.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = resolve(packageRoot, "node_modules/prisma/build/index.js");
const seedScript = resolve(packageRoot, "prisma/seed.mjs");

function getConfirmedDevelopmentUrl() {
  if (process.env.PORTFOLIO_SEED_TEST_DATABASE !== "development") {
    throw new Error(
      "Refusing to run without explicit development-database confirmation. Set PORTFOLIO_SEED_TEST_DATABASE=development.",
    );
  }
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT_ID) {
    throw new Error("Refusing to run the seed setup test from a production environment.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  const expectedHost = process.env.PGHOST;
  const expectedPort = process.env.PGPORT;
  const expectedDatabase = process.env.PGDATABASE;
  if (!databaseUrl || !expectedHost || !expectedPort || !expectedDatabase) {
    throw new Error(
      "The seed setup test requires DATABASE_URL and the development PGHOST, PGPORT, and PGDATABASE settings.",
    );
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL connection URL.");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("The seed setup test only supports PostgreSQL.");
  }
  if (
    parsed.hostname.toLowerCase() !== expectedHost.toLowerCase() ||
    Number(parsed.port || 5432) !== Number(expectedPort) ||
    decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) !== expectedDatabase
  ) {
    throw new Error(
      "Refusing to run because DATABASE_URL does not match the configured development PostgreSQL target.",
    );
  }
  if (/\bprod(?:uction)?\b/i.test(`${parsed.hostname} ${expectedDatabase}`)) {
    throw new Error("Refusing to run because the configured database target appears to be production.");
  }

  return databaseUrl;
}

function makeChildEnvironment(databaseUrl, additionalEnvironment = {}) {
  return {
    ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
    ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
    ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
    DATABASE_URL: databaseUrl,
    NODE_ENV: "test",
    ...additionalEnvironment,
  };
}

function runNodeScript(scriptPath, args, databaseUrl, label, additionalEnvironment = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: packageRoot,
      env: makeChildEnvironment(databaseUrl, additionalEnvironment),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      output += chunk;
      process.stderr.write(chunk);
    });
    child.once("error", rejectRun);
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(
          new Error(
            `${label} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.${output ? `\n${output}` : ""}`,
          ),
        );
      }
    });
  });
}

async function verifySimulatedFailureDiagnostics() {
  const simulatedDatabaseUrl =
    "postgresql://seed_test_user:seed_test_password@127.0.0.1:1/seed_failure_test?schema=public";
  let wrappedFailure;

  try {
    await withSeedOperation("Create the initial profile", async () => {
      throw new Error(
        `Database authentication failed for ${simulatedDatabaseUrl}; user=seed_test_user; password=seed_test_password`,
      );
    });
  } catch (error) {
    wrappedFailure = error;
  }

  const diagnostic = formatSeedFailure(wrappedFailure, simulatedDatabaseUrl);
  assert.match(diagnostic, /Create the initial profile/);
  assert.match(diagnostic, /Database authentication failed/);
  assert.match(diagnostic, /\[connection URL redacted\]/);
  assert.doesNotMatch(diagnostic, /seed_test_user|seed_test_password|postgresql:\/\//);
}

function runUnreachableDatabaseSeed() {
  const databaseUrl =
    "postgresql://seed_test_user:seed_test_password@127.0.0.1:1/seed_failure_test?schema=public&connect_timeout=1";

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [seedScript], {
      cwd: packageRoot,
      env: makeChildEnvironment(databaseUrl),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", rejectRun);
    child.once("close", (code, signal) => {
      resolveRun({ code, signal, output });
    });
  });
}

async function verifySeedProcessFailureDiagnostics() {
  const { code, signal, output } = await runUnreachableDatabaseSeed();
  assert.notEqual(code, 0, "The seed must fail when its database is unreachable.");
  assert.equal(signal, null, "The seed failure should be reported by the process, not a signal.");
  assert.match(
    output,
    /Database seed failed during "Initialize the default CMS content":/,
  );
  assert.match(output, /Can't reach database server|ECONNREFUSED|connect/i);
  assert.doesNotMatch(output, /seed_test_user|seed_test_password|postgresql:\/\//);
}

async function run() {
  await verifySimulatedFailureDiagnostics();
  await verifySeedProcessFailureDiagnostics();
  console.log("Seed failure diagnostics passed: operation and safe database error are reported.");
  if (process.argv.includes("--diagnostics-only")) return;

  const databaseUrl = getConfirmedDevelopmentUrl();
  const schemaName = `portfolio_seed_test_${randomBytes(8).toString("hex")}`;
  const isolatedUrl = new URL(databaseUrl);
  isolatedUrl.searchParams.set("schema", schemaName);

  const adminPrisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  let isolatedPrisma;
  let schemaCreated = false;
  let failure;

  try {
    await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;

    await runNodeScript(
      prismaCli,
      [
        "db",
        "push",
        "--schema",
        resolve(packageRoot, "prisma/schema.prisma"),
        "--skip-generate",
      ],
      isolatedUrl.toString(),
      "Creating the isolated test schema",
    );

    isolatedPrisma = new PrismaClient({
      datasources: { db: { url: isolatedUrl.toString() } },
    });

    await assert.rejects(
      runNodeScript(
        seedScript,
        [],
        isolatedUrl.toString(),
        "Injected first-run setup failure",
        { PORTFOLIO_SEED_TEST_FAIL_AFTER: "first-service" },
      ),
      /Injected seed setup failure after the first service/,
      "The seed test must fail after writing part of the initial CMS defaults.",
    );
    const [
      failedProfileCount,
      failedSocialLinkCount,
      failedCategoryCount,
      failedServiceCount,
      failedSettings,
    ] = await Promise.all([
      isolatedPrisma.profile.count(),
      isolatedPrisma.socialLink.count(),
      isolatedPrisma.serviceCategory.count(),
      isolatedPrisma.service.count(),
      isolatedPrisma.siteSettings.findUnique({ where: { id: "singleton" } }),
    ]);
    assert.equal(failedProfileCount, 0, "A failed setup must roll back the default profile.");
    assert.equal(failedSocialLinkCount, 0, "A failed setup must roll back default social links.");
    assert.equal(failedCategoryCount, 0, "A failed setup must roll back default service categories.");
    assert.equal(failedServiceCount, 0, "A failed setup must roll back default services.");
    assert.equal(failedSettings, null, "A failed setup must not leave the completion marker.");

    await runNodeScript(seedScript, [], isolatedUrl.toString(), "First seed run");
    const initialProfile = await isolatedPrisma.profile.findUnique({ where: { id: "singleton" } });
    const initialSettings = await isolatedPrisma.siteSettings.findUnique({ where: { id: "singleton" } });

    assert.ok(initialProfile, "The first seed run must create the initial profile.");
    assert.equal(initialProfile.name, "Krushna Kalamkar");
    assert.equal(initialProfile.professionalTitle, "Founder of KAVERI DIGITAL SOLUTIONS");
    assert.equal(initialProfile.email, "kalamkarkrushna007@gmail.com");
    assert.ok(initialProfile.biography, "The initial profile must include a biography.");

    assert.ok(initialSettings, "The first seed run must create initial site settings.");
    assert.equal(initialSettings.siteTitle, "KAVERI DIGITAL SOLUTIONS");
    assert.ok(initialSettings.description, "The initial site settings must include a description.");

    await isolatedPrisma.profile.update({
      where: { id: "singleton" },
      data: { name: "Seed Preservation Check", email: "seed-preservation@example.invalid" },
    });
    await isolatedPrisma.siteSettings.update({
      where: { id: "singleton" },
      data: {
        siteTitle: "Custom Site Title",
        description: "Custom site description that must survive the next seed run.",
      },
    });
    await isolatedPrisma.project.create({
      data: {
        title: "Custom project that must survive",
        slug: "seed-preservation-check",
        shortDescription: "A custom CMS record used to verify seed safety.",
      },
    });

    await runNodeScript(seedScript, [], isolatedUrl.toString(), "Second seed run");

    const [preservedProfile, preservedSettings, preservedProject] = await Promise.all([
      isolatedPrisma.profile.findUnique({ where: { id: "singleton" } }),
      isolatedPrisma.siteSettings.findUnique({ where: { id: "singleton" } }),
      isolatedPrisma.project.findUnique({ where: { slug: "seed-preservation-check" } }),
    ]);

    assert.equal(preservedProfile?.name, "Seed Preservation Check");
    assert.equal(preservedProfile?.email, "seed-preservation@example.invalid");
    assert.equal(preservedSettings?.siteTitle, "Custom Site Title");
    assert.equal(
      preservedSettings?.description,
      "Custom site description that must survive the next seed run.",
    );
    assert.equal(preservedProject?.title, "Custom project that must survive");

    // Recreate the database state left by a first-run failure before the
    // site-settings completion marker is written: some defaults exist and have
    // been edited, while other required defaults are still missing.
    await isolatedPrisma.serviceCategory.update({
      where: { slug: "web-technology" },
      data: {
        name: "Custom Web Category",
        description: "A category edit made before setup was interrupted.",
      },
    });
    await isolatedPrisma.service.update({
      where: { slug: "website-development" },
      data: {
        name: "Custom Website Development",
        description: "A service edit made before setup was interrupted.",
      },
    });
    await isolatedPrisma.socialLink.update({
      where: { platform: "instagram" },
      data: {
        label: "Custom Instagram",
        url: "https://example.invalid/custom-instagram",
      },
    });
    await isolatedPrisma.socialLink.delete({ where: { platform: "linkedin" } });
    await isolatedPrisma.service.delete({ where: { slug: "website-testing" } });
    await isolatedPrisma.serviceCategory.delete({ where: { slug: "content" } });
    await isolatedPrisma.siteSettings.delete({ where: { id: "singleton" } });

    assert.equal(
      await isolatedPrisma.siteSettings.findUnique({ where: { id: "singleton" } }),
      null,
      "The interrupted setup must not have its completion marker.",
    );
    assert.equal(
      await isolatedPrisma.serviceCategory.findUnique({ where: { slug: "content" } }),
      null,
      "The interrupted setup must be missing a required category.",
    );
    assert.equal(
      await isolatedPrisma.service.findUnique({ where: { slug: "website-testing" } }),
      null,
      "The interrupted setup must be missing a required service.",
    );

    await runNodeScript(seedScript, [], isolatedUrl.toString(), "Interrupted first-run recovery");

    const [
      recoveredProfile,
      recoveredSettings,
      recoveredProject,
      recoveredCategory,
      recoveredService,
      recoveredSocialLink,
      restoredSocialLink,
      restoredCategory,
      restoredService,
    ] = await Promise.all([
      isolatedPrisma.profile.findUnique({ where: { id: "singleton" } }),
      isolatedPrisma.siteSettings.findUnique({ where: { id: "singleton" } }),
      isolatedPrisma.project.findUnique({ where: { slug: "seed-preservation-check" } }),
      isolatedPrisma.serviceCategory.findUnique({ where: { slug: "web-technology" } }),
      isolatedPrisma.service.findUnique({
        where: { slug: "website-development" },
        include: { category: true },
      }),
      isolatedPrisma.socialLink.findUnique({ where: { platform: "instagram" } }),
      isolatedPrisma.socialLink.findUnique({ where: { platform: "linkedin" } }),
      isolatedPrisma.serviceCategory.findUnique({ where: { slug: "content" } }),
      isolatedPrisma.service.findUnique({
        where: { slug: "website-testing" },
        include: { category: true },
      }),
    ]);

    assert.equal(recoveredProfile?.name, "Seed Preservation Check");
    assert.equal(recoveredProfile?.email, "seed-preservation@example.invalid");
    assert.equal(recoveredSettings?.siteTitle, "KAVERI DIGITAL SOLUTIONS");
    assert.ok(recoveredSettings?.description, "Recovery must restore the default site settings.");
    assert.equal(recoveredProject?.title, "Custom project that must survive");
    assert.equal(recoveredCategory?.name, "Custom Web Category");
    assert.equal(
      recoveredCategory?.description,
      "A category edit made before setup was interrupted.",
    );
    assert.equal(recoveredService?.name, "Custom Website Development");
    assert.equal(
      recoveredService?.description,
      "A service edit made before setup was interrupted.",
    );
    assert.equal(recoveredService?.category.slug, "web-technology");
    assert.equal(recoveredSocialLink?.label, "Custom Instagram");
    assert.equal(recoveredSocialLink?.url, "https://example.invalid/custom-instagram");
    assert.equal(restoredSocialLink?.url, "https://www.linkedin.com/in/krushna-kalamkar-416895328/");
    assert.equal(restoredCategory?.name, "Content");
    assert.equal(restoredService?.name, "Website Testing");
    assert.equal(restoredService?.category.slug, "web-technology");
    console.log(
      "Seed setup passed: clean setup, completed rerun, and interrupted recovery preserve custom CMS edits.",
    );
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
  } finally {
    await isolatedPrisma?.$disconnect();
    if (schemaCreated) {
      try {
        await adminPrisma.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
      } catch (error) {
        const cleanupError = error instanceof Error ? error : new Error(String(error));
        failure = failure
          ? new Error(`${failure.message} The temporary test schema could not be removed: ${cleanupError.message}`)
          : cleanupError;
      }
    }
    await adminPrisma.$disconnect();
  }

  if (failure) throw failure;
}

run().catch((error) => {
  console.error(`First-run seed setup test failed: ${error.message}`);
  process.exitCode = 1;
});