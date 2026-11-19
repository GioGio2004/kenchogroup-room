/* Opens the awards popup (src/page/Awards.tsx) from anywhere; the menu's Awards link uses it. */
export const AWARDS_EVENT = 'kencho:awards'
export const openAwards = () => window.dispatchEvent(new Event(AWARDS_EVENT))
