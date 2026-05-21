'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PlaneTakeoff, ShieldCheck, ArrowRightLeft, Users } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SignUpModal from '@/components/SignUpModal';
import { db } from '@/lib/db';

export default function Home() {
  const router = useRouter();
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signup' | 'login'>('signup');

  const handleEnterAs = (pilotId: string) => {
    db.setCurrentPilotId(pilotId);
    router.push('/dashboard');
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
      {/* Visual Accent Glows in Background */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cta/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-2xl relative z-10 space-y-8 text-center"
      >
        {/* Branding Title */}
        <div className="flex flex-col items-center">
          <motion.div 
            whileHover={{ rotate: [0, -5, 5, 0] }}
            className="w-16 h-16 bg-gradient-to-tr from-primary to-cta rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pink-500/20 mb-4"
          >
            <PlaneTakeoff size={30} />
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold tracking-tight text-neutral-800">
            MEA <span className="text-primary">Flight</span> Swap
          </h1>
          <p className="text-sm font-sans font-medium text-neutral-500 mt-2 tracking-wide uppercase">
            Middle East Airlines Crew Exchange
          </p>
        </div>

        {/* Core Value Proposition Card */}
        <Card className="text-left md:p-8 max-w-xl mx-auto" hoverEffect={false}>
          <h2 className="text-lg font-heading font-bold text-neutral-800 mb-4 text-center border-b border-amber-200/50 pb-3">
            Minimalist Flight Roster Swapping
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
            <div className="flex flex-col items-center text-center p-2">
              <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center text-primary mb-2">
                <ArrowRightLeft size={18} />
              </div>
              <h3 className="text-xs font-heading font-bold text-neutral-800 mb-1">Upload PDF</h3>
              <p className="text-[11px] text-neutral-500 leading-snug">
                Gemini Flash parses the grid duties automatically.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-2">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-cta mb-2">
                <ShieldCheck size={18} />
              </div>
              <h3 className="text-xs font-heading font-bold text-neutral-800 mb-1">FTL Safety Check</h3>
              <p className="text-[11px] text-neutral-500 leading-snug">
                Verified rest period compliance in real-time.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-2">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 mb-2">
                <Users size={18} />
              </div>
              <h3 className="text-xs font-heading font-bold text-neutral-800 mb-1">Instant Trade</h3>
              <p className="text-[11px] text-neutral-500 leading-snug">
                Direct realtime coordination for fast approvals.
              </p>
            </div>
          </div>
        </Card>

        {/* Action Portal */}
        <div className="space-y-6 max-w-md mx-auto">
          {/* Sign Up / Login via Roster Box */}
          <div className="bg-white/60 backdrop-blur-md border border-amber-200 rounded-3xl p-6 shadow-md text-center space-y-4">
            <h3 className="text-sm font-heading font-bold text-neutral-800">
              MEA Flight Swap Portal
            </h3>
            <p className="text-xs text-neutral-500 leading-normal">
              Onboard instantly by uploading your roster PDF, or log in to manage your active swap postings.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="cta"
                onClick={() => {
                  setAuthModalMode('signup');
                  setIsSignUpOpen(true);
                }}
                className="w-full justify-center"
              >
                Sign Up via Roster Upload
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAuthModalMode('login');
                  setIsSignUpOpen(true);
                }}
                className="w-full justify-center border-primary/40 text-primary hover:bg-pink-500/5 hover:border-primary glow-primary"
              >
                Log In to Account
              </Button>
            </div>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-neutral-300"></div>
            <span className="flex-shrink mx-4 text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Or Enter Demo Persona</span>
            <div className="flex-grow border-t border-neutral-300"></div>
          </div>

          {/* Pilot Select Portal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleEnterAs('naim-id')}
              className="group p-5 bg-white/70 hover:bg-white border border-amber-200 hover:border-primary rounded-2xl text-left shadow-sm hover:shadow-md transition-all glow-primary cursor-pointer"
            >
              <span className="text-[10px] bg-pink-100 text-primary border border-pink-200 px-2 py-0.5 rounded-md font-semibold uppercase">
                First Officer
              </span>
              <h4 className="text-sm font-heading font-bold text-neutral-800 mt-2 group-hover:text-primary transition-colors">
                N. MOGHABGHAB
              </h4>
              <p className="text-[11px] text-neutral-500 mt-1">
                A320 Fleet • BEY Base
              </p>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleEnterAs('rayan-id')}
              className="group p-5 bg-white/70 hover:bg-white border border-amber-200 hover:border-cta rounded-2xl text-left shadow-sm hover:shadow-md transition-all glow-cta cursor-pointer"
            >
              <span className="text-[10px] bg-violet-100 text-cta border border-violet-200 px-2 py-0.5 rounded-md font-semibold uppercase">
                First Officer
              </span>
              <h4 className="text-sm font-heading font-bold text-neutral-800 mt-2 group-hover:text-cta transition-colors">
                R. MROUEH
              </h4>
              <p className="text-[11px] text-neutral-500 mt-1">
                A320/A321 Fleet • BEY Base
              </p>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Roster Onboarding SignUp Modal */}
      <SignUpModal 
        isOpen={isSignUpOpen} 
        onClose={() => setIsSignUpOpen(false)} 
        initialMode={authModalMode}
      />
    </main>
  );
}
