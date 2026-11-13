import { describe, expect, it } from 'vitest';
import { checkUsername, updateProfileSchema } from './user.ts';

describe('checkUsername (FR-PROF-001)', () => {
  it.each(['ada', 'Ada_1', 'a_b', '123', 'x'.repeat(30), 'user_0123456789'])(
    'allows %s',
    (username) => {
      expect(checkUsername(username)).toBeNull();
    },
  );

  it.each([
    ['ab', 'length'],
    ['', 'length'],
    ['x'.repeat(31), 'length'],
    ['ada lovelace', 'characters'],
    ['ada-lovelace', 'characters'],
    ['ada.l', 'characters'],
    ['adé', 'characters'],
    ['admin', 'reserved'],
    ['settings', 'reserved'],
    ['Admin', 'reserved'],
    ['SETTINGS', 'reserved'],
  ])('rejects %j: %s', (username, problem) => {
    expect(checkUsername(username)).toBe(problem);
  });
});

describe('updateProfileSchema (FR-PROF-001…003)', () => {
  it('leaves out what is not given, so that it stays as it is', () => {
    expect(updateProfileSchema.parse({ homeCityVisible: true })).toEqual({
      homeCityVisible: true,
    });
  });

  it('rejects a username that cannot be chosen', () => {
    expect(updateProfileSchema.safeParse({ username: 'admin' }).success).toBe(false);
  });

  it('needs a display name that is not blank', () => {
    expect(updateProfileSchema.safeParse({ displayName: '  ' }).success).toBe(false);
    expect(updateProfileSchema.parse({ displayName: ' Ada ' })).toEqual({ displayName: 'Ada' });
  });

  it('stores a blank bio as no bio and rejects a long one', () => {
    expect(updateProfileSchema.parse({ bio: '  ' })).toEqual({ bio: null });
    expect(updateProfileSchema.safeParse({ bio: 'x'.repeat(301) }).success).toBe(false);
  });

  it('knows only public and private', () => {
    expect(updateProfileSchema.safeParse({ visitedVisibility: 'friends' }).success).toBe(false);
  });
});
