import type { Doc } from './doc';

/**
 * Transcribed verbatim from https://ewenn.app/terms.html (last updated 30 August 2026), and
 * revised on 23 September 2026 for Guideline 1.2: zero tolerance for objectionable content and
 * abusive users, reports acted on within 24 hours, and the app's sign-in screens now say that
 * continuing is agreeing to these terms (the app repo's `LegalLinks.agreementLine`).
 *
 * Apple's Guideline 3.1.2 requires a functional Terms of Use link inside the binary, on
 * the purchase screen -- the Rewenn paywall links here, so the published `/terms.html`
 * is kept alive as an alias (see lib/docAliases).
 *
 * This is our own page rather than Apple's standard EULA so that both paywall links point
 * at ewenn.app, and so it can state what actually happens when a subscription lapses --
 * the caps stop applying and the hat is kept -- which a generic EULA cannot say.
 *
 * The renewal wording is Apple's expected shape (charged at confirmation, renews unless
 * turned off 24 hours before the period ends, managed in Settings). It reads as
 * boilerplate because it is: reviewers look for exactly these sentences.
 *
 * The heading is "Terms of Use", not "Terms of Service" -- that is what the published
 * document and the App Store Connect record both say.
 */
export const TERMS_DOC: Doc = {
  title: 'Terms of Use',
  description: 'The terms for using Ewenn.',
  updated: 'Last updated 23 September 2026',
  path: '/terms/',
  body: (
    <>
      <p>
        These terms cover your use of Ewenn, a focus companion app for iOS. By creating an account
        you agree to them. If you do not, please do not use the app.
      </p>

      <h2>Your account</h2>
      <p>
        You need an account to use Ewenn, and you are responsible for keeping your sign-in details to
        yourself. Please give accurate information when you sign up, and keep your account to
        yourself — one account is for one person.
      </p>
      <p>
        You can delete your account at any time from <strong>Profile → Account</strong>. Deleting
        removes your data and releases your username, and it cannot be undone.
      </p>

      <h2>Rewenn — the optional subscription</h2>
      <p>
        Ewenn is free to use. <strong>Rewenn</strong> is an optional auto-renewing subscription that
        gives you double the goal slots, up to five challenges you can host, and an exclusive hat for
        your penguin.
      </p>

      <h3>Billing</h3>
      <ul>
        <li>Payment is charged to your Apple ID account at confirmation of purchase.</li>
        <li>
          The subscription <strong>renews automatically</strong> unless auto-renew is turned off at
          least 24 hours before the end of the current period.
        </li>
        <li>
          Your account is charged for renewal within 24 hours before the end of the current period,
          at the price shown in the app for your region.
        </li>
        <li>
          You can manage your subscription and turn off auto-renewal in your Apple ID Account
          Settings after purchase.
        </li>
        <li>
          If a free trial is offered and you subscribe before it ends, any unused portion of the
          trial is forfeited.
        </li>
      </ul>
      <p>
        Prices are shown in the app in your local currency and are set by us in App Store Connect.
        Purchases are handled by Apple, and refunds are Apple's to give — you can request one through
        Apple's support.
      </p>

      <h3>If your subscription ends</h3>
      <div className="doc__note">
        <p>
          <strong>Nothing is taken away.</strong> If your subscription lapses, the raised limits
          simply stop applying to anything new — goals and challenges you already have stay exactly
          as they are — and the exclusive hat remains yours to wear. We do not repossess things you
          have earned or been given.
        </p>
      </div>

      <h2>Coins</h2>
      <p>
        Coins are an in-app item you earn by completing checklist steps, claiming badges and
        finishing challenges. They may also become available to buy in a future version of the app.
      </p>
      <ul>
        <li>
          Coins have <strong>no monetary value</strong>. They are not money, not a currency, and not
          a stored balance you own.
        </li>
        <li>
          Coins{' '}
          <strong>cannot be cashed out, exchanged for money, or transferred to another person</strong>
          . Money only ever flows into the app.
        </li>
        <li>Coins exist only inside your Ewenn account, and are lost if you delete it.</li>
        <li>
          Items you buy with coins are a licence to use them inside Ewenn, not property you own.
        </li>
      </ul>

      <h2>Using Ewenn decently</h2>
      <p>Please do not:</p>
      <ul>
        <li>
          Harass, impersonate or abuse other people through friend requests, usernames, challenge
          names or any other text the app lets you write.
        </li>
        <li>
          Try to break, overload or work around the app's limits, or access another person's account
          or data.
        </li>
        <li>Use the app for anything unlawful.</li>
      </ul>
      <p>
        <strong>Ewenn has zero tolerance for objectionable content and abusive users.</strong> You can
        block another user from their profile at any time, and report one from the same menu. We act
        on every report within 24 hours: content that breaks these rules is removed, and so is the
        account that posted it.
      </p>

      <h2>Your content</h2>
      <p>
        Your goals, checklists and the rest of what you write in Ewenn remain yours. You give us
        permission to store and process them only so far as we need to in order to run the app for
        you — which is described in the <a href="/privacy/">Privacy Policy</a>.
      </p>

      <h2>AI-suggested steps</h2>
      <p>
        Ewenn can suggest checklist steps for a goal. Suggestions are generated automatically and may
        be wrong, odd or unhelpful — please use your own judgement. The feature is a convenience and
        is never required: you can always write your own steps, and you can create a goal without
        using it at all.
      </p>

      <h2>Availability</h2>
      <p>
        We do our best to keep Ewenn working, but we cannot promise it will always be available or
        free of faults. The app is provided "as is", without warranties, to the fullest extent the
        law allows. Nothing in these terms limits any right you have that cannot be limited by law —
        including consumer rights in your country.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. When we do, the date at the top changes. If a change matters to
        you, we will say so in the app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:ewenn.app@gmail.com">ewenn.app@gmail.com</a>.
      </p>
    </>
  ),
};
