import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';
// @ts-ignore
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

// Register the worker globally to bypass dynamic import/ESM loader scheme issues on Windows/Next.js
(globalThis as any).pdfjsWorker = pdfjsWorker;

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

    console.log(`[Register Roster API] Processing file: ${file.name}, size: ${file.size} bytes`);

    // Parse the PDF buffer using pdf-parse
    let text = '';
    try {
      const fileBytes = await file.arrayBuffer();
      
      const parser = new PDFParse({ data: Buffer.from(fileBytes) });
      const textResult = await parser.getText();
      text = textResult.text;
    } catch (parseError: any) {
      console.error('[Register Roster API] pdf-parse error:', parseError);
      return NextResponse.json({ 
        error: `Failed to extract text from the PDF: ${parseError.message || parseError}` 
      }, { status: 400 });
    }

    if (!text || text.trim().length < 50) {
      return NextResponse.json({ 
        error: 'The uploaded file contains insufficient text. Please upload a valid MEA Crew Roster PDF.' 
      }, { status: 400 });
    }

    // Fallback mode if Gemini key is missing
    if (!ai) {
      console.warn('[Register Roster API] GEMINI_API_KEY is not set. Using simulated roster parsing.');
      // Simulate network & AI latency
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock parsed roster structure based on Naim's profile
      const mockResult = {
        isValidRoster: true,
        pilot_metadata: {
          first_name: "Naim",
          last_name: "Moghabghab",
          name: "MOGHABGHAB, NAIM ghassan",
          id: "18684",
          rank: "first_officer",
          base: "BEY",
          qualifications: ["A320", "A321", "A32A"]
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
            aircraft_type: "A321"
          },
          { day_number: 3, duty_type: "off" },
          { day_number: 4, duty_type: "off" },
          {
            day_number: 5,
            duty_type: "training",
            flight_number: "SIM-1",
            origin: "BEY",
            destination: "BEY",
            departure_time: "2026-05-05T04:28:00Z",
            arrival_time: "2026-05-05T06:29:00Z",
            aircraft_type: "A320"
          },
          {
            day_number: 6,
            duty_type: "standby",
            reporting_time: "2026-05-06T12:01:00Z",
            release_time: "2026-05-06T23:59:00Z"
          }
        ]
      };

      const username = "n.moghabghab";
      const email = "n.moghabghab@mea.com.lb";
      mockResult.pilot_metadata = {
        ...mockResult.pilot_metadata,
        ...({ username, email } as any)
      };

      return NextResponse.json(mockResult);
    }

    const prompt = `
      You are an expert aviation document parsing assistant.
      Analyze the provided Middle East Airlines (MEA) "Personal Crew Schedule Report" pilot roster text.
      
      First, verify if this text corresponds to a valid MEA crew schedule/roster.
      If it does not contain typical elements of an MEA roster (like flight numbers ME201, ME310, or mentions of BEY, CPT, FO, crew ID), set "isValidRoster" to false.
      
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: `Roster Text Content:\n${text}` },
        { text: prompt }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsedText = response.text || '{}';
    let result;
    try {
      result = JSON.parse(parsedText);
    } catch (jsonErr) {
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

  } catch (error: any) {
    console.error('[Register Roster API] Exception:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
