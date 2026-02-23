import 'server-only';

import {cache} from 'react';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {getImageFallback, getPublicStorageUrl, isHttpUrl, splitStorageTarget, type ImageFallbackKey} from '@/lib/images';

const getSignedUrlCached = cache(async (bucket: string, path: string): Promise<string | null> => {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (signed.error || !signed.data?.signedUrl) return null;
  return signed.data.signedUrl;
});

export async function resolveImageSrcServer(input: string | null | undefined, fallbackKey?: ImageFallbackKey): Promise<string> {
  const fallback = getImageFallback(fallbackKey);
  const raw = String(input || '').trim();
  if (!raw) return fallback;

  if (isHttpUrl(raw)) return raw;
  if (raw.startsWith('/')) return raw;

  const target = splitStorageTarget(raw);
  if (!target) return fallback;

  const supabase = createServerSupabaseClient();
  const publicUrl = supabase?.storage.from(target.bucket).getPublicUrl(target.path).data.publicUrl || null;
  const signedUrl = await getSignedUrlCached(target.bucket, target.path);

  return signedUrl || publicUrl || getPublicStorageUrl(target.bucket, target.path) || fallback;
}
