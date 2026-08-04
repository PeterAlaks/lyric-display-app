import { promises as fs } from 'fs';

export async function ensureNavigatorDirectory(directoryPath, label) {
  try {
    const fileStat = await fs.stat(directoryPath);
    if (!fileStat.isDirectory()) {
      throw new Error(`${label} already exists but is not a folder. Rename or remove it, then try again.`);
    }
    return false;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      // Created below.
    } else if (error?.code === 'EACCES' || error?.code === 'EPERM') {
      throw new Error(`${label} could not be accessed. Check access to your Documents folder and try again.`);
    } else if (error?.code === 'ENOTDIR') {
      throw new Error(`${label} could not be created because part of that path is not a folder.`);
    } else {
      throw error;
    }
  }

  try {
    await fs.mkdir(directoryPath, { recursive: true });
    const fileStat = await fs.stat(directoryPath);
    if (!fileStat.isDirectory()) {
      throw new Error(`${label} could not be created because that path is not a folder.`);
    }
    return true;
  } catch (error) {
    if (error?.message?.startsWith(label)) throw error;
    if (error?.code === 'EACCES' || error?.code === 'EPERM') {
      throw new Error(`${label} could not be created. Check access to your Documents folder and try again.`);
    }
    if (error?.code === 'EEXIST' || error?.code === 'ENOTDIR') {
      throw new Error(`${label} could not be created because part of that path is not a folder.`);
    }
    throw new Error(`${label} could not be created. ${error?.message || 'Please try again.'}`);
  }
}
