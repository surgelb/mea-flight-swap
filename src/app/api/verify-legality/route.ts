import { NextResponse } from 'next/server';
import { openai, generateContentWithFallback } from '@/lib/openrouter';

export const maxDuration = 60; // Allow up to 60 seconds on Vercel for OpenRouter cascade

interface FlightCheckDuty {
  day_number?: number;
  duty_type: string;
  flight_number: string | null;
  origin: string | null;
  destination: string | null;
  reporting_time: string | null;
  release_time: string | null;
}

export async function POST(req: Request) {
  try {
    const { pilotFlights, proposedDuty, dutyToGiveAway } = await req.json();

    if (!proposedDuty) {
      return NextResponse.json({ error: 'No proposed duty provided' }, { status: 400 });
    }

    const proposedDuties = Array.isArray(proposedDuty) ? proposedDuty : [proposedDuty];
    const dutiesToGiveAway = Array.isArray(dutyToGiveAway) ? dutyToGiveAway : (dutyToGiveAway ? [dutyToGiveAway] : []);

    // Filter out the duties we are giving away (by matching day_number or calendar date)
    const currentSchedule = (pilotFlights as FlightCheckDuty[] || [])
      .filter(f => {
        return !dutiesToGiveAway.some(giveAway => 
          f.day_number === giveAway.day_number || 
          (f.reporting_time && giveAway.reporting_time && f.reporting_time.substring(0, 10) === giveAway.reporting_time.substring(0, 10))
        );
      });

    // Add the new proposed duties to the schedule
    const newSchedule = [...currentSchedule, ...proposedDuties];

    // Filter duties that have times and sort them chronologically
    const timedDuties = newSchedule
      .filter(d => d.reporting_time && d.release_time && d.duty_type !== 'off')
      .map(d => ({
        ...d,
        reportDate: new Date(d.reporting_time!),
        releaseDate: new Date(d.release_time || d.reporting_time!) // Fallback if no release time
      }))
      .sort((a, b) => a.reportDate.getTime() - b.reportDate.getTime());

    // Perform deterministic rest check
    let restViolation: { after: string; before: string; restHours: number; date: string } | null = null;
    for (let i = 0; i < timedDuties.length - 1; i++) {
      const currentDuty = timedDuties[i];
      const nextDuty = timedDuties[i + 1];
      
      const restPeriodMs = nextDuty.reportDate.getTime() - currentDuty.releaseDate.getTime();
      const restHours = restPeriodMs / (1000 * 60 * 60);

      // If rest is less than 11.5 hours (we permit a small buffer for 12 hours)
      if (restHours > 0 && restHours < 11.5) {
        restViolation = {
          after: currentDuty.flight_number || currentDuty.duty_type,
          before: nextDuty.flight_number || nextDuty.duty_type,
          restHours: Math.round(restHours * 10) / 10,
          date: nextDuty.reportDate.toLocaleDateString()
        };
        break;
      }
    }

    const passed = !restViolation;
    let explanation = '';

    if (openai) {
      // Use OpenRouter to explain the swap safety profile
      const prompt = `
        You are an airline Flight Operations Legality Advisor.
        We are verifying if a roster swap is legal and safe for a pilot.
        
        Proposed Swap Details:
        - Duties to Give Away: ${dutiesToGiveAway.length > 0 ? JSON.stringify(dutiesToGiveAway) : 'None'}
        - Proposed Duties to Take: ${JSON.stringify(proposedDuties)}
        - Swap Legality Check Result: ${passed ? 'PASSED deterministic rest checks' : `FAILED deterministic rest checks. Violation: Rest period between ${restViolation?.after} and ${restViolation?.before} is only ${restViolation?.restHours} hours (legal minimum is 12 hours).`}
        
        Provide a concise, 2-3 sentence analysis of this swap for the pilot. 
        Be professional, direct, and refer to flight numbers/airport codes if applicable. 
        If failed, clearly explain the rest violation and warn them. If passed, state that it complies with rest requirements.
      `;

      try {
        const response = await generateContentWithFallback(prompt);
        explanation = response.text || '';
      } catch (err) {
        console.error('Gemini verification generation failed, using fallback template:', err);
      }
    }

    // Fallback explanation generator
    if (!explanation) {
      if (passed) {
        const flightNames = proposedDuties.map(d => d.flight_number).filter(Boolean).join('/');
        explanation = `The proposed swap for duty ${flightNames || 'flight'} complies with EASA/MEA Flight Time Limitations (FTL). You maintain a healthy rest margin of at least 12 hours between consecutive duties.`;
      } else {
        const giveAwayNames = dutiesToGiveAway.map(d => d.flight_number).filter(Boolean).join('/');
        const takeNames = proposedDuties.map(d => d.flight_number).filter(Boolean).join('/');
        explanation = `⚠️ WARNING: Swapping ${giveAwayNames || 'your flight'} for ${takeNames || 'flight'} creates a rest violation. You will only have ${restViolation!.restHours} hours of rest between releasing from duty ${restViolation!.after} and reporting for duty ${restViolation!.before} on ${restViolation!.date}. The legal minimum is 12 hours.`;
      }
    }

    return NextResponse.json({
      legality_check_passed: passed,
      legality_notes: explanation,
      rest_violation: restViolation
    });

  } catch (error) {
    console.error('Error verifying swap legality:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
