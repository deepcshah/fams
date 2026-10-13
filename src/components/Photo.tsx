import { useEffect, useState } from 'react';
import { Image, type ImageContentFit, type ImageStyle } from 'expo-image';

import { resolvePhotoUri } from '@/lib/sync/photoCache';
import { isRemotePhoto } from '@/lib/sync/types';

/**
 * An <Image> that understands both kinds of reference the app stores: a local
 * file URI, and a `fams-storage:` path that has to be signed first. Everywhere
 * a photograph appears goes through this, so a tree that syncs and one that
 * never left the device render by the same code.
 */
export function Photo({
  uri,
  style,
  contentFit = 'cover',
  transition = 160,
}: {
  uri?: string;
  style?: ImageStyle;
  contentFit?: ImageContentFit;
  transition?: number;
}) {
  // A local file needs no round trip, so it resolves during render.
  const local = uri && !isRemotePhoto(uri) ? uri : undefined;
  const [signed, setSigned] = useState<string | undefined>(undefined);

  const [lastUri, setLastUri] = useState(uri);
  if (lastUri !== uri) {
    setLastUri(uri);
    setSigned(undefined);
  }

  useEffect(() => {
    if (!uri || !isRemotePhoto(uri)) return;
    let cancelled = false;
    resolvePhotoUri(uri).then((next) => {
      if (!cancelled) setSigned(next);
    });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const resolved = local ?? signed;
  if (!resolved) return null;
  return <Image source={{ uri: resolved }} style={style} contentFit={contentFit} transition={transition} />;
}
