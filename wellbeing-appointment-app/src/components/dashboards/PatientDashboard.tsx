import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Calendar, User, LogOut, Bell, Search, LayoutGrid, Stethoscope, ChevronDown, ChevronRight, Scale, Activity, Droplet, Thermometer, Table, Edit, MoreVertical, Check, X, ClipboardList, Settings, FileText, MessageSquare, Briefcase, Plus, Circle, BarChart, Send, X as XIcon, ArrowLeft, Upload, Sun, Moon } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { chatService } from '@/services/chatService';
import { ChatMessage } from '@/types/chat';
import { format } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";

interface DoctorAppointmentData {
  doctor_id: string;
  doctors: {
    profiles: {
      first_name: string;
      last_name: string;
    } | null;
  } | null;
}

interface Appointment {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  appointment_time: string;
  reason: string;
  status: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  otp_code: string | null;
  otp_verified: boolean;
  doctors: {
    specialization: string;
    profiles: {
      first_name: string;
      last_name: string;
    } | null;
  } | null;
}

// Define a type for the raw data returned by Supabase, accounting for potential errors in joined tables
interface RawAppointmentData {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  appointment_time: string;
  reason: string;
  status: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  otp_code: string | null;
  otp_verified: boolean;
  doctors: {
    specialization?: string;
    profiles?: {
      first_name?: string;
      last_name?: string;
    } | null;
    error?: true; // Supabase can return an error object if join fails
  } | null;
}

// Type guard to ensure the fetched data conforms to the Appointment interface
function isAppointmentValid(appt: RawAppointmentData): appt is Appointment {
  // Check if doctors data exists and is not an error object
  if (!appt.doctors || typeof appt.doctors !== 'object' || ('error' in appt.doctors && appt.doctors.error === true)) {
    return false;
  }

  // Check if profiles data exists within doctors and has required properties
  if (!appt.doctors.profiles || typeof appt.doctors.profiles !== 'object' ||
      typeof appt.doctors.profiles.first_name !== 'string' ||
      typeof appt.doctors.profiles.last_name !== 'string') {
    return false;
  }

  // Check if specialization exists
  if (typeof appt.doctors.specialization !== 'string') {
    return false;
  }

  // Ensure all direct appointment properties (from *) are present and correctly typed
  if (typeof appt.created_at !== 'string' ||
      typeof appt.updated_at !== 'string' ||
      typeof appt.otp_verified !== 'boolean') {
    return false;
  }

  return true;
}

// Define a type for the raw data returned by Supabase for the doctor chat appointments fetch
interface RawDoctorAppointmentEntry {
  doctor_id: string;
  doctors: {
    profiles: {
      first_name: string | null;
      last_name: string | null;
    } | null;
  } | null | { error: true; message?: string }; // Account for potential SelectQueryError or null
}

// Type guard for the data from Supabase for doctor chat
function isValidDoctorAppointmentEntry(entry: RawDoctorAppointmentEntry): entry is DoctorAppointmentData {
  return (
    entry &&
    typeof entry.doctor_id === 'string' &&
    entry.doctors &&
    typeof entry.doctors === 'object' && // Ensure it's an object
    !('error' in entry.doctors) && // Exclude objects with an 'error' property
    entry.doctors.profiles &&
    typeof entry.doctors.profiles === 'object' &&
    typeof entry.doctors.profiles.first_name === 'string' &&
    typeof entry.doctors.profiles.last_name === 'string'
  );
}

interface PatientDashboardProps {
  profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    profile_picture_url: string | null;
    user_type: string | null;
    phone: string | null;
    date_of_birth: string | null;
    gender: string | null;
    address: string | null;
    emergency_contact: string | null;
  };
  smokingStatus: boolean | null | undefined;
  drinkingStatus: boolean | null | undefined;
  heartRate: number | null | undefined;
  bodyTemperature: number | null | undefined;
  bloodPressure: string | null | undefined;
  activity: string | null | undefined;
  bmi: number | null | undefined;
  isChatOpen: boolean;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const PatientDashboard = ({ profile, smokingStatus, drinkingStatus, heartRate, bodyTemperature, bloodPressure, activity, bmi, isChatOpen, setIsChatOpen }: PatientDashboardProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [recentAppointment, setRecentAppointment] = useState<Appointment | null>(null);
  const [loadingRecentAppointment, setLoadingRecentAppointment] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [selectedDoctorForChat, setSelectedDoctorForChat] = useState<{ id: string; name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(''); // New state for search term
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({}); // New state for unread message counts
  const [upcomingAppointment, setUpcomingAppointment] = useState<Appointment | null>(null);
  const [consultationHistory, setConsultationHistory] = useState<Appointment[]>([]);
  const [loadingConsultationHistory, setLoadingConsultationHistory] = useState(true);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [loadingMyAppointments, setLoadingMyAppointments] = useState(true);
  const { user } = useAuth();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editPhone, setEditPhone] = useState(profile.phone || "");
  const [editProfilePic, setEditProfilePic] = useState(profile.profile_picture_url || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState(profile.first_name || "");
  const [editLastName, setEditLastName] = useState(profile.last_name || "");
  const [editDateOfBirth, setEditDateOfBirth] = useState(profile.date_of_birth || "");
  const [editGender, setEditGender] = useState(profile.gender || "");
  const [editAddress, setEditAddress] = useState(profile.address || "");
  const [editEmergencyContact, setEditEmergencyContact] = useState(profile.emergency_contact || "");
  const [editProfilePicFile, setEditProfilePicFile] = useState<File | null>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{
    url: string;
    type: 'image' | 'video' | 'audio' | 'file';
    name?: string;
    size?: number;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  const totalUnreadMessages = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadMessages = useCallback(async (doctorUserId: string) => {
    setLoadingMessages(true);
    try {
      const loadedMessages = await chatService.getMessages(profile.id, doctorUserId);
      setMessages(loadedMessages);
      await chatService.markMessagesAsRead(doctorUserId, profile.id);
      setUnreadCounts(prevCounts => ({ ...prevCounts, [doctorUserId]: 0 })); // Mark as read when chat is opened
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingMessages(false);
    }
  }, [profile.id, toast]);

  // Helper to parse date and time into a JS Date object
  function parseAppointmentDateTime(date: string, time: string) {
    return new Date(`${date}T${time}`);
  }

  // Fetch all future appointments with status 'pending' or 'confirmed', and pick the soonest one
  const fetchUpcomingAppointment = useCallback(async () => {
    if (!profile.id) {
      setUpcomingAppointment(null);
      return;
    }
    setLoadingRecentAppointment(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          doctors (
            specialization,
            profiles (
              first_name,
              last_name
            )
          )
        `)
        .eq('patient_id', profile.id)
        .in('status', ['pending', 'confirmed'])
        .gte('appointment_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;

      // Sort by soonest date/time
      const validAppointments = (data as RawAppointmentData[])
        .filter(isAppointmentValid)
        .sort((a, b) => {
          const dateA = parseAppointmentDateTime(a.appointment_date, a.appointment_time);
          const dateB = parseAppointmentDateTime(b.appointment_date, b.appointment_time);
          return dateA.getTime() - dateB.getTime();
        });

      setUpcomingAppointment(validAppointments[0] || null);
    } catch (error) {
      console.error('Error fetching upcoming appointment:', error);
      setUpcomingAppointment(null);
    } finally {
      setLoadingRecentAppointment(false);
    }
  }, [profile.id]);

  const fetchPatientAppointments = useCallback(async () => {
    setLoadingAppointments(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          doctor_id,
          doctors (
            profiles (
              first_name,
              last_name
            )
          )
        `)
        .eq('patient_id', profile.id)
        .eq('status', 'confirmed');

      if (error) throw error;

      const uniqueDoctors: { [key: string]: Appointment } = {};
      const rawData = data as RawDoctorAppointmentEntry[];
      (rawData || []).filter(isValidDoctorAppointmentEntry).forEach((appt) => {
        // Now appt is guaranteed to be DoctorAppointmentData
        const doctorId = appt.doctor_id;
        // Only add if not already added
        if (!uniqueDoctors[doctorId]) {
          uniqueDoctors[doctorId] = {
            id: '', // This is just a placeholder, we only need doctor_id and name for chat selection
            doctor_id: doctorId,
            patient_id: profile.id,
            appointment_date: '', // Placeholder
            appointment_time: '', // Placeholder
            reason: '', // Placeholder
            status: '', // Placeholder
            created_at: '', // Placeholder
            updated_at: '', // Placeholder
            notes: null, // Placeholder
            otp_code: null, // Placeholder
            otp_verified: false, // Placeholder
            doctors: {
              specialization: '', // Placeholder
              profiles: {
                first_name: appt.doctors.profiles.first_name,
                last_name: appt.doctors.profiles.last_name,
              },
            },
          };
        }
      });
      setPatientAppointments(Object.values(uniqueDoctors));

    } catch (error) {
      console.error('Error fetching patient appointments for chat:', error);
      toast({
        title: "Error",
        description: "Failed to load doctors for chat. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingAppointments(false);
    }
  }, [profile.id, toast]);

  const fetchUnreadCounts = useCallback(async () => {
    if (!profile.id) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('sender_id', { count: 'exact' })
        .eq('receiver_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((message: { sender_id: string }) => {
        counts[message.sender_id] = (counts[message.sender_id] || 0) + 1;
      });
      setUnreadCounts(counts);

    } catch (error) {
      console.error('Error fetching unread counts:', error);
      toast({
        title: "Error",
        description: "Failed to load unread message counts.",
        variant: "destructive",
      });
    }
  }, [profile.id, toast]);

  const fetchConsultationHistory = useCallback(async () => {
    if (!profile.id) {
      setLoadingConsultationHistory(false);
      return;
    }
    setLoadingConsultationHistory(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`*, doctors (specialization, profiles (first_name, last_name))`)
        .eq('patient_id', profile.id)
        .in('status', ['completed', 'consulted'])
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });
      if (error) throw error;
      console.log('DEBUG: Raw fetched consultation history:', data);
      const validAppointments = (data as RawAppointmentData[])
        .filter(isAppointmentValid);
      setConsultationHistory(validAppointments);
    } catch (error) {
      console.error('Error fetching consultation history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load consultation history.',
        variant: 'destructive',
      });
    } finally {
      setLoadingConsultationHistory(false);
    }
  }, [profile.id, toast]);

  const handleSendMessage = async (content: string, type: string) => {
    if (!selectedDoctorForChat) return;

    try {
      const message = await chatService.sendMessage(profile.id, selectedDoctorForChat.id, content, type);
      if (message) {
        setMessages(prev => [...prev, message]);
        setChatMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDoctorForChat = useCallback((doctor: { id: string; name: string }) => {
    setSelectedDoctorForChat(doctor);
    setUnreadCounts(prevCounts => ({ ...prevCounts, [doctor.id]: 0 })); // Reset unread count for this doctor
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setChatMessage(e.target.value);
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage(chatMessage, '');
    }
  }, [handleSendMessage, chatMessage]);

  const handleCloseChat = useCallback(() => {
    setIsChatOpen(false);
    setSelectedDoctorForChat(null);
    setMessages([]);
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account.",
      });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const initials = `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      return 'Good Morning';
    } else if (hour >= 12 && hour < 18) {
      return 'Good Afternoon';
    } else {
      return 'Good Evening';
    }
  };

  // Memoize the chat message list
  const ChatMessageList = memo(({ messages, loadingMessages, profileId }: { messages: ChatMessage[], loadingMessages: boolean, profileId: string }) => {
    if (loadingMessages) {
      return (
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      );
    }

    // Helper to detect media type
    const renderMessageContent = (content: string) => {
      if (/\.(jpg|jpeg|png|gif|webp)$/i.test(content)) {
        return (
          <div className="relative group">
            <img
              src={content}
              alt="chat-media"
              className="max-w-xs max-h-60 rounded-lg border mt-1 cursor-pointer"
              onClick={() => handleMediaClick(content, 'image')}
            />
            <button
              className="absolute top-2 right-2 bg-white bg-opacity-80 rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              title="Download"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  const response = await fetch(content, { mode: 'cors' });
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = content.split('/').pop() || 'download';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  alert('Failed to download image');
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-green-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 6-6M12 18.75V3" />
              </svg>
            </button>
          </div>
        );
      }
      if (/\.pdf$/i.test(content)) {
        return (
          <a href={content} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 underline mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            View PDF
          </a>
        );
      }
      if (/^https?:\/\//.test(content)) {
        return (
          <a href={content} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 underline mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a2 2 0 10-2.828-2.828z" /></svg>
            Open File
          </a>
        );
      }
      return <span>{content}</span>;
    };

    return (
      <>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender_id === profileId ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.sender_id === profileId
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {renderMessageContent(message.content)}
              <p className="text-xs mt-1 opacity-70">
                {format(new Date(message.created_at), 'HH:mm')}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </>
    );
  });

  const handleEditProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: editFirstName,
        last_name: editLastName,
        phone: editPhone,
        profile_picture_url: editProfilePic,
        date_of_birth: editDateOfBirth,
        gender: editGender,
        address: editAddress,
        emergency_contact: editEmergencyContact
      })
      .eq('id', profile.id);
    setSavingProfile(false);
    if (!error) {
      toast({ title: "Profile updated!" });
      setEditProfileOpen(false);
      window.location.reload();
    } else {
      toast({ title: "Error updating profile", description: error.message, variant: "destructive" });
    }
  };

  const handleProfilePicFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setEditProfilePicFile(file);
    if (file) {
      setUploadingPic(true);
      const filePath = `profile-pictures/${profile.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        setEditProfilePic(publicUrlData.publicUrl);
        toast({ title: "Profile picture uploaded!" });
      } else {
        toast({ title: "Upload Failed", description: uploadError.message, variant: "destructive" });
      }
      setUploadingPic(false);
    }
  };

  const handleMediaClick = (url: string, type: 'image'|'video'|'audio'|'file', name?: string, size?: number) => {
    setMediaPreview({ url, type, name, size });
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setTimeout(() => setMediaPreview(null), 200);
  };

  // Keyboard navigation for modal
  useEffect(() => {
    if (!showPreview) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPreview(false);
      // Add left/right arrow navigation if you want to support swiping between images
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showPreview]);

  useEffect(() => {
    fetchUpcomingAppointment();
    fetchPatientAppointments();
    fetchUnreadCounts();
    fetchConsultationHistory();
  }, [fetchUpcomingAppointment, fetchPatientAppointments, fetchUnreadCounts, fetchConsultationHistory]);

  useEffect(() => {
    if (isChatOpen) {
      if (!selectedDoctorForChat) {
        // Only fetch appointments if no doctor is selected for chat
        fetchPatientAppointments();
      }
      // If a doctor is selected, load messages for that doctor
      if (selectedDoctorForChat) {
        loadMessages(selectedDoctorForChat.id);
        const subscription = chatService.subscribeToMessages(profile.id, (message) => {
          setMessages(prev => [...prev, message]);
          scrollToBottom();
        });

        return () => {
          subscription.unsubscribe();
        };
      }
    } else {
      // Reset selected doctor and messages when chat is closed
      setSelectedDoctorForChat(null);
      setMessages([]);
    }
    const subscription = chatService.subscribeToMessages(profile.id, (message) => {
      const doctorId = message.sender_id === profile.id ? message.receiver_id : message.sender_id;

      if (isChatOpen && selectedDoctorForChat?.id === doctorId) {
        setMessages(prev => [...prev, message]);
        chatService.markMessagesAsRead(doctorId, profile.id);
        setUnreadCounts(prevCounts => ({ ...prevCounts, [doctorId]: 0 }));
      } else {
        setUnreadCounts(prevCounts => ({
          ...prevCounts,
          [doctorId]: (prevCounts[doctorId] || 0) + 1,
        }));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isChatOpen, profile.id, selectedDoctorForChat, loadMessages, fetchPatientAppointments, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const fetchMyAppointments = async () => {
      if (!user) {
        setLoadingMyAppointments(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select(`*, doctors (specialization, profiles (first_name, last_name))`)
          .eq('patient_id', user.id)
          .order('appointment_date', { ascending: false })
          .order('appointment_time', { ascending: false });
        if (error) throw error;
        const validAppointments = (data as RawAppointmentData[]).filter(isAppointmentValid);
        setMyAppointments(validAppointments);
      } catch (error) {
        setMyAppointments([]);
      } finally {
        setLoadingMyAppointments(false);
      }
    };
    fetchMyAppointments();
  }, [user]);

  useEffect(() => {
    // Clear modal state on chat close or when messages change
    setShowPreview(false);
    setMediaPreview(null);
  }, [isChatOpen, selectedDoctorForChat, messages.length]);

  useEffect(() => {
    console.log("isChatOpen changed:", isChatOpen);
  }, [isChatOpen]);

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans antialiased">
      {/* Left Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="flex items-center justify-center h-16 border-b border-gray-200">
          <Link to="/" className="flex items-center space-x-2 text-blue-600 hover:text-blue-700">
            <Heart className="h-6 w-6" />
            <span className="text-xl font-bold">Pre Clinic</span>
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <div>
            <Button variant="ghost" className="w-full justify-start text-green-700 bg-green-50 hover:bg-green-100 font-semibold">
              <LayoutGrid className="h-5 w-5 mr-3" />
              Dashboard 
            </Button>
          </div>
          
          <Link to="/find-doctors" className="w-full">
            <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100">
              <Stethoscope className="h-5 w-5 mr-3" />
              Doctors 
            </Button>
          </Link>

          <Link to="/upcoming-appointments" className="w-full">
            <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100">
              <Calendar className="h-5 w-5 mr-3" />
              Upcoming Appointments
            </Button>
          </Link>

          <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100" onClick={() => { console.log("Sidebar Chat clicked"); setIsChatOpen(true); }}>
            <MessageSquare className="h-5 w-5 mr-3" />
            Chat
            {totalUnreadMessages > 0 && (
              <span className="ml-auto flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-white text-xs font-bold">
                {totalUnreadMessages}
              </span>
            )}
          </Button>

          <Link to="/input-health-data" className="w-full">
            <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100">
              <ClipboardList className="h-5 w-5 mr-3" />
              Input Health Data
            </Button>
          </Link>

          {/* Add My Appointments link below Input Health Data */}
          <Link to="/my-appointments" className="w-full">
            <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100">
              <Calendar className="h-5 w-5 mr-3" />
              My Appointments
            </Button>
          </Link>

          {/* Emergency Section */}
          <div className="flex flex-col items-center mt-auto mb-8">
            <div className="relative group">
              <a href="tel:108" title="Call Ambulance (108)">
                <button
                  className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-red-500 border-4 border-white shadow-2xl text-white text-4xl transition-transform transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-red-300 animate-pulse"
                  aria-label="Call Ambulance"
                >
                  {/* Ambulance SVG icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-10 h-10">
                    <rect x="3" y="11" width="13" height="6" rx="2" fill="white" stroke="currentColor" strokeWidth="2" />
                    <rect x="16" y="13" width="5" height="4" rx="1" fill="white" stroke="currentColor" strokeWidth="2" />
                    <circle cx="7.5" cy="18" r="1.5" fill="currentColor" />
                    <circle cx="18.5" cy="18" r="1.5" fill="currentColor" />
                    <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M7 14h3m-1.5-1.5v3" />
                  </svg>
                </button>
              </a>
              <span className="block mt-3 text-base font-bold text-red-700 text-center tracking-wide">Emergency<br/>Call Ambulance</span>
              <span className="absolute left-1/2 -top-10 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-black text-white text-xs rounded px-3 py-2 pointer-events-none transition-opacity z-50 shadow-lg">Call Ambulance (108)</span>
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between h-16 bg-white border-b border-gray-200 px-6">
          <div className="text-xl font-bold text-gray-800">Dashboard</div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-gray-600 text-sm">
              <Calendar className="h-4 w-4 mr-1" />
              <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            {/* Dark mode toggle */}
            <div className="flex items-center space-x-2">
              <Sun className={`h-5 w-5 ${theme === 'dark' ? 'text-muted-foreground' : 'text-yellow-500'}`} />
              <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} aria-label="Toggle dark mode" />
              <Moon className={`h-5 w-5 ${theme === 'dark' ? 'text-blue-400' : 'text-muted-foreground'}`} />
            </div>
            <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900">
              <Bell className="h-6 w-6" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile.profile_picture_url || ''} alt="@shadcn" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile.first_name} {profile.last_name}</p>
                    <p className="text-xs leading-none text-gray-500">Patient</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setEditProfileOpen(true)} className="ml-2">Edit Profile</Button>
          </div>
        </header>

        {/* Main Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
            <span>Dashboard</span>
            <span>&gt;</span>
          </div>

          {/* Good Morning Banner */}
          <Card className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 mb-6 flex items-center justify-between relative overflow-hidden h-48">
            <div className="absolute inset-0 bg-pattern opacity-10"></div>
            <div className="relative z-10">
              <h1 className="text-3xl font-bold mb-2">{getGreeting()}, {profile.first_name} {profile.last_name}</h1>
              <Link to="/find-doctors">
                <Button variant="default" className="bg-green-600 text-white hover:bg-green-700">
                  Create Appointment
                </Button>
              </Link>
            </div>
          </Card>

          {/* Health Stats Cards */}
          <div className="grid grid-cols-4 gap-6 mb-6">
            <Card className="p-4 flex items-center space-x-4">
              <div className="flex-shrink-0 p-3 rounded-full bg-blue-100 text-blue-600">
                <Heart className="h-6 w-6" />
              </div>
              <div className="flex-grow">
                <CardTitle className="text-sm font-medium text-gray-500">Heart Rate</CardTitle>
                <div className="text-2xl font-bold">{heartRate ?? 'N/A'} <span className="text-base font-normal text-gray-500">bpm</span></div>
              </div>
            </Card>
            <Card className="p-4 flex items-center space-x-4">
              <div className="flex-shrink-0 p-3 rounded-full bg-red-100 text-red-600">
                <Thermometer className="h-6 w-6" />
              </div>
              <div className="flex-grow">
                <CardTitle className="text-sm font-medium text-gray-500">Body Temperature</CardTitle>
                <div className="text-2xl font-bold">{bodyTemperature ?? 'N/A'} <span className="text-base font-normal text-gray-500">°C</span></div>
              </div>
            </Card>
            <Card className="p-4 flex items-center space-x-4">
              <div className="flex-shrink-0 p-3 rounded-full bg-yellow-100 text-yellow-600">
                <Droplet className="h-6 w-6" />
              </div>
              <div className="flex-grow">
                <CardTitle className="text-sm font-medium text-gray-500">Blood Pressure</CardTitle>
                <div className="text-2xl font-bold">{bloodPressure ?? 'N/A'} <span className="text-base font-normal text-gray-500">mm/Hg</span></div>
              </div>
            </Card>
            <Card className="p-4 flex items-center space-x-4">
              <div className="flex-shrink-0 p-3 rounded-full bg-pink-100 text-pink-600">
                <Activity className="h-6 w-6" />
              </div>
              <div className="flex-grow">
                <CardTitle className="text-sm font-medium text-gray-500">Activity</CardTitle>
                <div className="text-2xl font-bold">{activity ?? 'N/A'}</div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Body Mass Index */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Body Mass index</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="flex justify-around items-end mb-4">
                  <div>
                    <p className="text-gray-500 text-sm">76</p>
                    <Scale className="h-8 w-8 text-green-600 mx-auto" />
                    <p className="text-lg font-bold">68</p>
                    <p className="text-gray-500 text-sm">kg</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">168</p>
                    <Scale className="h-8 w-8 text-blue-600 mx-auto" />
                    <p className="text-lg font-bold">160</p>
                    <p className="text-gray-500 text-sm">cm</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">162</p>
                    <Scale className="h-8 w-8 text-purple-600 mx-auto" />
                    <p className="text-lg font-bold">{bmi ? bmi.toFixed(1) : 'N/A'}</p>
                    <p className="text-gray-500 text-sm">BMI</p>
                  </div>
                </div>
                <div className="flex justify-center space-x-2 mt-4">
                  <div className={`w-1/3 h-2 rounded-full ${bmi && bmi < 18.5 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                  <div className={`w-1/3 h-2 rounded-full ${bmi && bmi >= 18.5 && bmi < 24.9 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                  <div className={`w-1/3 h-2 rounded-full ${bmi && bmi >= 24.9 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Underweight</span>
                  <span>Normal (18.5-24.9)</span>
                  <span>Overweight</span>
                </div>
              </CardContent>
            </Card>
            {/* Live Appointment Status */}
            <Card className="col-span-1 animate-fade-in shadow-lg border-2 border-blue-400 bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-blue-900 dark:via-gray-900 dark:to-green-900">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600 animate-pulse" />
                  Live Appointment Status
                </CardTitle>
                {upcomingAppointment && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold shadow transition-colors duration-300 animate-pulse
                      ${upcomingAppointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-300' : ''}
                      ${upcomingAppointment.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-300' : ''}
                      ${upcomingAppointment.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-300' : ''}
                      ${upcomingAppointment.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-300' : ''}
                    `}
                  >
                    {upcomingAppointment.status.charAt(0).toUpperCase() + upcomingAppointment.status.slice(1)}
                  </span>
                )}
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center min-h-[180px]">
                {loadingRecentAppointment ? (
                  <div className="flex flex-col items-center justify-center h-full animate-pulse">
                    <div className="h-8 w-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <span className="text-blue-500 font-semibold">Loading appointment...</span>
                  </div>
                ) : upcomingAppointment ? (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {upcomingAppointment.doctors?.profiles?.first_name?.[0] || ''}
                          {upcomingAppointment.doctors?.profiles?.last_name?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <div className="font-bold text-lg text-blue-700 dark:text-blue-300">
                          Dr. {upcomingAppointment.doctors?.profiles?.first_name} {upcomingAppointment.doctors?.profiles?.last_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-300">
                          {upcomingAppointment.doctors?.specialization}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                      <Calendar className="inline h-4 w-4 mr-1 text-blue-400" />
                      {upcomingAppointment.appointment_date} at {upcomingAppointment.appointment_time}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-300 italic">
                      {upcomingAppointment.reason}
                    </div>
                  </>
                ) : (
                  <div className="text-gray-400 dark:text-gray-500 flex flex-col items-center">
                    <Calendar className="h-8 w-8 mb-2 animate-bounce text-blue-300" />
                    <span>No upcoming appointments found.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Smoking and Drinking Habits */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Smoking Habit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <p className="text-lg font-bold mb-2">{smokingStatus ? 'Unhealthy' : 'Healthy'}</p>
                  <Progress value={smokingStatus ? 80 : 20} className="w-full max-w-xs" />
                  <p className="text-sm text-gray-500 mt-2">{smokingStatus ? 'Consider reducing smoking' : 'Great! Keep it up.'}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Drinking Habit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <p className="text-lg font-bold mb-2">{drinkingStatus ? 'Unhealthy' : 'Healthy'}</p>
                  <Progress value={drinkingStatus ? 80 : 20} className="w-full max-w-xs" />
                  <p className="text-sm text-gray-500 mt-2">{drinkingStatus ? 'Consider reducing drinking' : 'Great! Keep it up.'}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Consultation History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingConsultationHistory ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading history...</p>
                </div>
              ) : consultationHistory.length === 0 ? (
                <div className="text-center text-gray-500 py-4">No consultation history.</div>
              ) : (
                consultationHistory.map((appointment) => (
                  <div key={appointment.id} className="flex items-center space-x-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{`${appointment.doctors?.profiles?.first_name?.[0] || ''}${appointment.doctors?.profiles?.last_name?.[0] || ''}`}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">Dr. {appointment.doctors?.profiles?.first_name} {appointment.doctors?.profiles?.last_name}</p>
                      <p className="text-sm text-gray-500">{appointment.reason}</p>
                      <p className="text-xs text-gray-400">{appointment.appointment_date} at {appointment.appointment_time}</p>
                      <p className="text-xs text-green-600">You have consulted with this doctor.</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Chat Button and Interface */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isChatOpen ? (
          <Button
            onClick={() => setIsChatOpen(true)}
            className="rounded-full p-4 bg-green-600 hover:bg-green-700 text-white shadow-lg relative"
          >
            <MessageSquare className="h-6 w-6" />
            {totalUnreadMessages > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                {totalUnreadMessages}
              </span>
            )}
          </Button>
        ) : (
          <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
            <div className="fixed inset-0 flex items-center justify-center z-[100]">
              <DialogContent className="max-w-4xl w-full max-h-[90vh] rounded-xl shadow-lg bg-white p-0 flex flex-col">
                {(() => {
                  try {
                    return (
                      <>
                        <DialogHeader className="p-4 border-b">
                          {selectedDoctorForChat ? (
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedDoctorForChat(null);
                                  setMessages([]);
                                }}
                                className="h-auto w-auto p-1"
                              >
                                <ArrowLeft className="h-5 w-5" />
                              </Button>
                              <DialogTitle>Chat with {selectedDoctorForChat.name}</DialogTitle>
                            </div>
                          ) : (
                            <DialogTitle>Select a Doctor to Chat</DialogTitle>
                          )}
                        </DialogHeader>
                        <ResizablePanelGroup direction="horizontal" className="flex-1 items-stretch">
                          <ResizablePanel defaultSize={30} minSize={20} className="flex flex-col border-r">
                            <div className="p-4 border-b">
                              <h2 className="text-lg font-semibold">Your Doctors:</h2>
                              <Input
                                type="text"
                                placeholder="Search doctors..."
                                className="mt-2"
                                value={searchTerm}
                                onChange={handleSearchChange}
                              />
                            </div>
                            <div className="flex-1 overflow-y-auto">
                              {loadingAppointments ? (
                                <div className="p-4 text-center text-gray-500">Loading doctors...</div>
                              ) : patientAppointments.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">You have no past appointments to chat with doctors.</div>
                              ) : (
                                <nav className="grid gap-1 p-2">
                                  {patientAppointments.filter((appointment) =>
                                    `${appointment.doctors?.profiles?.first_name} ${appointment.doctors?.profiles?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
                                  ).map((appointment) => (
                                    <Button
                                      key={appointment.doctor_id}
                                      variant="ghost"
                                      className={`w-full justify-start ${selectedDoctorForChat?.id === appointment.doctor_id ? 'bg-gray-100' : ''}`}
                                      onClick={() => handleSelectDoctorForChat({ id: appointment.doctor_id, name: `${appointment.doctors?.profiles?.first_name} ${appointment.doctors?.profiles?.last_name}` })}
                                    >
                                      <Avatar className="h-8 w-8 mr-2">
                                        <AvatarFallback>{`${appointment.doctors?.profiles?.first_name?.[0] || ''}${appointment.doctors?.profiles?.last_name?.[0] || ''}`}</AvatarFallback>
                                      </Avatar>
                                      <span className={`${(unreadCounts[appointment.doctor_id] || 0) > 0 ? 'font-bold' : ''}`}>
                                        {`${appointment.doctors?.profiles?.first_name} ${appointment.doctors?.profiles?.last_name}`}
                                      </span>
                                      {(unreadCounts[appointment.doctor_id] || 0) > 0 && (
                                        <span className="ml-auto flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-white text-xs font-bold">
                                          {unreadCounts[appointment.doctor_id]}
                                        </span>
                                      )}
                                    </Button>
                                  ))}
                                </nav>
                              )}
                            </div>
                          </ResizablePanel>

                          <ResizableHandle withHandle />

                          <ResizablePanel defaultSize={70} className="flex flex-col">
                            {!selectedDoctorForChat ? (
                              <div className="flex-1 flex items-center justify-center text-gray-500">
                                Select a Doctor to Chat
                              </div>
                            ) : (
                              <>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[100px]">
                                  <ChatMessageList messages={messages} loadingMessages={loadingMessages} profileId={profile.id} />
                                </div>
                                <div className="flex space-x-2 p-4 border-t">
                                  <Input
                                    placeholder="Type your message..."
                                    value={chatMessage}
                                    onChange={handleMessageChange}
                                    onKeyPress={handleKeyPress}
                                    className="flex-1"
                                  />
                                  {/* Media upload button */}
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    id="patient-chat-file-upload"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      // Upload to Supabase Storage
                                      const filePath = `chat-media/${profile.id}/${Date.now()}_${file.name}`;
                                      const { error: uploadError } = await supabase.storage
                                        .from('chat-media')
                                        .upload(filePath, file, { upsert: true });
                                      if (!uploadError) {
                                        const { data: publicUrlData } = supabase.storage
                                          .from('chat-media')
                                          .getPublicUrl(filePath);
                                        // Send as a chat message (you may want to distinguish media messages)
                                        await handleSendMessage(publicUrlData.publicUrl, file.type);
                                      } else {
                                        toast({ title: "Upload Failed", description: uploadError.message, variant: "destructive" });
                                      }
                                      e.target.value = '';
                                    }}
                                  />
                                  <Button
                                    variant="outline"
                                    className="p-2"
                                    onClick={() => document.getElementById('patient-chat-file-upload').click()}
                                    title="Send media"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-3A2.25 2.25 0 008.25 5.25v13.5A2.25 2.25 0 0010.5 21h3a2.25 2.25 0 002.25-2.25V15" />
                                    </svg>
                                  </Button>
                                  <Button
                                    variant="default"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleSendMessage(chatMessage, '')}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </ResizablePanel>
                        </ResizablePanelGroup>
                        {showPreview && mediaPreview && (
                          <div className="absolute inset-0 w-full h-full z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={handleClosePreview}>
                            <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()} ref={previewRef}>
                              {mediaPreview.type === 'image' && (
                                <img src={mediaPreview.url} alt="Preview" className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-lg cursor-zoom-in" style={{objectFit:'contain'}} />
                              )}
                              {mediaPreview.type === 'video' && (
                                <video src={mediaPreview.url} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-lg bg-black" />
                              )}
                              {mediaPreview.type === 'audio' && (
                                <audio src={mediaPreview.url} controls autoPlay className="w-full mt-4" />
                              )}
                              {mediaPreview.type === 'file' && (
                                <a href={mediaPreview.url} download className="text-blue-600 underline text-lg">Download File</a>
                              )}
                              {/* File name/size */}
                              {mediaPreview.name && (
                                <div className="absolute bottom-4 left-4 bg-white bg-opacity-80 rounded px-3 py-1 text-sm text-gray-800 shadow">{mediaPreview.name} {mediaPreview.size ? `(${(mediaPreview.size/1024).toFixed(1)} KB)` : ''}</div>
                              )}
                              {/* Download button */}
                              {mediaPreview.type === 'image' && (
                                <a
                                  href={mediaPreview.url}
                                  className="absolute top-4 right-4 bg-white bg-opacity-80 rounded-full p-2 shadow-md"
                                  title="Download"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                      const response = await fetch(mediaPreview.url, { mode: 'cors' });
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = mediaPreview.name || 'download';
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();
                                      window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                      alert('Failed to download image');
                                    }
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-green-600">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 6-6M12 18.75V3" />
                                  </svg>
                                </a>
                              )}
                              {/* Close button */}
                              <button
                                className="absolute top-4 left-4 bg-white bg-opacity-80 rounded-full p-2 shadow-md"
                                onClick={handleClosePreview}
                                title="Close"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-gray-700">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  } catch (err) {
                    console.error('Chat Modal Error:', err);
                    return <div style={{ color: 'red', padding: 20 }}>Error rendering chat modal: {String(err)}</div>;
                  }
                })()}
              </DialogContent>
            </div>
          </Dialog>
        )}
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Profile Picture Upload */}
            <div className="flex flex-col items-center space-y-2">
              <img src={editProfilePic} alt="Profile" className="h-20 w-20 rounded-full object-cover border" />
              <label className="flex items-center gap-2 cursor-pointer">
                <Upload className="h-5 w-5" />
                <span>Upload Photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleProfilePicFileChange} />
              </label>
              {uploadingPic && <span className="text-xs text-gray-500">Uploading...</span>}
            </div>
            {/* Other fields */}
            <Input placeholder="First Name" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} />
            <Input placeholder="Last Name" value={editLastName} onChange={e => setEditLastName(e.target.value)} />
            <Input placeholder="Phone number" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            <Input placeholder="Profile picture URL" value={editProfilePic} onChange={e => setEditProfilePic(e.target.value)} />
            <Input placeholder="Date of Birth" type="date" value={editDateOfBirth} onChange={e => setEditDateOfBirth(e.target.value)} />
            <select value={editGender} onChange={e => setEditGender(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <Textarea placeholder="Address" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
            <Input placeholder="Emergency Contact" value={editEmergencyContact} onChange={e => setEditEmergencyContact(e.target.value)} />
            <Button onClick={handleEditProfile} disabled={savingProfile} className="w-full">{savingProfile ? "Saving..." : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientDashboard;
