import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Reveal, MaskImage, StaggerWords, GoldHairline, ParallaxY } from "@/components/motion";
import { useSiteImage, listSiteImages } from "@/lib/site-images";

const siteImagesQuery = { queryKey: ["site-images"], queryFn: () => listSiteImages() };

export const Route = createFileRoute("/story")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteImagesQuery),
  head: () => ({
    meta: [
      { title: "The Story · Rugems Executive Lodge" },
      {
        name: "description",
        content: "The vision, craft, and philosophy behind Rugems Executive Lodge — a boutique stay in Lusaka.",
      },
      { property: "og:title", content: "The Story · Rugems Executive Lodge" },
      {
        property: "og:image",
        content: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1600&q=80",
      },
    ],
  }),
  component: StoryPage,
});

function StoryPage() {
  const heroImg = useSiteImage("story-hero", "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=2000&q=85");
  const woodDetailImg = useSiteImage("story-wood-detail", "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=85");
  const corridorImg = useSiteImage("story-corridor", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=2000&q=85");
  const artisanHandsImg = useSiteImage("story-artisan-hands", "https://images.unsplash.com/photo-1524230572899-a752b3835840?w=800&q=85");
  const textilesImg = useSiteImage("story-textiles", "https://images.unsplash.com/photo-1615529182904-14819c35db37?w=800&q=85");
  return (
    <>
      <Nav />
      <header className="relative h-[80svh] flex items-end pb-24 md:pb-40 px-6 md:px-16 overflow-hidden">
        <ParallaxY strength={80} className="absolute inset-0">
          <img
            src={heroImg}
            alt="Wide interior corridor of a Rugems suite"
            className="h-full w-full object-cover scale-105"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ivory via-ivory/40 to-ivory/10" />
        </ParallaxY>
        <div className="relative z-10 max-w-4xl">
          <Reveal>
            <span className="text-label-caps text-gold">The Narrative</span>
          </Reveal>
          <StaggerWords
            text="Crafting serenity."
            as="h1"
            delay={0.2}
            className="text-display-hero font-display text-primary mt-6"
          />
          <Reveal delay={0.5}>
            <p className="text-quote text-on-surface-variant mt-8 italic max-w-2xl">
              A journey into the heart of bespoke luxury and intentional design.
            </p>
          </Reveal>
        </div>
      </header>

      <section className="py-32 md:py-48 px-6 md:px-16 bg-surface">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-5 md:col-start-2 flex flex-col gap-6">
            <Reveal>
              <span className="text-label-caps text-on-surface-variant">The Vision</span>
            </Reveal>
            <StaggerWords
              text="Where heritage meets horizon."
              as="h2"
              className="text-headline-lg font-display text-primary"
            />
            <Reveal delay={0.2}>
              <p className="text-body-lg text-on-surface-variant">
                Rugems was born from a desire to create spaces that breathe. True luxury isn't
                found in excess, but in the meticulous curation of essential elements.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <p className="text-body-md text-secondary">
                Our architects blur the lines between the built environment and the untamed
                landscapes surrounding them — grounded, yet ethereal.
              </p>
            </Reveal>
          </div>
          <div className="md:col-span-5 md:col-start-8 aspect-[3/4] relative">
            <MaskImage
              src={woodDetailImg}
              alt="Handcrafted wooden detail filtering warm sunlight"
              className="absolute inset-0 shadow-ambient-lg"
              direction="up"
              parallax={0.15}
            />
          </div>
        </div>
      </section>

      {/* Pull quote */}
      <section className="py-32 md:py-40 px-6 md:px-16 bg-surface-container-low">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <span className="text-label-caps text-gold">The founders</span>
          </Reveal>
          <div className="my-6 flex justify-center"><GoldHairline /></div>
          <StaggerWords
            text="We do not build to conquer the landscape, but to quietly converse with it."
            as="p"
            delay={0.2}
            wordDelay={0.06}
            className="text-headline-md md:text-headline-lg font-display italic text-primary-container"
          />
        </div>
      </section>

      {/* Parallax architectural band */}
      <section className="relative h-[70svh] overflow-hidden">
        <ParallaxY strength={120} className="absolute inset-0">
          <img
            src={corridorImg}
            alt="Symmetrical interior corridor of a luxury sanctuary at dusk"
            className="h-full w-full object-cover scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-transparent to-charcoal/40" />
        </ParallaxY>
        <div className="relative z-10 h-full flex items-center justify-center px-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20, letterSpacing: "0.1em" }}
            whileInView={{ opacity: 1, y: 0, letterSpacing: "0.4em" }}
            viewport={{ once: true }}
            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
            className="text-label-caps text-gold-soft"
          >
            AN ARCHITECTURE OF QUIET
          </motion.p>
        </div>
      </section>

      <section className="py-32 md:py-48 px-6 md:px-16 bg-surface">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-6 order-2 md:order-1 grid grid-cols-2 gap-4">
            <MaskImage
              src={artisanHandsImg}
              alt="Artisan's hands finishing bespoke wooden furniture"
              className="h-64 shadow-ambient mt-12"
              direction="up"
            />
            <MaskImage
              src={textilesImg}
              alt="Bespoke woven textiles in warm tones"
              className="h-80 shadow-ambient"
              direction="up"
              delay={0.15}
            />
          </div>
          <div className="md:col-span-5 md:col-start-8 order-1 md:order-2 flex flex-col gap-6">
            <Reveal>
              <span className="text-label-caps text-on-surface-variant">The Craft</span>
            </Reveal>
            <StaggerWords
              text="Tactile elegance."
              as="h2"
              className="text-headline-lg font-display text-primary"
            />
            <Reveal delay={0.2}>
              <p className="text-body-lg text-on-surface-variant">
                We collaborate with master artisans to source materials that age gracefully,
                telling a story of time and touch.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <p className="text-body-md text-secondary">
                From hand-hewn timber to bespoke ceramics, every texture is chosen to engage the
                senses — a sanctuary not just for the mind, but for the tactile soul.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
