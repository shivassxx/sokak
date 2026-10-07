import { roomLink } from '../net/connection';

/** Share the salon link (native share sheet on phones, else copy to the clipboard). */
export async function shareRoom(roomId: string, msg: { title: string; text: string }): Promise<'shared' | 'copied' | 'failed'> {
  const url = roomLink(roomId);
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await nav.share({ ...msg, url });
      return 'shared';
    } catch {
      /* fall through to copy */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
