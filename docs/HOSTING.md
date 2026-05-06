# Host docs/site/ via GitHub Pages

The landing page (`docs/site/index.html`) and privacy policy (`docs/site/privacy.html`)
are designed to be served as a static site for free via GitHub Pages.

## One-time setup

1. Push `docs/site/` to `main` (already done if you committed this).
2. GitHub repo → **Settings → Pages**
3. Under **Source**: select `Deploy from a branch`
4. Under **Branch**: pick `main` and `/docs/site` folder. Click **Save**.
5. Wait ~1 min. Your site will be at:
   ```
   https://bbroeking.github.io/oink/
   ```
6. Privacy policy will be at:
   ```
   https://bbroeking.github.io/oink/privacy.html
   ```

## Wire it into the app

Once Pages is live:

```bash
# Local dev
echo 'EXPO_PUBLIC_PRIVACY_URL=https://bbroeking.github.io/oink/privacy.html' >> .env

# For TestFlight builds, set in eas.json or as a build-time env var
```

The `BattlePassSaleModal` checks `EXPO_PUBLIC_PRIVACY_URL` and shows the
"Privacy" link only when the URL is set. So nothing 404s if it's missing.

## Custom domain (later)

When you own `ticklethepig.app`:

1. Settings → Pages → **Custom domain**: enter `ticklethepig.app`
2. Add a `CNAME` DNS record pointing to `bbroeking.github.io`
3. Add a `docs/site/CNAME` file containing `ticklethepig.app`
4. Enable "Enforce HTTPS" once DNS propagates

## Newsletter signup

The email form posts to Buttondown's embed endpoint
(`https://buttondown.email/api/emails/embed-subscribe/ticklethepig`).
Sign up at https://buttondown.email and replace the URL with your username
if it differs from `ticklethepig`.

## Required tweaks before going public

- [ ] Replace the 🐷 emoji placeholder with a real screenshot or animated GIF
- [ ] Update the TestFlight CTA href when the public link is available
- [ ] Add an Open Graph image (`og:image`) for nice link previews
- [ ] Test on mobile + desktop
