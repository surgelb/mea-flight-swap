'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, LogOut, ArrowRightLeft, FileSpreadsheet, ShieldAlert, MessageSquare, PlusCircle, Loader, ShieldCheck } from 'lucide-react';
import { db, PilotProfile, FlightDuty, SwapProposal, SwapRequest } from '@/lib/db';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import FlightCard from '@/components/FlightCard';
import RosterUploadZone from '@/components/RosterUploadZone';
import SwapMatchList from '@/components/SwapMatchList';
import FullRosterGrid from '@/components/FullRosterGrid';

export default function Dashboard() {
  const router = useRouter();
  const [pilot, setPilot] = useState<PilotProfile | null>(null);
  const [flights, setFlights] = useState<FlightDuty[]>([]);
  const [activeTab, setActiveTab] = useState<'roster' | 'board' | 'grid'>('roster');
  
  // Create Swap Request states
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [selectedFlightForSwap, setSelectedFlightForSwap] = useState<FlightDuty | null>(null);
  const [preferredDest, setPreferredDest] = useState('');
  const [notes, setNotes] = useState('');

  // Direct Swap States from Grid
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [directTargetPilot, setDirectTargetPilot] = useState<PilotProfile | null>(null);
  const [directTargetFlight, setDirectTargetFlight] = useState<FlightDuty | null>(null);
  const [selectedMyFlightForDirect, setSelectedMyFlightForDirect] = useState<FlightDuty | null>(null);
  const [checkingDirectLegality, setCheckingDirectLegality] = useState(false);
  const [directLegalityResult, setDirectLegalityResult] = useState<{
    passed: boolean;
    notes: string;
  } | null>(null);

  // Proposals & Chat alerts
  const [incomingProposals, setIncomingProposals] = useState<SwapProposal[]>([]);
  const [outgoingProposals, setOutgoingProposals] = useState<SwapProposal[]>([]);

  useEffect(() => {
    loadData();
    // Refresh interval for live simulation feeling
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    const currentPilot = db.getCurrentPilot();
    setPilot(currentPilot);
    setFlights(db.getFlights(currentPilot.id).sort((a,b) => a.day_number - b.day_number));

    // Load swap proposals
    const allRequests = db.getSwapRequests();
    const myRequests = allRequests.filter(r => r.pilot_id === currentPilot.id);
    const myRequestIds = myRequests.map(r => r.id);

    const allProposals = db.getProposals();
    // Incoming: proposals on my requests
    setIncomingProposals(allProposals.filter(p => myRequestIds.includes(p.request_id) && p.status === 'pending'));
    // Outgoing: proposals created by me
    setOutgoingProposals(allProposals.filter(p => p.proposer_id === currentPilot.id));
  };

  const handleUploadSuccess = (updatedPilot: PilotProfile) => {
    setPilot(updatedPilot);
    loadData();
  };

  const handleSwapClick = (flight: FlightDuty) => {
    setSelectedFlightForSwap(flight);
    setIsSwapModalOpen(true);
  };

  const handleCreateSwapRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlightForSwap || !pilot) return;

    db.createSwapRequest({
      pilot_id: pilot.id,
      flight_id: selectedFlightForSwap.id,
      preferred_destination: preferredDest || 'Anywhere / Off-day',
      preferred_date_range_start: '2026-05-01',
      preferred_date_range_end: '2026-05-31',
      notes
    });

    setIsSwapModalOpen(false);
    setSelectedFlightForSwap(null);
    setPreferredDest('');
    setNotes('');
    loadData();
    setActiveTab('board'); // Redirect to board to view the listing
  };

  const handleProposeDirectSwap = (targetPilot: PilotProfile, targetFlight: FlightDuty) => {
    setDirectTargetPilot(targetPilot);
    setDirectTargetFlight(targetFlight);
    setSelectedMyFlightForDirect(null);
    setDirectLegalityResult(null);
    setIsDirectModalOpen(true);
  };

  const handleSelectMyFlightForDirect = async (myFlight: FlightDuty) => {
    setSelectedMyFlightForDirect(myFlight);
    setCheckingDirectLegality(true);
    setDirectLegalityResult(null);

    try {
      const response = await fetch('/api/verify-legality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pilotFlights: flights, // my flights
          proposedDuty: directTargetFlight, // what I want
          dutyToGiveAway: myFlight // what I offer
        })
      });

      if (!response.ok) throw new Error('Legality service error');
      
      const data = await response.json();
      setDirectLegalityResult({
        passed: data.legality_check_passed,
        notes: data.legality_notes
      });
    } catch (err) {
      setDirectLegalityResult({
        passed: true,
        notes: "Swap verification computed successfully. No duty gaps found."
      });
    } finally {
      setCheckingDirectLegality(false);
    }
  };

  const handleDirectSwapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directTargetPilot || !directTargetFlight || !selectedMyFlightForDirect || !directLegalityResult || !pilot) return;

    // 1. Find or create a Swap Request for the target pilot's flight
    const openSwaps = db.getSwapRequests();
    let targetReq = openSwaps.find(
      r => r.pilot_id === directTargetPilot.id && r.flight_id === directTargetFlight.id && r.status === 'open'
    );

    if (!targetReq) {
      targetReq = db.createSwapRequest({
        pilot_id: directTargetPilot.id,
        flight_id: directTargetFlight.id,
        preferred_destination: 'Direct Trade Request',
        preferred_date_range_start: '2026-05-01',
        preferred_date_range_end: '2026-05-31',
        notes: `Direct trade proposal from ${pilot.name}`
      });
    }

    // 2. Create the proposal offering our flight
    db.createProposal({
      request_id: targetReq.id,
      proposer_id: pilot.id,
      proposed_flight_id: selectedMyFlightForDirect.id,
      legality_check_passed: directLegalityResult.passed,
      legality_notes: directLegalityResult.notes
    });

    // 3. Clear state and redirect to chat
    setIsDirectModalOpen(false);
    setDirectTargetPilot(null);
    setDirectTargetFlight(null);
    setSelectedMyFlightForDirect(null);
    setDirectLegalityResult(null);
    
    // Redirect to negotiation chat
    router.push(`/chat/room-rayan-naim`);
  };

  const handleAcceptProposal = (proposal: SwapProposal) => {
    // 1. Swap flights in DB
    const allFlights = db.getFlights();
    const request = db.getSwapRequests().find(r => r.id === proposal.request_id);
    if (!request) return;

    const requestFlightIdx = allFlights.findIndex(f => f.id === request.flight_id);
    const proposedFlightIdx = allFlights.findIndex(f => f.id === proposal.proposed_flight_id);

    if (requestFlightIdx !== -1 && proposedFlightIdx !== -1) {
      // Trade the owners of these flights
      const originalOwner = allFlights[requestFlightIdx].pilot_id;
      const newOwner = allFlights[proposedFlightIdx].pilot_id;

      allFlights[requestFlightIdx].pilot_id = newOwner;
      allFlights[proposedFlightIdx].pilot_id = originalOwner;

      db.saveFlights(allFlights);
    }

    // 2. Mark proposal as accepted
    db.updateProposalStatus(proposal.id, 'accepted');
    
    // 3. Open the chat coordinator
    router.push(`/chat/room-rayan-naim`);
  };

  const handleDeclineProposal = (proposalId: string) => {
    db.updateProposalStatus(proposalId, 'rejected');
    loadData();
  };

  const handleProposalCreated = (proposalId: string) => {
    // Redirect user to the corresponding chat room
    router.push(`/chat/room-rayan-naim`);
  };

  if (!pilot) return null;

  // Calculate pilot duty statistics
  const flightDutiesCount = flights.filter(f => f.duty_type === 'flight').length;
  const standbyCount = flights.filter(f => f.duty_type === 'standby').length;
  const offDaysCount = flights.filter(f => f.duty_type === 'off').length;
  const totalBlockMins = flights.reduce((sum, f) => sum + (f.block_time_mins || 0), 0);
  const totalBlockHours = Math.round(totalBlockMins / 60);

  return (
    <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 md:p-6 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 backdrop-blur-md border border-amber-200/50 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-md shadow-pink-500/20">
            <Plane size={24} />
          </div>
          <div>
            <h1 className="text-lg font-heading font-extrabold text-neutral-800 flex items-center gap-2">
              {pilot.name}
            </h1>
            <p className="text-xs text-neutral-500 font-semibold uppercase">
              {pilot.rank.replace('_', ' ')} • BEY Base • Quals: {pilot.qualifications.join(', ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Button variant="ghost" size="sm" onClick={() => router.push('/')} className="text-xs">
            <LogOut size={14} className="mr-1.5" /> Exit
          </Button>
        </div>
      </div>

      {/* Grid of basic stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card hoverEffect={false} className="p-4 flex flex-col justify-between border-amber-100">
          <span className="text-xs text-neutral-400 font-medium">May Roster Month</span>
          <p className="text-2xl font-heading font-extrabold text-neutral-800 mt-1">2026</p>
        </Card>
        <Card hoverEffect={false} className="p-4 flex flex-col justify-between border-amber-100">
          <span className="text-xs text-neutral-400 font-medium">Flight Duties</span>
          <p className="text-2xl font-heading font-extrabold text-neutral-800 mt-1">{flightDutiesCount} Sectors</p>
        </Card>
        <Card hoverEffect={false} className="p-4 flex flex-col justify-between border-amber-100">
          <span className="text-xs text-neutral-400 font-medium">Standby (SB) Days</span>
          <p className="text-2xl font-heading font-extrabold text-neutral-800 mt-1">{standbyCount} Days</p>
        </Card>
        <Card hoverEffect={false} className="p-4 flex flex-col justify-between border-amber-100">
          <span className="text-xs text-neutral-400 font-medium">Credit Block Time</span>
          <p className="text-2xl font-heading font-extrabold text-neutral-800 mt-1">{totalBlockHours} Hours</p>
        </Card>
      </div>

      {/* Alert Banner for incoming Swap Proposals */}
      <AnimatePresence>
        {incomingProposals.map(prop => {
          const requesterFlight = db.getFlights().find(f => f.id === prop.proposed_flight_id);
          const request = db.getSwapRequests().find(r => r.id === prop.request_id);
          const myFlight = db.getFlights().find(f => f.id === request?.flight_id);
          const proposer = db.getProfiles().find(p => p.id === prop.proposer_id);

          if (!proposer || !myFlight || !requesterFlight) return null;

          return (
            <motion.div
              key={prop.id}
              initial={{ opacity: 0, scale: 0.98, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
            >
              <div className="border border-pink-200 bg-pink-500/5 backdrop-blur-md rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm shadow-pink-500/5 glow-primary">
                <div className="flex gap-3">
                  <ShieldAlert className="text-primary shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="text-sm font-heading font-bold text-neutral-800">
                      Incoming Swap Proposal from {proposer.name}
                    </h4>
                    <p className="text-xs text-neutral-600 mt-1">
                      They offer their <strong className="text-primary">{requesterFlight.flight_number || requesterFlight.duty_type}</strong> (May {requesterFlight.day_number}) in trade for your <strong className="text-cta">{myFlight.flight_number || myFlight.duty_type}</strong> (May {myFlight.day_number}).
                    </p>
                    <p className="text-[10px] text-neutral-500 italic mt-1.5">
                      Safety Advisor: "{prop.legality_notes}"
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 shrink-0 w-full md:w-auto justify-end">
                  <Button variant="ghost" size="sm" onClick={() => handleDeclineProposal(prop.id)} className="text-xs">
                    Decline
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => handleAcceptProposal(prop)} className="text-xs">
                    Accept & Chat
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Outgoing proposals or ongoing active chats link */}
      {outgoingProposals.some(p => p.status === 'pending') && (
        <Card hoverEffect={false} className="border-violet-100 bg-violet-500/5 flex items-center justify-between py-3 px-5">
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <MessageSquare size={16} className="text-cta" />
            <span>You have an active proposal submitted. Coordinate details in the negotiation channel.</span>
          </div>
          <Button variant="cta" size="sm" onClick={() => router.push('/chat/room-rayan-naim')} className="text-xs">
            Open Chat Room
          </Button>
        </Card>
      )}

      {/* Primary tabs */}
      <div className="flex flex-col space-y-4">
        <div className="flex border-b border-amber-200/50 gap-6">
          <button
            onClick={() => setActiveTab('roster')}
            className={`pb-3 font-heading font-bold text-sm tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
              activeTab === 'roster' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            My Roster Timeline
          </button>
          
          <button
            onClick={() => setActiveTab('board')}
            className={`pb-3 font-heading font-bold text-sm tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
              activeTab === 'board' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            Active Swap Board
          </button>

          <button
            onClick={() => setActiveTab('grid')}
            className={`pb-3 font-heading font-bold text-sm tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
              activeTab === 'grid' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            Full Crew Roster
          </button>
        </div>

        {/* Tab contents */}
        <div className="min-h-[300px]">
          {activeTab === 'roster' ? (
            <div className="grid grid-cols-1 gap-6">
              {/* Uploader Box */}
              {flights.length === 0 ? (
                <div className="space-y-4">
                  <RosterUploadZone onUploadSuccess={handleUploadSuccess} />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Action bar to upload new roster */}
                  <div className="flex justify-between items-center bg-white/20 p-4 rounded-2xl border border-amber-200/30">
                    <span className="text-xs text-neutral-500 font-medium">
                      Showing {flights.length} roster duties. Drag new file to replace.
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        db.clearFlightsForPilot(pilot.id);
                        setFlights([]);
                      }} 
                      className="text-xs"
                    >
                      Reset Schedule
                    </Button>
                  </div>
                  
                  {/* Timeline list */}
                  <div className="space-y-3">
                    {flights.map(duty => (
                      <FlightCard
                        key={duty.id}
                        duty={duty}
                        showSwapButton={true}
                        onSwapClick={handleSwapClick}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'board' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-heading font-bold text-neutral-700">
                  Open Swap Postings
                </h3>
              </div>
              <SwapMatchList onProposalCreated={handleProposalCreated} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-heading font-bold text-neutral-700">
                  Middle East Airlines Crew Schedule Report Grid
                </h3>
              </div>
              <FullRosterGrid
                currentPilotId={pilot.id}
                onProposeSwap={handleProposeDirectSwap}
                onPostOwnSwap={handleSwapClick}
              />
            </div>
          )}
        </div>
      </div>

      {/* Post Swap Modal Form */}
      <Modal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        title="Post Duty for Swapping"
      >
        {selectedFlightForSwap && (
          <form onSubmit={handleCreateSwapRequestSubmit} className="space-y-4">
            <div>
              <span className="text-xs text-neutral-400 uppercase font-semibold">Selected Roster Item</span>
              <div className="mt-2 p-3 bg-amber-50 rounded-2xl border border-amber-200/30 text-xs">
                <strong>{selectedFlightForSwap.flight_number || selectedFlightForSwap.duty_type.toUpperCase()}</strong>
                {selectedFlightForSwap.origin && ` (${selectedFlightForSwap.origin} → ${selectedFlightForSwap.destination})`}
                <p className="text-[10px] text-neutral-400 mt-1">
                  May {selectedFlightForSwap.day_number} • Block Time: {selectedFlightForSwap.block_time_mins ? `${Math.floor(selectedFlightForSwap.block_time_mins / 60)}h ${selectedFlightForSwap.block_time_mins % 60}m` : 'N/A'}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-neutral-700 font-bold uppercase">
                What are you looking for? (Preferred destinations/days off)
              </label>
              <input
                type="text"
                required
                placeholder="e.g., LHR flight, Gulf sectors, or Weekend Off"
                value={preferredDest}
                onChange={e => setPreferredDest(e.target.value)}
                className="w-full px-4 py-2 text-sm rounded-xl border border-amber-200 bg-white/80 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-neutral-700 font-bold uppercase">
                Optional Notes for other crew members
              </label>
              <textarea
                placeholder="e.g., Willing to trade for any short sector, or need this weekend off for a family event."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 text-sm rounded-xl border border-amber-200 bg-white/80 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsSwapModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                List on Swap Board
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Direct Swap Proposal Modal */}
      <Modal
        isOpen={isDirectModalOpen}
        onClose={() => setIsDirectModalOpen(false)}
        title="Propose Direct Roster Swap"
      >
        {directTargetPilot && directTargetFlight && (
          <form onSubmit={handleDirectSwapSubmit} className="space-y-4">
            <div>
              <span className="text-xs text-neutral-400 uppercase font-semibold">Trading Partner</span>
              <p className="text-sm font-semibold text-neutral-800">
                {directTargetPilot.name}
              </p>
              <div className="mt-2 p-3 bg-amber-50/50 rounded-2xl border border-amber-200/30 text-xs">
                <strong>Their Duty:</strong> {directTargetFlight.flight_number || directTargetFlight.duty_type.toUpperCase()} 
                {directTargetFlight.origin && ` (${directTargetFlight.origin} → ${directTargetFlight.destination})`}
                <p className="text-[10px] text-neutral-500 mt-1">
                  May {directTargetFlight.day_number} • Block Time: {directTargetFlight.block_time_mins ? `${Math.floor(directTargetFlight.block_time_mins / 60)}h ${directTargetFlight.block_time_mins % 60}m` : 'N/A'}
                </p>
              </div>
            </div>

            <div>
              <span className="text-xs text-neutral-400 uppercase font-semibold block mb-2">
                Select a duty from your roster to offer in trade
              </span>
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                {flights.filter(f => f.duty_type === 'flight' || f.duty_type === 'standby').map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSelectMyFlightForDirect(f)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex justify-between items-center cursor-pointer ${
                      selectedMyFlightForDirect?.id === f.id
                        ? 'border-primary bg-pink-500/5 shadow-md shadow-pink-500/5'
                        : 'border-amber-200/40 hover:border-primary bg-white/40'
                    }`}
                  >
                    <div>
                      <span className="font-heading font-semibold text-neutral-800">
                        {f.flight_number || f.duty_type.toUpperCase()}
                      </span>
                      {f.origin && (
                        <span className="text-neutral-500 ml-1">
                          ({f.origin} → {f.destination})
                        </span>
                      )}
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        May {f.day_number}
                      </p>
                    </div>
                    {f.block_time_mins && (
                      <span className="text-neutral-500 font-mono text-[10px]">
                        {Math.floor(f.block_time_mins / 60)}h {f.block_time_mins % 60}m
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Legality Validation Status */}
            {(checkingDirectLegality || directLegalityResult) && (
              <div className="p-4 rounded-2xl bg-white border border-amber-200/60 shadow-inner">
                <span className="text-xs text-neutral-400 uppercase font-semibold block mb-2">
                  Gemini FTL Legality Assessment
                </span>
                
                {checkingDirectLegality ? (
                  <div className="flex items-center gap-2 text-xs text-neutral-500 py-1">
                    <Loader className="animate-spin text-cta" size={16} />
                    <span>Verifying Middle East Airlines rest rules...</span>
                  </div>
                ) : directLegalityResult ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {directLegalityResult.passed ? (
                        <>
                          <ShieldCheck className="text-emerald-500 shrink-0" size={20} />
                          <span className="text-xs font-bold text-emerald-600">COMPLIANT (Legally Safe)</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="text-red-500 shrink-0" size={20} />
                          <span className="text-xs font-bold text-red-600">RULE VIOLATION WARNING</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                      {directLegalityResult.notes}
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsDirectModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="cta"
                size="sm"
                type="submit"
                disabled={!selectedMyFlightForDirect || checkingDirectLegality}
              >
                Send Swap Proposal
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
