'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plane, Calendar, Clock, User, Check, Search, Filter } from 'lucide-react';
import { db, PilotProfile, FlightDuty } from '@/lib/db';
import Card from './ui/Card';
import Button from './ui/Button';

interface FullRosterGridProps {
  currentPilotId: string;
  onProposeSwap: (targetPilot: PilotProfile, targetFlight: FlightDuty) => void;
  onPostOwnSwap: (flight: FlightDuty) => void;
}

export default function FullRosterGrid({ currentPilotId, onProposeSwap, onPostOwnSwap }: FullRosterGridProps) {
  const [profiles, setProfiles] = useState<PilotProfile[]>([]);
  const [allFlights, setAllFlights] = useState<FlightDuty[]>([]);
  const [filterQual, setFilterQual] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    // Load profiles and flights
    setProfiles(db.getProfiles());
    setAllFlights(db.getFlights());

    // Refresh every 3 seconds to keep sync
    const interval = setInterval(() => {
      setProfiles(db.getProfiles());
      setAllFlights(db.getFlights());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Helper to get weekday for May 2026
  const getDayOfWeek = (day: number) => {
    const date = new Date(2026, 4, day); // May is month index 4
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Helper to check if a day is weekend
  const isWeekend = (day: number) => {
    const date = new Date(2026, 4, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  };

  // Filter profiles based on search and qualification filter
  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.rank.toLowerCase().replace('_', ' ').includes(searchQuery.toLowerCase());
    const matchesQual = filterQual === 'all' ? true : p.qualifications.includes(filterQual);
    return matchesSearch && matchesQual;
  });

  // Calculate stats for a pilot
  const getPilotStats = (pilotId: string) => {
    const pilotDuties = allFlights.filter(f => f.pilot_id === pilotId);
    const flightsOnly = pilotDuties.filter(f => f.duty_type === 'flight');
    const standbyCount = pilotDuties.filter(f => f.duty_type === 'standby').length;
    const offCount = pilotDuties.filter(f => f.duty_type === 'off').length;
    const totalMins = flightsOnly.reduce((sum, f) => sum + (f.block_time_mins || 0), 0);
    const hours = Math.round(totalMins / 60);

    return {
      sectors: flightsOnly.length,
      hours,
      standby: standbyCount,
      off: offCount
    };
  };

  // Get duties grouped by day for a pilot
  const getDutiesForPilotDay = (pilotId: string, day: number) => {
    return allFlights.filter(f => f.pilot_id === pilotId && f.day_number === day);
  };

  const getDutyBadgeStyles = (duty: FlightDuty) => {
    switch (duty.duty_type) {
      case 'off':
        return 'bg-rose-50 border border-rose-100 text-rose-600 font-bold text-[10px] w-full py-1 rounded shadow-sm flex items-center justify-center';
      case 'standby':
        return 'bg-violet-50 border border-violet-100 text-violet-600 font-bold text-[10px] w-full py-1 rounded shadow-sm flex items-center justify-center hover:scale-105 transition-transform';
      case 'simulator':
      case 'training':
        return 'bg-amber-50 border border-amber-100 text-amber-700 font-bold text-[10px] w-full py-1 rounded shadow-sm flex items-center justify-center';
      case 'flight':
      default:
        return 'bg-white border border-neutral-200 text-neutral-800 font-extrabold text-[10px] w-full py-0.5 rounded shadow-sm flex flex-col items-center justify-center hover:scale-105 transition-transform hover:border-primary';
    }
  };

  const handleCellClick = (pilot: PilotProfile, duty: FlightDuty) => {
    if (duty.duty_type !== 'flight' && duty.duty_type !== 'standby') return;
    
    if (pilot.id === currentPilotId) {
      onPostOwnSwap(duty);
    } else {
      onProposeSwap(pilot, duty);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtering Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/40 backdrop-blur-md border border-amber-200/40 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto bg-white/60 px-3 py-1.5 rounded-xl border border-amber-200">
          <Search size={16} className="text-neutral-400" />
          <input
            type="text"
            placeholder="Search crew name or rank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-xs focus:outline-none w-full sm:w-48 text-neutral-800"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs text-neutral-500 font-semibold flex items-center gap-1.5 shrink-0">
            <Filter size={14} /> Qual Filter:
          </span>
          <div className="flex bg-white/60 p-0.5 rounded-xl border border-amber-200 text-xs">
            {['all', 'A320', 'A321', 'A330'].map((qual) => (
              <button
                key={qual}
                onClick={() => setFilterQual(qual)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterQual === qual
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {qual}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <Card hoverEffect={false} className="p-0 border-amber-200/50 overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-amber-200 scrollbar-track-transparent">
          <table className="min-w-max w-full border-collapse text-left font-sans text-xs">
            <thead>
              <tr className="bg-amber-100/50 text-neutral-600 font-semibold border-b border-amber-200">
                {/* Sticky Header Left */}
                <th className="sticky left-0 bg-amber-50/95 backdrop-blur-sm z-20 px-4 py-3 border-r border-amber-200 w-[240px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                  <div className="flex justify-between items-center">
                    <span className="font-heading font-extrabold uppercase tracking-wider text-[11px] text-neutral-700">MEA CREW MEMBER</span>
                    <span className="text-[10px] text-neutral-400 italic">May 2026</span>
                  </div>
                </th>
                
                {/* Stats Headers */}
                <th className="px-3 py-3 border-r border-amber-200 text-center font-heading font-bold text-[10px] text-neutral-500 w-[70px]">BLOCK</th>
                <th className="px-3 py-3 border-r border-amber-200 text-center font-heading font-bold text-[10px] text-neutral-500 w-[50px]">SECT</th>
                <th className="px-3 py-3 border-r border-amber-200 text-center font-heading font-bold text-[10px] text-neutral-500 w-[50px]">SBY</th>

                {/* Day Columns */}
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                  const weekend = isWeekend(day);
                  return (
                    <th
                      key={day}
                      className={`py-2 px-1 text-center border-r border-amber-200/50 min-w-[52px] ${
                        weekend ? 'bg-amber-200/20 text-neutral-700' : 'text-neutral-500'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] uppercase font-bold tracking-tight">
                          {getDayOfWeek(day)}
                        </span>
                        <span className="text-[11px] font-heading font-extrabold text-neutral-800">
                          {day}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((pilot) => {
                const isCurrent = pilot.id === currentPilotId;
                const stats = getPilotStats(pilot.id);

                return (
                  <tr
                    key={pilot.id}
                    className={`border-b border-amber-200/30 transition-colors ${
                      isCurrent
                        ? 'bg-pink-500/5 border-l-4 border-l-primary'
                        : 'hover:bg-white/40'
                    }`}
                  >
                    {/* Sticky Name Column */}
                    <td className={`sticky left-0 z-10 px-4 py-3 border-r border-amber-200 font-sans shadow-[2px_0_5px_rgba(0,0,0,0.03)] ${
                      isCurrent ? 'bg-pink-50/95' : 'bg-amber-50/95'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isCurrent ? 'bg-primary/20 text-primary' : 'bg-amber-200/40 text-amber-700'
                        }`}>
                          <User size={14} />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1">
                            <span className="font-heading font-extrabold text-neutral-800 text-[11px] truncate">
                              {pilot.name.split(',')[0]}
                            </span>
                            {isCurrent && (
                              <span className="bg-primary/10 text-primary text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 tracking-wider">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-neutral-500 font-semibold uppercase block">
                            {pilot.rank === 'captain' ? 'CPT' : 'F/O'} • {pilot.qualifications.join('/')}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Stats cells */}
                    <td className="px-2 py-3 border-r border-amber-200 text-center font-mono font-bold text-neutral-700">
                      {stats.hours}h
                    </td>
                    <td className="px-2 py-3 border-r border-amber-200 text-center font-mono font-semibold text-neutral-600">
                      {stats.sectors}
                    </td>
                    <td className="px-2 py-3 border-r border-amber-200 text-center font-mono text-neutral-500">
                      {stats.standby}
                    </td>

                    {/* Day cells */}
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                      const duties = getDutiesForPilotDay(pilot.id, day);
                      const weekend = isWeekend(day);

                      return (
                        <td
                          key={day}
                          className={`p-1 border-r border-amber-200/30 text-center min-w-[52px] align-middle ${
                            weekend ? 'bg-amber-200/5' : ''
                          }`}
                        >
                          <div className="flex flex-col gap-1 items-center justify-center">
                            {duties.length === 0 ? (
                              <span className="text-neutral-300 font-mono">.</span>
                            ) : (
                              duties.map((duty) => {
                                const isInteractive = duty.duty_type === 'flight' || duty.duty_type === 'standby';
                                return (
                                  <div
                                    key={duty.id}
                                    onClick={() => handleCellClick(pilot, duty)}
                                    className={`${getDutyBadgeStyles(duty)} ${
                                      isInteractive ? 'cursor-pointer' : 'cursor-default'
                                    }`}
                                    title={
                                      duty.duty_type === 'flight'
                                        ? `${duty.flight_number}: ${duty.origin} → ${duty.destination}\nDep: ${duty.departure_time ? new Date(duty.departure_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'N/A'}`
                                        : duty.duty_type === 'standby'
                                        ? 'Standby Duty (SB)'
                                        : duty.duty_type === 'off'
                                        ? 'Day Off (X / RO)'
                                        : 'Simulator/Training'
                                    }
                                  >
                                    {duty.duty_type === 'flight' ? (
                                      <>
                                        <span className="font-extrabold tracking-tighter">
                                          {duty.flight_number?.replace('ME', '')}
                                        </span>
                                        {duty.destination && (
                                          <span className="text-[8px] font-semibold text-neutral-500 leading-none">
                                            {duty.destination}
                                          </span>
                                        )}
                                      </>
                                    ) : duty.duty_type === 'standby' ? (
                                      <span>SB</span>
                                    ) : duty.duty_type === 'off' ? (
                                      <span>X</span>
                                    ) : (
                                      <span className="truncate max-w-[40px] text-[8px]">SIM</span>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legend key */}
      <div className="flex flex-wrap gap-4 justify-start items-center bg-white/30 p-3 rounded-xl border border-amber-200/30 text-[10px] font-semibold text-neutral-600">
        <span className="text-xs font-bold text-neutral-700">LEGEND:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 bg-white border border-neutral-200 shadow-sm rounded flex items-center justify-center text-[9px] font-extrabold text-neutral-800">201</span>
          <span>Flight (Click to Swap)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 bg-violet-50 border border-violet-100 text-violet-600 shadow-sm rounded flex items-center justify-center text-[9px] font-extrabold">SB</span>
          <span>Standby (Click to Swap)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 bg-rose-50 border border-rose-100 text-rose-600 shadow-sm rounded flex items-center justify-center text-[9px] font-extrabold">X</span>
          <span>Day Off / Rest Off</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 bg-amber-50 border border-amber-100 text-amber-700 shadow-sm rounded flex items-center justify-center text-[9px] font-extrabold">SIM</span>
          <span>Simulator & Training</span>
        </div>
      </div>
    </div>
  );
}
