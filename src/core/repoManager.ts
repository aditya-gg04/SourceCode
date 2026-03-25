import fs from 'fs';
import path from 'path';
import { simpleGit } from 'simple-git';

export class RepoManager {
  private targetDir: string;
  private git = simpleGit();

  constructor(targetDir: string) {
    if (targetDir.startsWith('http://') || targetDir.startsWith('https://')) {
      this.targetDir = process.cwd(); // Will clone into current directory
    } else {
      this.targetDir = path.resolve(targetDir);
    }
  }

  /**
   * Clones a repository if the provided path is a URL.
   * If it's a local path, it just sets the target directory.
   */
  async setup(repoPathOrUrl: string): Promise<string> {
    const isUrl = repoPathOrUrl.startsWith('http://') || repoPathOrUrl.startsWith('https://');

    if (isUrl) {
      const gitFolderName = repoPathOrUrl.split('/').pop()?.replace('.git', '') || 'cloned-repo';
      this.targetDir = path.join(this.targetDir, gitFolderName);

      if (!fs.existsSync(this.targetDir)) {
        console.log(`Cloning ${repoPathOrUrl} into ${this.targetDir}...`);
        await this.git.clone(repoPathOrUrl, this.targetDir);
      } else {
        console.log(`Directory ${this.targetDir} already exists, skipping clone.`);
      }
    } else {
      this.targetDir = path.resolve(repoPathOrUrl);
    }
    return this.targetDir;
  }

  /**
   * Recursively gets all files in the target directory, applying ignore filters.
   */
  getFiles(
    dir: string = this.targetDir,
    extensions: string[] = ['.ts', '.tsx', '.js', '.jsx', '.py', '.cpp', '.c', '.java', '.go', '.rs'],
    ignoreDirs: string[] = ['node_modules', '.git', 'dist', 'build', 'out']
  ): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);

    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat && stat.isDirectory()) {
        if (!ignoreDirs.includes(file)) {
          results = results.concat(this.getFiles(fullPath, extensions, ignoreDirs));
        }
      } else {
        const ext = path.extname(file);
        if (extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }

    return results;
  }
}
