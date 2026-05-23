import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { openai, generateContentWithFallback, cleanAndParseJson } from '@/lib/openrouter';

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

    console.log(`[Register Roster API] Processing file: ${file.name}, size: ${file.size} bytes`);

    // Parse the PDF buffer using pdf-parse
    let rawText = '';
    try {
      const fileBytes = await file.arrayBuffer();
      
      const textResult = await pdf(Buffer.from(fileBytes));
      rawText = textResult.text;
    } catch (parseError) {
      console.error('[Register Roster API] pdf-parse error:', parseError);
      const message = parseError instanceof Error ? parseError.message : String(parseError);
      return NextResponse.json({ 
        error: `Failed to extract text from the PDF: ${message}` 
      }, { status: 400 });
    }

    const text = cleanRosterText(rawText);

    if (!text || text.length < 50) {
      return NextResponse.json({ 
        error: 'The uploaded file contains insufficient text. Please upload a valid MEA Crew Roster PDF.' 
      }, { status: 400 });
    }

    // Error if OpenRouter key is missing
    if (!openai) {
      console.error('[Register Roster API] OPENROUTER_API_KEY is not set.');
      return NextResponse.json({ 
        error: 'Roster parsing service is temporarily unavailable (missing API key configuration).' 
      }, { status: 500 });
    }


    const prompt = `
      You are an expert aviation document parsing assistant.
      Analyze the provided Middle East Airlines (MEA) "Personal Crew Schedule Report" pilot roster text.
      
      First, verify if this text corresponds to a valid MEA crew schedule/roster.
      Note that flight numbers in the text may be printed as just numbers (e.g. 201, 310, 426, 217) without the "ME" prefix.
      If it contains typical elements of an MEA roster (like numeric flight patterns 201/310/426/265/217, or mentions of BEY, CPT, FO, crew ID, qualification, name), set "isValidRoster" to true. Otherwise, if it is completely irrelevant text, set "isValidRoster" to false.
      
      Second, extract the pilot's metadata:
      - first_name (the pilot's legal first name, e.g. "NAIM" from "MOGHABGHAB, NAIM ghassan" or "RAYAN" from "MROUEH, RAYAN jamal")
      - last_name (the pilot's legal last name, e.g. "MOGHABGHAB" or "MROUEH")
      - name (the full raw name string as printed, e.g., "MOGHABGHAB, NAIM ghassan")
      - id (the crew ID / code, string)
      - rank ("captain" for CPT, "first_officer" for FO or F/O)
      - base (string, usually "BEY")
      - qualifications (array of strings, e.g. ["A320", "A321"])
      
      Third, extract all duties for each calendar day (assume May 2026 based on scheduling period if not specified):
      - For flight legs:
      - duty_type: "flight"
      - flight_number: (e.g. "ME201")
      - origin: (3 letter code, e.g. "BEY")
      - destination: (3 letter code, e.g. "LHR")
      - departure_time: combine calendar day (e.g. 2026-05-01) and departure time (e.g. 05:11) to UTC ISO string
      - arrival_time: combine calendar day and arrival time to UTC ISO string
      - aircraft_type: (e.g. "A321", "A320")
      - For standby (e.g. "SB"):
      - duty_type: "standby"
      - reporting_time: combine day and start time
      - release_time: combine day and end time
      - For day off ("X" or "RO" or "Rest"):
      - duty_type: "off"
      - For training/simulator (e.g. SIM, CRM):
      - duty_type: "training"
      - flight_number: description
      
      CRITICAL DEDUPLICATION RULE:
      The PDF text extracted might repeat information multiple times (e.g. once in the grid and again in a detailed summary list at the bottom). You MUST ensure you DO NOT output duplicate duties.
      - For each calendar day, there should only be one main duty category.
      - If a day contains a flight or simulator/training duty, DO NOT output any standby or day-off ("off") duties for that day.
      - Do not output the exact same flight leg (same flight number, origin, destination, and times) twice.
      - A day can have multiple duties only if they are distinct flight legs (e.g., flight ME201 and ME202 on the same day).
      - Deduplicate all duties thoroughly before returning.
      
      Return a valid JSON object matching this schema:
      {
        "isValidRoster": boolean,
        "invalidReason": string (optional, if isValidRoster is false),
        "pilot_metadata": {
          "first_name": string,
          "last_name": string,
          "name": string,
          "id": string,
          "rank": "captain" | "first_officer",
          "base": string,
          "qualifications": string[]
        },
        "duties": [
          {
            "day_number": number,
            "duty_type": "flight" | "standby" | "training" | "off",
            "flight_number": string or null,
            "origin": string or null,
            "destination": string or null,
            "departure_time": string or null,
            "arrival_time": string or null,
            "reporting_time": string or null,
            "release_time": string or null,
            "aircraft_type": string or null
          }
        ]
      }
    `;

    const response = await generateContentWithFallback(
      [
        { text: `Roster Text Content:\n${text}` },
        { text: prompt }
      ],
      {
        responseMimeType: 'application/json'
      }
    );


    const parsedText = response.text || '{}';
    let result;
    try {
      result = cleanAndParseJson(parsedText);
    } catch {
      console.error('[Register Roster API] Failed to parse Gemini JSON response:', parsedText);
      return NextResponse.json({ error: 'Failed to interpret parser results. Please try again.' }, { status: 500 });
    }

    if (!result.isValidRoster) {
      return NextResponse.json({ 
        error: result.invalidReason || 'The uploaded file does not appear to be a valid MEA Crew Roster.' 
      }, { status: 400 });
    }

    // Process pilot metadata to programmatically generate uniform username and email
    if (result.pilot_metadata) {
      const firstName = (result.pilot_metadata.first_name || '').trim().toLowerCase();
      const lastName = (result.pilot_metadata.last_name || '').trim().toLowerCase();
      
      if (!firstName || !lastName) {
        return NextResponse.json({ 
          error: 'Failed to extract pilot first/last name from roster. Please ensure the document is clear.' 
        }, { status: 400 });
      }

      // Convention: [first letter of first name].[last name]
      const firstLetter = firstName.charAt(0);
      const cleanLastName = lastName.replace(/\s+/g, ''); // strip spaces in compound last names
      const username = `${firstLetter}.${cleanLastName}`;
      const email = `${username}@mea.com.lb`;

      result.pilot_metadata = {
        ...result.pilot_metadata,
        username,
        email
      };
    } else {
      return NextResponse.json({ error: 'Failed to extract pilot metadata.' }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Register Roster API] Exception:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
