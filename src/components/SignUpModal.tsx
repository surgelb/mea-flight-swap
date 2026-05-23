'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle, AlertCircle, Loader, Lock, Eye, EyeOff, ShieldCheck, User } from 'lucide-react';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { db, FlightDuty, PilotProfile } from '@/lib/db';
import { supabase, hasSupabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signup' | 'login';
}

const PARSING_STEPS = [
  "Reading MEA Crew Schedule report...",
  "Running PDF parser engine...",
  "Calling Gemini 3.5 Flash to extract pilot info...",
  "Extracting pilot name, base, rank, and aircraft ratings...",
  "Generating lowercase MEA format username...",
  "Preloading calendar duties..."
];

export default function SignUpModal({ isOpen, onClose, initialMode = 'signup' }: SignUpModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [step, setStep] = useState<1 | 2>(1);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'parsing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsed metadata from Screen 1 to pass to Screen 2
  const [parsedData, setParsedData] = useState<{
    pilot_metadata: {
      first_name: string;
      last_name: string;
      name: string;
      id: string;
      rank: 'captain' | 'first_officer';
      base: string;
      qualifications: string[];
      username: string;
      email: string;
    };
    duties: Partial<FlightDuty>[];
  } | null>(null);

  // Screen 2 (Signup Form) State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleReset = () => {
    setStep(1);
    setStatus('idle');
    setErrorMessage('');
    setParsedData(null);
    setPassword('');
    setConfirmPassword('');
    setFormError('');
    setLoginIdentifier('');
    setLoginPassword('');
    setLoginError('');
    setIsLoggingIn(false);
  };

  // Sync mode state when the modal opens with a specific mode
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setMode(initialMode);
        handleReset();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialMode]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const processFile = async (file: File) => {
    // Only accept PDF schedules
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setStatus('error');
      setErrorMessage('Invalid file format. Please upload a Middle East Airlines PDF schedule.');
      return;
    }

    setStatus('uploading');
    setErrorMessage('');
    setCurrentStepIndex(0);

    const formData = new FormData();
    formData.append('file', file);

    // Start parsing step progression animation
    let stepInterval: NodeJS.Timeout;
    const startStepAnimation = () => {
      setStatus('parsing');
      stepInterval = setInterval(() => {
        setCurrentStepIndex(prev => {
          if (prev < PARSING_STEPS.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 800);
    };

    try {
      // Small simulated latency before starting Gemini processing
      await new Promise(resolve => setTimeout(resolve, 500));
      startStepAnimation();
      
      const response = await fetch('/api/auth/register-roster', {
        method: 'POST',
        body: formData
      });

      if (stepInterval!) clearInterval(stepInterval);

      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to parse the roster file.');
      }

      setParsedData(data);
      setStatus('success');
      
      // Brief success pause, then progress to Screen 2
      setTimeout(() => {
        setStep(2);
      }, 1200);

    } catch (err) {
      if (stepInterval!) clearInterval(stepInterval);
      setStatus('error');
      const errMsg = err instanceof Error ? err.message : 'An error occurred during schedule processing.';
      setErrorMessage(errMsg);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedData) return;

    // Client-side validations
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    const meta = parsedData.pilot_metadata;

    try {
      let finalPilotId = `mock-${meta.username}`;

      if (hasSupabase) {
        // Query if profile with this email already exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', meta.email)
          .maybeSingle();

        // Sign up with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: meta.email,
          password: password,
          options: {
            data: {
              name: meta.name,
              username: meta.username,
              rank: meta.rank,
              base: meta.base,
              qualifications: meta.qualifications
            }
          }
        });

        if (authError) {
          throw authError;
        }

        if (authData.user?.id) {
          finalPilotId = authData.user.id;
        }

        // If the email already exists in profiles table under a different ID, delete the old profile to avoid 409 conflict
        if (existingProfile && existingProfile.id !== finalPilotId) {
          console.log(`[SignUp] Email ${meta.email} already exists with ID ${existingProfile.id}. Deleting old profile for new signup...`);
          await db.deleteProfile(existingProfile.id);
          db.clearFlightsForPilot(existingProfile.id);
        }
      }

      // 1. Create pilot profile
      const newPilotProfile: PilotProfile = {
        id: finalPilotId,
        email: meta.email,
        name: meta.name,
        username: meta.username,
        rank: meta.rank,
        base: meta.base,
        qualifications: meta.qualifications
      };

      // 2. Map duties to local/Postgres DB schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsedDuties: FlightDuty[] = parsedData.duties.map((duty: any, index: number) => ({
        id: `f-parsed-${finalPilotId}-${index}-${Date.now()}`,
        pilot_id: finalPilotId,
        duty_type: duty.duty_type,
        flight_number: duty.flight_number || null,
        origin: duty.origin || null,
        destination: duty.destination || null,
        departure_time: duty.departure_time || null,
        arrival_time: duty.arrival_time || null,
        reporting_time: duty.reporting_time || (duty.departure_time ? new Date(new Date(duty.departure_time).getTime() - 60 * 60 * 1000).toISOString() : null),
        release_time: duty.release_time || (duty.arrival_time ? new Date(new Date(duty.arrival_time).getTime() + 30 * 60 * 1000).toISOString() : null),
        block_time_mins: duty.block_time_mins || null,
        aircraft_type: duty.aircraft_type || null,
        day_number: duty.day_number || (duty.departure_time ? new Date(duty.departure_time).getDate() : 1)
      }));

      // 3. Save to database (localStorage sync and Supabase writes occur within DB helpers)
      db.updateProfile(newPilotProfile);
      db.saveFlights(parsedDuties);
      db.setCurrentPilotId(finalPilotId);

      // Successful Registration Transition
      setIsSubmitting(false);
      onClose();
      router.push('/dashboard');
    } catch (err) {
      console.error('[Register Password Form] error:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to complete registration.';
      setFormError(errMsg);
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier || !loginPassword) {
      setLoginError('Please enter both your username/email and password.');
      return;
    }

    setLoginError('');
    setIsLoggingIn(true);

    // Compute email representation if user entered username
    const computedEmail = loginIdentifier.includes('@')
      ? loginIdentifier
      : `${loginIdentifier.trim()}@mea.com.lb`;

    try {
      let loggedIn = false;
      let finalPilotId = '';
      let supabaseErrorMsg = '';

      if (hasSupabase) {
        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: computedEmail,
            password: loginPassword,
          });

          if (!authError && authData?.user) {
            finalPilotId = authData.user.id;
            
            // Load user profile from profiles table
            let profileData: PilotProfile | null = null;
            const { data: maybeProfile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', finalPilotId)
              .maybeSingle();

            if (!profileError && maybeProfile) {
              profileData = maybeProfile;
            } else {
              console.warn('Profile not found in profiles table, reconstructing from user metadata:', profileError);
              const metadata = authData.user.user_metadata || {};
              const email = authData.user.email || computedEmail;
              const fallbackUsername = email.split('@')[0];
              const fallbackName = fallbackUsername.replace(/[._]/g, ' ').toUpperCase();
              
              profileData = {
                id: finalPilotId,
                email: email,
                name: metadata.name || fallbackName || 'Unknown Pilot',
                username: metadata.username || fallbackUsername,
                rank: (metadata.rank === 'captain' || metadata.rank === 'first_officer') ? metadata.rank : 'first_officer',
                base: metadata.base || 'BEY',
                qualifications: metadata.qualifications || []
              };

              // Recreate/upsert the missing profile row in Supabase
              try {
                const { username: _username, ...supabaseProfileData } = profileData;
                void _username;
                const { error: upsertError } = await supabase
                  .from('profiles')
                  .upsert(supabaseProfileData);
                if (upsertError) {
                  console.error('Failed to upsert reconstructed profile to Supabase:', upsertError);
                }
              } catch (upsertErr) {
                console.error('Exception during upsert of reconstructed profile:', upsertErr);
              }
            }

            if (profileData) {
              db.updateProfile(profileData);
            }

            // Load flight duties
            const { data: flightsData, error: flightsError } = await supabase
              .from('schedules')
              .select('*')
              .eq('user_id', finalPilotId);

            if (!flightsError && flightsData) {
              const mappedFlights = flightsData.map(f => ({ ...f, pilot_id: f.user_id }));
              db.saveFlights(mappedFlights);
            }

            db.setCurrentPilotId(finalPilotId);
            loggedIn = true;
          } else {
            console.warn('Supabase signInWithPassword failed:', authError);
            supabaseErrorMsg = authError?.message || 'Authentication failed.';
          }
        } catch (supabaseErr) {
          console.warn('Supabase authentication error:', supabaseErr);
          supabaseErrorMsg = supabaseErr instanceof Error ? supabaseErr.message : 'Supabase connection error.';
        }
      }

      if (!loggedIn) {
        if (hasSupabase) {
          throw new Error(supabaseErrorMsg || 'Invalid credentials or user does not exist.');
        }

        // Fallback offline Mock Auth (only used when hasSupabase is false)
        const profiles = db.getProfiles();
        const pilot = profiles.find(p => {
          if (!p) return false;
          const u = (p.username || '').toLowerCase();
          const e = (p.email || '').toLowerCase();
          const target = (loginIdentifier || '').toLowerCase();
          return u === target || e === target;
        });
        
        if (pilot) {
          if (loginPassword.length < 8) {
            throw new Error('Password must be at least 8 characters long.');
          }
          db.setCurrentPilotId(pilot.id);
          loggedIn = true;
        } else {
          throw new Error('Invalid credentials or pilot profile not found.');
        }
      }

      setIsLoggingIn(false);
      onClose();
      router.push('/dashboard');
    } catch (err) {
      console.error('[Login Form] error:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to log in.';
      setLoginError(errMsg);
      setIsLoggingIn(false);
    }
  };



  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => {
        handleReset();
        onClose();
      }} 
      title={
        mode === 'login' 
          ? "Log In to Account" 
          : step === 1 
            ? "Sign Up via Roster Upload" 
            : "Complete Registration"
      }
    >
      <AnimatePresence mode="wait">
        {mode === 'login' ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4 font-sans text-neutral-800"
          >
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <p className="text-xs text-neutral-500 mb-2 leading-relaxed font-sans">
                Log in using your official MEA username (e.g. <code className="font-mono bg-neutral-100 px-1 py-0.5 rounded text-neutral-700">n.moghabghab</code>) or company email and your password.
              </p>

              <div className="space-y-3">
                {/* Username / Email field */}
                <div>
                  <label className="block text-xs font-heading font-bold text-neutral-600 mb-1">
                    MEA Username or Email
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                      <User size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm font-sans text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      placeholder="e.g. n.moghabghab"
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label className="block text-xs font-heading font-bold text-neutral-600 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                      <Lock size={16} />
                    </span>
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-white border border-border rounded-xl text-sm font-sans text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {loginError && (
                <div className="flex items-start gap-2 bg-red-50 text-red-600 border border-red-200/50 rounded-xl p-3 text-xs leading-normal">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-xs text-neutral-500 hover:text-primary transition-colors cursor-pointer"
                >
                  New crew? <span className="font-bold text-primary">Upload roster</span>
                </button>
                
                <Button variant="cta" size="md" type="submit" disabled={isLoggingIn} className="glow-cta">
                  {isLoggingIn ? (
                    <>
                      <Loader className="animate-spin mr-2 shrink-0" size={16} />
                      Logging In...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2" size={16} />
                      Log In
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        ) : step === 1 ? (
          <motion.div
            key="screen1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            <p className="text-xs text-neutral-500 mb-2 leading-relaxed font-sans">
              Middle East Airlines pilots can onboard instantly by uploading their official crew roster PDF. Gemini AI will securely verify your credentials and configure your flight schedule.
            </p>

            <form 
              onDragEnter={handleDrag} 
              onSubmit={(e) => e.preventDefault()}
              className="relative"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={handleChange}
              />

              <AnimatePresence mode="wait">
                {status === 'idle' && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onClick={triggerFileInput}
                    className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                      dragActive 
                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10 scale-[1.01]' 
                        : 'border-neutral-300 hover:border-primary hover:bg-primary/5 bg-white/40 backdrop-blur-md'
                    }`}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                  >
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                      className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4"
                    >
                      <UploadCloud size={32} />
                    </motion.div>
                    <h4 className="text-md font-heading font-semibold text-neutral-800 mb-1">
                      Drag & Drop MEA Crew Roster PDF
                    </h4>
                    <p className="text-xs text-neutral-400 text-center max-w-sm mb-4">
                      Supports only official MEA crew roster .pdf schedules.
                    </p>
                    <Button variant="primary" size="sm" type="button" className="pointer-events-none">
                      Browse Files
                    </Button>
                  </motion.div>
                )}

                {(status === 'uploading' || status === 'parsing') && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="border border-border bg-white/80 backdrop-blur-md rounded-3xl p-8 flex flex-col items-center justify-center min-h-[220px]"
                  >
                    <Loader className="animate-spin text-cta mb-4" size={36} />
                    <h4 className="text-md font-heading font-semibold text-neutral-800 mb-2">
                      {status === 'uploading' ? 'Uploading file...' : 'Gemini AI Processing...'}
                    </h4>
                    <div className="w-full max-w-xs bg-cta/10 h-1.5 rounded-full overflow-hidden mb-4">
                      <motion.div
                        className="bg-cta h-full"
                        initial={{ width: "0%" }}
                        animate={{ 
                          width: status === 'uploading' ? '30%' : '95%'
                        }}
                        transition={{ duration: status === 'uploading' ? 0.8 : 4 }}
                      />
                    </div>
                    <p className="text-xs text-neutral-500 text-center max-w-xs italic min-h-[32px] transition-all duration-300">
                      {PARSING_STEPS[currentStepIndex]}
                    </p>
                  </motion.div>
                )}

                {status === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="border-2 border-emerald-400 bg-emerald-50/50 backdrop-blur-md rounded-3xl p-8 flex flex-col items-center justify-center min-h-[220px]"
                  >
                    <CheckCircle className="text-emerald-500 mb-3" size={44} />
                    <h4 className="text-md font-heading font-semibold text-neutral-800 mb-1">
                      Roster Parsed & Verified!
                    </h4>
                    <p className="text-xs text-neutral-500 text-center max-w-xs">
                      Identity verified. Advancing to password verification...
                    </p>
                  </motion.div>
                )}

                {status === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="border-2 border-red-300 bg-red-50/50 backdrop-blur-md rounded-3xl p-8 flex flex-col items-center justify-center min-h-[220px]"
                  >
                    <AlertCircle className="text-red-500 mb-3" size={44} />
                    <h4 className="text-md font-heading font-semibold text-neutral-800 mb-1">
                      Verification Failed
                    </h4>
                    <p className="text-xs text-red-600 text-center max-w-sm mb-4 leading-normal">
                      {errorMessage}
                    </p>
                    <Button variant="outline" size="sm" type="button" onClick={() => setStatus('idle')}>
                      Try Again
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>

            {status === 'idle' && (
              <div className="text-center pt-4 border-t border-border mt-4">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-neutral-500 hover:text-primary transition-colors cursor-pointer"
                >
                  Already have an account? <span className="font-bold text-primary">Log In</span>
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="screen2"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            {parsedData && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4 font-sans text-neutral-800">
                {/* Meta details confirmation summary */}
                <div className="bg-neutral-50 border border-border rounded-2xl p-4 space-y-2">
                  <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider">
                    {parsedData.pilot_metadata.rank === 'captain' ? 'Captain' : 'First Officer'}
                  </span>
                  
                  <div className="space-y-1">
                    <h4 className="text-sm font-heading font-bold text-neutral-800">
                      {parsedData.pilot_metadata.name}
                    </h4>
                    <p className="text-xs text-neutral-500">
                      Base: <span className="font-semibold">{parsedData.pilot_metadata.base}</span> • Ratings: <span className="font-semibold">{parsedData.pilot_metadata.qualifications?.join(', ') || 'N/A'}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                    <div>
                      <span className="text-[10px] text-neutral-400 block">GENERATED USERNAME</span>
                      <span className="text-xs font-mono font-bold text-neutral-700">{parsedData.pilot_metadata.username}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block">MEA COMPANY EMAIL</span>
                      <span className="text-xs font-mono font-bold text-neutral-700">{parsedData.pilot_metadata.email}</span>
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <div className="space-y-3">
                  {/* Password field */}
                  <div>
                    <label className="block text-xs font-heading font-bold text-neutral-600 mb-1">
                      Choose Password (min. 8 characters)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                        <Lock size={16} />
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 bg-white border border-border rounded-xl text-sm font-sans text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password field */}
                  <div>
                    <label className="block text-xs font-heading font-bold text-neutral-600 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
                        <Lock size={16} />
                      </span>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 bg-white border border-border rounded-xl text-sm font-sans text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {formError && (
                  <div className="flex items-start gap-2 bg-red-50 text-red-600 border border-red-200/50 rounded-xl p-3 text-xs leading-normal">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" type="button" onClick={handleReset} disabled={isSubmitting}>
                    Back
                  </Button>
                  <Button variant="cta" size="md" type="submit" disabled={isSubmitting} className="glow-cta">
                    {isSubmitting ? (
                      <>
                        <Loader className="animate-spin mr-2 shrink-0" size={16} />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-2" size={16} />
                        Complete Registration
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

