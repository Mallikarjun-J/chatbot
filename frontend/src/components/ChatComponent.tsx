import React, { useState, FormEvent, useRef, useEffect, useCallback } from 'react';
import { User, UserRole, ChatMessage, GroundingSource, Announcement, Document } from '../types';
import { Spinner, SendIcon, UserIcon, SparklesIcon, TypingIndicator, LinkIcon, MicrophoneIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from './Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// TODO: Frontend should call /api/chat endpoint instead of using AI directly
// import { GoogleGenAI, Modality, LiveServerMessage, Blob } from "@google/genai";

interface ChatComponentProps {
    user?: User;
}

interface RoleBasedContext {
  permissions: string[];
  accessibleData: Record<string, any>;
}

// Custom type for audio blob (used by Google AI Live API)
interface AudioBlob {
  data: string;
  mimeType: string;
}

// Helper functions for Live API audio encoding
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): AudioBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}


const getRoleBasedContext = (user: User | undefined, documents: Document[], users: User[], studentAcademicData?: any): RoleBasedContext => {
  const recentTimetable = documents
    .filter(doc => doc.type === 'timetable')
    .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())[0];

  const generalInfo = {
    'Campus Events': "The annual tech fest 'Innovate 2024' is next month.",
    'Admission Info': 'Admissions for the next academic year are now open. Visit the college website for details.',
    'Courses Offered': ['Computer Science', 'Physics', 'Chemistry', 'Mathematics', 'Literature'],
    'Current Timetable': recentTimetable 
        ? `The timetable named "${recentTimetable.originalname}" was last updated on ${new Date(recentTimetable.uploadDate).toLocaleDateString()}.`
        : 'A timetable has not been uploaded yet.'
  };

  switch (user?.role) {
    case UserRole.ADMIN:
      return {
        permissions: ['read_all_users', 'read_all_documents', 'read_system_status', 'read_all_financials', 'read_all_announcements'],
        accessibleData: {
          ...generalInfo,
          'System Status': 'All systems nominal.',
          'Total Users': users.length,
          'User List': users.map(u => ({ name: u.name, email: u.email, role: u.role })),
          'Total Documents': documents.length,
          'Recent Document Uploads': documents.slice(0, 5).map(d => ({ name: d.originalname, type: d.type, size: d.size, uploaded: new Date(d.uploadDate).toLocaleDateString() })),
        },
      };

    case UserRole.TEACHER:
      // Mock data for a specific teacher for demonstration
      return {
        permissions: ['read_own_schedule', 'read_assigned_courses', 'read_students_in_courses', 'read_student_attendance_in_courses', 'read_public_announcements'],
        accessibleData: {
          ...generalInfo,
          'name': user.name,
          'upcomingSchedule': [
            { time: '10 AM', course: 'Advanced Quantum Physics', room: '303' },
            { time: '2 PM', course: 'Introduction to Astrophysics Lab', room: 'Lab B' },
          ],
          'assignmentsToGrade': {
            'Introduction to Astrophysics': 5
          },
          'studentRoster': {
            'Advanced Quantum Physics': ['Alex Johnson', 'Maria Garcia', 'Chen Wei'],
          }
        },
      };

    case UserRole.STUDENT:
       // Use real academic data if available
      return {
        permissions: ['read_own_schedule', 'read_own_grades', 'read_own_attendance', 'read_course_info', 'read_public_announcements'],
        accessibleData: {
          ...generalInfo,
          'name': user.name,
          'email': user.email,
          'department': studentAcademicData?.cgpa?.department || 'N/A',
          'semester': studentAcademicData?.cgpa?.semester || 'N/A',
          'section': studentAcademicData?.cgpa?.section || 'N/A',
          'cgpa': studentAcademicData?.cgpa?.cgpa || 'N/A',
          'currentSGPA': studentAcademicData?.cgpa?.sgpa?.[`sem${studentAcademicData?.cgpa?.semester}`] || 'N/A',
          'semesterGrades': studentAcademicData?.cgpa?.sgpa || {},
          'overallAttendance': studentAcademicData?.attendance?.overallAttendance ? `${studentAcademicData.attendance.overallAttendance}%` : 'N/A',
          'subjectWiseAttendance': studentAcademicData?.attendance?.subjectWiseAttendance || [],
        },
      };

    default: // Guest user
      return {
        permissions: ['read_public_info', 'read_public_announcements'],
        accessibleData: generalInfo,
      };
  }
};


const ChatComponent: React.FC<ChatComponentProps> = ({ user }) => {
    const [prompt, setPrompt] = useState('');
    const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
    
    // Initialize state variables first
    const [documents, setDocuments] = useState<Document[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [studentAcademicData, setStudentAcademicData] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    
    // Load user-specific chat history from localStorage
    const getUserChatKey = () => {
        if (user) {
            return `chatHistory_${user.email}`;
        }
        return 'chatHistory_guest';
    };

    const loadChatHistory = (): ChatMessage[] => {
        // Generate personalized welcome message
        let welcomeMessage = `Welcome, ${user ? user.name : 'Guest'}.\n\n`;
        
        if (user && userProfile) {
            if (user.role === UserRole.STUDENT) {
                if (userProfile.basic?.semester || userProfile.basic?.branch) {
                    welcomeMessage += `${userProfile.basic?.semester ? `Semester ${userProfile.basic.semester}` : ''} ${userProfile.basic?.branch || ''}\n\n`;
                }
            } else if (user.role === UserRole.TEACHER) {
                welcomeMessage += `Department: ${userProfile.basic?.branch || 'N/A'}\n\n`;
            } else if (user.role === UserRole.ADMIN) {
                welcomeMessage += `Administrator Access\n\n`;
            }
        }
        
        welcomeMessage += `I can assist you with:\n`;
        welcomeMessage += `• Academic schedules and timetables\n`;
        welcomeMessage += `• Announcements and updates\n`;
        welcomeMessage += `• Campus resources and documents\n`;
        welcomeMessage += `• General inquiries\n`;

        return [{ role: 'model', content: welcomeMessage }];
    };

    const [messages, setMessages] = useState<ChatMessage[]>(loadChatHistory());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [isRecording, setIsRecording] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const recognitionRef = useRef<any>(null);
    const liveSessionPromiseRef = useRef<Promise<any> | null>(null);
    const liveSessionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);

    // Initialize speech recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setPrompt(transcript);
                setIsRecording(false);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsRecording(false);
            };

            recognitionRef.current.onend = () => {
                setIsRecording(false);
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);


    useEffect(() => {
        const fetchUserData = async () => {
            const token = localStorage.getItem('authToken');
            if (!token || !user) return;

            try {
                // Fetch comprehensive user profile
                const profileResponse = await fetch('/api/user/profile', {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                
                if (profileResponse.ok) {
                    const profile = await profileResponse.json();
                    setUserProfile(profile);
                    
                    // Also set studentAcademicData for backward compatibility
                    if (user.role === UserRole.STUDENT && profile.academic && profile.attendance) {
                        setStudentAcademicData({
                            cgpa: profile.academic,
                            attendance: profile.attendance
                        });
                    }
                }

                // Still fetch documents and users for admin
                if (user?.role === UserRole.ADMIN) {
                    // Fetch documents
                    const docsResponse = await fetch('/api/documents', {
                        headers: { 'Authorization': `Bearer ${token}` },
                    });
                    if (docsResponse.ok) {
                        const docsData: Document[] = await docsResponse.json();
                        setDocuments(docsData);
                    }

                    // Fetch users
                    const usersResponse = await fetch('/api/users', {
                        headers: { 'Authorization': `Bearer ${token}` },
                    });
                    if (usersResponse.ok) {
                        const usersData: User[] = await usersResponse.json();
                        setUsers(usersData);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch user data for AI context", err);
            }
        };

        fetchUserData();
    }, [user]);

    // Update welcome message when profile is loaded
    useEffect(() => {
        if (userProfile && messages.length === 1) {
            setMessages(loadChatHistory());
        }
    }, [userProfile]);

    // Auto-hide welcome message after 8 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowWelcomeMessage(false);
        }, 8000); // Hide after 8 seconds

        return () => clearTimeout(timer);
    }, []);

    // Voice input handler
    const handleVoiceInput = () => {
        if (!recognitionRef.current) {
            alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
            return;
        }

        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            setIsRecording(true);
            recognitionRef.current.start();
        }
    };

    // Text-to-speech handler
    const speakText = (text: string) => {
        if ('speechSynthesis' in window) {
            // Stop any ongoing speech
            window.speechSynthesis.cancel();
            
            // Remove markdown formatting for better speech
            const cleanText = text
                .replace(/[#*_`~]/g, '') // Remove markdown symbols
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links but keep text
                .replace(/\n+/g, '. '); // Replace newlines with pauses
            
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 1;
            
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            
            window.speechSynthesis.speak(utterance);
        } else {
            alert('Text-to-speech is not supported in your browser.');
        }
    };

    // Stop speech
    const stopSpeaking = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    };

    const MAX_CHAR_LIMIT = 500;
    const suggestions = user 
        ? [
            "What are the latest placement statistics?",
            "Show me upcoming events and workshops",
            "Tell me about recent recruitments",
            "What courses are available?"
          ]
        : [
            "What courses are offered?",
            "Tell me about campus events",
            "What are the placement records?",
            "How do I apply for admission?"
          ];

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset height to recalculate
            const scrollHeight = textarea.scrollHeight;
            const maxHeight = 120; // Max height in pixels

            if (scrollHeight > maxHeight) {
                textarea.style.height = `${maxHeight}px`;
                textarea.style.overflowY = 'auto';
            } else {
                textarea.style.height = `${scrollHeight}px`;
                textarea.style.overflowY = 'hidden';
            }
        }
    }, [prompt]);
    
    const stopRecording = useCallback(async () => {
        if (liveSessionRef.current) {
            await liveSessionRef.current.close();
            liveSessionRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            await audioContextRef.current.close();
            audioContextRef.current = null;
        }
        liveSessionPromiseRef.current = null;
        setIsRecording(false);
    }, []);

    const startRecording = async () => {
        // Voice recording feature temporarily disabled - requires backend websocket implementation
        setError('Voice input feature is currently unavailable. Please type your message instead.');
        return;
        
        /* DISABLED - Requires backend WebSocket implementation
        try {
            micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsRecording(true);
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            liveSessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        // Start streaming audio from microphone
                        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(micStreamRef.current as MediaStream);
                        scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            liveSessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(audioContextRef.current.destination);
                    },
                    onmessage: (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            setPrompt(prev => (prev + text).slice(0, MAX_CHAR_LIMIT));
                        }
                        if (message.serverContent?.turnComplete) {
                            // Can add logic here if needed when a user's turn is considered complete
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setError('An error occurred during transcription.');
                        stopRecording();
                    },
                    onclose: () => {
                        // This might be called when the other side closes.
                        // Ensure local resources are also cleaned up if not already.
                        if (isRecording) {
                             stopRecording();
                        }
                    },
                },
                config: {
                    inputAudioTranscription: {},
                },
            });

            liveSessionRef.current = await liveSessionPromiseRef.current;
        } catch (err) {
            console.error('Failed to start recording:', err);
            setError('Could not start microphone. Please check permissions.');
            setIsRecording(false);
        }
        */
    };
    
    const handleToggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // Cleanup effect
    useEffect(() => {
        return () => {
           stopRecording();
        };
    }, [stopRecording]);

    const handleSendMessage = async (e: FormEvent, messageContent?: string) => {
        if (e) e.preventDefault();
        const currentPrompt = messageContent || prompt;
        if (!currentPrompt.trim() || isLoading) return;

        const newUserMessage: ChatMessage = { role: 'user', content: currentPrompt };
        setMessages(prev => [...prev, newUserMessage]);
        setPrompt('');
        setIsLoading(true);
        setError(null);

        // Add typing indicator message
        const typingMessage: ChatMessage = { role: 'model', content: '' };
        setMessages(prev => [...prev, typingMessage]);

        try {
            // Use userProfile as primary data source if available, fallback to getRoleBasedContext
            let userContext;
            if (userProfile) {
                // Flatten the nested profile structure for the chatbot
                const flatProfile: any = {
                    // Basic info
                    name: userProfile.basic?.name,
                    email: userProfile.basic?.email,
                    role: userProfile.basic?.role,
                    department: userProfile.basic?.branch,
                    branch: userProfile.basic?.branch,
                    semester: userProfile.basic?.semester,
                    section: userProfile.basic?.section,
                };

                // Academic data
                if (userProfile.academic) {
                    flatProfile.cgpa = userProfile.academic.cgpa;
                    flatProfile.currentSGPA = userProfile.academic.currentSemesterSGPA;
                    flatProfile.semesterGrades = userProfile.academic.sgpa;
                }

                // Attendance data
                if (userProfile.attendance) {
                    flatProfile.overallAttendance = userProfile.attendance.overall;
                    flatProfile.subjectWiseAttendance = userProfile.attendance.subjects;
                }

                // Timetable data
                if (userProfile.timetable) {
                    flatProfile.timetable = userProfile.timetable;
                }

                // Announcements and documents
                flatProfile.announcements = userProfile.announcements;
                flatProfile.documents = userProfile.documents;

                userContext = {
                    permissions: ['read_own_schedule', 'read_own_grades', 'read_own_attendance', 'read_course_info', 'read_public_announcements'],
                    accessibleData: flatProfile
                };
            } else {
                // Fallback to old context method
                userContext = getRoleBasedContext(user, documents, users, studentAcademicData);
            }
            
            // Call backend AI proxy with streaming enabled
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: currentPrompt,
                    history: messages.slice(-10), // Send last 10 messages for context
                    context: {
                        role: user?.role || 'Guest',
                        name: user?.name || 'Guest',
                        permissions: userContext.permissions,
                        data: userContext.accessibleData
                    },
                    stream: true, // Enable streaming
                    cache: true // Enable caching
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to get AI response');
            }

            // Check if response is streaming (SSE) or regular JSON
            const contentType = response.headers.get('content-type');
            const isStreaming = contentType?.includes('text/event-stream');

            if (isStreaming) {
                // Handle streaming response
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let accumulatedContent = '';
                let metadata: any = undefined;
                let sources: any = undefined;

                if (reader) {
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value);
                            const lines = chunk.split('\n');

                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    try {
                                        const data = JSON.parse(line.slice(6));
                                        
                                        if (data.content) {
                                            accumulatedContent += data.content;
                                            // Update the last message with accumulated content
                                            setMessages(prev => [
                                                ...prev.slice(0, -1),
                                                { role: 'model', content: accumulatedContent }
                                            ]);
                                        }

                                        if (data.metadata) {
                                            metadata = data.metadata;
                                        }

                                        if (data.sources) {
                                            sources = data.sources;
                                        }

                                        if (data.done) {
                                            // Final message with metadata
                                            const finalMessage: ChatMessage = {
                                                role: 'model',
                                                content: accumulatedContent,
                                                sources: sources && sources.length > 0 ? sources : undefined,
                                                metadata: metadata
                                            };
                                            setMessages(prev => [...prev.slice(0, -1), finalMessage]);
                                        }
                                    } catch (parseError) {
                                        console.error('Error parsing SSE data:', parseError);
                                    }
                                }
                            }
                        }
                    } finally {
                        reader.releaseLock();
                    }
                }
            } else {
                // Handle non-streaming response (fallback)
                const data = await response.json();
                
                // Enhanced AI message with knowledge base metadata
                const aiMessage: ChatMessage = {
                    role: 'model',
                    content: data.content,
                    sources: data.sources && data.sources.length > 0 ? data.sources : undefined,
                    metadata: data.knowledgeBase ? {
                        model: data.model,
                        announcementsUsed: data.knowledgeBase.announcementsUsed,
                        liveDataFetched: data.knowledgeBase.liveDataFetched,
                        placementsFound: data.knowledgeBase.placementsFound,
                        eventsFound: data.knowledgeBase.eventsFound
                    } : undefined
                };
                
                // Remove typing indicator and add actual response
                setMessages(prev => [...prev.slice(0, -1), aiMessage]);
            }

        } catch (err: any) {
            console.error('AI chat error:', err);
            const errorMessage = err.message || "Sorry, I'm having trouble connecting right now. Please try again later.";
            setError(errorMessage);
            // Remove typing indicator and add error message
            setMessages(prev => [...prev.slice(0, -1), { role: 'model', content: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSuggestionClick = (suggestion: string) => {
        handleSendMessage(new Event('submit') as unknown as FormEvent, suggestion);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-full w-full">
            <div className="p-3 md:p-4 border-b dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                <h3 className="text-base md:text-lg lg:text-xl font-semibold text-gray-800 dark:text-white truncate">🧠 Advanced AI Assistant</h3>
                {user && (
                    <button
                        onClick={() => {
                            const chatKey = getUserChatKey();
                            localStorage.removeItem(chatKey);
                            setMessages(loadChatHistory());
                            setShowWelcomeMessage(true);
                        }}
                        className="text-xs px-2 md:px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                        title="Clear chat history"
                    >
                        Clear Chat
                    </button>
                )}
            </div>
            
            <div ref={chatContainerRef} className="flex-1 p-3 md:p-4 space-y-3 md:space-y-4 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-gray-900 [&::-webkit-scrollbar-thumb]:bg-black [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-800">
                {messages.map((msg, index) => {
                    // Hide welcome message (first message) after timer expires
                    if (index === 0 && !showWelcomeMessage) {
                        return null;
                    }
                    
                    return (
                    <div 
                        key={index} 
                        className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''} ${
                            index === 0 && showWelcomeMessage ? 'animate-fade-in' : ''
                        }`}
                        style={index === 0 ? { 
                            transition: 'opacity 0.5s ease-out',
                            opacity: showWelcomeMessage ? 1 : 0
                        } : {}}
                    >
                        {msg.role === 'model' && (
                           <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white flex-shrink-0">
                             <SparklesIcon className="h-5 w-5" />
                           </div>
                        )}
                         <div className={`group relative max-w-md md:max-w-2xl p-3 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-500 text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'}`}>
                            {msg.content === '' && msg.role === 'model' ? (
                                <TypingIndicator />
                            ) : msg.role === 'model' ? (
                                <>
                                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                    {msg.content && (
                                        <button
                                            onClick={() => isSpeaking ? stopSpeaking() : speakText(msg.content)}
                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
                                            title={isSpeaking ? "Stop speaking" : "Read aloud"}
                                        >
                                            {isSpeaking ? (
                                                <SpeakerXMarkIcon className="w-4 h-4" />
                                            ) : (
                                                <SpeakerWaveIcon className="w-4 h-4" />
                                            )}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                            )}
                        </div>
                         {msg.role === 'user' && (
                             <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 flex-shrink-0">
                                <UserIcon className="h-5 w-5" />
                            </div>
                        )}
                    </div>
                    );
                })}
                {!user && messages.length === 1 && !isLoading && showWelcomeMessage && (
                    <div className="pt-4">
                        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-3">Or try one of these suggestions:</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {suggestions.map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="p-3 md:p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                 <form onSubmit={handleSendMessage} className="flex items-start gap-3">
                    <button
                        type="button"
                        onClick={handleVoiceInput}
                        disabled={isLoading}
                        className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 ${isRecording ? 'text-red-500 bg-red-100 dark:bg-red-900/20 animate-pulse' : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'}`}
                        aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                        title={isRecording ? 'Stop recording' : 'Click to speak your question'}
                    >
                        <MicrophoneIcon className="h-5 w-5" />
                    </button>
                    <div className="relative flex-grow">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    (e.target as HTMLTextAreaElement).form?.requestSubmit();
                                }
                            }}
                            placeholder={isRecording ? '🎤 Listening...' : 'Ask CampusAura anything...'}
                            disabled={isLoading}
                            maxLength={MAX_CHAR_LIMIT}
                            className="w-full p-3 pr-20 text-sm text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            style={{ overflowY: 'hidden', minHeight: '48px' }}
                            aria-label="Chat input"
                        />
                        <div className="absolute bottom-2 right-3 text-xs text-gray-400 dark:text-gray-500 select-none">
                            {prompt.length}/{MAX_CHAR_LIMIT}
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading || !prompt.trim()}
                        className="flex-shrink-0 flex items-center justify-center w-12 h-12 text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
                        aria-label="Send message"
                    >
                        <SendIcon className="h-5 w-5" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatComponent;