import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';

const TEMP_DIR = path.join(process.cwd(), '.temp', 'repos');

/**
 * Extract owner and repo name from GitHub URL
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\.]+)/,
    /github\.com\/([^\/]+)\/([^\/]+)\.git/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }

  return null;
}

/**
 * Clone a GitHub repository to temporary directory
 */
export async function cloneRepository(
  repoUrl: string,
  onProgress?: (message: string) => void
): Promise<{ id: string; path: string }> {
  const id = nanoid(10);
  const repoPath = path.join(TEMP_DIR, id);

  try {
    // Ensure temp directory exists
    await fs.mkdir(TEMP_DIR, { recursive: true });

    onProgress?.('[STATUS] CLONING REPO...');
    
    const git: SimpleGit = simpleGit();
    await git.clone(repoUrl, repoPath, ['--depth', '1']);

    onProgress?.('[STATUS] CLONE COMPLETE');

    return { id, path: repoPath };
  } catch (error) {
    onProgress?.('[ERROR] CLONE FAILED');
    throw new Error(`Failed to clone repository: ${error}`);
  }
}

/**
 * Recursively find all Solidity files in a directory
 */
export async function findSolidityFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function traverse(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      // Skip common ignored directories
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build', 'out'].includes(entry.name)) {
          await traverse(fullPath);
        }
      } else if (entry.name.endsWith('.sol')) {
        files.push(fullPath);
      }
    }
  }

  await traverse(dir);
  return files;
}

/**
 * Read and flatten all Solidity files into a context-rich string
 */
export async function flattenSolidityCode(
  repoPath: string,
  onProgress?: (message: string) => void
): Promise<{ code: string; files: Array<{ path: string; content: string }> }> {
  onProgress?.('[STATUS] MAPPING ARCHITECTURE...');

  const solidityFiles = await findSolidityFiles(repoPath);
  
  if (solidityFiles.length === 0) {
    throw new Error('No Solidity files found in repository');
  }

  onProgress?.(`[STATUS] FOUND ${solidityFiles.length} CONTRACTS`);

  const files: Array<{ path: string; content: string }> = [];
  let flattenedCode = '';

  for (const filePath of solidityFiles) {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = filePath.replace(repoPath, '').replace(/^\//, '');

    files.push({ path: relativePath, content });

    flattenedCode += `\n\n// ========================================\n`;
    flattenedCode += `// FILE: ${relativePath}\n`;
    flattenedCode += `// ========================================\n\n`;
    flattenedCode += content;
  }

  onProgress?.('[STATUS] ARCHITECTURE MAPPED');

  return { code: flattenedCode, files };
}

/**
 * Clean up temporary repository directory
 */
export async function cleanupRepository(id: string): Promise<void> {
  const repoPath = path.join(TEMP_DIR, id);
  try {
    await fs.rm(repoPath, { recursive: true, force: true });
  } catch (error) {
    console.error(`Failed to cleanup repository ${id}:`, error);
  }
}

/**
 * Validate GitHub URL format
 */
export function isValidGitHubUrl(url: string): boolean {
  return parseGitHubUrl(url) !== null;
}
