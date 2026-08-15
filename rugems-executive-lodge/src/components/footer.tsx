import { Link } from "@tanstack/react-router";
import { Phone, MessageCircle, MapPin, Mail } from "lucide-react";
import { Reveal, GoldHairline } from "./motion";
import { BUSINESS, links } from "@/lib/business";

export function Footer() {
  return (
    <footer className="relative bg-surface-container-lowest border-t border-outline-variant/60 overflow-hidden">
      <div className="mx-auto max-w-[1400px] px-6 md:px-16 py-24 md:py-32 flex flex-col items-center gap-10">
        <Reveal>
          <Link
            to="/"
            className="text-headline-md md:text-display-hero font-display text-primary tracking-[-0.01em]"
          >
            RUGEMS
          </Link>
        </Reveal>
        <GoldHairline className="w-32" />
        <Reveal delay={0.1}>
          <p className="text-quote max-w-xl text-center text-on-surface-variant italic">
            {BUSINESS.name} — a quiet address in New Avondale, Lusaka.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-14 gap-y-4 text-label-caps text-on-surface-variant">
            <a
              href={links.tel}
              className="inline-flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Phone className="h-3.5 w-3.5 text-gold" /> {BUSINESS.phone}
            </a>
            <a
              href={links.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:text-primary transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5 text-gold" /> WhatsApp
            </a>
            <a
              href={links.mapView}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:text-primary transition-colors"
            >
              <MapPin className="h-3.5 w-3.5 text-gold" /> {BUSINESS.address.line2}
            </a>
            <a
              href={links.email}
              className="inline-flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Mail className="h-3.5 w-3.5 text-gold" /> Email · {BUSINESS.email}
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <nav className="flex flex-wrap justify-center gap-8 pt-4">
            {[
              { to: "/story", label: "The Story" },
              { to: "/sanctuaries", label: "Sanctuaries" },
              { to: "/experiences", label: "Experiences" },
              { to: "/book", label: "Reserve" },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-label-caps text-on-surface-variant hover:text-primary transition-colors relative group"
              >
                {l.label}
                <span className="absolute inset-x-0 -bottom-1 h-px bg-gold origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
              </Link>
            ))}
          </nav>
        </Reveal>

        <Reveal delay={0.25}>
          <div className="text-label-caps text-on-surface-variant text-center space-y-1">
            <p>Check-in · {BUSINESS.hours.checkIn}</p>
            <p>Check-out · {BUSINESS.hours.checkOut}</p>
          </div>
        </Reveal>

        <Reveal delay={0.3}>
          <p className="text-label-caps text-outline mt-6 text-center">
            © {new Date().getFullYear()} {BUSINESS.name} · Crafted with intention
          </p>
        </Reveal>
      </div>
    </footer>
  );
}
