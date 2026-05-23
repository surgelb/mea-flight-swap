'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User, Search, Filter, X, Plane, Clock } from 'lucide-react';
import { db, PilotProfile, FlightDuty } from '@/lib/db';
import Card from './ui/Card';

interface FullRosterGridProps {
  currentPilotId: string;
  onProposeSwap: (targetPilot: PilotProfile, targetFlight: FlightDuty) => void;
  onPostOwnSwap: (flight: FlightDuty) => void;
}

interface PopoverState {
  pilot: PilotProfile;
  duties: FlightDuty[];
  day: number;
}

export default function FullRosterGrid({ currentPilotId, onProposeSwap, onPostOwnSwap }: FullRosterGridProps) {
  const [profiles, setProfiles] = useState<PilotProfile[]>([]);
  const [allFlights, setAllFlights] = useState<FlightDuty[]>([]);
  const [filterQual, setFilterQual] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activePopover, setActivePopover] = useState<PopoverState | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProfiles(db.getProfiles());
      setAllFlights(db.getFlights());
    }, 0);
    const interval = setInterval(() => {
      setProfiles(db.getProfiles());
      setAllFlights(db.getFlights());
    }, 3000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Close popover on outside click / escape
  useEffect(() => {
    if (!activePopover) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePopover(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [activePopover]);

  // Helper: day of week abbreviation (2 chars)
  const getDayOfWeek = (day: number) => {
    const date = new Date(2026, 4, day); // May 2026
    return date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
  };

  const isWeekend = (day: number) => {
    const dow = new Date(2026, 4, day).getDay();
    return dow === 0 || dow === 6;
  };

  const filteredProfiles = profiles.filter(p => {
    if (p?.email === 'test.pilot@mea.com.lb' || (p?.name || '').toUpperCase().includes('TEST PILOT')) return false;
    const name = (p?.name || '').toLowerCase();
    const rank = (p?.rank || '').toLowerCase().replace('_', ' ');
    const query = (searchQuery || '').toLowerCase();
    const matchesSearch = name.includes(query) || rank.includes(query);
    const matchesQual = filterQual === 'all' || (p?.qualifications || []).includes(filterQual);
    return matchesSearch && matchesQual;
  });

  const getPilotStats = (pilotId: string) => {
    const duties = allFlights.filter(f => f.pilot_id === pilotId);
    const flights = duties.filter(f => f.duty_type === 'flight');
    const totalMins = flights.reduce((sum, f) => sum + (f.block_time_mins || 0), 0);
    return {
      sectors: flights.length,
      hours: Math.round(totalMins / 60),
      standby: duties.filter(f => f.duty_type === 'standby').length,
    };
  };

  const getDutiesForPilotDay = (pilotId: string, day: number) =>
    allFlights.filter(f => f.pilot_id === pilotId && f.day_number === day);

  // Returns base Tailwind classes for a duty badge (no sizing — applied per context)
  const dutyColors = (duty: FlightDuty): string => {
    switch (duty.duty_type) {
      case 'off':       return 'bg-emerald-50 border border-emerald-100 text-emerald-600';
      case 'standby':   return 'bg-amber-50 border border-amber-100 text-amber-700';
      case 'simulator':
      case 'training':  return 'bg-teal-50 border border-teal-100 text-teal-700';
      default:          return 'bg-white border border-neutral-200 text-neutral-800';
    }
  };

  const dutyCode = (duty: FlightDuty): string => {
    if (duty.duty_type === 'flight') return duty.flight_number?.replace('ME', '') ?? '—';
    if (duty.duty_type === 'standby') return 'SB';
    if (duty.duty_type === 'off') return 'X';
    return 'SIM';
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch { return '—'; }
  };

  const handleCellClick = (pilot: PilotProfile, duties: FlightDuty[], day: number) => {
    const interactive = duties.filter(d => d.duty_type === 'flight' || d.duty_type === 'standby');
    if (interactive.length === 0) return;
    setActivePopover({ pilot, duties: interactive, day });
  };

  const handlePopoverAction = () => {
    if (!activePopover) return;
    const duty = activePopover.duties[0];
    if (activePopover.pilot.id === currentPilotId) {
      onPostOwnSwap(duty);
    } else {
      onProposeSwap(activePopover.pilot, duty);
    }
    setActivePopover(null);
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const pilotLastName = (name: string) => {
    // Name format: "LAST, First" or "LAST FIRST" — return first token before comma
    const beforeComma = name.split(',')[0].trim();
    // If multiple words, take the last word (actual last name token)
    const parts = beforeComma.split(' ');
    return parts[parts.length - 1];
  };

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/40 backdrop-blur-md border border-border/40 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto bg-white/60 px-3 py-1.5 rounded-xl border border-border">
          <Search size={16} className="text-neutral-400 shrink-0" />
          <input
            type="text"
            placeholder="Search crew name or rank..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-xs focus:outline-none w-full sm:w-48 text-neutral-800"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs text-neutral-500 font-semibold flex items-center gap-1.5 shrink-0">
            <Filter size={14} /> Qual:
          </span>
          <div className="flex bg-white/60 p-0.5 rounded-xl border border-border text-xs">
            {['all', 'A320', 'A321', 'A330'].map(qual => (
              <button
                key={qual}
                onClick={() => setFilterQual(qual)}
                className={`px-2 md:px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterQual === qual ? 'bg-primary text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {qual}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      <Card hoverEffect={false} className="p-0 border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-200 scrollbar-track-transparent">
          <table className="border-collapse text-left font-sans text-xs" style={{ minWidth: 'max-content', width: '100%' }}>
            {/* colgroup: fixes column widths so 10 day cols fill the mobile viewport */}
            <colgroup>
              {/* Pilot name: 90px mobile / 200px desktop */}
              <col style={{ width: '90px' }} className="md:w-[200px]" />
              {/* Stats: desktop only (hidden on mobile via th/td classes) */}
              <col className="md:w-[70px]" />
              <col className="md:w-[50px]" />
              <col className="md:w-[50px]" />
              {/* Day cols: (100vw - 90px) / 10 on mobile, 52px on desktop */}
              {days.map(d => (
                <col key={d} />
              ))}
            </colgroup>

            <thead>
              <tr className="bg-neutral-50 text-neutral-600 font-semibold border-b border-border">
                {/* ── Pilot name header — sticky left + sticky top ── */}
                <th
                  className="sticky left-0 top-0 z-30 bg-neutral-50 border-r border-border shadow-[2px_0_5px_rgba(0,0,0,0.06)]"
                  style={{ minWidth: 90, width: 90 }}
                >
                  <div className="px-2 md:px-4 py-2 md:py-3">
                    <span className="font-heading font-extrabold uppercase tracking-wider text-[10px] md:text-[11px] text-neutral-700 block">
                      CREW
                    </span>
                    <span className="text-[9px] text-neutral-400 italic hidden md:block">May 2026</span>
                  </div>
                </th>

                {/* ── Stats headers — desktop only ── */}
                <th className="hidden md:table-cell sticky top-0 z-20 bg-neutral-50 px-3 py-3 border-r border-border text-center font-heading font-bold text-[10px] text-neutral-500 whitespace-nowrap">BLOCK</th>
                <th className="hidden md:table-cell sticky top-0 z-20 bg-neutral-50 px-3 py-3 border-r border-border text-center font-heading font-bold text-[10px] text-neutral-500">SECT</th>
                <th className="hidden md:table-cell sticky top-0 z-20 bg-neutral-50 px-3 py-3 border-r border-border text-center font-heading font-bold text-[10px] text-neutral-500">SBY</th>

                {/* ── Day column headers ── */}
                {days.map(day => {
                  const weekend = isWeekend(day);
                  return (
                    <th
                      key={day}
                      className={`sticky top-0 z-20 border-r border-border/40 text-center ${
                        weekend ? 'bg-neutral-100 text-neutral-700' : 'bg-neutral-50 text-neutral-500'
                      }`}
                      // Mobile: fill exactly 1/10th of remaining viewport; desktop: fixed 52px
                      style={{ width: 'max(28px, calc((100vw - 90px) / 10))', minWidth: 28 }}
                    >
                      <div className="flex flex-col items-center py-1.5 md:py-2 px-0">
                        <span className="text-[8px] md:text-[9px] uppercase font-bold tracking-tight leading-none">
                          {getDayOfWeek(day)}
                        </span>
                        <span className="text-[10px] md:text-[11px] font-heading font-extrabold text-neutral-800 leading-tight">
                          {day}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {filteredProfiles.map(pilot => {
                const isCurrent = pilot.id === currentPilotId;
                const stats = getPilotStats(pilot.id);

                return (
                  <tr
                    key={pilot.id}
                    className={`border-b border-border/30 transition-colors ${
                      isCurrent ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-white/40'
                    }`}
                  >
                    {/* ── Sticky Pilot Name Cell ── */}
                    <td
                      className={`sticky left-0 z-10 border-r border-border shadow-[2px_0_5px_rgba(0,0,0,0.04)] ${
                        isCurrent ? 'bg-primary/5' : 'bg-white'
                      }`}
                      style={{ minWidth: 90, width: 90 }}
                    >
                      <div className="px-2 md:px-4 py-2 md:py-3 flex items-center gap-1.5 md:gap-2.5">
                        <div className={`w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isCurrent ? 'bg-primary/10 text-primary' : 'bg-neutral-100 text-neutral-500'
                        }`}>
                          <User size={12} />
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          <div className="flex items-center gap-1">
                            {/* Mobile: last name only */}
                            <span className="font-heading font-extrabold text-[10px] text-neutral-800 truncate block md:hidden leading-tight">
                              {pilotLastName(pilot.name)}
                            </span>
                            {/* Desktop: full name before comma */}
                            <span className="font-heading font-extrabold text-[11px] text-neutral-800 truncate hidden md:block leading-tight">
                              {pilot.name.split(',')[0]}
                            </span>
                            {isCurrent && (
                              <span className="bg-primary/10 text-primary text-[7px] font-bold px-1 py-0.5 rounded-full uppercase shrink-0 tracking-wider leading-none">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-[8px] md:text-[9px] text-neutral-400 font-semibold uppercase block truncate">
                            {pilot.rank === 'captain' ? 'CPT' : 'F/O'}
                            <span className="hidden md:inline"> · {pilot.qualifications.join('/')}</span>
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* ── Stats cells — desktop only ── */}
                    <td className="hidden md:table-cell px-2 py-3 border-r border-border text-center font-mono font-bold text-[11px] text-neutral-700">{stats.hours}h</td>
                    <td className="hidden md:table-cell px-2 py-3 border-r border-border text-center font-mono font-semibold text-[11px] text-neutral-600">{stats.sectors}</td>
                    <td className="hidden md:table-cell px-2 py-3 border-r border-border text-center font-mono text-[11px] text-neutral-500">{stats.standby}</td>

                    {/* ── Day Cells ── */}
                    {days.map(day => {
                      const duties = getDutiesForPilotDay(pilot.id, day);
                      const weekend = isWeekend(day);
                      const interactive = duties.filter(d => d.duty_type === 'flight' || d.duty_type === 'standby');
                      const isClickable = interactive.length > 0;

                      return (
                        <td
                          key={day}
                          onClick={() => isClickable && handleCellClick(pilot, duties, day)}
                          className={`p-0.5 md:p-1 border-r border-border/30 align-middle ${
                            weekend ? 'bg-neutral-50/60' : ''
                          } ${isClickable ? 'cursor-pointer' : ''}`}
                          style={{ width: 'max(28px, calc((100vw - 90px) / 10))', minWidth: 28 }}
                        >
                          <div className="flex flex-col gap-0.5 items-center justify-center">
                            {duties.length === 0 ? (
                              <span className="text-neutral-200 font-mono text-[10px] select-none">·</span>
                            ) : (
                              duties.map(duty => (
                                <div
                                  key={duty.id}
                                  className={`${dutyColors(duty)} w-full rounded font-bold flex flex-col items-center justify-center
                                    py-0.5 md:py-1 leading-none
                                    ${isClickable ? 'hover:scale-105 transition-transform' : ''}
                                  `}
                                >
                                  {/* Code label — always visible */}
                                  <span className="text-[9px] md:text-[10px] font-extrabold tracking-tighter leading-none">
                                    {dutyCode(duty)}
                                  </span>
                                  {/* Destination sub-label — desktop only */}
                                  {duty.duty_type === 'flight' && duty.destination && (
                                    <span className="hidden md:block text-[8px] font-semibold text-neutral-500 leading-none mt-px">
                                      {duty.destination}
                                    </span>
                                  )}
                                </div>
                              ))
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

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 md:gap-4 justify-start items-center bg-white/30 p-3 rounded-xl border border-border/40 text-[10px] font-semibold text-neutral-600">
        <span className="text-xs font-bold text-neutral-700">LEGEND:</span>
        {[
          { label: '201', bg: 'bg-white border border-neutral-200 text-neutral-800', desc: 'Flight (Tap to Swap)' },
          { label: 'SB',  bg: 'bg-amber-50 border border-amber-100 text-amber-700',   desc: 'Standby (Tap to Swap)' },
          { label: 'X',   bg: 'bg-emerald-50 border border-emerald-100 text-emerald-600', desc: 'Day Off' },
          { label: 'SIM', bg: 'bg-teal-50 border border-teal-100 text-teal-700',      desc: 'Simulator / Training' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`w-5 h-5 ${item.bg} shadow-sm rounded flex items-center justify-center text-[9px] font-extrabold`}>
              {item.label}
            </span>
            <span>{item.desc}</span>
          </div>
        ))}
      </div>

      {/* ── Bottom-sheet Popover ────────────────────────────────────────── */}
      {activePopover && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/40 backdrop-blur-sm"
          onClick={() => setActivePopover(null)}
        >
          <div
            ref={sheetRef}
            className="w-full sm:w-[380px] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border/60 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-neutral-200 rounded-full" />
            </div>

            {/* Sheet header */}
            <div className="flex items-start justify-between px-5 pt-3 pb-2 border-b border-border/40">
              <div>
                <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                  May {activePopover.day} · {activePopover.pilot.rank === 'captain' ? 'CPT' : 'F/O'}{' '}
                  {activePopover.pilot.name.split(',')[0]}
                </p>
                <h4 className="text-base font-heading font-extrabold text-neutral-800 mt-0.5">
                  {activePopover.duties.map(d => dutyCode(d)).join(' / ')}
                </h4>
              </div>
              <button
                onClick={() => setActivePopover(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors cursor-pointer shrink-0 mt-0.5"
              >
                <X size={16} />
              </button>
            </div>

            {/* Duty details */}
            <div className="px-5 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
              {activePopover.duties.map(duty => (
                <div key={duty.id} className={`p-3 rounded-xl border ${dutyColors(duty)} space-y-1.5`}>
                  {duty.duty_type === 'flight' ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Plane size={13} className="text-primary shrink-0" />
                        <span className="text-sm font-heading font-bold text-neutral-800">
                          {duty.flight_number} · {duty.origin} → {duty.destination}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <Clock size={12} className="shrink-0" />
                        <span>
                          Dep {formatTime(duty.departure_time)} · Arr {formatTime(duty.arrival_time)}
                        </span>
                      </div>
                      {duty.block_time_mins != null && (
                        <p className="text-xs text-neutral-500">
                          Block: {Math.floor(duty.block_time_mins / 60)}h {duty.block_time_mins % 60}m
                          {duty.aircraft_type ? ` · ${duty.aircraft_type}` : ''}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-heading font-bold text-amber-700">Standby (SB)</span>
                      {duty.reporting_time && (
                        <span className="text-xs text-neutral-500">from {formatTime(duty.reporting_time)}</span>
                      )}
                      {duty.release_time && (
                        <span className="text-xs text-neutral-500">· until {formatTime(duty.release_time)}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-5 pb-6 pt-3">
              <button
                onClick={handlePopoverAction}
                className="w-full py-3 rounded-xl font-heading font-bold text-sm text-white bg-primary hover:bg-primary-hover transition-colors cursor-pointer shadow-md shadow-primary/20"
              >
                {activePopover.pilot.id === currentPilotId
                  ? '✦ Post This Duty for Swap'
                  : `✦ Propose Swap with ${activePopover.pilot.name.split(',')[0]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
