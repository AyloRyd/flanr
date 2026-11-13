import { describe, expect, it } from 'vitest';
import { addListEntrySchema, createListSchema, updateListSchema } from './list.ts';

describe('createListSchema (FR-LIST-003, FR-LIST-005)', () => {
  it('needs only a title; the list is public and has no description', () => {
    expect(createListSchema.parse({ title: ' Cities with the best tram networks ' })).toEqual({
      title: 'Cities with the best tram networks',
      description: null,
      visibility: 'public',
    });
  });

  it.each(['', '   ', 'x'.repeat(101)])('rejects the title %j', (title) => {
    expect(createListSchema.safeParse({ title }).success).toBe(false);
  });

  it('stores a blank description as no description', () => {
    expect(createListSchema.parse({ title: 'Trams', description: '  ' }).description).toBeNull();
  });

  it('rejects a visibility other than public or private', () => {
    expect(createListSchema.safeParse({ title: 'Trams', visibility: 'friends' }).success).toBe(
      false,
    );
  });
});

describe('updateListSchema (FR-LIST-003)', () => {
  it('leaves out what is not given, so that it stays as it is', () => {
    expect(updateListSchema.parse({ visibility: 'private' })).toEqual({ visibility: 'private' });
  });

  it('can remove the description', () => {
    expect(updateListSchema.parse({ description: null })).toEqual({ description: null });
  });
});

describe('addListEntrySchema (FR-LIST-004)', () => {
  it('does not need a note', () => {
    expect(addListEntrySchema.parse({ cityId: 1 })).toEqual({ cityId: 1, note: null });
  });

  it('rejects a note that is too long', () => {
    expect(addListEntrySchema.safeParse({ cityId: 1, note: 'x'.repeat(501) }).success).toBe(false);
  });
});
