import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-border bg-[#F6F6F6]/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Disclaimer */}
        <p className="text-[11px] leading-relaxed text-neutral-400 max-w-xl">
          <span className="font-semibold text-neutral-500">Disclaimer:</span>{' '}
          MEA Flight Swap is an independent, community-built tool and is not affiliated with,
          endorsed by, or sponsored by Middle East Airlines (MEA). All roster data is user-submitted.
          Pilots are solely responsible for verifying schedule changes and ensuring all flight swaps
          comply with official company policies and aviation regulations.
        </p>

        {/* Branding + Support */}
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-[11px] font-heading font-bold text-neutral-400 tracking-widest uppercase">
            JAXI
          </span>
          <span className="text-neutral-300 text-xs">·</span>
          <a
            href="mailto:jad.aloueini@outlook.com"
            className="text-[11px] font-medium text-neutral-400 hover:text-primary transition-colors"
          >
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
