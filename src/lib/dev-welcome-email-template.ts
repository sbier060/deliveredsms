// Pure, dependency-free HTML template for the Resms developer welcome
// email, sent when a sandbox tenant is provisioned. Mirrors the other
// transactional emails (trial-welcome etc.): black canvas, system-ui
// headline, Pulse Gradient pill CTA, raised-surface callouts, muted prose.
//
// SENDING IS FLAG-GATED: the trigger in /api/developers/tenant only fires when
// DEV_API_EMAILS_ENABLED === 'true'. Per repo rule, do not enable without
// explicit owner approval.

export interface DevWelcomeEmailParams {
  name: string | null;
  /** Last 4 chars of the minted test key, e.g. "xVtD". */
  keyLast4: string;
  /** The tenant's sandbox from-number, e.g. "+15005559586". */
  sandboxNumber: string;
  consoleUrl: string;
  quickstartUrl: string;
}

export function buildDevWelcomeEmailHtml(params: DevWelcomeEmailParams): string {
  const { name, keyLast4, sandboxNumber, consoleUrl, quickstartUrl } = params;
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const fontBaseUrl = 'https://www.joinghostnumber.com/fonts/ghost-gothic';
  const fontStack = `system-ui, 'Helvetica Neue', Helvetica, Arial, sans-serif`;
  const monoStack = `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your Resms sandbox is live</title>
    <style>/system-ui-Regular.woff2') format('woff2');
        font-weight: 400;
        font-style: normal;
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #000000;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000;">
      <tr>
        <td align="center" style="padding: 48px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">
            <tr>
              <td style="padding-bottom: 28px; font-family: ${fontStack}; color: #00D26A; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;">
                Resms · Sandbox
              </td>
            </tr>
            <tr>
              <td style="font-family: ${fontStack}; font-weight: 400; font-size: 30px; line-height: 1.2; letter-spacing: -0.02em;">
                <span style="color: #EFEEEC;">Your sandbox is live.</span><br />
                <span style="color: #918E86;">First message is five lines of code.</span>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 20px; font-family: ${fontStack}; color: #C9C6BF; font-size: 15px; line-height: 1.65;">
                ${greeting}<br /><br />
                Your Resms account is ready. We minted a test key ending in
                <span style="color: #FFFFFF;">…${keyLast4}</span> and a sandbox number
                (<span style="color: #FFFFFF;">${sandboxNumber}</span>). Keys are shown
                once at creation, so if you didn't copy yours, roll it from the console.
              </td>
            </tr>
            <tr>
              <td style="padding-top: 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F0E0C; border: 1px solid #2E2C28; border-radius: 12px;">
                  <tr>
                    <td style="padding: 18px 20px;">
                      <span style="display: block; font-family: ${fontStack}; color: #918E86; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase;">Magic test numbers</span>
                      <span style="display: block; padding-top: 10px; font-family: ${monoStack}; color: #C9C6BF; font-size: 13px; line-height: 1.8;">
                        +1 500 555 0006 &nbsp;→&nbsp; delivered<br />
                        +1 500 555 0001 &nbsp;→&nbsp; stuck in queued<br />
                        +1 500 555 0002 &nbsp;→&nbsp; failed
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="left" style="padding-top: 28px;">
                <a href="${quickstartUrl}" style="display: inline-block; background: linear-gradient(90deg, #00D26A 0%, #009E4F 100%); color: #FFFFFF; font-family: ${fontStack}; font-weight: 400; font-size: 15px; text-decoration: none; padding: 15px 32px; border-radius: 9999px;">
                  Read the Quickstart &nbsp;&rarr;
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 20px; font-family: ${fontStack}; color: #918E86; font-size: 13px; line-height: 1.6;">
                Console: <a href="${consoleUrl}" style="color: #918E86;">${consoleUrl.replace('https://', '')}</a>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 40px; border-top: 1px solid #1F1E1C; margin-top: 24px; font-family: ${fontStack}; color: #918E86; font-size: 12px; line-height: 1.6;">
                Block Apps LLC · You received this because you created a Resms account.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
