import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.mjs';
import fs from 'fs';

const genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });

/**
 * Analyze timetable from PDF or image using Gemini Vision
 * @param {string} filePath - Path to the uploaded file
 * @param {string} fileType - Type of file (pdf/png/jpg)
 * @param {string} analysisType - 'class' or 'teacher'
 * @returns {Promise<Object>} Structured timetable data
 */
export async function analyzeTimetable(filePath, fileType, analysisType = 'class') {
    try {
        console.log(`📊 Analyzing ${analysisType} timetable from ${fileType} file...`);

        // Read file as base64
        const fileBuffer = fs.readFileSync(filePath);
        const base64Data = fileBuffer.toString('base64');

        const mimeType = fileType === 'pdf' ? 'application/pdf' : `image/${fileType}`;

        const prompt = analysisType === 'class' 
            ? `Analyze this class timetable image/PDF and extract the schedule information.
            
Return a JSON object with this EXACT structure:
{
  "branch": "detected branch/department name",
  "section": "detected section (A/B/C etc)",
  "semester": "detected semester/year",
  "days": {
    "Monday": [
      {"time": "9:00-10:00", "subject": "Subject Name", "teacher": "Teacher Name", "room": "Room Number"},
      {"time": "10:00-11:00", "subject": "Subject Name", "teacher": "Teacher Name", "room": "Room Number"}
    ],
    "Tuesday": [...],
    "Wednesday": [...],
    "Thursday": [...],
    "Friday": [...],
    "Saturday": [...]
  }
}

Extract ALL visible schedule entries. If information is not visible, use "N/A".`
            : `Analyze this teacher's personal timetable and extract their schedule.
            
Return a JSON object with this EXACT structure:
{
  "teacherName": "detected teacher name",
  "employeeId": "detected employee ID if visible, otherwise N/A",
  "department": "detected department",
  "days": {
    "Monday": [
      {"time": "9:00-10:00", "subject": "Subject Name", "class": "Class/Section", "room": "Room Number"},
      {"time": "10:00-11:00", "subject": "Subject Name", "class": "Class/Section", "room": "Room Number"}
    ],
    "Tuesday": [...],
    "Wednesday": [...],
    "Thursday": [...],
    "Friday": [...],
    "Saturday": [...]
  }
}

Extract ALL visible schedule entries. If information is not visible, use "N/A".`;

        const contents = [{
            role: 'user',
            parts: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                }
            ]
        }];

        // Try different models for analysis
        const models = ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        
        for (const modelName of models) {
            try {
                console.log(`🤖 Using model: ${modelName} for timetable analysis`);
                
                const result = await genAI.models.generateContent({
                    model: modelName,
                    contents: contents,
                    config: {
                        temperature: 0.1, // Low temperature for accurate extraction
                        maxOutputTokens: 2048,
                    }
                });

                const responseText = result.text || result.response?.text?.() || '';
                
                // Extract JSON from response
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No JSON found in response');
                }

                const timetableData = JSON.parse(jsonMatch[0]);
                
                console.log(`✅ Successfully analyzed timetable using ${modelName}`);
                return {
                    success: true,
                    data: timetableData,
                    model: modelName
                };

            } catch (modelError) {
                console.error(`Model ${modelName} failed:`, modelError.message);
                continue;
            }
        }

        throw new Error('All AI models failed to analyze timetable');

    } catch (error) {
        console.error('Timetable analysis error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Validate timetable structure
 */
export function validateTimetableStructure(data, type = 'class') {
    if (type === 'class') {
        return data.branch && data.section && data.days;
    } else {
        return data.teacherName && data.days;
    }
}
