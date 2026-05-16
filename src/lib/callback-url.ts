export const DEFAULT_CALLBACK_URL = '/';

export const isValidCallbackUrl = (url: string): boolean => {
  try {
    // Allow relative paths starting with /
    if (url.startsWith('/') && !url.startsWith('//')) return true;

    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    const hostname = parsed.hostname.toLowerCase();
    // Allow localhost and the production domain
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'tcetcercd.in' || 
      hostname.endsWith('.tcetcercd.in')
    );
  } catch {
    return false;
  }
};
