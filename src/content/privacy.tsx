import type { Doc } from './doc';

/**
 * Transcribed verbatim from https://ewenn.app/privacy.html (last updated 30 August 2026),
 * revised on 21 September 2026 for the app's avatars (the app repo's `_specs/profile-avatars.md`),
 * and again on 23 September 2026 when the app stopped using the Google profile photo.
 *
 * Every claim here is a description of the app's code rather than boilerplate -- no photo
 * leaves the device because the project has no Cloud Storage, and no avatar another user sees
 * is a picture: it is a figure or a preset drawn from the app's own art (`functions/src/avatar.ts`
 * resolves nothing else); the Gemini
 * disclosure is conditional because the app picks the on-device model when there is one;
 * "no analytics" is the vendor floor the app holds itself to. If any of those change,
 * this file and the date at the top change in the same commit.
 *
 * Three consumers depend on the URL: App Store Connect's app record, both Rewenn
 * subscription products, and the paywall inside the binary (Guideline 3.1.2). The
 * published `/privacy.html` is kept alive as an alias for them (see lib/docAliases).
 */
export const PRIVACY_DOC: Doc = {
  title: 'Privacy Policy',
  description: 'How Ewenn handles your data.',
  updated: 'Last updated 23 September 2026',
  path: '/privacy/',
  body: (
    <>
      <p>
        Ewenn is a focus companion app for iOS. This policy explains what the app collects, where it
        goes, and what it never does. It is written to be checked rather than skimmed, so it says
        plainly where data is stored and which companies can see it.
      </p>

      <h2>What we collect</h2>

      <h3>Your account</h3>
      <p>
        You need an account to use Ewenn. You can create one with an email address and password, or
        by signing in with Google or Apple. We receive:
      </p>
      <ul>
        <li>
          Your <strong>email address</strong>. If you sign in with Apple and choose to hide it, we
          only ever see Apple's private relay address.
        </li>
        <li>
          Your <strong>display name</strong>, if your sign-in provider supplies one.
        </li>
      </ul>

      <h3>Your profile</h3>
      <ul>
        <li>
          The <strong>username</strong> you choose. This is a public identity within the app — it is
          how friends find you.
        </li>
        <li>
          Your <strong>name</strong>, <strong>birthday</strong> and <strong>gender</strong>, entered
          when you set up the app.
        </li>
        <li>
          The <strong>name you give your penguin</strong>, and the date you joined.
        </li>
        <li>
          Your <strong>avatar</strong>, which is made from Ewenn's own pictures and is never a
          photo.
        </li>
      </ul>

      <h3>What you create in the app</h3>
      <ul>
        <li>
          Your <strong>goals</strong>, their descriptions, and their checklist steps.
        </li>
        <li>
          Your <strong>focus sessions</strong>, <strong>streak history</strong> and activity record.
        </li>
        <li>
          Your <strong>friends</strong>, friend requests, and anyone you have blocked.
        </li>
        <li>
          <strong>Challenges</strong> you create or join.
        </li>
        <li>
          Your <strong>coins</strong>, the items you own, the badges you have earned, and a record of
          purchases and spends.
        </li>
      </ul>

      <h3>Purchases</h3>
      <p>
        If you subscribe to Rewenn, your subscription status is held by RevenueCat and Apple.{' '}
        <strong>We never see your payment details</strong> — Apple handles the transaction and tells
        us only whether a subscription is active.
      </p>

      <h3>Technical</h3>
      <p>
        The app uses Apple's App Attest to confirm that requests come from a genuine copy of Ewenn
        rather than from a script. This protects other users from spam and abuse.
      </p>

      <h2>What never leaves your device</h2>

      <div className="doc__note">
        <p>
          <strong>Ewenn never uploads a photo from your iPhone.</strong> It has no photo storage on
          its servers at all, and it does not use your Google profile photo. Your avatar is always
          made from Ewenn's own pictures, and you can change it, or remove it, at any time.
        </p>
      </div>

      <h2>What other people can see</h2>
      <p>
        When another user looks at your profile, they see your <strong>username</strong>,{' '}
        <strong>display name</strong> and <strong>avatar</strong>. Your email address, birthday,
        gender, goals, coin balance and account identifier are never shown to another user.
      </p>
      <p>
        People in a challenge with you can see your progress in that challenge. Public links to a
        challenge or an invite show only a title and a username.
      </p>

      <h2>Who we share data with</h2>
      <p>We do not sell your data. We use a small number of services to make the app work:</p>
      <ul>
        <li>
          <strong>Google Firebase</strong> — sign-in, database, server functions and hosting. Your
          account and everything listed above is stored here.
        </li>
        <li>
          <strong>Google Gemini</strong> — when you ask Ewenn to suggest checklist steps for a goal,
          the goal's <em>title, description and current steps</em> are sent to Google's Gemini API to
          generate them.{' '}
          <strong>
            On iPhones that support Apple Intelligence this happens entirely on your device and
            nothing is sent at all.
          </strong>{' '}
          The app chooses the on-device model whenever it is available.
        </li>
        <li>
          <strong>Apple</strong> — Sign in with Apple, App Store purchases, and App Attest.
        </li>
        <li>
          <strong>RevenueCat</strong> — subscription status, linked to your Ewenn account identifier.
        </li>
      </ul>

      <h2>What we don't do</h2>
      <ul>
        <li>
          <strong>No tracking.</strong> Ewenn does not track you across other apps or websites and
          does not use an advertising identifier.
        </li>
        <li>
          <strong>No advertising</strong>, and no ad networks.
        </li>
        <li>
          <strong>No analytics or crash-reporting services.</strong> Ewenn contains no analytics SDK
          and no crash reporter. If that ever changes, this page and the app's App Store privacy
          labels change with it, and we will say so in the app before it takes effect.
        </li>
        <li>
          <strong>We do not sell or rent your data</strong> to anyone.
        </li>
      </ul>

      <h2>Deleting your account</h2>
      <p>
        You can delete your account at any time from inside the app, under{' '}
        <strong>Profile → Account</strong>. Deleting removes your profile, goals, streak, friends,
        challenges, badges, items and coin balance, and releases your username so somebody else can
        use it. This cannot be undone.
      </p>
      <p>
        You can also ask us to delete your account by writing to{' '}
        <a href="mailto:ewenn.app@gmail.com">ewenn.app@gmail.com</a>.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us for a copy of the data we hold about you, ask us to correct it, or ask us to
        delete it. Write to <a href="mailto:ewenn.app@gmail.com">ewenn.app@gmail.com</a> and we will
        respond within 30 days. Depending on where you live, you may have additional rights under
        local law, and we will honour them.
      </p>

      <h2>How long we keep things</h2>
      <p>
        We keep your account data for as long as your account exists. When you delete your account,
        it is removed. Records we are required to keep for tax or accounting reasons — such as a
        record that a purchase happened — may be retained for as long as the law requires.
      </p>

      <h2>Children</h2>
      <p>
        Ewenn is not directed at children under 13, and we do not knowingly collect information from
        them. If you believe a child has given us their information, write to{' '}
        <a href="mailto:ewenn.app@gmail.com">ewenn.app@gmail.com</a> and we will delete the account.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If this policy changes, the date at the top changes with it. If a change materially affects
        how your data is handled, we will say so in the app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy, or about anything on this page:{' '}
        <a href="mailto:ewenn.app@gmail.com">ewenn.app@gmail.com</a>.
      </p>
    </>
  ),
};
