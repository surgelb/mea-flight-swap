import 'pdf-parse/worker';
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';

// Initialize Gemini client if API key is provided
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log(`Parsing file: ${file.name}, size: ${file.size} bytes`);

    // Fallback mode if Gemini key is missing
    if (!ai) {
      console.warn('GEMINI_API_KEY is not set. Using simulated roster parsing.');
      // Simulate network & AI latency (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock parsed roster structure based on Naim's PDF
      const mockResult = {
        pilot_metadata: {
          name: "MOGHABGHAB, NAIM ghassan",
          id: "18684",
          rank: "first_officer",
          base: "BEY"
        },
        duties: [
          {
            day_number: 1,
            duty_type: "flight",
            flight_number: "ME201",
            origin: "BEY",
            destination: "LHR",
            departure_time: "2026-05-01T05:11:00Z",
            arrival_time: "2026-05-01T10:09:00Z",
            reporting_time: "2026-05-01T04:11:00Z",
            release_time: "2026-05-01T10:39:00Z",
            block_time_mins: 298,
            aircraft_type: "A321"
          },
          {
            day_number: 2,
            duty_type: "flight",
            flight_number: "ME202",
            origin: "LHR",
            destination: "BEY",
            departure_time: "2026-05-02T12:34:00Z",
            arrival_time: "2026-05-02T17:24:00Z",
            reporting_time: "2026-05-02T11:34:00Z",
            release_time: "2026-05-02T17:54:00Z",
            block_time_mins: 290,
            aircraft_type: "A321"
          },
          {
            day_number: 3,
            duty_type: "off"
          },
          {
            day_number: 4,
            duty_type: "off"
          },
          {
            day_number: 5,
            duty_type: "training",
            flight_number: "SIM-1",
            origin: "BEY",
            destination: "BEY",
            departure_time: "2026-05-05T04:28:00Z",
            arrival_time: "2026-05-05T06:29:00Z",
            reporting_time: "2026-05-05T04:28:00Z",
            release_time: "2026-05-05T06:29:00Z",
            block_time_mins: 121,
            aircraft_type: "A320"
          },
          {
            day_number: 6,
            duty_type: "standby",
            reporting_time: "2026-05-06T12:01:00Z",
            release_time: "2026-05-06T23:59:00Z"
          },
          {
            day_number: 15,
            duty_type: "flight",
            flight_number: "ME310",
            origin: "BEY",
            destination: "AMM",
            departure_time: "2026-05-15T04:30:00Z",
            arrival_time: "2026-05-15T05:24:00Z",
            reporting_time: "2026-05-15T03:30:00Z",
            release_time: "2026-05-15T05:54:00Z",
            block_time_mins: 54,
            aircraft_type: "A320"
          },
          {
            day_number: 15,
            duty_type: "flight",
            flight_number: "ME311",
            origin: "AMM",
            destination: "BEY",
            departure_time: "2026-05-15T06:19:00Z",
            arrival_time: "2026-05-15T07:15:00Z",
            reporting_time: "2026-05-15T05:49:00Z",
            release_time: "2026-05-15T07:45:00Z",
            block_time_mins: 56,
            aircraft_type: "A320"
          },
          {
            day_number: 18,
            duty_type: "flight",
            flight_number: "ME304",
            origin: "BEY",
            destination: "CAI",
            departure_time: "2026-05-18T08:30:00Z",
            arrival_time: "2026-05-18T10:05:00Z",
            reporting_time: "2026-05-18T07:30:00Z",
            release_time: "2026-05-18T10:35:00Z",
            block_time_mins: 95,
            aircraft_type: "A320"
          },
          {
            day_number: 18,
            duty_type: "flight",
            flight_number: "ME305",
            origin: "CAI",
            destination: "BEY",
            departure_time: "2026-05-18T11:19:00Z",
            arrival_time: "2026-05-18T12:34:00Z",
            reporting_time: "2026-05-18T10:49:00Z",
            release_time: "2026-05-18T13:04:00Z",
            block_time_mins: 75,
            aircraft_type: "A320"
          },
          {
            day_number: 21,
            duty_type: "flight",
            flight_number: "ME306",
            origin: "BEY",
            destination: "CAI",
            departure_time: "2026-05-21T15:15:00Z",
            arrival_time: "2026-05-21T16:35:00Z",
            reporting_time: "2026-05-21T14:15:00Z",
            release_time: "2026-05-21T17:05:00Z",
            block_time_mins: 80,
            aircraft_type: "A320"
          },
          {
            day_number: 22,
            duty_type: "flight",
            flight_number: "ME304",
            origin: "BEY",
            destination: "CAI",
            departure_time: "2026-05-22T08:40:00Z",
            arrival_time: "2026-05-22T10:00:00Z",
            reporting_time: "2026-05-22T07:40:00Z",
            release_time: "2026-05-22T10:30:00Z",
            block_time_mins: 80,
            aircraft_type: "A320"
          },
          {
            day_number: 22,
            duty_type: "flight",
            flight_number: "ME305",
            origin: "CAI",
            destination: "BEY",
            departure_time: "2026-05-22T11:00:00Z",
            arrival_time: "2026-05-22T12:20:00Z",
            reporting_time: "2026-05-22T10:30:00Z",
            release_time: "2026-05-22T12:50:00Z",
            block_time_mins: 80,
            aircraft_type: "A320"
          },
          {
            day_number: 27,
            duty_type: "flight",
            flight_number: "ME241",
            origin: "BEY",
            destination: "MAD",
            departure_time: "2026-05-27T06:15:00Z",
            arrival_time: "2026-05-27T11:15:00Z",
            reporting_time: "2026-05-27T05:15:00Z",
            release_time: "2026-05-27T11:45:00Z",
            block_time_mins: 300,
            aircraft_type: "A321"
          },
          {
            day_number: 27,
            duty_type: "flight",
            flight_number: "ME242",
            origin: "MAD",
            destination: "BEY",
            departure_time: "2026-05-27T12:45:00Z",
            arrival_time: "2026-05-27T17:25:00Z",
            reporting_time: "2026-05-27T11:45:00Z",
            release_time: "2026-05-27T17:55:00Z",
            block_time_mins: 280,
            aircraft_type: "A321"
          }
        ]
      };

      return NextResponse.json(mockResult);
    }

    // Actual Gemini parser code
    const fileBytes = await file.arrayBuffer();
    const base64File = Buffer.from(fileBytes).toString('base64');
    const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

    let contentPayload: any[] = [];
    
    if (isPDF) {
      try {
        const parser = new PDFParse({ data: Buffer.from(fileBytes) });
        const textResult = await parser.getText();
        contentPayload = [{ text: `Roster Text Content:\n${textResult.text}` }];
      } catch (parseError: any) {
        console.error('[Parse Roster API] pdf-parse error:', parseError);
        return NextResponse.json({ 
          error: `Failed to parse PDF document text: ${parseError.message || parseError}` 
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
      - For flight legs (e.g. "201 \\n 05:11 \\n BEY \\n LHR \\n 10:09 \\n (A321)"):
        - duty_type: "flight"
        - flight_number: "ME201" (prepend ME to short numbers)
        - origin: "BEY"
        - destination: "LHR"
        - departure_time: combine the calendar day date (assume May 2026 based on header) and departure time (e.g. "05:11")
        - arrival_time: combine the calendar day date and arrival time (e.g. "10:09")
        - aircraft_type: "A321"
      - For standby (e.g. "SB \\n 12:01 \\n 23:59"):
        - duty_type: "standby"
        - flight_number: null
        - reporting_time: start of standby combined with the calendar date
        - release_time: end of standby combined with the calendar date
      - For day off ("X"):
        - duty_type: "off"
      - For simulator or training duties (from the TRAINING grid at the bottom):
        - duty_type: "training"
        - flight_number: description
      
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contentPayload,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsedText = response.text || '{}';
    return NextResponse.json(JSON.parse(parsedText));

  } catch (error: any) {
    console.error('Error in parse-roster API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
