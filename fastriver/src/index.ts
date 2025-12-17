import { simpleGit } from 'simple-git';
import { existsSync, readdirSync, statSync, cpSync, mkdirSync, rmSync } from 'fs';
import { join, basename } from 'path';
import { tmpdir } from 'os';

export interface AlbumOptions {
  token: string;
  username: string;
  dryRun?: boolean;
  onProgress?: (step: string, detail?: string) => void;
}

export interface AlbumResult {
  name: string;
  repoUrl: string;
  albumUrl: string;
  success: boolean;
  error?: string;
  photoCount?: number;
}

const TEMPLATE_REPO = 'https://github.com/rathnasorg/i4tow-album.git';
const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.webp', '.gif'];

export function isPhotoFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return PHOTO_EXTENSIONS.includes(ext);
}

export function getPhotosInDir(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir).filter((f) => {
      const fullPath = join(dir, f);
      try {
        return statSync(fullPath).isFile() && isPhotoFile(f);
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

export function getSubdirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir).filter((f) => {
      const fullPath = join(dir, f);
      try {
        return statSync(fullPath).isDirectory() && !f.startsWith('.');
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

export function sanitizeRepoName(name: string): string {
  return name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_-]/g, '');
}

async function createGitHubRepo(
  name: string,
  token: string
): Promise<{ success: boolean; error?: string; alreadyExists?: boolean }> {
  try {
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'i4tow-cli',
      },
      body: JSON.stringify({ name, private: false }),
    });

    if (!response.ok) {
      const data = (await response.json()) as {
        message?: string;
        errors?: { message?: string }[];
      };
      if (data.errors?.[0]?.message?.includes('already exists')) {
        return { success: true, alreadyExists: true };
      }
      if (data.message === 'Bad credentials') {
        return { success: false, error: 'Invalid GitHub token. Check your token and try again.' };
      }
      if (data.message === 'Not Found') {
        return { success: false, error: 'GitHub API error. Ensure token has "repo" scope.' };
      }
      return { success: false, error: data.message || 'Failed to create repository' };
    }
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return { success: false, error: 'Network error. Check your internet connection.' };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Unknown error creating repository' };
  }
}

export async function createAlbum(
  sourceDir: string,
  repoName: string,
  options: AlbumOptions
): Promise<AlbumResult> {
  const { token, username, dryRun, onProgress } = options;
  const fullRepoName = repoName.startsWith('i4tow-') ? repoName : `i4tow-${repoName}`;
  const photos = getPhotosInDir(sourceDir);
  const albumUrl = `https://rathnasorg.github.io/i4tow/a/${fullRepoName}`;

  const progress = (step: string, detail?: string) => {
    if (onProgress) onProgress(step, detail);
  };

  if (photos.length === 0) {
    return {
      name: fullRepoName,
      repoUrl: '',
      albumUrl: '',
      success: false,
      error: 'No photos found in directory',
      photoCount: 0,
    };
  }

  if (dryRun) {
    return {
      name: fullRepoName,
      repoUrl: `https://github.com/${username}/${fullRepoName}`,
      albumUrl,
      success: true,
      photoCount: photos.length,
    };
  }

  try {
    // Step 1: Create GitHub repo
    progress('Creating repository', fullRepoName);
    const createResult = await createGitHubRepo(fullRepoName, token);
    if (!createResult.success) {
      return {
        name: fullRepoName,
        repoUrl: '',
        albumUrl: '',
        success: false,
        error: createResult.error,
        photoCount: photos.length,
      };
    }
    if (createResult.alreadyExists) {
      progress('Repository exists', 'Using existing repository');
    }

    // Step 2: Clone template
    progress('Downloading template', 'rathnasorg/i4tow-album');
    const tempDir = join(tmpdir(), `i4tow-${Date.now()}`);
    const git = simpleGit();
    await git.clone(TEMPLATE_REPO, tempDir, ['--depth', '1']);

    // Step 3: Clean up template
    progress('Preparing album', 'Cleaning template files');
    const tempGit = join(tempDir, '.git');
    const tempDemo = join(tempDir, 'temp-demo-files');
    if (existsSync(tempGit)) {
      rmSync(tempGit, { recursive: true, force: true });
    }
    if (existsSync(tempDemo)) {
      rmSync(tempDemo, { recursive: true, force: true });
    }

    // Step 4: Copy photos
    progress('Copying photos', `${photos.length} files`);
    const photosDir = join(tempDir, 'public', 'photos', 'raw2');
    mkdirSync(photosDir, { recursive: true });

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      cpSync(join(sourceDir, photo), join(photosDir, photo));
    }

    // Step 5: Initialize git and push
    progress('Uploading to GitHub', `Pushing to ${username}/${fullRepoName}`);
    const repoUrl = `https://${username}:${token}@github.com/${username}/${fullRepoName}.git`;
    const localGit = simpleGit(tempDir);
    await localGit.init();
    await localGit.addRemote('origin', repoUrl);
    await localGit.add('.');
    await localGit.commit(`${photos.length} photos added via i4tow`);
    await localGit.push('origin', 'main', ['--set-upstream', '--force']);

    // Cleanup temp dir
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    return {
      name: fullRepoName,
      repoUrl: `https://github.com/${username}/${fullRepoName}`,
      albumUrl,
      success: true,
      photoCount: photos.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide helpful error messages
    let friendlyError = errorMessage;
    if (errorMessage.includes('Authentication failed')) {
      friendlyError = 'GitHub authentication failed. Check your token.';
    } else if (errorMessage.includes('Permission denied')) {
      friendlyError = 'Permission denied. Ensure token has "repo" scope.';
    } else if (errorMessage.includes('Repository not found')) {
      friendlyError = 'Repository not found. It may still be creating, try again in a moment.';
    }

    return {
      name: fullRepoName,
      repoUrl: '',
      albumUrl: '',
      success: false,
      error: friendlyError,
      photoCount: photos.length,
    };
  }
}

export async function processDirectory(
  dir: string,
  options: AlbumOptions & { batch?: boolean; single?: boolean }
): Promise<AlbumResult[]> {
  const results: AlbumResult[] = [];
  const photos = getPhotosInDir(dir);
  const subdirs = getSubdirs(dir);

  const hasPhotos = photos.length > 0;
  const hasSubdirs = subdirs.length > 0;

  if (options.single || (hasPhotos && !hasSubdirs) || (hasPhotos && !options.batch)) {
    const name = sanitizeRepoName(basename(dir));
    const result = await createAlbum(dir, name, options);
    results.push(result);
  } else if (options.batch || hasSubdirs) {
    for (const subdir of subdirs) {
      const subdirPath = join(dir, subdir);
      const subdirPhotos = getPhotosInDir(subdirPath);
      if (subdirPhotos.length > 0) {
        const name = sanitizeRepoName(subdir);
        const result = await createAlbum(subdirPath, name, options);
        results.push(result);
      }
    }
  }

  return results;
}
