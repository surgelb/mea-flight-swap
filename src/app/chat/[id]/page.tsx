'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Send, ArrowLeft, ArrowRightLeft, CheckCircle } from 'lucide-react';
import { db, PilotProfile, FlightDuty, SwapProposal, ChatMessage } from '@/lib/db';
import Card from '@/components/ui/Card';

export default function ChatRoom() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params.id as string) || '';
  
  const [currentPilot, setCurrentPilot] = useState<PilotProfile | null>(null);
  const [partnerPilot, setPartnerPilot] = useState<PilotProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  // Swap context
  const [proposal, setProposal] = useState<SwapProposal | null>(null);
  const [myFlight, setMyFlight] = useState<FlightDuty | null>(null);
  const [partnerFlight, setPartnerFlight] = useState<FlightDuty | null>(null);
  const [myFlightGroup, setMyFlightGroup] = useState<FlightDuty[]>([]);
  const [partnerFlightGroup, setPartnerFlightGroup] = useState<FlightDuty[]>([]);
  const [swapSuccess, setSwapSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to construct roundtrip routes
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

  // Parse room ID room-id1--id2 dynamically
  const parseRoomIds = (idStr: string): { id1: string; id2: string } | null => {
    if (!idStr.startsWith('room-')) return null;
    const body = idStr.substring(5);
    if (body.includes('--')) {
      const parts = body.split('--');
      if (parts.length === 2) {
        return { id1: parts[0], id2: parts[1] };
      }
    }
    // Fallback for legacy formats
    const profiles = db.getProfiles();
    for (const p of profiles) {
      if (body.startsWith(p.id + '-')) {
        const otherId = body.substring(p.id.length + 1);
        return { id1: p.id, id2: otherId };
      }
    }
    const lastHyphen = body.lastIndexOf('-');
    if (lastHyphen !== -1) {
      return { id1: body.substring(0, lastHyphen), id2: body.substring(lastHyphen + 1) };
    }
    return null;
  };

  function loadMessages() {
    setMessages(db.getMessages(roomId));
  }

  function loadData() {
    const me = db.getCurrentPilot();
    if (!me) {
      router.push('/');
      return;
    }
    setCurrentPilot(me);

    const roomInfo = parseRoomIds(roomId);
    if (!roomInfo) {
      router.push('/dashboard');
      return;
    }

    const { id1, id2 } = roomInfo;
    const partnerId = me.id === id1 ? id2 : id1;
    const partner = db.getProfiles().find(p => p.id === partnerId);
    if (!partner) {
      router.push('/dashboard');
      return;
    }
    setPartnerPilot(partner);

    // Find the swap proposal matching this room context
    const proposals = db.getProposals();
    const requests = db.getSwapRequests();
    
    const activeProp = proposals.find(p => {
      const req = requests.find(r => r.id === p.request_id);
      if (!req) return false;
      return (
        (p.proposer_id === me.id && req.pilot_id === partnerId) ||
        (p.proposer_id === partnerId && req.pilot_id === me.id)
      );
    });

    if (!activeProp) {
      router.push('/dashboard');
      return;
    }
    
    setProposal(activeProp);

    // Get flights being traded
    const flights = db.getFlights();
    const req = requests.find(r => r.id === activeProp.request_id);
    
    let proposerFlight: FlightDuty | null = null;
    let receiverFlight: FlightDuty | null = null;

    if (me.id === activeProp.proposer_id) {
      proposerFlight = flights.find(f => f.id === activeProp.proposed_flight_id) || null;
      receiverFlight = flights.find(f => f.id === req?.flight_id) || null;
    } else {
      receiverFlight = flights.find(f => f.id === req?.flight_id) || null;
      proposerFlight = flights.find(f => f.id === activeProp.proposed_flight_id) || null;
    }

    const myF = me.id === activeProp.proposer_id ? proposerFlight : receiverFlight;
    const partnerF = me.id === activeProp.proposer_id ? receiverFlight : proposerFlight;

    setMyFlight(myF);
    setPartnerFlight(partnerF);

    if (myF && partnerF) {
      const myG = flights.filter(f => f.pilot_id === me.id && f.day_number === myF.day_number && (f.duty_type === 'flight' || f.duty_type === 'standby'));
      const partnerG = flights.filter(f => f.pilot_id === partnerId && f.day_number === partnerF.day_number && (f.duty_type === 'flight' || f.duty_type === 'standby'));
      
      setMyFlightGroup(myG);
      setPartnerFlightGroup(partnerG);
    } else {
      setMyFlightGroup([]);
      setPartnerFlightGroup([]);
    }

    loadMessages();
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    // Periodically poll for live feeling
    const interval = setInterval(loadMessages, 1500);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    // Scroll to bottom when messages update
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !currentPilot) return;

    db.sendMessage(roomId, currentPilot.id, inputValue.trim());
    setInputValue('');
    loadMessages();
  };

  const handleApproveSwapClick = () => {
    if (!proposal || !myFlight || !partnerFlight) return;

    // Execute swap transaction: trade flight owners
    const allFlights = db.getFlights();
    
    // Trade the owners of all flights on these days
    const originalOwner = myFlight.pilot_id;
    const newOwner = partnerFlight.pilot_id;

    const requestDay = myFlight.day_number;
    const proposedDay = partnerFlight.day_number;

    allFlights.forEach(f => {
      if (f.pilot_id === originalOwner && f.day_number === requestDay && f.duty_type === 'flight') {
        f.pilot_id = newOwner;
      } else if (f.pilot_id === newOwner && f.day_number === proposedDay && f.duty_type === 'flight') {
        f.pilot_id = originalOwner;
      }
    });

    db.saveFlights(allFlights);

    // Set proposal to accepted
    db.updateProposalStatus(proposal.id, 'accepted');

    setSwapSuccess(true);
    setTimeout(() => {
      setSwapSuccess(false);
      router.push('/dashboard');
    }, 2500);
  };

  if (!currentPilot || !partnerPilot) return null;

  const myFlightNumbers = myFlightGroup.map(t => t.flight_number).filter(Boolean).join(' / ') || (myFlight?.duty_type || '').toUpperCase();
  const partnerFlightNumbers = partnerFlightGroup.map(t => t.flight_number).filter(Boolean).join(' / ') || (partnerFlight?.duty_type || '').toUpperCase();

  const myRoute = getGroupRoute(myFlightGroup);
  const partnerRoute = getGroupRoute(partnerFlightGroup);

  return (
    <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-4 md:p-6 space-y-4">
      {/* Header panel */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-xs font-heading font-bold text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <span className="text-xs text-neutral-400 font-semibold uppercase">
          Swap Coordination Channel
        </span>
      </div>

      {/* Roster Swap Summary bar */}
      {myFlight && partnerFlight && (
        <Card hoverEffect={false} className="border-border bg-white/70 py-4 px-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 font-bold text-neutral-800">
                <span className="text-primary">{myFlightNumbers}</span>
                {myRoute && <span className="text-xs text-neutral-400">{myRoute}</span>}
                <span className="text-xs text-neutral-400 font-normal">on May {myFlight.day_number}</span>
              </div>
              <ArrowRightLeft size={14} className="text-neutral-400 mx-1" />
              <div className="flex items-center gap-1.5 font-bold text-neutral-800">
                <span className="text-cta">{partnerFlightNumbers}</span>
                {partnerRoute && <span className="text-xs text-neutral-400">{partnerRoute}</span>}
                <span className="text-xs text-neutral-400 font-normal">on May {partnerFlight.day_number}</span>
              </div>
            </div>

            {/* Approve Swap action */}
            <div className="flex items-center gap-2 border-l border-border md:pl-4 py-1">
              {proposal?.status !== 'accepted' ? (
                <button
                  onClick={handleApproveSwapClick}
                  className="px-3.5 py-1.5 bg-cta text-white text-xs font-heading font-bold rounded-lg hover:bg-cta-hover glow-cta transition-colors cursor-pointer"
                >
                  Approve Swap
                </button>
              ) : (
                <span className="text-xs font-bold text-neutral-500 bg-neutral-200 px-2.5 py-1 rounded-lg">
                  Swap Finalized
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Chat Area */}
      <Card hoverEffect={false} className="flex-1 flex flex-col min-h-[400px] p-0 overflow-hidden border-border/80">
        {/* Coordinating header */}
        <div className="bg-background/80 border-b border-border px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-neutral-200 rounded-full flex items-center justify-center text-neutral-600 font-semibold text-xs">
              {partnerPilot.name[0]}
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-700 block leading-tight">{partnerPilot.name}</span>
              <span className="text-[10px] text-neutral-400 font-semibold uppercase">{partnerPilot.rank.replace('_', ' ')}</span>
            </div>
          </div>
          <span className="text-[10px] text-neutral-400">
            Realtime Encryption Enabled
          </span>
        </div>

        {/* Message timeline feed */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map(msg => {
            const isMe = msg.sender_id === currentPilot.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs md:max-w-md rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    isMe
                      ? 'bg-primary text-white rounded-tr-none'
                      : 'bg-white border border-border text-neutral-800 rounded-tl-none'
                  }`}
                >
                  <p className="leading-relaxed font-sans">{msg.content}</p>
                  <span
                    className={`text-[9px] block text-right mt-1 ${
                      isMe ? 'text-white/90' : 'text-neutral-400'
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input form */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-background/20 flex gap-3">
          <input
            type="text"
            placeholder={`Reply to ${partnerPilot.name.split(',')[0]}...`}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white focus:outline-none focus:border-primary text-sm focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="p-3 rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-40 transition-colors flex items-center justify-center glow-primary cursor-pointer"
          >
            <Send size={16} />
          </button>
        </form>
      </Card>

      {/* Success Transaction Overlay */}
      {swapSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl max-w-sm mx-4"
          >
            <CheckCircle className="text-emerald-500 mb-4 animate-bounce" size={56} />
            <h2 className="text-xl font-heading font-extrabold text-neutral-800 mb-2">
              Roster Swap Approved!
            </h2>
            <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
              Your flight lines have been swapped. This transaction has been dispatched to Middle East Airlines scheduling system.
            </p>
            <div className="text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 rounded-xl py-2 px-4 inline-block">
              Roster swap confirmed — coordinate final details with MEA Scheduling.
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
