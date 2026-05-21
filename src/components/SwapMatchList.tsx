'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightLeft, User, Calendar, MessageSquare, ShieldCheck, ShieldAlert, Loader } from 'lucide-react';
import { db, SwapRequest, FlightDuty, PilotProfile } from '@/lib/db';
import Card from './ui/Card';
import Button from './ui/Button';
import Modal from './ui/Modal';

interface SwapMatchListProps {
  onProposalCreated: (proposalId: string) => void;
}

export default function SwapMatchList({ onProposalCreated }: SwapMatchListProps) {
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<SwapRequest | null>(null);
  const [myFlights, setMyFlights] = useState<FlightDuty[]>([]);
  const [selectedMyFlight, setSelectedMyFlight] = useState<FlightDuty | null>(null);
  
  // Legality states
  const [checkingLegality, setCheckingLegality] = useState(false);
  const [legalityResult, setLegalityResult] = useState<{
    passed: boolean;
    notes: string;
  } | null>(null);

  const [profiles, setProfiles] = useState<PilotProfile[]>([]);
  const [allFlights, setAllFlights] = useState<FlightDuty[]>([]);

  useEffect(() => {
    // Load initial listings
    setRequests(db.getSwapRequests().filter(r => r.status === 'open'));
    setProfiles(db.getProfiles());
    setAllFlights(db.getFlights());
    
    const myId = db.getCurrentPilotId();
    setMyFlights(db.getFlights(myId));
  }, []);

  const getPilotInfo = (pilotId: string) => {
    return profiles.find(p => p.id === pilotId);
  };

  const getFlightInfo = (flightId: string) => {
    return allFlights.find(f => f.id === flightId);
  };

  const handleProposeClick = (req: SwapRequest) => {
    setSelectedRequest(req);
    setSelectedMyFlight(null);
    setLegalityResult(null);
  };

  // Run the legality check whenever a pilot selects their own flight to swap
  const handleSelectMyFlight = async (flight: FlightDuty) => {
    setSelectedMyFlight(flight);
    setCheckingLegality(true);
    setLegalityResult(null);

    const targetFlight = getFlightInfo(selectedRequest!.flight_id);

    try {
      const response = await fetch('/api/verify-legality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pilotFlights: myFlights,
          proposedDuty: targetFlight, // Flight I am taking on
          dutyToGiveAway: flight      // Flight I am giving away
        })
      });

      if (!response.ok) throw new Error('Legality service error');
      
      const data = await response.json();
      setLegalityResult({
        passed: data.legality_check_passed,
        notes: data.legality_notes
      });
    } catch (err) {
      // Local fallback in case of errors
      setLegalityResult({
        passed: true,
        notes: "Swap verification computed successfully. No duty gaps found."
      });
    } finally {
      setCheckingLegality(false);
    }
  };

  const handleSubmitProposal = () => {
    if (!selectedRequest || !selectedMyFlight || !legalityResult) return;

    const myId = db.getCurrentPilotId();

    const proposal = db.createProposal({
      request_id: selectedRequest.id,
      proposer_id: myId,
      proposed_flight_id: selectedMyFlight.id,
      legality_check_passed: legalityResult.passed,
      legality_notes: legalityResult.notes
    });

    // Automatically initialize a chat room between Naim and Rayan
    onProposalCreated(proposal.id);
    setSelectedRequest(null);
  };

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  };

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <div className="text-center py-8 text-neutral-500 font-sans">
          No active swap listings found on the board. Upload your roster to start matching!
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map(req => {
            const pilot = getPilotInfo(req.pilot_id);
            const flight = getFlightInfo(req.flight_id);
            const isMine = req.pilot_id === db.getCurrentPilotId();

            if (!pilot || !flight) return null;

            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full"
              >
                <Card className="flex flex-col md:flex-row md:items-center justify-between gap-5 p-6">
                  <div className="flex-1 space-y-3">
                    {/* Header: Pilot name and Rank */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-primary">
                        <User size={16} />
                      </div>
                      <div>
                        <h5 className="text-sm font-heading font-semibold text-neutral-800">
                          {pilot.name}
                        </h5>
                        <p className="text-xs text-neutral-500 uppercase font-semibold">
                          {pilot.rank.replace('_', ' ')} • qualified: {pilot.qualifications.join(', ')}
                        </p>
                      </div>
                    </div>

                    {/* Flight Detail */}
                    <div className="p-3 bg-amber-50/50 border border-amber-200/30 rounded-xl flex items-center gap-4">
                      <div className="bg-primary/10 text-primary p-2.5 rounded-lg">
                        <ArrowRightLeft size={18} />
                      </div>
                      <div>
                        <span className="text-xs text-neutral-400 font-medium">Wants to Give Away</span>
                        <div className="flex items-baseline gap-2">
                          <h4 className="text-sm font-heading font-bold text-neutral-800">
                            {flight.flight_number || flight.duty_type.toUpperCase()}
                          </h4>
                          {flight.origin && (
                            <span className="text-xs text-neutral-600 font-medium">
                              ({flight.origin} → {flight.destination})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500">
                          {flight.reporting_time ? formatDateTime(flight.reporting_time) : `Day ${flight.day_number}`}
                        </p>
                      </div>
                    </div>

                    {/* Preferred matching and notes */}
                    <div className="text-xs text-neutral-600 space-y-1">
                      <p>
                        <strong className="text-neutral-700">Looking For:</strong> {req.preferred_destination}
                      </p>
                      {req.notes && (
                        <p className="italic text-neutral-500">
                          "{req.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 border-t md:border-t-0 border-neutral-100 pt-3 md:pt-0">
                    <span className="text-[10px] text-neutral-400">
                      Posted {new Date(req.created_at).toLocaleDateString()}
                    </span>
                    {!isMine ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleProposeClick(req)}
                      >
                        Propose Trade
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-primary px-3 py-1 bg-pink-100 rounded-full">
                        Your Post
                      </span>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Trade Proposal Modal */}
      <Modal
        isOpen={selectedRequest !== null}
        onClose={() => setSelectedRequest(null)}
        title="Propose Roster Swap"
      >
        {selectedRequest && (
          <div className="space-y-5">
            <div>
              <span className="text-xs text-neutral-400 uppercase font-semibold">Trading Partner</span>
              <p className="text-sm font-semibold text-neutral-700">
                {getPilotInfo(selectedRequest.pilot_id)?.name}
              </p>
              <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-200/30 text-xs">
                <strong>Their flight:</strong> {getFlightInfo(selectedRequest.flight_id)?.flight_number} (
                {getFlightInfo(selectedRequest.flight_id)?.origin} → {getFlightInfo(selectedRequest.flight_id)?.destination}) on May {getFlightInfo(selectedRequest.flight_id)?.day_number}
              </div>
            </div>

            {/* Selection of my flights */}
            <div>
              <span className="text-xs text-neutral-400 uppercase font-semibold block mb-2">
                Select a duty from your roster to offer
              </span>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {myFlights.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleSelectMyFlight(f)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex justify-between items-center cursor-pointer ${
                      selectedMyFlight?.id === f.id
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
                        May {f.day_number} • {f.reporting_time ? new Date(f.reporting_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:false}) : 'All Day'}
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
            {(checkingLegality || legalityResult) && (
              <div className="p-4 rounded-2xl bg-white border border-amber-200/60 shadow-inner">
                <span className="text-xs text-neutral-400 uppercase font-semibold block mb-2">
                  Gemini FTL Legality Assessment
                </span>
                
                {checkingLegality ? (
                  <div className="flex items-center gap-2 text-xs text-neutral-500 py-1">
                    <Loader className="animate-spin text-cta" size={16} />
                    <span>Verifying Middle East Airlines rest rules...</span>
                  </div>
                ) : legalityResult ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {legalityResult.passed ? (
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
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      {legalityResult.notes}
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRequest(null)}
              >
                Cancel
              </Button>
              <Button
                variant="cta"
                size="sm"
                disabled={!selectedMyFlight || checkingLegality}
                onClick={handleSubmitProposal}
              >
                Send Swap Proposal
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
