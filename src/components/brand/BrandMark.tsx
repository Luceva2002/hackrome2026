"use client";

import { useId } from "react";

import { LOGO_MARK_FILE } from "@/lib/brand";

/** Simbolo del logo: LOGO_MARK_FILE (src/lib/brand.ts) se impostato, altrimenti il pin vettoriale. */
export function BrandMark() {
  const gold = useId();
  if (LOGO_MARK_FILE) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LOGO_MARK_FILE}
        alt=""
        aria-hidden
        style={{ width: "1.08em", height: "1.08em" }}
        className="shrink-0"
      />
    );
  }
  return (
    <svg
      viewBox="0 0 48 48"
      style={{ width: "1.08em", height: "1.08em" }}
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd23e" />
          <stop offset="55%" stopColor="#f5b301" />
          <stop offset="100%" stopColor="#d89b00" />
        </linearGradient>
      </defs>
      <path
        d="M24 3.5C15.4 3.5 8.5 10.4 8.5 19c0 10.6 13 22.4 14.6 23.8a1.4 1.4 0 0 0 1.8 0C26.5 41.4 39.5 29.6 39.5 19c0-8.6-6.9-15.5-15.5-15.5z"
        fill={`url(#${gold})`}
      />
      <ellipse
        cx="18.5"
        cy="11.5"
        rx="7.5"
        ry="4.6"
        fill="#ffffff"
        opacity="0.3"
        transform="rotate(-24 18.5 11.5)"
      />
      {/* Pallone */}
      <circle cx="24" cy="19" r="8.2" fill="#ffffff" />
      <path
        d="M24 13.6l3.6 2.6-1.4 4.2h-4.4l-1.4-4.2z M15.9 19.2l2.7-.4 1.3 3.9-2 2.4 M32.1 19.2l-2.7-.4-1.3 3.9 2 2.4"
        fill="none"
        stroke="#b07d00"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
