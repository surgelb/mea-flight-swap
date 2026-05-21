// Local database manager with localStorage persistence for visual mock state and Supabase integration
import { hasSupabase, supabase } from './supabase';

export interface PilotProfile {
  id: string;
  email: string;
  name: string;
  rank: 'captain' | 'first_officer';
  base: string;
  qualifications: string[];
}

export interface FlightDuty {
  id: string;
  pilot_id: string;
  duty_type: 'flight' | 'standby' | 'simulator' | 'off' | 'training';
  flight_number: string | null;
  origin: string | null;
  destination: string | null;
  departure_time: string | null; // ISO UTC string
  arrival_time: string | null;   // ISO UTC string
  reporting_time: string | null; // ISO UTC string
  release_time: string | null;   // ISO UTC string
  block_time_mins: number | null;
  aircraft_type: string | null;
  day_number: number;
}

export interface SwapRequest {
  id: string;
  pilot_id: string;
  flight_id: string;
  preferred_destination: string;
  preferred_date_range_start: string;
  preferred_date_range_end: string;
  notes: string;
  status: 'open' | 'matched' | 'cancelled';
  created_at: string;
}

export interface SwapProposal {
  id: string;
  request_id: string;
  proposer_id: string;
  proposed_flight_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  legality_check_passed: boolean;
  legality_notes: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

// Mock initial data matching user schedule reports
const initialProfiles: PilotProfile[] = [
  {
    id: 'naim-id',
    email: 'n.moghabghab@mea.com.lb',
    name: 'MOGHABGHAB, NAIM ghassan',
    rank: 'first_officer',
    base: 'BEY',
    qualifications: ['A320', 'A321', 'A32A']
  },
  {
    id: 'rayan-id',
    email: 'r.mroueh@mea.com.lb',
    name: 'MROUEH, RAYAN jamal',
    rank: 'first_officer',
    base: 'BEY',
    qualifications: ['A320', 'A321', 'A32A']
  },
  {
    id: 'shibli-id',
    email: 's.awanni@mea.com.lb',
    name: 'AWANNI, SHIBLI ri',
    rank: 'first_officer',
    base: 'BEY',
    qualifications: ['A321']
  },
  {
    id: 'rami-id',
    email: 'r.abboud@mea.com.lb',
    name: 'ABBOUD, RAMI hassan',
    rank: 'first_officer',
    base: 'BEY',
    qualifications: ['A321']
  },
  {
    id: 'jamil-id',
    email: 'j.abdulmalak@mea.com.lb',
    name: 'ABDUL MALAK, JAMIL mah',
    rank: 'first_officer',
    base: 'BEY',
    qualifications: ['A330']
  },
  {
    id: 'khaled-id',
    email: 'k.abijomaa@mea.com.lb',
    name: 'ABI JOMAA, KHALED hoss',
    rank: 'first_officer',
    base: 'BEY',
    qualifications: ['A320']
  },
  {
    id: 'richard-id',
    email: 'r.abitorbey@mea.com.lb',
    name: 'ABI TOBBY, RICHARD an',
    rank: 'first_officer',
    base: 'BEY',
    qualifications: ['A330']
  },
  {
    id: 'paul-id',
    email: 'p.aboueiwan@mea.com.lb',
    name: 'ABOU EIWAN, PAUL edmon',
    rank: 'first_officer',
    base: 'BEY',
    qualifications: ['A330']
  },
  {
    id: 'ziad-id',
    email: 'z.abourjily@mea.com.lb',
    name: 'ABOU RJILY, ZIAD wali',
    rank: 'first_officer',
    base: 'BEY',
    qualifications: ['A321']
  },
  {
    id: 'julio-id',
    email: 'j.abousaleh@mea.com.lb',
    name: 'ABOU SALEH, JULIO mich',
    rank: 'first_officer',
    base: 'BEY',
    qualifications: ['A321']
  }
];

// Helper to generate monthly schedules for grid demo
const generateDutiesForPilot = (pilotId: string, specificDuties: { [day: number]: Partial<FlightDuty> }): FlightDuty[] => {
  const duties: FlightDuty[] = [];
  for (let day = 1; day <= 31; day++) {
    const key = `f-${pilotId}-${day}`;
    if (specificDuties[day]) {
      const spec = specificDuties[day];
      duties.push({
        id: key,
        pilot_id: pilotId,
        duty_type: spec.duty_type || 'flight',
        flight_number: spec.flight_number || null,
        origin: spec.origin || null,
        destination: spec.destination || null,
        departure_time: spec.departure_time || null,
        arrival_time: spec.arrival_time || null,
        reporting_time: spec.reporting_time || null,
        release_time: spec.release_time || null,
        block_time_mins: spec.block_time_mins || null,
        aircraft_type: spec.aircraft_type || null,
        day_number: day,
      });
    } else {
      // Default to off-days pattern
      const isOff = (day % 5 === 0) || (day % 7 === 0);
      duties.push({
        id: key,
        pilot_id: pilotId,
        duty_type: isOff ? 'off' : 'flight', // flight but null flight_number means available
        flight_number: null,
        origin: null,
        destination: null,
        departure_time: null,
        arrival_time: null,
        reporting_time: null,
        release_time: null,
        block_time_mins: null,
        aircraft_type: null,
        day_number: day,
      });
    }
  }
  return duties;
};

const initialFlights: FlightDuty[] = [
  // NAIM MOGHABGHAB (FO) - Image 1
  {
    id: 'f-naim-1',
    pilot_id: 'naim-id',
    duty_type: 'flight',
    flight_number: 'ME201',
    origin: 'BEY',
    destination: 'LHR',
    departure_time: '2026-05-01T05:11:00Z',
    arrival_time: '2026-05-01T10:09:00Z',
    reporting_time: '2026-05-01T04:11:00Z',
    release_time: '2026-05-01T10:39:00Z',
    block_time_mins: 298,
    aircraft_type: 'A321',
    day_number: 1
  },
  {
    id: 'f-naim-2',
    pilot_id: 'naim-id',
    duty_type: 'flight',
    flight_number: 'ME202',
    origin: 'LHR',
    destination: 'BEY',
    departure_time: '2026-05-02T12:34:00Z',
    arrival_time: '2026-05-02T17:24:00Z',
    reporting_time: '2026-05-02T11:34:00Z',
    release_time: '2026-05-02T17:54:00Z',
    block_time_mins: 290,
    aircraft_type: 'A321',
    day_number: 2
  },
  { id: 'f-naim-3', pilot_id: 'naim-id', duty_type: 'off', flight_number: null, origin: null, destination: null, departure_time: null, arrival_time: null, reporting_time: null, release_time: null, block_time_mins: null, aircraft_type: null, day_number: 3 },
  { id: 'f-naim-4', pilot_id: 'naim-id', duty_type: 'off', flight_number: null, origin: null, destination: null, departure_time: null, arrival_time: null, reporting_time: null, release_time: null, block_time_mins: null, aircraft_type: null, day_number: 4 },
  {
    id: 'f-naim-5-1',
    pilot_id: 'naim-id',
    duty_type: 'training',
    flight_number: 'SIM-1',
    origin: 'BEY',
    destination: 'BEY',
    departure_time: '2026-05-05T04:28:00Z',
    arrival_time: '2026-05-05T06:29:00Z',
    reporting_time: '2026-05-05T04:28:00Z',
    release_time: '2026-05-05T06:29:00Z',
    block_time_mins: 121,
    aircraft_type: 'A320',
    day_number: 5
  },
  {
    id: 'f-naim-6',
    pilot_id: 'naim-id',
    duty_type: 'standby',
    flight_number: null,
    origin: 'BEY',
    destination: null,
    departure_time: '2026-05-06T12:01:00Z',
    arrival_time: '2026-05-06T23:59:00Z',
    reporting_time: '2026-05-06T12:01:00Z',
    release_time: '2026-05-06T23:59:00Z',
    block_time_mins: 718,
    aircraft_type: null,
    day_number: 6
  },
  {
    id: 'f-naim-15-1',
    pilot_id: 'naim-id',
    duty_type: 'flight',
    flight_number: 'ME310',
    origin: 'BEY',
    destination: 'AMM',
    departure_time: '2026-05-15T04:30:00Z',
    arrival_time: '2026-05-15T05:24:00Z',
    reporting_time: '2026-05-15T03:30:00Z',
    release_time: '2026-05-15T05:54:00Z',
    block_time_mins: 54,
    aircraft_type: 'A320',
    day_number: 15
  },
  {
    id: 'f-naim-15-2',
    pilot_id: 'naim-id',
    duty_type: 'flight',
    flight_number: 'ME311',
    origin: 'AMM',
    destination: 'BEY',
    departure_time: '2026-05-15T06:19:00Z',
    arrival_time: '2026-05-15T07:15:00Z',
    reporting_time: '2026-05-15T05:49:00Z',
    release_time: '2026-05-15T07:45:00Z',
    block_time_mins: 56,
    aircraft_type: 'A320',
    day_number: 15
  },
  {
    id: 'f-naim-15-3',
    pilot_id: 'naim-id',
    duty_type: 'flight',
    flight_number: 'ME320',
    origin: 'BEY',
    destination: 'BGW',
    departure_time: '2026-05-15T08:50:00Z',
    arrival_time: '2026-05-15T10:22:00Z',
    reporting_time: '2026-05-15T07:50:00Z',
    release_time: '2026-05-15T10:52:00Z',
    block_time_mins: 92,
    aircraft_type: 'A320',
    day_number: 15
  },
  {
    id: 'f-naim-15-4',
    pilot_id: 'naim-id',
    duty_type: 'flight',
    flight_number: 'ME321',
    origin: 'BGW',
    destination: 'BEY',
    departure_time: '2026-05-15T11:09:00Z',
    arrival_time: '2026-05-15T12:57:00Z',
    reporting_time: '2026-05-15T10:39:00Z',
    release_time: '2026-05-15T13:27:00Z',
    block_time_mins: 108,
    aircraft_type: 'A320',
    day_number: 15
  },

  // RAYAN MROUEH (FO) - Image 2
  {
    id: 'f-rayan-5-1',
    pilot_id: 'rayan-id',
    duty_type: 'flight',
    flight_number: 'ME418',
    origin: 'BEY',
    destination: 'AUH',
    departure_time: '2026-05-05T12:35:00Z',
    arrival_time: '2026-05-05T16:00:00Z',
    reporting_time: '2026-05-05T11:35:00Z',
    release_time: '2026-05-05T16:30:00Z',
    block_time_mins: 205,
    aircraft_type: 'A321',
    day_number: 5
  },
  {
    id: 'f-rayan-5-2',
    pilot_id: 'rayan-id',
    duty_type: 'flight',
    flight_number: 'ME419',
    origin: 'AUH',
    destination: 'BEY',
    departure_time: '2026-05-05T16:55:00Z',
    arrival_time: '2026-05-05T21:10:00Z',
    reporting_time: '2026-05-05T16:25:00Z',
    release_time: '2026-05-05T21:40:00Z',
    block_time_mins: 255,
    aircraft_type: 'A321',
    day_number: 5
  },
  {
    id: 'f-rayan-10-1',
    pilot_id: 'rayan-id',
    duty_type: 'flight',
    flight_number: 'ME201',
    origin: 'BEY',
    destination: 'LHR',
    departure_time: '2026-05-10T05:10:00Z',
    arrival_time: '2026-05-10T10:15:00Z',
    reporting_time: '2026-05-10T04:10:00Z',
    release_time: '2026-05-10T10:45:00Z',
    block_time_mins: 305,
    aircraft_type: 'A321',
    day_number: 10
  },
  {
    id: 'f-rayan-10-2',
    pilot_id: 'rayan-id',
    duty_type: 'flight',
    flight_number: 'ME202',
    origin: 'LHR',
    destination: 'BEY',
    departure_time: '2026-05-10T12:00:00Z',
    arrival_time: '2026-05-10T16:35:00Z',
    reporting_time: '2026-05-10T11:00:00Z',
    release_time: '2026-05-10T17:05:00Z',
    block_time_mins: 275,
    aircraft_type: 'A321',
    day_number: 10
  },

  // Seeded schedule items for additional MEA crew matching the attached PDF schedule
  ...generateDutiesForPilot('shibli-id', {
    1: { duty_type: 'off' }, // RO
    2: { duty_type: 'flight', flight_number: 'ME422', origin: 'BEY', destination: 'DXB', reporting_time: '2026-05-02T11:00:00Z', release_time: '2026-05-02T18:00:00Z', block_time_mins: 220, aircraft_type: 'A321' },
    3: { duty_type: 'flight', flight_number: 'ME436', origin: 'BEY', destination: 'DOH', reporting_time: '2026-05-03T12:00:00Z', release_time: '2026-05-03T19:00:00Z', block_time_mins: 180, aircraft_type: 'A321' },
    4: { duty_type: 'standby', reporting_time: '2026-05-04T12:01:00Z', release_time: '2026-05-04T23:59:00Z' },
    5: { duty_type: 'standby', reporting_time: '2026-05-05T12:01:00Z', release_time: '2026-05-05T23:59:00Z' },
    6: { duty_type: 'off' }, // X
    7: { duty_type: 'flight', flight_number: 'ME322', origin: 'BEY', destination: 'CAI', reporting_time: '2026-05-07T08:00:00Z', release_time: '2026-05-07T14:00:00Z', block_time_mins: 90, aircraft_type: 'A321' },
    11: { duty_type: 'flight', flight_number: 'ME312', origin: 'BEY', destination: 'LHR', reporting_time: '2026-05-11T12:00:00Z', release_time: '2026-05-11T18:00:00Z', block_time_mins: 300, aircraft_type: 'A321' },
    12: { duty_type: 'flight', flight_number: 'ME322', origin: 'BEY', destination: 'DXB', reporting_time: '2026-05-12T11:00:00Z', release_time: '2026-05-12T18:00:00Z', block_time_mins: 220, aircraft_type: 'A321' },
    13: { duty_type: 'flight', flight_number: 'ME434', origin: 'BEY', destination: 'DOH', reporting_time: '2026-05-13T10:00:00Z', release_time: '2026-05-13T17:00:00Z', block_time_mins: 180, aircraft_type: 'A321' }
  }),
  ...generateDutiesForPilot('rami-id', {
    1: { duty_type: 'off' }, // X
    2: { duty_type: 'flight', flight_number: 'ME251', origin: 'BEY', destination: 'ATH', reporting_time: '2026-05-02T10:00:00Z', release_time: '2026-05-02T15:00:00Z', block_time_mins: 120, aircraft_type: 'A321' },
    3: { duty_type: 'standby', reporting_time: '2026-05-03T00:01:00Z', release_time: '2026-05-03T12:00:00Z' },
    4: { duty_type: 'flight', flight_number: 'ME364', origin: 'BEY', destination: 'AMM', reporting_time: '2026-05-04T07:00:00Z', release_time: '2026-05-04T11:00:00Z', block_time_mins: 60, aircraft_type: 'A321' },
    5: { duty_type: 'standby', reporting_time: '2026-05-05T00:01:00Z', release_time: '2026-05-05T12:00:00Z' },
    6: { duty_type: 'flight', flight_number: 'ME426', origin: 'BEY', destination: 'DXB', reporting_time: '2026-05-06T15:00:00Z', release_time: '2026-05-06T22:00:00Z', block_time_mins: 220, aircraft_type: 'A321' },
    10: { duty_type: 'flight', flight_number: 'ME426', origin: 'BEY', destination: 'DXB', reporting_time: '2026-05-10T15:00:00Z', release_time: '2026-05-10T22:00:00Z', block_time_mins: 220, aircraft_type: 'A321' }
  }),
  ...generateDutiesForPilot('jamil-id', {
    2: { duty_type: 'flight', flight_number: 'ME324', origin: 'BEY', destination: 'CAI', reporting_time: '2026-05-02T09:00:00Z', release_time: '2026-05-02T15:00:00Z', block_time_mins: 90, aircraft_type: 'A330' },
    3: { duty_type: 'standby', reporting_time: '2026-05-03T12:01:00Z', release_time: '2026-05-03T23:59:00Z' },
    4: { duty_type: 'flight', flight_number: 'ME434', origin: 'BEY', destination: 'DOH', reporting_time: '2026-05-04T10:00:00Z', release_time: '2026-05-04T17:00:00Z', block_time_mins: 180, aircraft_type: 'A330' },
    5: { duty_type: 'off' }, // RO
    6: { duty_type: 'off' }, // X
    7: { duty_type: 'flight', flight_number: 'ME422', origin: 'BEY', destination: 'DXB', reporting_time: '2026-05-07T11:00:00Z', release_time: '2026-05-07T18:00:00Z', block_time_mins: 220, aircraft_type: 'A330' }
  }),
  ...generateDutiesForPilot('khaled-id', {
    1: { duty_type: 'off' },
    2: { duty_type: 'off' },
    3: { duty_type: 'off' },
    4: { duty_type: 'off' },
    5: { duty_type: 'training', flight_number: 'CEO11', reporting_time: '2026-05-05T08:00:00Z', release_time: '2026-05-05T16:00:00Z' },
    6: { duty_type: 'flight', flight_number: 'ME426', origin: 'BEY', destination: 'DXB', block_time_mins: 220, aircraft_type: 'A320' },
    7: { duty_type: 'flight', flight_number: 'ME326', origin: 'BEY', destination: 'CAI', block_time_mins: 90, aircraft_type: 'A320' }
  }),
  ...generateDutiesForPilot('richard-id', {
    1: { duty_type: 'flight', flight_number: 'ME211', origin: 'BEY', destination: 'LHR', block_time_mins: 300, aircraft_type: 'A330' },
    3: { duty_type: 'flight', flight_number: 'ME428', origin: 'BEY', destination: 'DXB', block_time_mins: 220, aircraft_type: 'A330' },
    4: { duty_type: 'flight', flight_number: 'ME322', origin: 'BEY', destination: 'CAI', block_time_mins: 90, aircraft_type: 'A330' },
    5: { duty_type: 'off' },
    6: { duty_type: 'standby', reporting_time: '2026-05-06T12:01:00Z', release_time: '2026-05-06T23:59:00Z' }
  }),
  ...generateDutiesForPilot('paul-id', {
    1: { duty_type: 'standby', reporting_time: '2026-05-01T00:01:00Z', release_time: '2026-05-01T12:00:00Z' },
    3: { duty_type: 'flight', flight_number: 'ME229', origin: 'BEY', destination: 'PAR', block_time_mins: 280, aircraft_type: 'A330' },
    4: { duty_type: 'off' },
    5: { duty_type: 'flight', flight_number: 'ME430', origin: 'BEY', destination: 'DXB', block_time_mins: 220, aircraft_type: 'A330' },
    6: { duty_type: 'off' },
    7: { duty_type: 'flight', flight_number: 'ME211', origin: 'BEY', destination: 'LHR', block_time_mins: 300, aircraft_type: 'A330' }
  }),
  ...generateDutiesForPilot('ziad-id', {
    2: { duty_type: 'flight', flight_number: 'ME229', origin: 'BEY', destination: 'PAR', block_time_mins: 280, aircraft_type: 'A321' },
    3: { duty_type: 'standby', reporting_time: '2026-05-03T12:01:00Z', release_time: '2026-05-03T23:59:00Z' },
    4: { duty_type: 'standby', reporting_time: '2026-05-04T12:01:00Z', release_time: '2026-05-04T23:59:00Z' },
    5: { duty_type: 'off' },
    6: { duty_type: 'standby', reporting_time: '2026-05-06T00:01:00Z', release_time: '2026-05-06T12:00:00Z' }
  }),
  ...generateDutiesForPilot('julio-id', {
    1: { duty_type: 'flight', flight_number: 'ME217', origin: 'BEY', destination: 'FCO', block_time_mins: 200, aircraft_type: 'A321' },
    2: { duty_type: 'standby', reporting_time: '2026-05-02T02:00:00Z', release_time: '2026-05-02T14:00:00Z' },
    4: { duty_type: 'flight', flight_number: 'ME442', origin: 'BEY', destination: 'DOH', block_time_mins: 180, aircraft_type: 'A321' },
    5: { duty_type: 'off' },
    6: { duty_type: 'flight', flight_number: 'ME247', origin: 'BEY', destination: 'MAD', block_time_mins: 300, aircraft_type: 'A321' },
    7: { duty_type: 'standby', reporting_time: '2026-05-07T12:01:00Z', release_time: '2026-05-07T23:59:00Z' }
  })
];

const initialSwapRequests: SwapRequest[] = [
  {
    id: 'req-rayan-1',
    pilot_id: 'rayan-id',
    flight_id: 'f-rayan-10-1', // Rayan wants to swap ME201 London flight on May 10
    preferred_destination: 'Gulf (DXB/AUH) or Off Days',
    preferred_date_range_start: '2026-05-10',
    preferred_date_range_end: '2026-05-12',
    notes: 'Need to swap LHR on the 10th. Prefer a regional sector or weekend off if possible.',
    status: 'open',
    created_at: '2026-05-20T10:00:00Z'
  }
];

// Database operations helper
class DB {
  private isBrowser = typeof window !== 'undefined';
  private syncIntervalId: any = null;

  constructor() {
    if (this.isBrowser) {
      // Initialize local storage from defaults if empty or outdated
      this.initLocalStorage();

      // Start Supabase background synchronization if configured
      if (hasSupabase) {
        this.syncFromSupabase();
        this.syncIntervalId = setInterval(() => {
          this.syncFromSupabase();
        }, 3000);
      }
    }
  }

  private initLocalStorage() {
    let existingProfiles: PilotProfile[] = [];
    try {
      const stored = localStorage.getItem('mfs_profiles');
      if (stored) {
        existingProfiles = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error reading mfs_profiles", e);
    }

    const isOutdated = !localStorage.getItem('mfs_profiles') || existingProfiles.length < 10;

    if (isOutdated) {
      localStorage.setItem('mfs_profiles', JSON.stringify(initialProfiles));
      localStorage.setItem('mfs_flights', JSON.stringify(initialFlights));
      localStorage.setItem('mfs_swaps', JSON.stringify(initialSwapRequests));
      localStorage.setItem('mfs_proposals', JSON.stringify([]));
      localStorage.setItem('mfs_messages', JSON.stringify([
        {
          id: 'msg-init-1',
          room_id: 'room-rayan-naim',
          sender_id: 'rayan-id',
          content: "Hey Naim! I saw you offered a swap. Are you open to trading the LHR sector?",
          created_at: new Date(Date.now() - 3600000).toISOString()
        }
      ]));
    }
    if (!localStorage.getItem('mfs_current_pilot_id')) {
      localStorage.setItem('mfs_current_pilot_id', 'naim-id');
    }
  }

  private async syncFromSupabase() {
    try {
      const [profilesRes, flightsRes, swapsRes, proposalsRes, messagesRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('flight_duties').select('*'),
        supabase.from('swap_requests').select('*'),
        supabase.from('swap_proposals').select('*'),
        supabase.from('chat_messages').select('*')
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (flightsRes.error) throw flightsRes.error;
      if (swapsRes.error) throw swapsRes.error;
      if (proposalsRes.error) throw proposalsRes.error;
      if (messagesRes.error) throw messagesRes.error;

      if (profilesRes.data && profilesRes.data.length > 0) {
        localStorage.setItem('mfs_profiles', JSON.stringify(profilesRes.data));
      }
      if (flightsRes.data) {
        localStorage.setItem('mfs_flights', JSON.stringify(flightsRes.data));
      }
      if (swapsRes.data) {
        localStorage.setItem('mfs_swaps', JSON.stringify(swapsRes.data));
      }
      if (proposalsRes.data) {
        localStorage.setItem('mfs_proposals', JSON.stringify(proposalsRes.data));
      }
      if (messagesRes.data) {
        localStorage.setItem('mfs_messages', JSON.stringify(messagesRes.data));
      }
    } catch (err) {
      console.warn('Supabase sync warning (operating in mock fallback):', err);
    }
  }

  private get<T>(key: string, fallback: T): T {
    if (!this.isBrowser) return fallback;
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  }

  private set(key: string, data: any) {
    if (this.isBrowser) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  }

  // Session management
  getCurrentPilotId(): string {
    return this.get('mfs_current_pilot_id', 'naim-id');
  }

  setCurrentPilotId(id: string) {
    this.set('mfs_current_pilot_id', id);
  }

  getCurrentPilot(): PilotProfile {
    const id = this.getCurrentPilotId();
    return this.getProfiles().find(p => p.id === id) || initialProfiles[0];
  }

  // Profiles
  getProfiles(): PilotProfile[] {
    return this.get('mfs_profiles', initialProfiles);
  }

  updateProfile(profile: PilotProfile) {
    const profiles = this.getProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx !== -1) {
      profiles[idx] = profile;
    } else {
      profiles.push(profile);
    }
    this.set('mfs_profiles', profiles);

    if (hasSupabase) {
      supabase.from('profiles').upsert(profile).then(({ error }: any) => {
        if (error) console.error('Supabase write error (profiles):', error);
      });
    }
  }

  // Flights
  getFlights(pilotId?: string): FlightDuty[] {
    const flights = this.get('mfs_flights', initialFlights);
    if (pilotId) {
      return flights.filter(f => f.pilot_id === pilotId);
    }
    return flights;
  }

  saveFlights(newFlights: FlightDuty[]) {
    const flights = this.get('mfs_flights', initialFlights);
    // Remove existing flights for the pilots that we are overwriting
    const pilotIds = Array.from(new Set(newFlights.map(f => f.pilot_id)));
    const filtered = flights.filter(f => !pilotIds.includes(f.pilot_id));
    const combined = [...filtered, ...newFlights];
    this.set('mfs_flights', combined);

    if (hasSupabase) {
      supabase.from('flight_duties').upsert(newFlights).then(({ error }: any) => {
        if (error) console.error('Supabase write error (flight_duties):', error);
      });
    }
  }

  // Swap Requests
  getSwapRequests(): SwapRequest[] {
    return this.get('mfs_swaps', initialSwapRequests);
  }

  createSwapRequest(req: Omit<SwapRequest, 'id' | 'created_at' | 'status'>) {
    const swaps = this.getSwapRequests();
    const newReq: SwapRequest = {
      ...req,
      id: `req-${Math.random().toString(36).substr(2, 9)}`,
      status: 'open',
      created_at: new Date().toISOString()
    };
    swaps.push(newReq);
    this.set('mfs_swaps', swaps);

    if (hasSupabase) {
      supabase.from('swap_requests').insert(newReq).then(({ error }: any) => {
        if (error) console.error('Supabase write error (swap_requests):', error);
      });
    }
    return newReq;
  }

  // Proposals
  getProposals(requestId?: string): SwapProposal[] {
    const proposals = this.get<SwapProposal[]>('mfs_proposals', []);
    if (requestId) {
      return proposals.filter(p => p.request_id === requestId);
    }
    return proposals;
  }

  createProposal(prop: Omit<SwapProposal, 'id' | 'created_at' | 'status'>) {
    const proposals = this.getProposals();
    const newProp: SwapProposal = {
      ...prop,
      id: `prop-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    proposals.push(newProp);
    this.set('mfs_proposals', proposals);

    if (hasSupabase) {
      supabase.from('swap_proposals').insert(newProp).then(({ error }: any) => {
        if (error) console.error('Supabase write error (swap_proposals):', error);
      });
    }
    return newProp;
  }

  updateProposalStatus(id: string, status: 'accepted' | 'rejected') {
    const proposals = this.getProposals();
    const idx = proposals.findIndex(p => p.id === id);
    if (idx !== -1) {
      proposals[idx].status = status;
      this.set('mfs_proposals', proposals);

      if (hasSupabase) {
        supabase.from('swap_proposals').update({ status }).eq('id', id).then(({ error }: any) => {
          if (error) console.error('Supabase write error (update proposals):', error);
        });
      }

      // If accepted, update the swap request status to matched
      if (status === 'accepted') {
        const swaps = this.getSwapRequests();
        const sIdx = swaps.findIndex(s => s.id === proposals[idx].request_id);
        if (sIdx !== -1) {
          swaps[sIdx].status = 'matched';
          this.set('mfs_swaps', swaps);

          if (hasSupabase) {
            supabase.from('swap_requests').update({ status: 'matched' }).eq('id', proposals[idx].request_id).then(({ error }: any) => {
              if (error) console.error('Supabase write error (update swap requests):', error);
            });
          }
        }
      }
    }
  }

  // Messages / Chat
  getMessages(roomId: string): ChatMessage[] {
    const messages = this.get<ChatMessage[]>('mfs_messages', []);
    return messages.filter(m => m.room_id === roomId).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  sendMessage(roomId: string, senderId: string, content: string) {
    const messages = this.getMessages(roomId);
    const newMsg: ChatMessage = {
      id: `msg-${Math.random().toString(36).substr(2, 9)}`,
      room_id: roomId,
      sender_id: senderId,
      content,
      created_at: new Date().toISOString()
    };
    const allMessages = this.get<ChatMessage[]>('mfs_messages', []);
    allMessages.push(newMsg);
    this.set('mfs_messages', allMessages);

    if (hasSupabase) {
      supabase.from('chat_messages').insert(newMsg).then(({ error }: any) => {
        if (error) console.error('Supabase write error (chat_messages):', error);
      });
    }
    return newMsg;
  }
}

export const db = new DB();
export default db;
