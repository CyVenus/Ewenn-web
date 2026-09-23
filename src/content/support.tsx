import type { Doc } from './doc';

/**
 * Written for this site, not transcribed -- the published ewenn.app has no support page.
 * App Store Connect requires a Support URL on the app record, and this is it.
 *
 * Every factual claim below is taken from the Privacy Policy or the Terms of Use rather
 * than written afresh, so the three documents cannot drift apart: the subscription
 * mechanics, the lapse behaviour, the coin rules, the on-device AI, no photo ever
 * leaving the phone, and the 30-day window for data requests all say here exactly what
 * they say there. The precedence line under "About this page" is what makes that safe --
 * this page explains, the other two govern.
 *
 * `updated` is this page's own date, not the dates the other two carry.
 */
export const SUPPORT_DOC: Doc = {
  title: 'Support',
  description: 'Help with your Ewenn account, subscription and data.',
  updated: 'Last updated 21 September 2026',
  path: '/support/',
  body: (
    <>
      <p>
        Everything about Ewenn is handled by one small team, and every message reaches a person.
        Write to <a href="mailto:ewenn.app@gmail.com">ewenn.app@gmail.com</a> and we aim to reply
        within two to three working days.
      </p>

      <div className="doc__note">
        <p>
          <strong>Reporting something urgent?</strong> If a message concerns someone's safety, abuse
          or harassment, put <strong>“Safety”</strong> at the start of the subject line and we will
          look at it ahead of everything else.
        </p>
      </div>

      <h2>Your account</h2>

      <h3>Signing in</h3>
      <p>
        You can sign in with an email address and password, or with Google or Apple. Use the same
        method each time — signing in with Apple and then with Google creates two separate accounts
        rather than reconnecting you to the first.
      </p>
      <p>
        If you signed in with Apple and chose to hide your email address, we only ever see Apple's
        private relay address, and mail we send reaches you through it. Turning off mail forwarding
        for Ewenn in your Apple ID settings will stop our replies arriving.
      </p>

      <h3>Resetting your password</h3>
      <p>
        Choose <strong>Forgot password</strong> on the sign-in screen and we will email you a reset
        link. If it does not arrive within a few minutes, check your spam folder, and confirm you are
        using the address you signed up with. Accounts created with Google or Apple have no Ewenn
        password — sign in with that provider instead.
      </p>

      <h3>Your username</h3>
      <p>
        Your username is your public identity in the app: it is how friends find you, and it is one
        of only two things another person can see on your profile — the other is your display name.
        Usernames are unique, so one that is already taken cannot be claimed until the account
        holding it is deleted.
      </p>

      <h3>Deleting your account</h3>
      <p>
        You can delete your account at any time from inside the app, under{' '}
        <strong>Profile → Account</strong>. Deleting removes your profile, goals, streak, friends,
        challenges, badges, items and coin balance, and releases your username so somebody else can
        use it. <strong>This cannot be undone</strong>, and we cannot restore an account afterwards.
      </p>
      <p>
        You can also ask us to delete your account by writing to{' '}
        <a href="mailto:ewenn.app@gmail.com">ewenn.app@gmail.com</a>. Please write from the address
        your account uses, or tell us your username, so we can be sure the request is yours.
      </p>
      <p>
        Deleting the app from your iPhone does not delete your account.
      </p>

      <h2>Rewenn — the optional subscription</h2>
      <p>
        Ewenn is free to use. Rewenn is an optional auto-renewing subscription that gives you double
        the goal slots, up to five challenges you can host, and an exclusive hat for your penguin.
        The full terms are in the <a href="/terms/">Terms of Use</a>.
      </p>

      <h3>Managing or cancelling it</h3>
      <p>
        Your subscription is billed by Apple, not by us, so it is managed in your Apple ID Account
        Settings — on your iPhone, open <strong>Settings</strong>, tap your name, then{' '}
        <strong>Subscriptions</strong>. To avoid being charged again, turn off auto-renewal at least{' '}
        <strong>24 hours before</strong> the current period ends. Cancelling stops the next renewal;
        it does not end the period you have already paid for, and you keep Rewenn until that period
        runs out.
      </p>

      <h3>What happens if it lapses</h3>
      <p>
        Nothing is taken away. The raised limits stop applying to anything new, the goals and
        challenges you already have stay exactly as they are, and the exclusive hat remains yours to
        wear.
      </p>

      <h3>Refunds</h3>
      <p>
        Purchases are handled by Apple, and refunds are Apple's to give — we cannot issue one
        ourselves. Request one at{' '}
        <a href="https://reportaproblem.apple.com" target="_blank" rel="noopener noreferrer">
          reportaproblem.apple.com
        </a>
        , or through <strong>Settings → your name → Media &amp; Purchases → View Account →
        Purchase History</strong> on your iPhone. Nothing here affects consumer rights you have under
        the law where you live.
      </p>

      <h3>Restoring a purchase</h3>
      <p>
        On a new device, sign in to Ewenn with the same account and use{' '}
        <strong>Restore purchases</strong> on the Rewenn screen. A subscription follows the Apple ID
        that bought it, so restoring needs that same Apple ID signed in to the App Store.
      </p>

      <h2>Coins and items</h2>
      <p>
        Coins are earned by completing checklist steps, claiming badges and finishing challenges.
        They have <strong>no monetary value</strong>, cannot be cashed out, exchanged for money or
        transferred to another person, and exist only inside your account — deleting it loses them.
        Items bought with coins are a licence to use them inside Ewenn rather than property you own.
      </p>

      <h2>Goals and AI-suggested steps</h2>
      <p>
        Ewenn can suggest checklist steps for a goal. For a free account on an iPhone or iPad with
        Apple Intelligence, this happens on your device and nothing is sent anywhere. Otherwise — and
        for Rewenn subscribers — the goal's title and description (and, for a rewrite, its current
        steps and your instruction) are sent to Google's Gemini API, but only after you allow it: the
        app asks first and names Gemini. Choose Not Now and nothing is sent.
      </p>
      <p>
        Suggestions are generated automatically and may be wrong, odd or unhelpful — please use your
        own judgement. The feature is never required: you can always write your own steps, and you
        can create a goal without using it at all.
      </p>

      <h2>Friends and challenges</h2>
      <p>
        People in a challenge with you can see your progress in that challenge. A public link to a
        challenge or an invite shows only a title and a username — never your email address,
        birthday, gender, goals or coin balance.
      </p>
      <p>
        You can block another user from their profile at any time. To report harassment,
        impersonation or abuse, write to{' '}
        <a href="mailto:ewenn.app@gmail.com">ewenn.app@gmail.com</a> with the username and, if you
        can, a screenshot. We may suspend or remove an account that breaks the{' '}
        <a href="/terms/">Terms of Use</a>.
      </p>

      <h2>Your privacy and your data</h2>
      <p>
        The <a href="/privacy/">Privacy Policy</a> sets out in full what the app collects and who can
        see it. In short: Ewenn never uploads a photo from your iPhone, it contains no
        analytics SDK and no crash reporter, there is no advertising and no tracking across other
        apps or websites, and we do not sell or rent your data.
      </p>
      <p>
        You can ask us for a copy of the data we hold about you, ask us to correct it, or ask us to
        delete it. Write to <a href="mailto:ewenn.app@gmail.com">ewenn.app@gmail.com</a> and we will
        respond within 30 days. Depending on where you live you may have further rights under local
        law, and we will honour them.
      </p>

      <h2>Children</h2>
      <p>
        Ewenn is not directed at children under 13, and we do not knowingly collect information from
        them. If you believe a child has given us their information, write to{' '}
        <a href="mailto:ewenn.app@gmail.com">ewenn.app@gmail.com</a> and we will delete the account.
      </p>

      <h2>Reporting a bug</h2>
      <p>
        Tell us what you were doing, what you expected and what happened instead, along with your
        iPhone model and iOS version. Ewenn has no crash reporter, so nothing reaches us
        automatically — a report from you is genuinely the only way we hear about a problem.
      </p>

      <h2>About this page</h2>
      <p>
        This page is a plain-language guide to the questions we are asked most. It does not vary or
        replace our agreement with you: where anything here differs from the{' '}
        <a href="/terms/">Terms of Use</a> or the <a href="/privacy/">Privacy Policy</a>, those
        documents govern.
      </p>

      <h2>Contact</h2>
      <p>
        Anything at all, including anything not covered above:{' '}
        <a href="mailto:ewenn.app@gmail.com">ewenn.app@gmail.com</a>.
      </p>
    </>
  ),
};
