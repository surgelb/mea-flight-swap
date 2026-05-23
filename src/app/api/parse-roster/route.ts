import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { openai, generateContentWithFallback, cleanAndParseJson } from '@/lib/openrouter';
import { parseRosterTextProgrammatic, Duty } from '@/lib/roster-parser';

export const maxDuration = 60; // Allow up to 60 seconds on Vercel for OpenRouter cascade

function cleanRosterText(text: string): string {
  // Collapse multiple spaces
  let cleaned = text.replace(/[ \t]+/g, ' ');
  // Collapse multiple newlines
  cleaned = cleaned.replace(/\n\s*\n+/g, '\n');
  
  // Truncate at "OTHER CREW MEMBERS" to discard the massive table at the bottom and avoid confusion/token waste
  const truncateIndex = cleaned.toUpperCase().indexOf('OTHER CREW MEMBERS');
  if (truncateIndex !== -1) {
    cleaned = cleaned.substring(0, truncateIndex);
  }
  
  return cleaned.trim();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log(`Parsing file: ${file.name}, size: ${file.size} bytes`);

    // Error if OpenRouter key is missing
    if (!openai) {
      console.error('[Parse Roster API] OPENROUTER_API_KEY is not set.');
      return NextResponse.json({ 
        error: 'Roster parsing service is temporarily unavailable (missing API key configuration).' 
      }, { status: 500 });
    }


    // Actual Gemini parser code
    const fileBytes = await file.arrayBuffer();
    const base64File = Buffer.from(fileBytes).toString('base64');
    const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

    let contentPayload: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    
    if (isPDF) {
      try {
        const textResult = await pdf(Buffer.from(fileBytes));
        
        console.log('[Parse Roster API] Trying programmatic PDF parsing...');
        const programmaticResult = parseRosterTextProgrammatic(textResult.text);
        if (programmaticResult) {
          console.log('[Parse Roster API] Programmatic PDF parsing succeeded!');
          const cleanResult = {
            pilot_metadata: {
              name: programmaticResult.pilot_metadata.name,
              id: programmaticResult.pilot_metadata.id,
              rank: programmaticResult.pilot_metadata.rank,
              base: programmaticResult.pilot_metadata.base
            },
            duties: programmaticResult.duties.map((d: Duty) => ({
              day_number: d.day_number,
              duty_type: d.duty_type,
              flight_number: d.flight_number,
              origin: d.origin,
              destination: d.destination,
              departure_time: d.departure_time,
              arrival_time: d.arrival_time,
              aircraft_type: d.aircraft_type
            }))
          };
          return NextResponse.json(cleanResult);
        }

        console.log('[Parse Roster API] Programmatic parser returned null, falling back to OpenRouter LLM...');
        const cleanedText = cleanRosterText(textResult.text);
        contentPayload = [{ text: `Roster Text Content:\n${cleanedText}` }];
      } catch (parseError) {
        console.error('[Parse Roster API] pdf-parse error:', parseError);
        const message = parseError instanceof Error ? parseError.message : String(parseError);
        return NextResponse.json({ 
          error: `Failed to parse PDF document text: ${message}` 
        }, { status: 400 });
      }
    } else {
      contentPayload = [
        {
          inlineData: {
            mimeType: file.type || 'image/png',
            data: base64File
          }
        }
      ];
    }

    const prompt = `
      You are an expert aviation document parsing assistant.
      Analyze the provided Middle East Airlines (MEA) "Personal Crew Schedule Report" pilot roster.
      
      The document contains:
      1. Pilot info at the top: NAME, ID, and qualifications (e.g. "BEY FO-A320, A321, A32A" -> Base BEY, Rank FO (First Officer), qualifications A320 family).
      2. A calendar grid for the month with days 1 to 31. Each day cell has vertically stacked duties, flight numbers (e.g. 201, 202, 418), reporting times, departure/arrival airports, block times, and codes like "SB" (Standby) or "X" (Day Off).
      3. A "TRAINING" table and "OTHER CREW MEMBERS" table at the bottom.
      
      First, extract the pilot's metadata:
      - name (string)
      - id (string)
      - rank ("captain" for CPT, "first_officer" for FO)
      - base (string, e.g. "BEY")
      - qualifications (array of strings, e.g. ["A320", "A321"])
      
      Second, extract all duties for each calendar day:
      - For flight legs (e.g. "201 \n 05:11 \n BEY \n LHR \n 10:09 \n (A321)"):
        - duty_type: "flight"
        - flight_number: "ME201" (prepend ME to short numbers)
        - origin: "BEY"
        - destination: "LHR"
        - departure_time: combine the calendar day date (assume May 2026 based on header) and departure time (e.g. "05:11")
        - arrival_time: combine the calendar day date and arrival time (e.g. "10:09")
        - aircraft_type: "A321"
      - For standby (e.g. "SB \n 12:01 \n 23:59"):
        - duty_type: "standby"
        - flight_number: null
        - reporting_time: start of standby combined with the calendar date
        - release_time: end of standby combined with the calendar date
      - For day off ("X"):
        - duty_type: "off"
      - For simulator or training duties (from the TRAINING grid at the bottom):
        - duty_type: "training"
        - flight_number: description
      
      CRITICAL DEDUPLICATION AND MERGING RULE:
      The PDF text extracted might repeat information multiple times. You MUST ensure you DO NOT output duplicate duties, and you MUST guarantee exactly one duty row per calendar day.
      - For each calendar day, there should only be one main duty category (and exactly one object in the "duties" array).
      - If a day contains a flight or simulator/training duty, DO NOT output any standby or day-off ("off") duties for that day.
      - If a day contains multiple distinct flight legs (e.g., a roundtrip ME201 and ME202 on the same day), you MUST combine them into a single flight duty for that day:
        - flight_number: combine numbers with a slash (e.g. "ME201/ME202")
        - origin: origin of the first flight (e.g. "BEY")
        - destination: destination of the first flight (e.g. "LHR")
        - departure_time: combine calendar day date and departure time of the first flight
        - arrival_time: combine calendar day date and arrival time of the last flight
        - aircraft_type: combine aircraft types if different (e.g. "A321/A320")
      Deduplicate and merge all duties thoroughly so that you return exactly one duty object per day.
      
      Return a valid JSON object matching this schema:
      {
        "pilot_metadata": {
          "name": string,
          "id": string,
          "rank": "captain" | "first_officer",
          "base": string
        },
        "duties": [
          {
            "day_number": number,
            "duty_type": "flight" | "standby" | "simulator" | "off" | "training",
            "flight_number": string or null,
            "origin": string or null,
            "destination": string or null,
            "departure_time": string or null,
            "arrival_time": string or null,
            "aircraft_type": string or null
          }
        ]
      }
    `;

    contentPayload.push({ text: prompt });

    const response = await generateContentWithFallback(contentPayload, {
      responseMimeType: 'application/json'
    });


    const parsedText = response.text || '{}';
    try {
      return NextResponse.json(cleanAndParseJson(parsedText));
    } catch (parseErr) {
      console.error('[Parse Roster API] Failed to parse JSON response:', parsedText, parseErr);
      return NextResponse.json({ error: 'Failed to interpret parser results. Please try again.' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in parse-roster API:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
