import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("./path-access.json", import.meta.url), "utf8"));
const validLanes = new Set(["PLAN", "RESEARCH", "DEVELOP", "VALIDATE", "OPERATE"]);
const validModes = new Set(["read", "write"]);
const forbiddenActions = new Set(["merge", "release", "force-push", "delete-branch", "cross-repository-write", "scrape-chatgpt-web", "bypass-approval"]);

function match(pattern, path) {
  if (pattern.endsWith("/**")) return path.startsWith(pattern.slice(0, -3) + "/");
  return pattern === path;
}
function cleanPath(path) {
  return typeof path === "string" && path.length > 0 && !path.startsWith("/") &&
    !path.includes("\\") && !path.split("/").some(x => x === ".." || x === "" || x === ".");
}
export function evaluatePermission(request) {
  const deny = reason => ({ decision: "deny", reason });
  if (!request || !validLanes.has(request.lane) || !validModes.has(request.mode)) return deny("Invalid lane or mode.");
  if (!cleanPath(request.path)) return deny("Missing or unsafe repository-relative path.");
  if (request.repository !== "OpenITStudios/LazyPrompting") return deny("Cross-repository scope is not granted.");
  if (forbiddenActions.has(request.action)) return deny("Forbidden action.");
  if (request.action && request.action !== "source-read" && request.action !== "source-write") return deny("Unrecognized action.");
  if (request.mode === "write" && request.action !== "source-write") return deny("Explicit source-write action required.");
  if (request.mode === "read" && request.action !== "source-read") return deny("Explicit source-read action required.");
  if (request.mode === "write" && (request.lane !== "DEVELOP" || request.branch !== "Local")) return deny("Only DEVELOP on Local may write.");
  const owners = config.owners.filter(x => match(x.path, request.path));
  if (owners.length !== 1) return deny("Path requires exactly one canonical owner.");
  if (request.mode === "read") return { decision: "allow", owner: owners[0].owner, reason: "Known source path; read-only." };
  if (request.approval?.kind !== "EXPLICIT_USER_MESSAGE" ||
      typeof request.approval?.reference !== "string" || !request.approval.reference.trim() ||
      !Array.isArray(request.approval.paths) || !request.approval.paths.includes(request.path)) {
    return deny("Explicit user provenance and exact path scope required.");
  }
  return { decision: "allow", owner: owners[0].owner, reason: "Path, branch, lane and user scope checked; tool capability and current HEAD must still be verified." };
}
