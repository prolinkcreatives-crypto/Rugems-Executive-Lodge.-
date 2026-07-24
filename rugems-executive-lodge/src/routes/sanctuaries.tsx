import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Reveal, MaskImage, StaggerWords, GoldHairline, cinematic } from "@/components/motion";
import { listSanctuaries } from "@/lib/atelier.functions";

const sanctuariesQuery = { queryKey: ["sanctuaries"], queryFn: () => listSanctuaries() };

export const Route = createFileRoute("/sanctuaries")({
  loader: ({ context }) => context.queryClient.ensureQueryData(sanctuariesQuery),
  head: () => ({
    meta: [
      { title: "Suites · Rugems Executive Lodge" },
      {
        name: "description",
        content:
          "A curated collection of suites at Rugems Executive Lodge, Lusaka — from garden rooms to executive suites.",
      },
      { property: "og:title", content: "Suites · Rugems Executive Lodge" },
      {
        property: "og:image",
        content: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1600&q=80",
      },
    ],
  }),
  component: SanctuariesPage,
});

function SanctuariesPage() {
  const { data: sanctuaries } = useSuspenseQuery(sanctuariesQuery);

  return (
    <>
      <Nav />
      <header className="pt-40 md:pt-48 pb-16 px-6 md:px-16">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <span className="text-label-caps text-gold">The Collection</span>
          </Reveal>
          <StaggerWords
            text="Our Sanctuaries."
            as="h1"
            delay={0.2}
            className="text-display-hero font-display text-primary mt-6"
          />
          <Reveal delay={0.5}>
            <p className="text-quote text-on-surface-variant italic mt-8 max-w-3xl">
              A curated collection of private spaces, each designed to evoke a sense of calm and
              exclusivity. Discover your personal retreat.
            </p>
          </Reveal>
          <div className="mt-10"><GoldHairline /></div>
        </div>
      </header>

      <div className="pb-32 md:pb-48 px-6 md:px-16">
        <div className="mx-auto max-w-7xl flex flex-col gap-32 md:gap-48">
          {sanctuaries.map((s, i) => (
            <SanctuaryRow key={s.slug} sanctuary={s} reverse={i % 2 === 1} />
          ))}
        </div>
      </div>

      <Footer />
    </>
  );
}

function SanctuaryRow({
  sanctuary,
  reverse,
}: {
  sanctuary: Awaited<ReturnType<typeof listSanctuaries>>[number];
  reverse: boolean;
}) {
  return (
    <article className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
      <div className={"md:col-span-7 group " + (reverse ? "md:order-2" : "")}>
        <MaskImage
          src={sanctuary.hero_image}
          alt={sanctuary.name}
          className="aspect-[4/3] shadow-ambient gold-hairline"
          direction={reverse ? "right" : "left"}
          parallax={0.15}
        />
      </div>
      <div className={"md:col-span-5 flex flex-col gap-6 " + (reverse ? "md:pr-12" : "md:pl-12")}>
        <Reveal>
          <span className="text-label-caps text-on-surface-variant tracking-widest">
            {sanctuary.tagline} · {sanctuary.location}
          </span>
        </Reveal>
        <StaggerWords
          text={sanctuary.name}
          as="h2"
          className="text-headline-lg font-display text-primary"
        />
        <Reveal delay={0.15}>
          <p className="text-body-lg text-on-surface-variant">{sanctuary.description}</p>
        </Reveal>
        <Reveal delay={0.25}>
          <ul className="flex flex-wrap gap-2 mt-2">
            {sanctuary.amenities.map((a) => (
              <li key={a} className="text-label-caps rounded-full bg-primary-fixed text-on-primary-fixed px-4 py-2">
                {a}
              </li>
            ))}
            <li className="text-label-caps rounded-full bg-primary-fixed text-on-primary-fixed px-4 py-2">
              {sanctuary.size_sqm} SQM
            </li>
          </ul>
        </Reveal>
        <Reveal delay={0.35}>
          <div className="flex items-center justify-between border-t border-outline-variant pt-6 mt-4">
            <div>
              <span className="text-label-caps text-on-surface-variant">Starting from</span>
              <p className="text-headline-md font-display text-primary">
                K{sanctuary.price_per_night}
                <span className="text-body-md text-on-surface-variant ml-1">/ night</span>
              </p>
            </div>
            <Link
              to="/book"
              search={{ sanctuary: sanctuary.slug }}
              className="group inline-flex items-center gap-2 rounded-full border border-gold text-tertiary px-6 py-3 text-label-caps hover:bg-gold hover:text-primary transition-all duration-500"
            >
              Reserve
              <motion.span
                aria-hidden
                initial={{ x: 0 }}
                whileHover={{ x: 4 }}
                transition={{ duration: 0.4, ease: cinematic }}
              >
                <ArrowRight className="h-4 w-4" />
              </motion.span>
            </Link>
          </div>
        </Reveal>
      </div>
    </article>
  );
}
