import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: [
    "pdf-parse",
    "pdf-parse/worker",
    "pdfjs-dist",
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    "pdfjs-dist/legacy/build/pdf.mjs"
  ],
};

export default nextConfig;

