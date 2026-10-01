// ffmpeg / ffprobe: checked once at startup so a missing install is reported
// clearly instead of as a stream of "spawn ffmpeg ENOENT" errors.

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function isAvailable(bin) {
  try {
    return spawnSync(bin, ["-version"], { stdio: "ignore", timeout: 10000 }).status === 0;
  } catch {
    return false;
  }
}

/**
 * On Windows, `winget install Gyan.FFmpeg` adds ffmpeg to PATH only for programs
 * started afterwards (for VS Code terminals, after VS Code restarts). Look in
 * winget's install folders too, so a fresh install works straight away.
 */
function findWingetBinary(name) {
  if (process.platform !== "win32" || !process.env.LOCALAPPDATA) return null;
  const winget = path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet");
  const candidates = [path.join(winget, "Links", `${name}.exe`)];
  try {
    const packages = path.join(winget, "Packages");
    for (const pkg of fs.readdirSync(packages).filter((d) => /ffmpeg/i.test(d))) {
      for (const build of fs.readdirSync(path.join(packages, pkg))) {
        candidates.push(path.join(packages, pkg, build, "bin", `${name}.exe`));
      }
    }
  } catch {
    // no winget packages folder
  }
  return candidates.find((file) => fs.existsSync(file)) || null;
}

function resolveBinary(envVar, name) {
  if (process.env[envVar]) return process.env[envVar];
  if (isAvailable(name)) return name;
  const found = findWingetBinary(name);
  if (found && isAvailable(found)) {
    console.log(`🔎 Using ${name} from ${found}`);
    return found;
  }
  return name;
}

const FFMPEG = resolveBinary("FFMPEG_PATH", "ffmpeg");
const FFPROBE = resolveBinary("FFPROBE_PATH", "ffprobe");
const ffmpegOk = isAvailable(FFMPEG);
const ffprobeOk = isAvailable(FFPROBE);

/** Whether this ffmpeg accepts an output option (e.g. -fps_mode needs ffmpeg 5.1+). */
function supportsOption(option, value) {
  if (!ffmpegOk) return false;
  try {
    const result = spawnSync(
      FFMPEG,
      ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "nullsrc=d=0.04", option, value, "-f", "null", "-"],
      { stdio: "ignore", timeout: 10000 }
    );
    return result.status === 0;
  } catch {
    return false;
  }
}

// After a provider reconnect the timestamps jump; by default ffmpeg fills the gap by
// repeating frames ("More than 1000 frames duplicated"), which viewers see as a freeze.
const fpsPassthroughArgs = supportsOption("-fps_mode", "passthrough") ? ["-fps_mode", "passthrough"] : [];

if (!ffmpegOk || !ffprobeOk) {
  const missing = [!ffmpegOk && FFMPEG, !ffprobeOk && FFPROBE].filter(Boolean).join(" and ");
  console.error(
    [
      "",
      `⚠️  ${missing} not found. Live TV, radio and movie/episode playback are disabled.`,
      "    Browsing channels, movies and series still works.",
      "    Install ffmpeg (it includes ffprobe), then restart this server:",
      "      Windows: winget install Gyan.FFmpeg   (then open a new terminal)",
      "      Ubuntu:  sudo apt install ffmpeg",
      "    Or set FFMPEG_PATH / FFPROBE_PATH in server/.env to the full paths.",
      "",
    ].join("\n")
  );
}

const MISSING_MESSAGE = "Playback isn't available right now: the server is missing ffmpeg.";

module.exports = { FFMPEG, FFPROBE, ffmpegOk, ffprobeOk, fpsPassthroughArgs, MISSING_MESSAGE };
