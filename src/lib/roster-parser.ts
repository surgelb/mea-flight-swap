export interface PilotMetadata {
  first_name: string;
  last_name: string;
  name: string;
  id: string;
  rank: 'captain' | 'first_officer';
  base: string;
  qualifications: string[];
  username?: string;
  email?: string;
}

export interface Duty {
  day_number: number;
  duty_type: 'flight' | 'standby' | 'training' | 'off';
  flight_number: string | null;
  origin: string | null;
  destination: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  reporting_time: string | null;
  release_time: string | null;
  aircraft_type: string | null;
}

export interface RosterParseResult {
  isValidRoster: boolean;
  pilot_metadata: PilotMetadata;
  duties: Duty[];
}

export function getUsernameAndEmail(first_name: string, last_name: string) {
  const firstName = first_name.trim().toLowerCase();
  const lastName = last_name.trim().toLowerCase();
  const firstLetter = firstName.charAt(0);
  const cleanLastName = lastName.replace(/\s+/g, ''); // strip spaces in compound last names
  const username = `${firstLetter}.${cleanLastName}`;
  const email = `${username}@mea.com.lb`;
  return { username, email };
}

export function parseRosterTextProgrammatic(text: string): RosterParseResult | null {
  try {
    const normalized = text.replace(/[ \t]+/g, ' ').replace(/\r\n/g, '\n').trim();
    const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

    let name = '';
    let id = '';
    let rank: 'captain' | 'first_officer' = 'first_officer';
    let base = 'BEY';
    let qualifications: string[] = [];

    // Extract pilot metadata
    for (const line of lines) {
      if (line.toUpperCase().includes('NAME:')) {
        name = line.split(/NAME:/i)[1].trim();
      }
      if (line.toUpperCase().includes('ID:')) {
        const parts = line.split(/ID:/i)[1].trim();
        const idMatch = parts.match(/^(\d+)/);
        if (idMatch) id = idMatch[1];
        
        const parenMatch = parts.match(/\(([^)]+)\)/);
        if (parenMatch) {
          const details = parenMatch[1].split(' ');
          if (details.length >= 2) {
            const rankPart = details[1];
            if (rankPart.toUpperCase().startsWith('CPT') || rankPart.toUpperCase().startsWith('CAPTAIN')) {
              rank = 'captain';
            } else {
              rank = 'first_officer';
            }
            
            if (details[0]) base = details[0];
          }
          
          // Extract qualifications
          const qualsList = parenMatch[1].split(',');
          qualsList.forEach((q) => {
            const cleanQual = q.replace(/[^A-Za-z0-9-]/g, '').trim();
            if (cleanQual) {
              const fleetMatch = cleanQual.match(/A\d{3}[A-Z]?/i) || cleanQual.match(/FO-A\d{3}[A-Z]?/i) || cleanQual.match(/CPT-A\d{3}[A-Z]?/i);
              if (fleetMatch) {
                const rating = cleanQual.replace(/^(FO-|CPT-)/i, '');
                if (!qualifications.includes(rating)) {
                  qualifications.push(rating);
                }
              }
            }
          });
        }
      }
    }

    if (!name || !id) {
      return null; // Failed to parse metadata
    }

    let first_name = '';
    let last_name = '';
    if (name.includes(',')) {
      const parts = name.split(',');
      last_name = parts[0].trim();
      const firstPart = parts[1].trim().split(' ');
      first_name = firstPart[0].trim();
    } else {
      const parts = name.split(' ');
      first_name = parts[0] || '';
      last_name = parts.slice(1).join(' ') || '';
    }

    // Extract year and month programmatically
    let year = '2026';
    let month = '05';
    
    const periodMatch = text.match(/Period:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (periodMatch) {
      year = periodMatch[3];
      month = periodMatch[2];
    } else {
      const rangeMatch = text.match(/\b(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i);
      if (rangeMatch) {
        year = rangeMatch[3];
        const months: Record<string, string> = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        const mStr = rangeMatch[2].toLowerCase();
        if (months[mStr]) {
          month = months[mStr];
        }
      }
    }

    // Find header index
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('1 Fri') && lines[i].includes('2 Sat') && lines[i].includes('31 Sun')) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      return null; // Failed to find grid
    }

    // Extract known flight dates from OTHER CREW MEMBERS
    const knownFlightDates: { day: number; flightNumber: string }[] = [];
    const otherCrewRegex = /(\d{2})\/(\d{2})\/(\d{4})(\d+[A-Z]?)/g;
    let match;
    while ((match = otherCrewRegex.exec(text)) !== null) {
      knownFlightDates.push({
        day: parseInt(match[1], 10),
        flightNumber: match[4]
      });
    }

    // Extract training dates
    const trainingDates: { day: number; time: string }[] = [];
    const trainingRegex = /(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/g;
    while ((match = trainingRegex.exec(text)) !== null) {
      trainingDates.push({
        day: parseInt(match[1], 10),
        time: `${match[3]}:${match[4]}`
      });
    }

    const cellLines = lines.slice(headerIndex + 1);
    const gridLines = [];
    for (const line of cellLines) {
      const upper = line.toUpperCase();
      if (upper.includes('CODEDESCRIPTION') || 
          upper.includes('CREDIT HRS') || 
          upper.includes('BLOCK HRS') || 
          upper.includes('DESCRIPTIONTOTAL') ||
          upper.includes('OTHER CREW MEMBERS') ||
          upper.includes('TRAINING') ||
          upper.includes('INDICATORDESCRIPTION') ||
          upper.includes('PAGE:')) {
        break;
      }
      gridLines.push(line);
    }
    const cellText = gridLines.join(' ').replace(/[()]/g, ' $& ').replace(/\s+/g, ' ').trim();
    const rawTokens = cellText.split(' ').filter(Boolean);

    const tokens: string[] = [];
    const dutyMergedRegex = /^(?:[.\-X]|RO|RD|LVET|Rest)+$/;
    
    function peelTokens(word: string): string[] {
      const codes = ['LVET', 'Rest', 'RO', 'RD', 'SB', 'X', '.', '-'];
      const result: string[] = [];
      let current = word.trim();
      while (current.length > 0) {
        let matched = false;
        for (const code of codes) {
          if (current.startsWith(code)) {
            result.push(code);
            current = current.substring(code.length);
            matched = true;
            break;
          }
        }
        if (!matched) {
          result.push(current[0]);
          current = current.substring(1);
        }
      }
      return result;
    }

    for (const token of rawTokens) {
      if (dutyMergedRegex.test(token)) {
        tokens.push(...peelTokens(token));
      } else {
        tokens.push(token);
      }
    }

    // Parse raw events sequentially
    const rawEvents: any[] = [];
    let tokenIdx = 0;
    
    while (tokenIdx < tokens.length) {
      const token = tokens[tokenIdx];
      const dayOffCodes = ['X', 'RO', 'Rest', 'LVET', 'RD'];
      const availableCodes = ['.', '-'];
      
      if (dayOffCodes.includes(token) || availableCodes.includes(token)) {
        rawEvents.push({ type: 'off', desc: token });
        tokenIdx++;
        continue;
      }
      
      if (token === 'SB') {
        const start = tokens[tokenIdx + 1];
        const end = tokens[tokenIdx + 2];
        rawEvents.push({ type: 'standby', start, end });
        tokenIdx += 3;
        continue;
      }
      
      let isFlight = false;
      let flightTokenOffset = 0;
      
      if (token === 'e' && /^\d+$/.test(tokens[tokenIdx + 1])) {
        isFlight = true;
        flightTokenOffset = 1;
      } else if (/^\d+$/.test(token)) {
        isFlight = true;
        flightTokenOffset = 0;
      }
      
      if (isFlight) {
        const flightsInGroup: any[] = [];
        
        while (tokenIdx < tokens.length) {
          const currentToken = tokens[tokenIdx];
          let currentFlightOffset = 0;
          let isCurrentFlight = false;
          
          if (currentToken === 'e' && /^\d+$/.test(tokens[tokenIdx + 1])) {
            isCurrentFlight = true;
            currentFlightOffset = 1;
          } else if (/^\d+$/.test(currentToken)) {
            isCurrentFlight = true;
            currentFlightOffset = 0;
          }
          
          if (!isCurrentFlight) break;
          
          const flightNumRaw = tokens[tokenIdx + currentFlightOffset];
          const depTime = tokens[tokenIdx + currentFlightOffset + 1];
          const origin = tokens[tokenIdx + currentFlightOffset + 2];
          const destination = tokens[tokenIdx + currentFlightOffset + 3];
          const arrTime = tokens[tokenIdx + currentFlightOffset + 4];
          
          let acType: string | null = null;
          let acTokenCount = 0;
          
          if (tokens[tokenIdx + currentFlightOffset + 5] === '(') {
            acType = tokens[tokenIdx + currentFlightOffset + 6];
            acTokenCount = 3; 
          } else if (tokens[tokenIdx + currentFlightOffset + 5] && tokens[tokenIdx + currentFlightOffset + 5].startsWith('(')) {
            acType = tokens[tokenIdx + currentFlightOffset + 5].replace(/[()]/g, '');
            acTokenCount = 1;
            if (tokens[tokenIdx + currentFlightOffset + 6] === ')') {
              acTokenCount = 2;
            }
          }
          
          flightsInGroup.push({
            flight_number: `ME${flightNumRaw}`,
            flight_number_raw: flightNumRaw,
            origin,
            destination,
            departure_time: depTime,
            arrival_time: arrTime,
            aircraft_type: acType
          });
          
          tokenIdx += currentFlightOffset + 5 + acTokenCount;
          
          const nextToken = tokens[tokenIdx];
          const nextNextToken = tokens[tokenIdx + 1];
          
          let hasMoreFlights = false;
          if (nextToken === 'e' && /^\d+$/.test(nextNextToken)) {
            const nextNextNextToken = tokens[tokenIdx + 2];
            if (nextNextNextToken && nextNextNextToken.includes(':')) {
              const currArrParts = arrTime.split(':').map(Number);
              const nextDepParts = nextNextNextToken.split(':').map(Number);
              const currMinutes = currArrParts[0] * 60 + currArrParts[1];
              const nextMinutes = nextDepParts[0] * 60 + nextDepParts[1];
              let diff = nextMinutes - currMinutes;
              if (diff < 0) diff += 24 * 60;
              if (diff <= 240) hasMoreFlights = true;
            }
          } else if (/^\d+$/.test(nextToken)) {
            if (nextNextToken && nextNextToken.includes(':')) {
              const currArrParts = arrTime.split(':').map(Number);
              const nextDepParts = nextNextToken.split(':').map(Number);
              const currMinutes = currArrParts[0] * 60 + currArrParts[1];
              const nextMinutes = nextDepParts[0] * 60 + nextDepParts[1];
              let diff = nextMinutes - currMinutes;
              if (diff < 0) diff += 24 * 60;
              if (diff <= 240) hasMoreFlights = true;
            }
          }
          
          if (!hasMoreFlights) break;
        }
        
        rawEvents.push({ type: 'flight_group', flights: flightsInGroup });
        continue;
      }
      
      rawEvents.push({ type: 'unknown', desc: token });
      tokenIdx++;
    }

    // Align raw events to calendar days using known dates
    const alignedDuties: Duty[] = [];
    let currentDay = 1;

    function getKnownDateForFlightGroup(group: any): number | null {
      for (const fl of group.flights) {
        const tr = trainingDates.find(t => t.time === fl.departure_time);
        if (tr) return tr.day;
        
        const oc = knownFlightDates.find(k => k.flightNumber.replace(/[A-Z]$/i, '') === fl.flight_number_raw);
        if (oc) return oc.day;
      }
      return null;
    }

    for (const event of rawEvents) {
      if (event.type === 'flight_group') {
        const knownDay = getKnownDateForFlightGroup(event);
        if (knownDay !== null && knownDay > currentDay) {
          while (currentDay < knownDay) {
            alignedDuties.push({
              day_number: currentDay,
              duty_type: 'off',
              flight_number: null,
              origin: null,
              destination: null,
              departure_time: null,
              arrival_time: null,
              reporting_time: null,
              release_time: null,
              aircraft_type: null
            });
            currentDay++;
          }
        }
        
        event.flights.forEach((fl: any) => {
          alignedDuties.push({
            day_number: currentDay,
            duty_type: 'flight',
            flight_number: fl.flight_number,
            origin: fl.origin,
            destination: fl.destination,
            departure_time: `${year}-${month}-${currentDay.toString().padStart(2, '0')}T${fl.departure_time}:00Z`,
            arrival_time: `${year}-${month}-${currentDay.toString().padStart(2, '0')}T${fl.arrival_time}:00Z`,
            reporting_time: `${year}-${month}-${currentDay.toString().padStart(2, '0')}T${fl.departure_time}:00Z`,
            release_time: `${year}-${month}-${currentDay.toString().padStart(2, '0')}T${fl.arrival_time}:00Z`,
            aircraft_type: fl.aircraft_type
          });
        });
        currentDay++;
      } else if (event.type === 'standby') {
        alignedDuties.push({
          day_number: currentDay,
          duty_type: 'standby',
          flight_number: null,
          origin: null,
          destination: null,
          departure_time: null,
          arrival_time: null,
          reporting_time: `${year}-${month}-${currentDay.toString().padStart(2, '0')}T${event.start}:00Z`,
          release_time: `${year}-${month}-${currentDay.toString().padStart(2, '0')}T${event.end}:00Z`,
          aircraft_type: null
        });
        currentDay++;
      } else if (event.type === 'off') {
        alignedDuties.push({
          day_number: currentDay,
          duty_type: 'off',
          flight_number: null,
          origin: null,
          destination: null,
          departure_time: null,
          arrival_time: null,
          reporting_time: null,
          release_time: null,
          aircraft_type: null
        });
        currentDay++;
      } else {
        currentDay++;
      }
    }

    while (currentDay <= 31) {
      alignedDuties.push({
        day_number: currentDay,
        duty_type: 'off',
        flight_number: null,
        origin: null,
        destination: null,
        departure_time: null,
        arrival_time: null,
        reporting_time: null,
        release_time: null,
        aircraft_type: null
      });
      currentDay++;
    }

    return {
      isValidRoster: true,
      pilot_metadata: {
        first_name,
        last_name,
        name,
        id,
        rank,
        base,
        qualifications
      },
      duties: alignedDuties
    };
  } catch (error) {
    console.error('Error in parseRosterTextProgrammatic:', error);
    return null;
  }
}
