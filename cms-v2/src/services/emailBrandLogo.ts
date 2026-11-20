/**
 * The Vertex Learning Solutions crest for emails, served from the website.
 * PNG, because many mail apps do not show SVG. If images are blocked, the alt
 * text reads "VLS".
 */
const LOGO_BASE_URL = 'https://vls-online.com/media';

/** White crest for the navy email header. */
export const EMAIL_LOGO_ON_DARK_URL = `${LOGO_BASE_URL}/vls-logo-footer-mark.png`;
/** Navy crest for emails with a white header. */
export const EMAIL_LOGO_ON_LIGHT_URL = `${LOGO_BASE_URL}/vls-logo-header-mark.png`;

// Both files are about 0.92 wide for every 1 tall.
const LOGO_HEIGHT = 48;
const LOGO_WIDTH = 44;

export function emailBrandLogoHtml(background: 'dark' | 'light' = 'dark'): string {
  const src = background === 'dark' ? EMAIL_LOGO_ON_DARK_URL : EMAIL_LOGO_ON_LIGHT_URL;
  const altColor = background === 'dark' ? '#ffffff' : '#0f1e3c';
  return `<img src="${src}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="VLS" style="display:block;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;border:0;outline:none;text-decoration:none;font-family:Poppins, Arial, Helvetica, sans-serif;font-size:14px;font-weight:700;color:${altColor};">`;
}
