import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, ArrowDown, MapPin, Phone, MessageCircle, Navigation } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { BrandLoader } from "@/components/brand-loader";
import { Reveal, MaskImage, StaggerWords, GoldHairline, GoldSparkle, cinematic } from "@/components/motion";
import { listSanctuaries } from "@/lib/atelier.functions";
import { BUSINESS, links, LOCATIONS, locationDirections, locationMapEmbed } from "@/lib/business";
import heroEntranceAsset from "@/assets/hero-new-avondale-entrance.webp";
import receptionLobbyAsset from "@/assets/reception-lobby.webp";

const sanctuariesQuery = {
  queryKey: ["sanctuaries"],
  queryFn: () => listSanctuaries(),
};

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(sanctuariesQuery);
  },
  head: () => ({
    meta: [
      { title: "Rugems Executive Lodge · Boutique Stay in Lusaka" },
      {
        name: "description",
        content:
          "Rugems Executive Lodge — a boutique retreat on Imboswa Road, New Avondale, Lusaka. Refined suites, warm hospitality, and quiet luxury minutes from the city.",
      },
      { property: "og:title", content: "Rugems Executive Lodge · Lusaka" },
      {
        property: "og:image",
        content: heroEntranceAsset,
      },
    ],
  }),
  component: HomePage,
  errorComponent: ({ error }) => <div className="p-10">Failed to load: {error.message}</div>,
  notFoundComponent: () => <div className="p-10">Not found</div>,
});

function HomePage() {
  return (
    <>
      <BrandLoader />
      <Nav />
      <Hero />
      <Story />
      <FeaturedSanctuaries />
      <QuoteBand />
      <ContactLocation />
      <Footer />
    </>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "-8%"]);
  const contentOp = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  return (
    <header
      ref={ref}
      className="relative w-full bg-primary overflow-hidden flex items-end min-h-[90dvh] md:min-h-[100dvh]"
    >
      {/* IMAGE — full-bleed, immersive, preserves original composition and sharpness */}
      <motion.figure
        style={{ y: imgY }}
        className="absolute inset-0 w-full h-full"
      >
        <img
          src={heroEntranceAsset}
          alt="Rugems Executive Lodge entrance at golden hour — palm tree, gate and driveway"
          className="absolute inset-0 h-full w-full object-cover object-[center_35%] md:object-[center_45%]"
          loading="eager"
          fetchPriority="high"
        />
        {/* Subtle luxury gradient — improves readability without hiding property details */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/5" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(20,15,10,0.45)_0%,transparent_60%)]" />

        <GoldSparkle className="left-[14%] top-[22%] h-1.5 w-1.5" delay={0.4} />
        <GoldSparkle className="right-[28%] top-[18%] h-1 w-1" delay={1.6} />
      </motion.figure>

      {/* TEXT — anchored bottom-left; safe top spacing via pt for status bars/notches */}
      <motion.div
        style={{ y: contentY, opacity: contentOp }}
        className="relative z-10 w-full px-6 pt-[max(6rem,env(safe-area-inset-top))] pb-12 md:px-16 md:pt-40 md:pb-20"
      >
        <div className="max-w-2xl">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: cinematic, delay: 1.2 }}
            className="text-label-caps text-gold mb-5 block"
          >
            {BUSINESS.name} · Lusaka
          </motion.span>

          <StaggerWords
            text="Where every stay is a quiet masterpiece."
            as="h1"
            delay={1.4}
            wordDelay={0.11}
            className="text-display-hero font-display text-ivory drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)]"
          />

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: cinematic, delay: 2.3 }}
            className="text-body-lg md:text-quote text-ivory/90 mt-6 max-w-xl md:italic"
          >
            A boutique lodge on Imboswa Road, New Avondale — warm hospitality and unhurried living,
            minutes from the heart of Lusaka.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: cinematic, delay: 2.7 }}
            className="mt-8 md:mt-10 flex flex-wrap items-center gap-4"
          >
            <Link
              to="/book"
              className="group inline-flex items-center gap-3 rounded-full bg-ivory/10 backdrop-blur-md border border-gold/60 text-ivory px-8 py-3.5 text-label-caps hover:bg-gold hover:text-primary transition-all duration-500"
            >
              Book Now
              <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/sanctuaries"
              className="text-label-caps text-ivory/85 hover:text-ivory transition-colors underline underline-offset-8 decoration-gold/60"
            >
              Explore Suites
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* Discover cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.2, duration: 1 }}
        className="absolute bottom-6 right-6 md:right-16 md:bottom-10 z-10 hidden sm:flex flex-col items-center gap-2 text-ivory/70"
      >
        <span className="text-label-caps [writing-mode:vertical-rl] rotate-180">Discover</span>
        <ArrowDown className="h-4 w-4 animate-gentle-bounce" />
      </motion.div>
    </header>
  );
}

function Story() {
  return (
    <section className="relative py-32 md:py-48 bg-surface px-6 md:px-16">
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-5 md:pr-10 flex flex-col gap-6">
          <Reveal>
            <span className="text-label-caps text-gold">The Narrative</span>
          </Reveal>
          <StaggerWords
            text="Crafted with care. Lived by you."
            as="h2"
            className="text-headline-lg font-display text-primary"
          />
          <Reveal delay={0.15}>
            <p className="text-body-lg text-on-surface-variant">
              A true sanctuary is born from intention. Every texture, every beam of light, and every
              piece of bespoke furniture has been meticulously curated to evoke quiet luxury and profound calm.
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="text-body-md text-secondary">
              Minimalism meets warmth. Architectural lines provide the canvas; raw linen, honed stone
              and rich woods tell a story of slow, deliberate living at Rugems.
            </p>
          </Reveal>
          <Reveal delay={0.35}>
            <Link
              to="/story"
              className="group mt-2 inline-flex items-center gap-3 text-label-caps text-primary w-max"
            >
              Read the full story
              <span className="relative overflow-hidden inline-block">
                <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
              </span>
              <span className="absolute -bottom-1 left-0 h-px w-full bg-primary origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
            </Link>
          </Reveal>
        </div>

        <div className="md:col-span-7 relative h-[520px] md:h-[640px]">
          <MaskImage
            src={receptionLobbyAsset}
            alt="Rugems Executive Lodge reception lobby with plush seating and branded desk"
            className="absolute top-8 -left-4 md:-left-10 w-2/3 h-4/5 z-0 shadow-ambient"
            direction="left"
            parallax={0.2}
          />
          <div className="absolute -bottom-6 md:bottom-0 right-0 w-full md:w-[78%] h-[70%] md:h-[86%] z-10 gold-hairline p-2 bg-ivory shadow-ambient-lg">
            <MaskImage
              src="https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1600&q=85"
              alt="Minimalist master bedroom with distant view"
              className="w-full h-full"
              direction="right"
              delay={0.15}
              parallax={0.1}
            />
          </div>
          <GoldSparkle className="right-[8%] top-[10%] h-1 w-1" delay={0.5} />
        </div>
      </div>
    </section>
  );
}

function FeaturedSanctuaries() {
  const { data } = useSuspenseQuery(sanctuariesQuery);
  return (
    <section className="relative py-32 md:py-48 bg-surface-container-low px-6 md:px-16 overflow-hidden">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center text-center mb-20">
          <Reveal>
            <span className="text-label-caps text-gold">The Collection</span>
          </Reveal>
          <StaggerWords
            text="Sanctuaries to still your step."
            as="h2"
            delay={0.15}
            className="text-headline-lg font-display text-primary mt-4 max-w-3xl"
          />
          <div className="mt-8"><GoldHairline /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-24">
          {data.map((s, i) => (
            <Reveal key={s.slug} delay={(i % 2) * 0.15}>
              <Link to="/sanctuaries" className="group block">
                <div className="relative overflow-hidden aspect-[4/3] md:aspect-[5/4] shadow-ambient bg-ivory">
                  <motion.img
                    src={s.hero_image}
                    alt={s.name}
                    loading="lazy"
                    className="h-full w-full object-cover object-center"
                    initial={{ scale: 1.02, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 1.4, ease: cinematic }}
                    whileHover={{ scale: 1.02 }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/10 to-transparent" />
                  <div className="absolute inset-x-8 bottom-8 flex items-end justify-between text-ivory">
                    <div>
                      <p className="text-label-caps text-gold-soft mb-2">{s.tagline}</p>
                      <h3 className="text-headline-md font-display">{s.name}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-label-caps opacity-80">from</p>
                      <p className="text-headline-md font-display">K{s.price_per_night}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-label-caps text-on-surface-variant">{s.location}</p>
                  <span className="text-label-caps text-primary flex items-center gap-2 group-hover:gap-3 transition-all">
                    Explore <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuoteBand() {
  return (
    <section className="relative py-40 md:py-56 bg-primary text-ivory overflow-hidden">
      <motion.div
        aria-hidden
        className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-gold/10 blur-3xl"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary-container/40 blur-3xl"
        animate={{ scale: [1.1, 1, 1.1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative z-10 mx-auto max-w-4xl text-center px-6">
        <Reveal>
          <span className="text-label-caps text-gold">Guest reflection</span>
        </Reveal>
        <StaggerWords
          text="To step into Rugems is to step out of the noise of the day."
          as="p"
          delay={0.2}
          className="text-quote md:text-headline-md font-display italic mt-10 leading-tight"
        />
        <Reveal delay={0.5}>
          <p className="text-label-caps text-gold-soft mt-10">— A returning guest, Lusaka 2025</p>
        </Reveal>
      </div>
    </section>
  );
}

function ContactLocation() {
  return (
    <section id="visit" className="relative py-32 md:py-48 bg-surface px-6 md:px-16">
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
        <div className="md:col-span-5 flex flex-col gap-6">
          <Reveal>
            <span className="text-label-caps text-gold">Visit</span>
          </Reveal>
          <StaggerWords
            text="Find us in Lusaka."
            as="h2"
            className="text-headline-lg font-display text-primary"
          />
          <div className="mt-2"><GoldHairline /></div>

          <Reveal delay={0.15}>
            <dl className="grid grid-cols-2 gap-6 mt-4">
              <div>
                <dt className="text-label-caps text-on-surface-variant">Check-in</dt>
                <dd className="text-body-md text-on-surface mt-1">{BUSINESS.hours.checkIn}</dd>
              </div>
              <div>
                <dt className="text-label-caps text-on-surface-variant">Check-out</dt>
                <dd className="text-body-md text-on-surface mt-1">{BUSINESS.hours.checkOut}</dd>
              </div>
            </dl>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="flex flex-wrap gap-3 mt-6">
              <a
                href={links.tel}
                className="group inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-label-caps hover:-translate-y-0.5 hover:shadow-ambient-lg transition-all duration-500"
              >
                <Phone className="h-4 w-4" /> Call
              </a>
              <a
                href={links.whatsapp}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-2 rounded-full border border-gold text-tertiary px-6 py-3 text-label-caps hover:bg-gold hover:text-primary transition-all duration-500"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.25}>
            <p className="text-label-caps text-on-surface-variant mt-6">
              {BUSINESS.phone} · Email ·{" "}
              <a href={links.email} className="hover:text-primary transition-colors">
                {BUSINESS.email}
              </a>
            </p>
          </Reveal>
        </div>

        <div className="md:col-span-7 flex flex-col gap-14">
          {LOCATIONS.map((loc, i) => (
            <div key={loc.slug}>
              <Reveal delay={0.05 + i * 0.05}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-gold mt-1 flex-shrink-0" />
                    <p className="text-body-md text-on-surface-variant">
                      <span className="text-label-caps text-primary block mb-1">{loc.short}</span>
                      {loc.addressLines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </p>
                  </div>
                  <a
                    href={locationDirections(loc.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex flex-shrink-0 items-center gap-2 rounded-full border border-outline-variant text-on-surface-variant px-5 py-2.5 text-label-caps hover:border-primary hover:text-primary transition-all duration-500"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Directions
                  </a>
                </div>
              </Reveal>
              <Reveal delay={0.1 + i * 0.05}>
                <div className="relative aspect-[16/10] overflow-hidden shadow-ambient-lg gold-hairline bg-ivory p-2">
                  <iframe
                    title={`${loc.name} location map`}
                    src={locationMapEmbed(loc.slug)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />
                </div>
              </Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
