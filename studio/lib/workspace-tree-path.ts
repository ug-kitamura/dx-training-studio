export function isProjectFolder(folderPath: string): boolean {
  return !folderPath.includes("/");
}

export function getProjectRoot(folderPath: string): string {
  return folderPath.split("/")[0] ?? folderPath;
}

export function getParentFolderPath(folderPath: string): string | null {
  const idx = folderPath.lastIndexOf("/");
  if (idx < 0) return null;
  return folderPath.slice(0, idx);
}

export function isDescendantPath(
  ancestorPath: string,
  descendantPath: string,
): boolean {
  return (
    descendantPath === ancestorPath ||
    descendantPath.startsWith(`${ancestorPath}/`)
  );
}
