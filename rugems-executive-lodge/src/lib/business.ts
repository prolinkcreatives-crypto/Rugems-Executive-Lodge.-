/**
 * Real business details for Rugems Executive Lodge.
 * Update in one place — imported everywhere.
 */
export const BUSINESS = {
  name: "Rugems Executive Lodge",
  short: "Rugems",
  tagline: "Executive Lodge · Lusaka",
  phone: "+260 979 585 832",
  whatsapp: "+260 979 585 832",
  email: "Coming Soon",
  address: {
    line1: "Plot Number 23, Imboswa Road",
    line2: "New Avondale, Lusaka, Zambia",
    full: "Plot Number 23, Imboswa Road, New Avondale, Lusaka, Zambia",
  },
  coords: { lat: -15.381227, lng: 28.406019 },
  hours: {
    checkIn: "12:30 AM – 12:00 PM",
    checkOut: "6:00 AM – 10:00 AM",
  },
  payment: {
    method: "Airtel Money",
    accountName: "Kelvin Shimoh",
    sendNumber: "+260 979 585 832",
    altWithdrawalNumber: "+260 974 147 471",
  },
} as const;

const digits = (s: string) => s.replace(/[^\d+]/g, "");

export const links = {
  tel: `tel:${digits(BUSINESS.phone)}`,
  whatsapp: `https://wa.me/${digits(BUSINESS.whatsapp).replace(/^\+/, "")}`,
  directions: `https://www.google.com/maps/dir/?api=1&destination=${BUSINESS.coords.lat},${BUSINESS.coords.lng}`,
  mapEmbed: `https://www.google.com/maps?q=${BUSINESS.coords.lat},${BUSINESS.coords.lng}&hl=en&z=17&output=embed`,
  mapView: `https://www.google.com/maps/search/?api=1&query=${BUSINESS.coords.lat},${BUSINESS.coords.lng}`,
};

import locationNewAvondaleAsset from "@/assets/location-new-avondale.png";
import locationRanchdaleImg from "@/assets/location-ranchdale-entrance.png";

const locationNewAvondaleImg = locationNewAvondaleAsset;

/**
 * The two Rugems Executive Lodge branches. Rooms, prices, services and
 * payment details are identical — only the physical location differs.
 */
export const LOCATIONS = [
  {
    slug: "new-avondale",
    name: "Rugems Executive Lodge – New Avondale",
    short: "New Avondale",
    tagline: "Our flagship residence",
    description:
      "Tucked along Imboswa Road in leafy New Avondale, our flagship lodge welcomes you with lantern-lit corridors and the calm of a private residence.",
    addressLines: ["Plot 23, Imboswa Road", "New Avondale, Lusaka, Zambia"],
    coords: { lat: -15.381227, lng: 28.406019 },
    image: locationNewAvondaleImg,
  },
  {
    slug: "ranchdale",
    name: "Rugems Executive Lodge – Ranchdale",
    short: "Ranchdale",
    tagline: "Our garden retreat",
    description:
      "A quieter garden retreat in Ranchdale, framed by tall trees and unhurried mornings — the same signature Rugems service in a different mood.",
    addressLines: ["Ranchdale", "Lusaka, Zambia"],
    coords: { lat: -15.335277, lng: 28.371203 },
    image: locationRanchdaleImg,
  },
] as const;

export type LocationSlug = (typeof LOCATIONS)[number]["slug"];

export const getLocation = (slug?: string | null) =>
  LOCATIONS.find((l) => l.slug === slug);

export const locationDirections = (slug: LocationSlug) => {
  const loc = getLocation(slug)!;
  return `https://www.google.com/maps/dir/?api=1&destination=${loc.coords.lat},${loc.coords.lng}`;
};
