const connectionUrlPattern = /\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>]+/gi;

function redactDatabaseCredentials(message, databaseUrl) {
  let safeMessage = message.replace(connectionUrlPattern, "[connection URL redacted]");

  if (databaseUrl) {
    try {
      const parsedUrl = new URL(databaseUrl);
      const credentialValues = [parsedUrl.username, parsedUrl.password]
        .filter(Boolean)
        .flatMap((value) => {
          try {
            return [value, decodeURIComponent(value)];
          } catch {
            return [value];
          }
        })
        .sort((a, b) => b.length - a.length);

      for (const credential of credentialValues) {
        safeMessage = safeMessage.split(credential).join("[credential redacted]");
      }
    } catch {
      // The URL itself is still covered by the scheme-based redaction above.
    }
  }

  return safeMessage;
}

export async function withSeedOperation(operation, action) {
  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = new Error(message);
    failure.seedOperation = error?.seedOperation || operation;
    throw failure;
  }
}

export function formatSeedFailure(error, databaseUrl = process.env.DATABASE_URL) {
  const operation = error?.seedOperation || "unknown operation";
  const message = error instanceof Error ? error.message : String(error);
  const safeOperation = redactDatabaseCredentials(operation, databaseUrl);
  const safeMessage = redactDatabaseCredentials(message, databaseUrl);

  return `Database seed failed during "${safeOperation}": ${safeMessage}`;
}
