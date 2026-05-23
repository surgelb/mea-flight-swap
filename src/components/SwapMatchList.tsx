'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightLeft, User } from 'lucide-react';
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
  

  const [profiles, setProfiles] = useState<PilotProfile[]>([]);
  const [allFlights, setAllFlights] = useState<FlightDuty[]>([]);

  useEffect(() => {
    // Load initial listings asynchronously to avoid cascading renders warning
    const timer = setTimeout(() => {
      setRequests(db.getSwapRequests().filter(r => r.status === 'open'));
      setProfiles(db.getProfiles());
      setAllFlights(db.getFlights());
      
      const myId = db.getCurrentPilotId();
      setMyFlights(db.getFlights(myId));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const getPilotInfo = (pilotId: string) => {
    return profiles.find(p => p.id === pilotId);
  };

  const getFlightInfo = (flightId: string) => {
    return allFlights.find(f => f.id === flightId);
  };

  const getGroupRoute = (group: FlightDuty[]) => {
    if (group[0]?.duty_type !== 'flight') return '';
    const airports: string[] = [];
    group.forEach(g => {
      if (g.origin && (airports.length === 0 || airports[airports.length - 1] !== g.origin)) {
        airports.push(g.origin);
      }
      if (g.destination && (airports.length === 0 || airports[airports.length - 1] !== g.destination)) {
        airports.push(g.destination);
      }
    });
    return `(${airports.join(' → ')})`;
  };

  const groupedMyFlights = React.useMemo(() => {
    const groups: Record<number, FlightDuty[]> = {};
    myFlights.forEach(f => {
      if (f.duty_type === 'flight' || f.duty_type === 'standby') {
        if (!groups[f.day_number]) groups[f.day_number] = [];
        groups[f.day_number].push(f);
      }
    });
    return Object.values(groups).sort((a, b) => a[0].day_number - b[0].day_number);
  }, [myFlights]);

  const handleProposeClick = (req: SwapRequest) => {
    setSelectedRequest(req);
    setSelectedMyFlight(null);
  };


  // When a pilot picks a flight to offer, simply store the selection
  const handleSelectMyFlight = (flight: FlightDuty) => {
    setSelectedMyFlight(flight);
  };

  const handleSubmitProposal = () => {
    if (!selectedRequest || !selectedMyFlight) return;

    const myId = db.getCurrentPilotId();
    if (!myId) return;

    const proposal = db.createProposal({
      request_id: selectedRequest.id,
      proposer_id: myId,
      proposed_flight_id: selectedMyFlight.id,
    });

    // Automatically initialize a chat room between the two pilots
    onProposalCreated(proposal.id);
    setSelectedRequest(null);
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
            const targetFlights = allFlights.filter(f => f.pilot_id === req.pilot_id && f.day_number === flight?.day_number && (f.duty_type === 'flight' || f.duty_type === 'standby'));
            const targetFlightNumbers = targetFlights.map(t => t.flight_number).filter(Boolean).join(' / ');
            const totalTargetBlockTime = targetFlights.reduce((sum, g) => sum + (g.block_time_mins || 0), 0);
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
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
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
                    <div className="p-3 bg-neutral-50 border border-border rounded-xl flex items-center gap-4">
                      <div className="bg-primary/10 text-primary p-2.5 rounded-lg">
                        <ArrowRightLeft size={18} />
                      </div>
                      <div>
                        <span className="text-xs text-neutral-400 font-medium">Wants to Give Away (Roundtrip Day Group)</span>
                        <div className="flex items-baseline gap-2">
                          <h4 className="text-sm font-heading font-bold text-neutral-800">
                            {targetFlightNumbers || flight.duty_type.toUpperCase()}
                          </h4>
                          {flight.duty_type === 'flight' && (
                            <span className="text-xs text-neutral-600 font-medium">
                              {getGroupRoute(targetFlights)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500">
                          May {flight.day_number} {totalTargetBlockTime > 0 && `• Block Time: ${Math.floor(totalTargetBlockTime / 60)}h ${totalTargetBlockTime % 60}m`}
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
                          &ldquo;{req.notes}&rdquo;
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
                      <span className="text-xs font-semibold text-primary px-3 py-1 bg-primary/10 rounded-full">
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
              <div className="mt-2 p-3 bg-neutral-50 rounded-xl border border-border text-xs">
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
                {groupedMyFlights.map(group => {
                  const representative = group[0];
                  const flightNumbers = group.map(f => f.flight_number).filter(Boolean).join(' / ') || representative.duty_type.toUpperCase();
                  const route = getGroupRoute(group);
                  const totalBlockTime = group.reduce((sum, f) => sum + (f.block_time_mins || 0), 0);
                  const isSelected = selectedMyFlight?.day_number === representative.day_number;

                  return (
                    <button
                      key={representative.id}
                      onClick={() => handleSelectMyFlight(representative)}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex justify-between items-center cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                          : 'border-border hover:border-primary bg-white/40'
                      }`}
                    >
                      <div>
                        <span className="font-heading font-semibold text-neutral-800">
                          {flightNumbers}
                        </span>
                        {route && (
                          <span className="text-neutral-500 ml-1">
                            {route}
                          </span>
                        )}
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          May {representative.day_number} • {representative.reporting_time ? new Date(representative.reporting_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:false}) : 'All Day'}
                        </p>
                      </div>
                      {totalBlockTime > 0 && (
                        <span className="text-neutral-500 font-mono text-[10px]">
                          {Math.floor(totalBlockTime / 60)}h {totalBlockTime % 60}m
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>


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
              disabled={!selectedMyFlight}
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
