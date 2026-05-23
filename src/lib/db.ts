// Local database manager with localStorage persistence for visual mock state and Supabase integration
import { hasSupabase, supabase } from './supabase';

export interface PilotProfile {
  id: string;
  email: string;
  name: string;
  username: string;
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
const initialProfiles: PilotProfile[] = [];
const initialFlights: FlightDuty[] = [];
const initialSwapRequests: SwapRequest[] = [];
const initialMessages: ChatMessage[] = [];

// Database operations helper
class DB {
  private isBrowser = typeof window !== 'undefined';
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;

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

    const legacyIds = [
      'naim-id', 'rayan-id', 'shibli-id', 'rami-id', 'jamil-id', 
      'khaled-id', 'richard-id', 'paul-id', 'ziad-id', 'julio-id'
    ];
    const hasLegacyIds = existingProfiles.some(p => legacyIds.includes(p.id)) || 
                         legacyIds.includes(localStorage.getItem('mfs_current_pilot_id') || '');

    if (hasLegacyIds) {
      localStorage.removeItem('mfs_profiles');
      localStorage.removeItem('mfs_flights');
      localStorage.removeItem('mfs_swaps');
      localStorage.removeItem('mfs_proposals');
      localStorage.removeItem('mfs_messages');
      localStorage.removeItem('mfs_current_pilot_id');
      existingProfiles = [];
    }

    if (!localStorage.getItem('mfs_profiles')) {
      localStorage.setItem('mfs_profiles', JSON.stringify([]));
    }
    if (!localStorage.getItem('mfs_flights')) {
      localStorage.setItem('mfs_flights', JSON.stringify([]));
    }
    if (!localStorage.getItem('mfs_swaps')) {
      localStorage.setItem('mfs_swaps', JSON.stringify([]));
    }
    if (!localStorage.getItem('mfs_proposals')) {
      localStorage.setItem('mfs_proposals', JSON.stringify([]));
    }
    if (!localStorage.getItem('mfs_messages')) {
      localStorage.setItem('mfs_messages', JSON.stringify([]));
    }
  }

  private async syncFromSupabase() {
    try {
      const syncTable = async (tableName: string, storageKey: string) => {
        try {
          const { data, error } = await supabase.from(tableName).select('*');
          if (error) {
            console.warn(`Supabase sync warning for table '${tableName}':`, error.message);
            return;
          }
          if (data) {
            localStorage.setItem(storageKey, JSON.stringify(data));
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn(`Supabase sync exception for table '${tableName}':`, errMsg);
        }
      };

      await Promise.all([
        syncTable('profiles', 'mfs_profiles'),
        syncTable('flight_duties', 'mfs_flights'),
        syncTable('swap_requests', 'mfs_swaps'),
        syncTable('swap_proposals', 'mfs_proposals'),
        syncTable('chat_messages', 'mfs_messages')
      ]);
    } catch (err) {
      console.warn('Supabase sync main execution error:', err);
    }
  }

  private get<T>(key: string, fallback: T): T {
    if (!this.isBrowser) return fallback;
    const val = localStorage.getItem(key);
    if (!val) return fallback;
    try {
      return JSON.parse(val);
    } catch {
      return val as unknown as T;
    }
  }

  private set<T>(key: string, data: T) {
    if (this.isBrowser) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  }

  // Session management
  getCurrentPilotId(): string | null {
    return this.get<string | null>('mfs_current_pilot_id', null);
  }

  setCurrentPilotId(id: string | null) {
    if (id === null) {
      if (this.isBrowser) {
        localStorage.removeItem('mfs_current_pilot_id');
      }
    } else {
      this.set('mfs_current_pilot_id', id);
    }
  }

  getCurrentPilot(): PilotProfile | null {
    const id = this.getCurrentPilotId();
    if (!id) return null;
    return this.getProfiles().find(p => p.id === id) || null;
  }

  // Profiles
  getProfiles(): PilotProfile[] {
    const stored = this.get<PilotProfile[]>('mfs_profiles', []);
    const mergedMap = new Map<string, PilotProfile>();
    
    // First, populate with initialProfiles
    initialProfiles.forEach(p => {
      const username = p.username || p.email.split('@')[0];
      mergedMap.set(p.id, { ...p, username });
    });
    
    // Then override/add with stored profiles (which may have been synced from Supabase)
    stored.forEach(p => {
      const username = p.username || p.email.split('@')[0];
      mergedMap.set(p.id, { ...p, username });
    });
    
    return Array.from(mergedMap.values());
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
      const { username: _username, ...supabaseProfile } = profile;
      void _username;
      supabase.from('profiles').upsert(supabaseProfile).then(({ error }) => {
        if (error) console.error('Supabase write error (profiles):', error);
      });
    }
  }

  async deleteProfile(id: string) {
    const stored = this.get<PilotProfile[]>('mfs_profiles', []);
    const filtered = stored.filter(p => p.id !== id);
    this.set('mfs_profiles', filtered);

    if (hasSupabase) {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) {
        console.error('Supabase delete error (profiles):', error);
      }
    }
  }

  // Flights
  getFlights(pilotId?: string | null): FlightDuty[] {
    if (pilotId === null) return [];
    const stored = this.get<FlightDuty[]>('mfs_flights', []);
    
    const mergedFlights = [...stored];
    const storedPilotIds = new Set(stored.map(f => f.pilot_id));
    
    for (const f of initialFlights) {
      if (!storedPilotIds.has(f.pilot_id)) {
        mergedFlights.push(f);
      }
    }
    
    if (pilotId !== undefined) {
      return mergedFlights.filter(f => f.pilot_id === pilotId);
    }
    return mergedFlights;
  }

  deduplicateDuties(duties: FlightDuty[]): FlightDuty[] {
    // Group duties by pilot_id first
    const dutiesByPilot: { [pilotId: string]: FlightDuty[] } = {};
    for (const duty of duties) {
      const pId = duty.pilot_id;
      if (!dutiesByPilot[pId]) {
        dutiesByPilot[pId] = [];
      }
      dutiesByPilot[pId].push(duty);
    }

    const finalDuties: FlightDuty[] = [];

    for (const pId in dutiesByPilot) {
      const pilotDuties = dutiesByPilot[pId];
      // Group duties by day_number for this pilot
      const dutiesByDay: { [day: number]: FlightDuty[] } = {};
      for (const duty of pilotDuties) {
        const day = duty.day_number;
        if (!dutiesByDay[day]) {
          dutiesByDay[day] = [];
        }
        dutiesByDay[day].push(duty);
      }

      for (const dayStr in dutiesByDay) {
        const day = parseInt(dayStr);
        const dayDuties = dutiesByDay[day];

        // Filter day duties:
        // If there is any "flight" or "training" or "simulator" duty, we discard any "off" or "standby" duties for that day.
        const hasFlightOrTraining = dayDuties.some(d => 
          d.duty_type === 'flight' || 
          d.duty_type === 'training' || 
          d.duty_type === 'simulator'
        );

        let filtered = dayDuties;
        if (hasFlightOrTraining) {
          filtered = dayDuties.filter(d => 
            d.duty_type === 'flight' || 
            d.duty_type === 'training' || 
            d.duty_type === 'simulator'
          );
        }

        // Remove exact duplicates
        const seenKeys = new Set<string>();
        const uniqueDayDuties: FlightDuty[] = [];

        for (const duty of filtered) {
          let key = '';
          if (duty.duty_type === 'flight') {
            const fNum = (duty.flight_number || '').trim().toUpperCase();
            const orig = (duty.origin || '').trim().toUpperCase();
            const dest = (duty.destination || '').trim().toUpperCase();
            const depTime = (duty.departure_time || '').trim();
            key = `flight-${fNum}-${orig}-${dest}-${depTime}`;
          } else if (duty.duty_type === 'standby') {
            const repTime = (duty.reporting_time || '').trim();
            const relTime = (duty.release_time || '').trim();
            key = `standby-${repTime}-${relTime}`;
          } else if (duty.duty_type === 'off') {
            key = `off`;
          } else {
            const fNum = (duty.flight_number || '').trim().toUpperCase();
            const depTime = (duty.departure_time || '').trim();
            key = `${duty.duty_type}-${fNum}-${depTime}`;
          }

          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueDayDuties.push(duty);
          }
        }

        finalDuties.push(...uniqueDayDuties);
      }
    }

    return finalDuties.sort((a, b) => {
      if (a.pilot_id !== b.pilot_id) {
        return a.pilot_id.localeCompare(b.pilot_id);
      }
      if (a.day_number !== b.day_number) {
        return a.day_number - b.day_number;
      }
      const aTime = a.departure_time || a.reporting_time || '';
      const bTime = b.departure_time || b.reporting_time || '';
      return aTime.localeCompare(bTime);
    });
  }

  async saveFlights(newFlights: FlightDuty[]) {
    const dedupedNewFlights = this.deduplicateDuties(newFlights);
    const flights = this.get('mfs_flights', initialFlights);
    // Remove existing flights for the pilots that we are overwriting
    const pilotIds = Array.from(new Set(dedupedNewFlights.map(f => f.pilot_id)));
    const filtered = flights.filter(f => !pilotIds.includes(f.pilot_id));
    const combined = [...filtered, ...dedupedNewFlights];
    this.set('mfs_flights', combined);

    if (hasSupabase) {
      try {
        // Delete existing flight duties in Supabase first
        const { error: deleteError } = await supabase
          .from('flight_duties')
          .delete()
          .in('pilot_id', pilotIds);

        if (deleteError) {
          console.error('Supabase delete error (flight_duties):', deleteError);
        }

        // Upsert the new flights
        const { error: upsertError } = await supabase
          .from('flight_duties')
          .upsert(dedupedNewFlights);

        if (upsertError) {
          console.error('Supabase write error (flight_duties):', upsertError);
        }
      } catch (err) {
        console.error('Supabase saveFlights exception:', err);
      }
    }
  }

  async clearFlightsForPilot(pilotId: string) {
    const flights = this.get('mfs_flights', initialFlights);
    const filtered = flights.filter(f => f.pilot_id !== pilotId);
    this.set('mfs_flights', filtered);

    if (hasSupabase) {
      try {
        const { error } = await supabase
          .from('flight_duties')
          .delete()
          .eq('pilot_id', pilotId);
        if (error) {
          console.error('Supabase delete error (clearFlightsForPilot):', error);
        }
      } catch (err) {
        console.error('Supabase clearFlightsForPilot exception:', err);
      }
    }
  }

  // Swap Requests
  getSwapRequests(): SwapRequest[] {
    const stored = this.get<SwapRequest[]>('mfs_swaps', initialSwapRequests);
    const mergedMap = new Map<string, SwapRequest>();
    
    // Populate with initialSwapRequests
    initialSwapRequests.forEach(r => mergedMap.set(r.id, r));
    
    // Override/add with stored swap requests
    stored.forEach(r => mergedMap.set(r.id, r));
    
    return Array.from(mergedMap.values());
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
      supabase.from('swap_requests').insert(newReq).then(({ error }) => {
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
      supabase.from('swap_proposals').insert(newProp).then(({ error }) => {
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
        supabase.from('swap_proposals').update({ status }).eq('id', id).then(({ error }) => {
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
            supabase.from('swap_requests').update({ status: 'matched' }).eq('id', proposals[idx].request_id).then(({ error }) => {
              if (error) console.error('Supabase write error (update swap requests):', error);
            });
          }
        }
      }
    }
  }

  // Messages / Chat
  getMessages(roomId: string): ChatMessage[] {
    const stored = this.get<ChatMessage[]>('mfs_messages', []);
    
    // Merge stored and initialMessages
    const mergedMap = new Map<string, ChatMessage>();
    initialMessages.forEach(m => mergedMap.set(m.id, m));
    stored.forEach(m => mergedMap.set(m.id, m));
    
    const messages = Array.from(mergedMap.values());
    return messages.filter(m => m.room_id === roomId).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  sendMessage(roomId: string, senderId: string, content: string) {
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
      supabase.from('chat_messages').insert(newMsg).then(({ error }) => {
        if (error) console.error('Supabase write error (chat_messages):', error);
      });
    }
    return newMsg;
  }
}

export const db = new DB();
export default db;
