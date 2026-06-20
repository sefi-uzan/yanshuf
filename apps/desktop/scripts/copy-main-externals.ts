import fs from 'node:fs';
import path from 'node:path';

/** Main-process packages marked `external` in vite.main.config.ts — not bundled by Vite. */
export const MAIN_EXTERNALS = ['http-mitm-proxy', 'ws'] as const;

function readPackageJson(packageDir: string): { dependencies?: Record<string, string> } | null {
  const packageJsonPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return null;
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>;
  };
}

function packagePath(nodeModulesRoot: string, packageName: string): string {
  if (packageName.startsWith('@')) {
    const [scope, name] = packageName.split('/');
    return path.join(nodeModulesRoot, scope, name);
  }
  return path.join(nodeModulesRoot, packageName);
}

function resolvePackageDir(nodeModulesRoot: string, packageName: string): string | null {
  const dir = packagePath(nodeModulesRoot, packageName);
  return fs.existsSync(dir) ? dir : null;
}

function findNodeModulesRoot(projectRoot: string, probePackage = 'http-mitm-proxy'): string {
  let current = projectRoot;
  let fallback = path.join(projectRoot, 'node_modules');
  while (true) {
    const candidate = path.join(current, 'node_modules');
    if (fs.existsSync(path.join(candidate, probePackage))) {
      return candidate;
    }
    if (fs.existsSync(candidate)) {
      fallback = candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return fallback;
}

/** Collect production dependency names reachable from the given roots. */
export function collectDependencyTree(
  roots: readonly string[],
  nodeModulesRoot = findNodeModulesRoot(process.cwd()),
): string[] {
  const seen = new Set<string>();
  const queue = [...roots];

  while (queue.length > 0) {
    const name = queue.pop();
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const packageDir = resolvePackageDir(nodeModulesRoot, name);
    if (!packageDir) continue;

    const pkg = readPackageJson(packageDir);
    for (const dep of Object.keys(pkg?.dependencies ?? {})) {
      if (!seen.has(dep)) queue.push(dep);
    }
  }

  return [...seen];
}

function copyDir(source: string, destination: string): void {
  fs.cpSync(source, destination, { recursive: true, dereference: true });
}

/** Copy external main-process modules (and their deps) into a packaged app build. */
export function copyMainExternals(buildPath: string, projectRoot = process.cwd()): void {
  const sourceNodeModules = findNodeModulesRoot(projectRoot);
  const destNodeModules = path.join(buildPath, 'node_modules');
  const packages = collectDependencyTree(MAIN_EXTERNALS, sourceNodeModules);

  fs.mkdirSync(destNodeModules, { recursive: true });

  for (const packageName of packages) {
    const sourceDir = resolvePackageDir(sourceNodeModules, packageName);
    if (!sourceDir) {
      throw new Error(`Missing production dependency "${packageName}" in ${sourceNodeModules}`);
    }

    const destDir = packagePath(destNodeModules, packageName);
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    copyDir(sourceDir, destDir);
  }
}
