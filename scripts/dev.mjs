const watchers = [];
const stdio = {stdin: "inherit", stdout: "inherit", stderr: "inherit"};

function stopWatchers() {
  for (const watcher of watchers) {
    if (watcher.exitCode === null && watcher.signalCode === null) watcher.kill();
  }
}

function handleSignal(signal) {
  process.exitCode = signal === "SIGINT" ? 130 : 143;
  stopWatchers();
}

process.once("SIGINT", handleSignal);
process.once("SIGTERM", handleSignal);

try {
  watchers.push(Bun.spawn([process.execPath, "--no-orphans", "--bun", "run", "tsc", "--watch",
    "--preserveWatchOutput"], stdio));
  watchers.push(Bun.spawn([process.execPath, "--watch", "build/app.js"], stdio));
  const exitCode = await Promise.race(watchers.map(watcher => watcher.exited));
  process.exitCode ??= exitCode;
} finally {
  stopWatchers();
  await Promise.allSettled(watchers.map(watcher => watcher.exited));
}
