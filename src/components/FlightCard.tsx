'use client';

import React from 'react';
import { Plane, Calendar, ShieldAlert, Coffee, Monitor } from 'lucide-react';
import { FlightDuty } from '@/lib/db';
import Card from './ui/Card';

interface FlightCardProps {
  duty: FlightDuty;
  showSwapButton?: boolean;
  onSwapClick?: (duty: FlightDuty) => void;
}

export default function FlightCard({ duty, showSwapButton = false, onSwapClick }: FlightCardProps) {
  const getIcon = () => {
    switch (duty.duty_type) {
      case 'flight':
        return <Plane className="text-primary rotate-45" size={20} />;
      case 'standby':
        return <ShieldAlert className="text-amber-500" size={20} />;
      case 'off':
        return <Coffee className="text-emerald-500" size={20} />;
      case 'training':
      case 'simulator':
        return <Monitor className="text-cta" size={20} />;
      default:
        return <Calendar className="text-neutral-500" size={20} />;
    }
  };

  const getBadgeColor = () => {
    switch (duty.duty_type) {
      case 'flight':
        return 'bg-pink-100 text-primary border border-pink-200';
      case 'standby':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'off':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'training':
      case 'simulator':
        return 'bg-violet-100 text-cta border border-violet-200';
      default:
        return 'bg-neutral-100 text-neutral-800';
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 px-5">
      <div className="flex items-center gap-4">
        {/* Timing Column */}
        <div className="flex flex-col items-center justify-center bg-amber-50 border border-amber-200/40 rounded-xl px-3 py-2 min-w-[70px]">
          <span className="text-xs text-neutral-500 font-medium">May</span>
          <span className="text-2xl font-heading font-bold text-neutral-800 leading-none mt-0.5">
            {duty.day_number}
          </span>
        </div>

        {/* Details Column */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 bg-neutral-100 rounded-lg">
              {getIcon()}
            </div>
            <span className={`text-xs uppercase font-semibold px-2 py-0.5 rounded-md ${getBadgeColor()}`}>
              {duty.duty_type}
            </span>
            {duty.aircraft_type && (
              <span className="text-[10px] bg-neutral-100 text-neutral-600 border border-neutral-200 px-1.5 py-0.5 rounded">
                {duty.aircraft_type}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            {duty.duty_type === 'flight' ? (
              <>
                <h4 className="text-base font-heading font-semibold text-neutral-800">
                  {duty.flight_number}
                </h4>
                <p className="text-sm text-neutral-600 font-medium">
                  {duty.origin} <span className="text-neutral-400 text-xs">→</span> {duty.destination}
                </p>
              </>
            ) : duty.duty_type === 'standby' ? (
              <h4 className="text-base font-heading font-semibold text-neutral-800">
                Home Standby (SB)
              </h4>
            ) : duty.duty_type === 'off' ? (
              <h4 className="text-base font-heading font-semibold text-neutral-800">
                Day Off (X)
              </h4>
            ) : (
              <h4 className="text-base font-heading font-semibold text-neutral-800">
                {duty.flight_number || 'Training Activity'}
              </h4>
            )}
          </div>

          {/* Time range */}
          {duty.reporting_time && (
            <p className="text-xs text-neutral-500 mt-1">
              {duty.duty_type === 'flight' ? 'FDP Report: ' : 'Duty Period: '}
              <span className="font-semibold text-neutral-600">
                {formatTime(duty.reporting_time)} - {formatTime(duty.release_time)}
              </span> (UTC)
            </p>
          )}
        </div>
      </div>

      {/* Action Column */}
      <div className="flex items-center justify-between md:justify-end gap-4 mt-2 md:mt-0 pt-2 md:pt-0 border-t border-neutral-100 md:border-t-0">
        {duty.block_time_mins && (
          <div className="text-right">
            <span className="text-xs text-neutral-400">Block Time</span>
            <p className="text-sm font-semibold text-neutral-700">
              {Math.floor(duty.block_time_mins / 60)}h {duty.block_time_mins % 60}m
            </p>
          </div>
        )}

        {showSwapButton && onSwapClick && duty.duty_type !== 'off' && (
          <button
            onClick={() => onSwapClick(duty)}
            className="px-4 py-2 text-xs font-heading font-semibold rounded-xl bg-cta text-white hover:bg-violet-600 transition-all glow-cta cursor-pointer"
          >
            Post Swap
          </button>
        )}
      </div>
    </Card>
  );
}
