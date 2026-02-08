import { Octokit } from 'octokit';
import { nanoid } from 'nanoid';

const octokit = new Octokit();

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
 * Fetch Solidity files from GitHub repository via API
 */
export async function cloneRepository(
  repoUrl: string,
  onProgress?: (message: string) => void
): Promise<{ id: string; path: string }> {
  const id = nanoid(10);
  
  onProgress?.('[STATUS] FETCHING REPO VIA API...');
  
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new Error('Invalid GitHub URL');
  }

  onProgress?.('[STATUS] FETCH COMPLETE');
  
  // Return ID and a placeholder path (API-based, no actual path)
  return { id, path: `api:${parsed.owner}/${parsed.repo}` };
}

/**
 * Fetch all Solidity files from GitHub repository via API
 */
async function fetchSolidityFilesFromGitHub(
  owner: string,
  repo: string,
  onProgress?: (message: string) => void
): Promise<Array<{ path: string; content: string }>> {
  try {
    // Get the default branch
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    // Get the repository tree (recursive)
    const { data: tree } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: 'true',
    });

    // Filter for .sol files
    const solFiles = tree.tree.filter(
      (item) => item.type === 'blob' && item.path?.endsWith('.sol')
    );

    if (solFiles.length === 0) {
      throw new Error('No Solidity files found in repository');
    }

    onProgress?.(`[STATUS] FOUND ${solFiles.length} CONTRACTS`);

    // Fetch content for each .sol file
    const files: Array<{ path: string; content: string }> = [];
    
    for (const file of solFiles) {
      if (!file.path) continue;

      try {
        const { data: blob } = await octokit.rest.git.getBlob({
          owner,
          repo,
          file_sha: file.sha!,
        });

        // Decode base64 content
        const content = Buffer.from(blob.content, 'base64').toString('utf-8');
        files.push({ path: file.path, content });
      } catch (error) {
        console.error(`Failed to fetch ${file.path}:`, error);
      }
    }

    return files;
  } catch (error: any) {
    throw new Error(`Failed to fetch repository files: ${error.message}`);
  }
}

/**
 * Fetch and flatten all Solidity files from GitHub via API
 */
export async function flattenSolidityCode(
  repoPath: string,
  onProgress?: (message: string) => void
): Promise<{ code: string; files: Array<{ path: string; content: string }> }> {
  onProgress?.('[STATUS] MAPPING ARCHITECTURE...');

  // Parse the repoPath (format: "api:owner/repo")
  const match = repoPath.match(/^api:(.+?)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid repository path format');
  }

  const [, owner, repo] = match;

  // Fetch files from GitHub API
  const files = await fetchSolidityFilesFromGitHub(owner, repo, onProgress);

  // Flatten into a single string
  let flattenedCode = '';
  for (const file of files) {
    flattenedCode += `\n\n// ========================================\n`;
    flattenedCode += `// FILE: ${file.path}\n`;
    flattenedCode += `// ========================================\n\n`;
    flattenedCode += file.content;
  }

  onProgress?.('[STATUS] ARCHITECTURE MAPPED');

  return { code: flattenedCode, files };
}

/**
 * Cleanup repository (no-op for API-based fetching)
 */
export async function cleanupRepository(id: string): Promise<void> {
  // No cleanup needed for API-based fetching (no temp files)
  return Promise.resolve();
}

/**
 * Validate GitHub URL format
 */
export function isValidGitHubUrl(url: string): boolean {
  return parseGitHubUrl(url) !== null;
}
