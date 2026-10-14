/**
 * After Google sends a student back, any problem arrives in the web address
 * (e.g. ?error=access_denied&error_description=...). This turns it into a
 * friendly sentence and gives back a clean address without it.
 */
export function readSignInError(href: string): { message: string; cleanHref: string } | null {
  const url = new URL(href);
  const fromHash = url.hash.includes('error') ? new URLSearchParams(url.hash.replace(/^#\/?\??/, '')) : null;
  const params = url.searchParams.has('error') || url.searchParams.has('error_description') ? url.searchParams : fromHash;
  if (!params || !(params.has('error') || params.has('error_description'))) return null;

  const details = `${params.get('error') ?? ''} ${params.get('error_description') ?? ''}`.toLowerCase();
  const message = details.includes('school')
    ? "That isn't a Douglas Park school account. Please sign in with your school Google account."
    : details.includes('access_denied') && !details.includes('school')
      ? 'Sign-in was cancelled. Press the button to try again.'
      : 'Something went wrong signing in. Please try again.';

  return { message, cleanHref: `${url.origin}${url.pathname}#/sign-in` };
}
