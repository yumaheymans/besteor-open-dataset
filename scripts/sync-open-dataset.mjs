/** Atomic publisher for the PUBLIC dataset repository only. Never touches the app repository. */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { collectSnapshot, sha256 } from "./gen-open-dataset.mjs";

export const REPOSITORY = "yumaheymans/besteor-open-dataset";

function client(token) {
  if (!token) throw new Error("A repository-scoped GitHub token is required");
  return async (path, method = "GET", body) => {
    const res = await fetch(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "x-github-api-version": "2026-03-10",
        "user-agent": "BestEOR-DatasetSyncBot/1.0",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${res.status}`);
    return res.json();
  };
}

/** Use the existing tree as a base, so LICENSE and unrelated files are preserved. */
export async function publishFiles(files, token, message) {
  const api = client(token);
  const ref = await api("git/ref/heads/main");
  const parent = await api(`git/commits/${ref.object.sha}`);
  const tree = await api("git/trees", "POST", {
    base_tree: parent.tree.sha,
    tree: Object.entries(files).map(([path, content]) => ({ path, content, mode: "100644", type: "blob" })),
  });
  if (tree.sha === parent.tree.sha) return { changed: false, commit: ref.object.sha };
  const commit = await api("git/commits", "POST", { message, tree: tree.sha, parents: [ref.object.sha] });
  // Fail on concurrent changes instead of overwriting someone else's work.
  await api("git/refs/heads/main", "PATCH", { sha: commit.sha, force: false });
  const published = await api(`git/trees/${commit.sha}?recursive=1`);
  if (published.truncated) throw new Error("Cannot verify a truncated tree");
  for (const [path, expected] of Object.entries(files)) {
    const entry = published.tree.find((item) => item.path === path && item.type === "blob");
    if (!entry) throw new Error(`Published file missing: ${path}`);
    const blob = await api(`git/blobs/${entry.sha}`);
    const actual = Buffer.from(blob.content, "base64").toString("utf8");
    if (sha256(actual) !== sha256(expected)) throw new Error(`Published checksum mismatch: ${path}`);
  }
  return { changed: true, commit: commit.sha, verified_files: Object.keys(files).length };
}

export async function syncSnapshot(token) {
  const files = await collectSnapshot();
  const incoming = JSON.parse(files["data/_manifest.json"]);
  const api = client(token);
  const ref = await api("git/ref/heads/main");
  const tree = await api(`git/trees/${ref.object.sha}?recursive=1`);
  if (tree.truncated) throw new Error("Cannot inspect a truncated tree");
  const entry = tree.tree.find((item) => item.path === "data/_manifest.json");
  if (entry) {
    const blob = await api(`git/blobs/${entry.sha}`);
    const previous = JSON.parse(Buffer.from(blob.content, "base64").toString("utf8"));
    if (previous.content_fingerprint === incoming.content_fingerprint &&
        previous.generator_version === incoming.generator_version &&
        previous.fetched_at.slice(0, 10) === incoming.fetched_at.slice(0, 10)) {
      for (const [name, expected] of Object.entries(previous.files)) {
        const file = tree.tree.find((item) => item.path === `data/${name}`);
        if (!file) throw new Error(`Existing snapshot file missing: ${name}`);
        const stored = await api(`git/blobs/${file.sha}`);
        if (sha256(Buffer.from(stored.content, "base64").toString("utf8")) !== expected.sha256) {
          throw new Error(`Existing snapshot checksum mismatch: ${name}`);
        }
      }
      return { changed: false, reason: "Same verified data and UTC snapshot day", commit: ref.object.sha };
    }
  }
  return publishFiles(files, token, `Refresh verified dataset snapshot ${incoming.fetched_at.slice(0, 10)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  syncSnapshot(process.env.GITHUB_TOKEN || process.env.GH_TOKEN)
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
