'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import Button from './ui/Button';
import { db, FlightDuty, PilotProfile } from '@/lib/db';

interface RosterUploadZoneProps {
  onUploadSuccess: (pilotMetadata: PilotProfile) => void;
}

const PARSING_STEPS = [
  "Analyzing Middle East Airlines document structure...",
  "Extracting Pilot Name and Crew ID (Base: BEY, Rank: FO)...",
  "Scanning May 2026 schedule calendar grid columns (Days 1 - 31)...",
  "Resolving flight legs (ME201, ME202, ME310) and Standbys (SB)...",
  "Checking training log details and simulator requirements...",
  "Finalizing FTL compliance baseline calculations..."
];

export default function RosterUploadZone({ onUploadSuccess }: RosterUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'parsing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setStatus('uploading');
    setErrorMessage('');
    setCurrentStepIndex(0);

    const formData = new FormData();
    formData.append('file', file);

    // Start animated steps loop during the parsing phase
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
      }, 700);
    };

    try {
      // Simulate file upload transition, then call API
      await new Promise(resolve => setTimeout(resolve, 800));
      startStepAnimation();
      
      const response = await fetch('/api/parse-roster', {
        method: 'POST',
        body: formData
      });

      if (stepInterval!) clearInterval(stepInterval);

      if (!response.ok) {
        throw new Error('Failed to parse the roster file.');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const currentPilot = db.getCurrentPilot();
      const targetPilotId = currentPilot?.id || data.pilot_metadata.id || `pilot-${Math.random().toString(36).substr(2, 9)}`;

      // Standardize duties array, assign appropriate IDs
      const parsedDuties: FlightDuty[] = data.duties.map((duty: Partial<FlightDuty>, index: number) => {
        const depTime = duty.departure_time || null;
        const arrTime = duty.arrival_time || null;
        const repTime = duty.reporting_time || (depTime ? new Date(new Date(depTime).getTime() - 60 * 60 * 1000).toISOString() : null);
        const relTime = duty.release_time || (arrTime ? new Date(new Date(arrTime).getTime() + 30 * 60 * 1000).toISOString() : null);
        const dayNumber = duty.day_number || (depTime ? new Date(depTime).getDate() : 1);

        return {
          id: `f-parsed-${Date.now()}-${index}`,
          pilot_id: targetPilotId,
          duty_type: duty.duty_type || 'off',
          flight_number: duty.flight_number || null,
          origin: duty.origin || null,
          destination: duty.destination || null,
          departure_time: depTime,
          arrival_time: arrTime,
          reporting_time: repTime,
          release_time: relTime,
          block_time_mins: duty.block_time_mins || null,
          aircraft_type: duty.aircraft_type || null,
          day_number: dayNumber
        };
      });

      // Update pilot profile with extracted details
      const updatedPilot = {
        id: targetPilotId,
        email: currentPilot?.email || `${targetPilotId}@mea.com.lb`,
        username: currentPilot?.username || (data.pilot_metadata.name || 'crew').toLowerCase().replace(/[^a-z0-9]/g, ''),
        name: data.pilot_metadata.name || currentPilot?.name || 'MEA Crew Member',
        rank: data.pilot_metadata.rank || currentPilot?.rank || 'first_officer',
        base: data.pilot_metadata.base || currentPilot?.base || 'BEY',
        qualifications: currentPilot?.qualifications || ['A320', 'A330']
      };

      db.setCurrentPilotId(targetPilotId);
      db.updateProfile(updatedPilot);
      db.saveFlights(parsedDuties);
      
      setStatus('success');
      setTimeout(() => {
        onUploadSuccess(updatedPilot);
        setStatus('idle');
      }, 1500);

    } catch (err) {
      if (stepInterval!) clearInterval(stepInterval);
      setStatus('error');
      const message = err instanceof Error ? err.message : 'An error occurred during schedule processing.';
      setErrorMessage(message);
    }
  };

  return (
    <div className="w-full">
      <form 
        onDragEnter={handleDrag} 
        onSubmit={(e) => e.preventDefault()}
        className="relative"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.txt"
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
              <h4 className="text-lg font-heading font-semibold text-neutral-800 mb-1">
                Upload Your MEA Crew Roster
              </h4>
              <p className="text-sm text-neutral-500 text-center max-w-sm mb-4">
                Drag and drop your PDF Schedule Report here, or click to browse files. Supports PDF documents and screenshots.
              </p>
              <Button variant="primary" size="sm" type="button" className="pointer-events-none">
                Select File
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
              <h4 className="text-lg font-heading font-semibold text-neutral-800 mb-2">
                {status === 'uploading' ? 'Uploading file...' : 'Gemini AI Parsing...'}
              </h4>
              <div className="w-full max-w-xs bg-cta/10 h-1.5 rounded-full overflow-hidden mb-4">
                <motion.div
                  className="bg-cta h-full"
                  initial={{ width: "0%" }}
                  animate={{ 
                    width: status === 'uploading' ? '30%' : '90%'
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
              <h4 className="text-lg font-heading font-semibold text-neutral-800 mb-1">
                Roster Successfully Parsed!
              </h4>
              <p className="text-sm text-neutral-500 text-center max-w-xs">
                Welcome back, Captain/FO! Your duties are now integrated into the swap engine.
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
              <h4 className="text-lg font-heading font-semibold text-neutral-800 mb-1">
                Parsing Failed
              </h4>
              <p className="text-sm text-red-600 text-center max-w-sm mb-4">
                {errorMessage}
              </p>
              <Button variant="outline" size="sm" type="button" onClick={() => setStatus('idle')}>
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
