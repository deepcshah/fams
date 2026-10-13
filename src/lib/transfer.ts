import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File as FsFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type TransferResult = { ok: true; message: string } | { ok: false; message: string };

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w\d\-. ]+/g, '').trim().replace(/\s+/g, '-');
  return `${cleaned || 'family-tree'}.fams.json`;
}

/** Saves the tree as JSON: a browser download on web, a share sheet on device. */
export async function exportTreeJson(json: string, treeName: string): Promise<TransferResult> {
  const fileName = safeFileName(treeName);

  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { ok: true, message: `Downloaded ${fileName}` };
    } catch {
      return { ok: false, message: 'The browser blocked the download.' };
    }
  }

  try {
    const file = new FsFile(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(json);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Share your family tree' });
      return { ok: true, message: 'Ready to share.' };
    }
    return { ok: true, message: `Saved to ${file.uri}` };
  } catch {
    return { ok: false, message: 'Could not write the file.' };
  }
}

/** Opens the system file picker and returns the file's text contents (JSON or GEDCOM). */
export async function pickTreeJson(): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      // GEDCOM has no registered MIME type and arrives as anything at all.
      type: ['application/json', 'application/x-gedcom', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return { ok: false, message: 'Import cancelled.' };

    const asset = result.assets[0];
    if (Platform.OS === 'web') {
      const response = await fetch(asset.uri);
      return { ok: true, text: await response.text() };
    }
    return { ok: true, text: await new FsFile(asset.uri).text() };
  } catch {
    return { ok: false, message: 'Could not read that file.' };
  }
}
