/* =========================
   USER & ROLES
   ========================= */

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

  // Academic / Staff Info
  branch?: string;        // students & teachers
  section?: string;       // students
  semester?: number;      // students
  department?: string;    // teachers
  employeeId?: string;    // teachers
}

/* =========================
   ANNOUNCEMENTS
   ========================= */

export interface Announcement {
  id: string;
  title: string;
  content: string;

  date: string; // ISO creation date

  eventDate?: string | null; // YYYY-MM-DD
  eventTime?: string | null; // HH:mm
  location?: string | null;
}

/* =========================
   NOTIFICATIONS
   ========================= */

export enum NotificationType {
  ANNOUNCEMENT = 'announcement',
  SYSTEM = 'system',
}

export interface Notification {
  id: string;
  message: string;
  timestamp: string; // ISO
  isRead: boolean;
  type: NotificationType;
}

/* =========================
   CHAT & AI
   ========================= */

export enum ChatRole {
  USER = 'user',
  MODEL = 'model',
}

export interface GroundingSource {
  url?: string;
  title?: string;
  type?: string;
  count?: number;
  scrapedAt?: string;
  latest?: string;
}

export interface ChatMessage {
  role: ChatRole;
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

/* =========================
   DOCUMENTS
   ========================= */

export enum DocumentType {
  TIMETABLE = 'timetable',
  SYLLABUS = 'syllabus',
  NOTICE = 'notice',
  RESULT = 'result',
  OTHER = 'other',
}

export interface Document {
  id: string;
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  uploadDate: string; // ISO

  type: DocumentType;

  // AI Analysis
  documentType?: string;
  subject?: string;
  semester?: number;
  branch?: string;
  topics?: string[];
  keywords?: string[];
  description?: string;
  aiAnalyzed?: boolean;
}

/* =========================
   TIMETABLES
   ========================= */

export interface TimetableSlot {
  time: string;     // e.g. "10:00 - 11:00"
  subject: string;
  teacher?: string; // class timetable
  class?: string;   // teacher timetable
  room?: string;
}

export interface ClassTimetable {
  id: string;
  branch: string;
  section: string;
  semester?: number;

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
