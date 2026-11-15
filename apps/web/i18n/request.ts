import { getRequestConfig } from 'next-intl/server';
import messages from '../messages/en.json';

/**
 * English is the only language for now (NFR-L10N-001), so the locale is fixed and not part of
 * the URL. Adding a language means adding a messages file and choosing the locale here, from the
 * user's setting or the Accept-Language header (NFR-L10N-002).
 */
export const defaultLocale = 'en';

export default getRequestConfig(async () => ({ locale: defaultLocale, messages }));
