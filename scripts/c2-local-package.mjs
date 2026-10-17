import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Local files only. No network, database, dependency installation, Git writes or deployment.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'plan';
const packageRoot = path.join(root, '.c2-local-backup', 'c2-revision');
const initial = path.join(root, '.c2-local-backup', 'initial');
const sha = bytes => bytes == null ? null : createHash('sha256').update(bytes).digest('hex');
const read = target => fs.existsSync(target) ? fs.readFileSync(target) : null;
function safe(base, relative) {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(s => s === '..' || s === '.git' || s.startsWith('.env'))) throw new Error(`Path ditolak: ${relative}`);
  const target = path.resolve(base, relative);
  if (!target.startsWith(path.resolve(base) + path.sep)) throw new Error('Path di luar folder tujuan.');
  let cursor = path.resolve(base);
  for (const segment of path.relative(base, target).split(path.sep)) {
    cursor = path.join(cursor, segment);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`Symlink tidak diikuti: ${relative}`);
  }
  return target;
}
function write(target, bytes) {
  if (bytes == null) { if (fs.existsSync(target)) fs.unlinkSync(target); return; }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
}
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
if (git('branch', '--show-current').toString().trim() !== 'C2-001-revisi-ccr-1510') throw new Error('Jalankan pada branch C2-001-revisi-ccr-1510.');
const allowed = relative => /^(app|components|lib|utils|tests|scripts|docs|sql)\//.test(relative) || /^(package(-lock)?\.json|pnpm-lock\.yaml|tsconfig\.json|eslint\.config\.mjs|next\.config\.ts|proxy\.ts|README\.md|\.gitignore)$/.test(relative);
function files() {
  return [...new Set([...git('diff', '--name-only', 'HEAD', '-z').toString().split('\0'), ...git('ls-files', '--others', '--exclude-standard', '-z').toString().split('\0')].filter(Boolean))].filter(allowed).sort();
}
function readInitialStatus() {
  const bytes = read(path.join(initial, 'initial-status.txt'));
  if (!bytes) throw new Error('Snapshot awal tidak tersedia; tidak boleh menebak baseline perubahan lokal.');
  return bytes.toString(bytes[0] === 255 && bytes[1] === 254 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
}
function loadManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error('Manifest tidak valid.');
  for (const entry of manifest.files) {
    if (!allowed(entry.path)) throw new Error(`File di luar cakupan: ${entry.path}`);
    safe(root, entry.path);
    for (const version of ['before', 'after']) {
      if (sha(read(safe(path.join(packageRoot, version), entry.path))) !== entry[`${version}Hash`]) throw new Error(`Paket berubah/rusak: ${entry.path}`);
    }
  }
  return manifest;
}
function backup(manifest) {
  const destination = path.join(root, '.c2-local-backup', `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const entries = manifest.files.map(entry => {
    const bytes = read(safe(root, entry.path));
    write(safe(destination, entry.path), bytes);
    return { path: entry.path, hash: sha(bytes) };
  });
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'snapshot.json'), JSON.stringify({ files: entries }, null, 2));
  console.log(`Backup lokal: ${destination}`);
}
if (mode === 'plan') {
  console.log('Rencana paket perubahan lokal (tidak mengubah file/database):');
  console.log(files().join('\n'));
} else if (mode === 'pack') {
  const status = readInitialStatus();
  const entries = [];
  for (const relative of files()) {
    const snapshot = safe(initial, relative);
    const wasDeleted = status.some(line => line.slice(0, 2).includes('D') && line.slice(3).replaceAll('\\', '/') === relative);
    let before = fs.existsSync(snapshot) ? fs.readFileSync(snapshot) : null;
    if (!before && !wasDeleted) {
      try { before = git('show', `HEAD:${relative}`); } catch { /* New file has no HEAD baseline. */ }
    }
    const after = read(safe(root, relative));
    if (sha(before) === sha(after)) continue;
    write(safe(path.join(packageRoot, 'before'), relative), before);
    write(safe(path.join(packageRoot, 'after'), relative), after);
    entries.push({ path: relative, beforeHash: sha(before), afterHash: sha(after) });
  }
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(path.join(packageRoot, 'manifest.json'), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), files: entries }, null, 2));
  console.log(`Paket siap: ${entries.length} file, ${packageRoot}`);
} else if (['check', 'backup', 'apply', 'rollback'].includes(mode)) {
  const manifest = loadManifest();
  if (mode === 'backup') backup(manifest);
  else {
    const targetVersion = mode === 'rollback' ? 'before' : 'after';
    const conflicts = manifest.files.filter(entry => {
      const current = sha(read(safe(root, entry.path)));
      return mode === 'check' ? current !== entry.afterHash : current !== entry.beforeHash && current !== entry.afterHash;
    });
    if (conflicts.length) throw new Error(`Perubahan lain terdeteksi; tidak ada file ditimpa:\n${conflicts.map(x => x.path).join('\n')}`);
    if (mode !== 'check') {
      const changes = manifest.files.filter(entry => sha(read(safe(root, entry.path))) !== entry[`${targetVersion}Hash`]);
      if (changes.length) {
        backup(manifest);
        for (const entry of changes) write(safe(root, entry.path), read(safe(path.join(packageRoot, targetVersion), entry.path)));
      }
      console.log(`${mode}: ${changes.length} file dipulihkan/disalin; database tidak disentuh.`);
    } else console.log(`Check berhasil: ${manifest.files.length} file sesuai paket.`);
  }
} else throw new Error('Mode: plan | pack | check | backup | apply | rollback');
