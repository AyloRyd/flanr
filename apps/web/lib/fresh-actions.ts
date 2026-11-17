import * as cityActions from '@/app/cities/[cityId]/actions';
import * as onboardingActions from '@/app/onboarding/actions';
import * as settingsActions from '@/app/settings/actions';
import * as listActions from '@/lib/list-actions';
import * as mapActions from '@/lib/map-actions';

/**
 * Makes sure the session cookie holds a valid token before a server action reads it. Clerk
 * session tokens live about a minute and are renewed by a timer in the browser; when the timer
 * is late, for example in a tab that was in the background, a server action would run as a
 * guest. getToken renews an expired token and its cookie, and returns a valid one at once.
 */
async function ensureFreshSession(): Promise<void> {
  await window.Clerk?.session?.getToken();
}

function freshly<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    await ensureFreshSession();
    return action(...args);
  };
}

// The server actions that client components call, each after renewing the session.
export const setPlanned = freshly(cityActions.setPlanned);
export const logVisit = freshly(cityActions.logVisit);
export const updateVisit = freshly(cityActions.updateVisit);
export const deleteVisit = freshly(cityActions.deleteVisit);
export const setUndatedVisits = freshly(cityActions.setUndatedVisits);
export const setRating = freshly(cityActions.setRating);
export const deleteRating = freshly(cityActions.deleteRating);
export const setLived = freshly(cityActions.setLived);
export const removeLived = freshly(cityActions.removeLived);
export const loadVisits = freshly(cityActions.loadVisits);
export const createList = freshly(listActions.createList);
export const createListAndOpen = freshly(listActions.createListAndOpen);
export const updateList = freshly(listActions.updateList);
export const deleteList = freshly(listActions.deleteList);
export const addToList = freshly(listActions.addToList);
export const removeFromList = freshly(listActions.removeFromList);
export const updateEntry = freshly(listActions.updateEntry);
export const loadMyLists = freshly(listActions.loadMyLists);
export const updateProfile = freshly(settingsActions.updateProfile);
export const deleteAccount = freshly(settingsActions.deleteAccount);
export const findCities = freshly(onboardingActions.findCities);
export const savePastVisits = freshly(onboardingActions.savePastVisits);
export const loadCityPreview = freshly(mapActions.loadCityPreview);
