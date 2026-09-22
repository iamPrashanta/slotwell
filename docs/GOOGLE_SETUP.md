# Google setup

Slotwell signs the owner in with Google and uses the same grant to read busy times and create events.

1. **Project:** Google Cloud Console → create a project named `Slotwell`.
2. **API:** APIs & Services → Library → enable **Google Calendar API**.
3. **Consent screen (Google Auth Platform):**
   - Audience: *External* (personal Gmail) or *Internal* (Google Workspace).
   - App name `Slotwell`, support email, app domain `slotwell.app`, privacy/terms links.
   - Data access (scopes): `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar.freebusy`, `https://www.googleapis.com/auth/calendar.events`.
4. **Client:** Clients → Create → *Web application*.
   - Authorised JavaScript origins: `http://localhost:3004`, `https://slotwell.app`
   - Authorised redirect URIs: `http://localhost:3004/api/auth/callback/google`, `https://slotwell.app/api/auth/callback/google`
   - Copy the ID and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. **Publishing status — important:** while an External app is in *Testing*, refresh tokens expire after about 7 days and calendar access stops. Before going live, click **Publish app**. For owner-only use Google shows an "unverified app" warning on your own consent screen, which you can accept; full verification is only needed if other people will sign in.

If calendar access ever stops, the dashboard shows a warning: sign out and sign in again.
