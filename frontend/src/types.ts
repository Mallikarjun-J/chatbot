export enum UserRole {
  ADMIN = 'Admin',
  TEACHER = 'Teacher',
  STUDENT = 'Student',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  branch?: string; // For students
  section?: string; // For students
  department?: string; // For teachers
  employeeId?: string; // For teachers
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string; // ISO string for creation date
  eventDate?: string | null; // e.g., "2024-09-15"
  eventTime?: string | null; // e.g., "14:00"
  location?: string | null;
}

export interface Notification {
  id: string;
  message: string;
  timestamp: string; // ISO string
  isRead: boolean;
  type: 'announcement' | 'system';
}

export interface GroundingSource {
    uri?: string;
    title?: string;
    type?: string;
    count?: number;
    url?: string;
    scrapedAt?: string;
    latest?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  sources?: GroundingSource[];
  metadata?: {
    model?: string;
    announcementsUsed?: number;
    liveDataFetched?: boolean;
    placementsFound?: number;
    eventsFound?: number;
  };
}

export interface Document {
  id: string;
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  uploadDate: string; // ISO string
  type: string;
  // AI Analysis fields
  documentType?: string;
  subject?: string;
  semester?: number;
  branch?: string;
  topics?: string[];
  keywords?: string[];
  description?: string;
  aiAnalyzed?: boolean;
}

export interface TimetableSlot {
  time: string;
  subject: string;
  teacher?: string; // For class timetables
  class?: string; // For teacher timetables
  room?: string;
}

export interface ClassTimetable {
  id: string;
  branch: string;
  section: string;
  semester?: string;
  days: {
    Monday: TimetableSlot[];
    Tuesday: TimetableSlot[];
    Wednesday: TimetableSlot[];
    Thursday: TimetableSlot[];
    Friday: TimetableSlot[];
    Saturday?: TimetableSlot[];
  };
  filePath: string;
  uploadedBy: string;
  uploadDate: string;
}

export interface TeacherTimetable {
  id: string;
  teacherId: string;
  teacherName: string;
  department?: string;
  employeeId?: string;
  days: {
    Monday: TimetableSlot[];
    Tuesday: TimetableSlot[];
    Wednesday: TimetableSlot[];
    Thursday: TimetableSlot[];
    Friday: TimetableSlot[];
    Saturday?: TimetableSlot[];
  };
  filePath: string;
  uploadDate: string;
}
