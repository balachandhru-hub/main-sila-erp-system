import { getPersonDetail, logoutBuyer, type PersonDetailDto } from '../../remote-buyer/src/api/Buyerapi';

/** The signed-in user's profile (same call as the buyer dashboard). */
export const loadPerson = async (): Promise<PersonDetailDto> => {
  const result = await getPersonDetail();
  if ('personId' in result) return result;
  throw new Error(result.description || result.message || 'Could not load your profile.');
};

/** Ends the session like the buyer dashboard does, then lets the host return to the login page. */
export const signOut = async (): Promise<void> => {
  try {
    await logoutBuyer();
  } finally {
    window.dispatchEvent(new CustomEvent('session:expired'));
  }
};

export type { PersonDetailDto };
