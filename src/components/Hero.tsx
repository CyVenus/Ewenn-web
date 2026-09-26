import { COPY, HEADLINE } from '../config';
import { AppStoreBadge } from './AppStoreBadge';
import { BlurText } from './BlurText';

/**
 * The one block of copy on the site. It carries its own light rather than sitting on a panel —
 * see .hero__title in global.css for why a rectangle here is the wrong answer.
 */
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__card">
        <h1 id="hero-title" className="hero__title">
          <BlurText
            text={COPY.headline}
            phrase={HEADLINE.phrase}
            phraseClassName="hero__title-phrase"
            marks={COPY.headlineMarks}
            delay={100}
            stepDuration={140}
          />
        </h1>
        <p className="hero__subline">{COPY.subline}</p>
        <AppStoreBadge />
      </div>
    </section>
  );
}
