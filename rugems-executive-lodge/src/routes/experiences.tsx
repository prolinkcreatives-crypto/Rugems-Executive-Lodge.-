import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Reveal, MaskImage, StaggerWords, GoldHairline, ParallaxY, GoldSparkle } from "@/components/motion";

export const Route = createFileRoute("/experiences")({
  head: () => ({
    meta: [
      { title: "Experiences · Rugems Executive Lodge" },
      {
        name: "description",
        content:
          "Curated immersions and tactile refinement — a meticulously crafted sequence of moments at Rugems Executive Lodge.",
      },
      { property: "og:title", content: "Experiences · Rugems Executive Lodge" },
      {
        property: "og:image",
        content: "https://images.unsplash.com/photo-1571508601891-ca5e7a713859?w=1600&q=80",
      },
    ],
  }),
  component: ExperiencesPage,
});

function ExperiencesPage() {
  return (
    <>
      <Nav />
      <header className="relative min-h-[100svh] flex flex-col justify-end px-6 md:px-16 pb-32 pt-40 overflow-hidden">
        <ParallaxY strength={80} className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1571508601891-ca5e7a713859?w=2000&q=85"
            alt="A tranquil sanctuary interior at first light"
            className="h-full w-full object-cover scale-105"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ivory via-ivory/30 to-transparent" />
        </ParallaxY>
        <div className="relative z-10 max-w-4xl">
          <Reveal>
            <span className="text-label-caps text-gold">Curated Immersions</span>
          </Reveal>
          <StaggerWords
            text="The art of being present."
            as="h1"
            delay={0.2}
            className="text-display-hero font-display text-primary mt-6"
          />
          <Reveal delay={0.5}>
            <p className="text-body-lg text-on-surface-variant mt-8 max-w-2xl">
              Beyond mere accommodation, Rugems offers a meticulously crafted sequence of moments.
              Every detail is intentionally designed to anchor you in luxury.
            </p>
          </Reveal>
        </div>
      </header>

      <section className="relative py-32 md:py-48 px-6 md:px-16 bg-surface">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-5 flex flex-col gap-6">
            <StaggerWords
              text="Tactile refinement."
              as="h2"
              className="text-headline-lg font-display text-primary"
            />
            <Reveal delay={0.2}>
              <p className="text-body-md text-on-surface-variant">
                We eschew standard amenity lists in favor of sensory touchpoints. Deep royal purple
                hues and champagne gold accents create an atmosphere of quiet opulence.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <ul className="flex flex-wrap gap-3 mt-4">
                {["Artisan Bath", "Acoustic Serenity", "Private Chef", "Curated Library", "Aromatherapy"].map(
                  (t) => (
                    <li key={t} className="text-label-caps rounded-full bg-primary-fixed text-on-primary-fixed px-5 py-2 border border-primary-fixed">
                      {t}
                    </li>
                  ),
                )}
              </ul>
            </Reveal>
          </div>
          <div className="md:col-span-6 md:col-start-7 relative min-h-[600px]">
            <MaskImage
              src="https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1400&q=85"
              alt="A deep stone soaking tub with artisan bath salts"
              className="absolute right-0 top-0 w-4/5 h-[500px] shadow-ambient gold-hairline"
              direction="right"
              parallax={0.2}
            />
            <MaskImage
              src="https://images.unsplash.com/photo-1616627981793-ee7d92858c6c?w=800&q=85"
              alt="A reading nook with cashmere throw and gold reading lamp"
              className="absolute left-0 bottom-0 w-2/5 h-[300px] shadow-ambient-lg border-8 border-ivory -translate-y-12"
              direction="left"
              delay={0.2}
              parallax={0.35}
            />
            <GoldSparkle className="top-[8%] right-[10%] h-1 w-1" delay={0.8} />
          </div>
        </div>
      </section>

      {/* Cinematic asymmetric gallery */}
      <section className="relative py-32 md:py-48 bg-surface-container-low overflow-hidden">
        <div className="px-6 md:px-16 max-w-3xl mx-auto text-center mb-24">
          <Reveal>
            <span className="text-label-caps text-gold">A cinematic canvas</span>
          </Reveal>
          <StaggerWords
            text="Spaces designed to be felt."
            as="h2"
            delay={0.15}
            className="text-headline-lg font-display text-primary mt-4"
          />
          <div className="mt-6 flex justify-center"><GoldHairline /></div>
        </div>

        <div className="relative w-full max-w-[1600px] mx-auto h-[1100px] md:h-[1300px] px-6">
          <MaskImage
            src="https://images.unsplash.com/photo-1519821172144-4f87d85de2a4?w=1400&q=85"
            alt="Private dining terrace at twilight"
            className="absolute top-0 left-[5%] w-[80%] md:w-[50%] h-[500px] md:h-[680px] shadow-ambient"
            direction="left"
            parallax={0.15}
          />
          <MaskImage
            src="https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=85"
            alt="Infinity pool blending into the horizon"
            className="absolute top-[35%] md:top-[42%] right-[5%] md:right-[15%] w-[70%] md:w-[35%] h-[400px] md:h-[500px] shadow-ambient-lg gold-hairline"
            direction="right"
            delay={0.15}
            parallax={0.25}
          />
          <MaskImage
            src="https://images.unsplash.com/photo-1602928298849-325cec8771c0?w=800&q=85"
            alt="Hand-poured artisan candle on slate with gold accents"
            className="absolute bottom-[10%] left-[10%] md:left-[25%] w-[60%] md:w-[24%] h-[340px] shadow-ambient bg-ivory p-3"
            direction="up"
            delay={0.3}
            parallax={0.4}
          />
        </div>
      </section>

      {/* Interstitial quote */}
      <section className="relative py-40 md:py-52 px-6 md:px-16 bg-primary text-ivory overflow-hidden">
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(600px circle at 50% 50%, rgba(203,167,47,0.25), transparent 60%)",
          }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <Reveal>
            <span className="text-label-caps text-gold-soft">The Artisans</span>
          </Reveal>
          <StaggerWords
            text="To step into Rugems is to step out of the noise of the day."
            as="p"
            delay={0.2}
            className="text-headline-md md:text-headline-lg font-display italic mt-10 leading-tight"
          />
        </div>
      </section>

      <Footer />
    </>
  );
}
