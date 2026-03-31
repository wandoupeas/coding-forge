import { resolve } from 'path';
import { scanProjects, type ProjectRecord } from './project-scanner.js';

export class ProjectRegistry {
  private lastRootPath: string | null = null;
  private cachedProjects: ProjectRecord[] = [];

  async refresh(rootPath: string): Promise<ProjectRecord[]> {
    const normalizedRoot = resolve(rootPath);
    this.cachedProjects = await scanProjects(normalizedRoot);
    this.lastRootPath = normalizedRoot;

    return [...this.cachedProjects];
  }

  get lastRoot(): string | null {
    return this.lastRootPath;
  }

  get projects(): ProjectRecord[] {
    return [...this.cachedProjects];
  }
}
