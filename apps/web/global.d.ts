import type messages from './messages/en.json';

// Message keys are checked by the compiler: a missing or misspelled key is a type error.
declare module 'next-intl' {
  interface AppConfig {
    Locale: 'en';
    Messages: typeof messages;
  }
}
