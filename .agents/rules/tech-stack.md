# Tech Stack Configuration
* Project Name: MEA Flight Swap
* Frontend: Next.js (App Router), Tailwind CSS, Shadcn UI deployed to Vercel.
* Backend: Supabase Postgres, Supabase Auth, and Edge Functions.
* Python/Node Parser: Hybrid approach leveraging `pdf-parse` for text extraction and Gemini 3.5 Flash for JSON structuring.
* Aviation Rules: Restrict swap matching strictly by identical aircraft tags and exact rank equality (First Officer to First Officer).