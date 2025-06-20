import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Calendar, Users, Settings, LogOut, Bell, Stethoscope, Search, LayoutGrid, BarChart, LineChart, PieChart, ClipboardList, PackageOpen, LifeBuoy, MoreVertical, ChevronDown, ChevronRight, UserRoundCog, FlaskConical, CircleHelp, Clock, Check, MessageSquare, Briefcase, FileText, Plus, X as XIcon, Send, ArrowLeft, Upload, Sun, Moon } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, PieChart as RechartsPieChart, Pie, Cell, LineChart as RechartsLineChart, Line } from 'recharts';
import { chatService } from '@/services/chatService';
import { ChatMessage } from '@/types/chat';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";

interface FetchedPatientProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
  date_of_birth?: string | null;
  age?: number;
}

interface PatientAnalysisDataPoint {
  name: string;
  "All Patients": number;
  patients: {
    first_name: string | null;
    last_name: string | null;
    profile_picture_url: string | null;
    date_of_birth: string | null;
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
  patients: {
    first_name: string | null;
    last_name: string | null;
    profile_picture_url: string | null;
  };
}

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
  patients: {
    first_name: string | null;
    last_name: string | null;
    profile_picture_url: string | null;
  } | { error: true };
}

interface RawPatientAppointmentData {
  patient_id: string;
  patients: {
    first_name: string | null;
    last_name: string | null;
    profile_picture_url: string | null;
    date_of_birth: string | null;
  } | null;
}

interface RawMessageData {
  sender_id: string;
}

export function isAppointmentValid(appt: RawAppointmentData): appt is Appointment {
  if (!appt.patients || typeof appt.patients !== 'object' || 'error' in appt.patients) {
    return false;
  }

  const patientProfile = appt.patients;
  if (
    !(patientProfile.first_name === null || typeof patientProfile.first_name === 'string') ||
    !(patientProfile.last_name === null || typeof patientProfile.last_name === 'string') ||
    !(patientProfile.profile_picture_url === null || typeof patientProfile.profile_picture_url === 'string')
  ) {
    return false;
  }

  return true;
}

interface DoctorDashboardProps {
  profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    profile_picture_url: string | null;
    user_type: string | null;
    phone: string | null;
    medical_license: string | null;
    specialization: string | null;
    experience_years: number | null;
    qualifications: string | null;
    consultation_fee: number | null;
    bio: string | null;
  };
}

const DoctorDashboard = ({ profile }: DoctorDashboardProps) => {
  if (!profile || !profile.id) {
    return <div style={{ color: 'red', padding: 20 }}>Error: Doctor profile not found. Please log in again.</div>;
  }

  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [recentAppointment, setRecentAppointment] = useState<Appointment | null>(null);
  const [loadingRecentAppointment, setLoadingRecentAppointment] = useState(true);

  const [todaysAppointments, setTodaysAppointments] = useState<Appointment[]>([]);
  const [loadingTodaysAppointments, setLoadingTodaysAppointments] = useState(true);

  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [loadingUpcomingAppointments, setLoadingUpcomingAppointments] = useState(true);

  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [loadingPendingAppointments, setLoadingPendingAppointments] = useState(true);

  const [totalAppointmentsCount, setTotalAppointmentsCount] = useState(0);

  const [featuredPatient, setFeaturedPatient] = useState<FetchedPatientProfile | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string; profile_picture_url: string | null } | null>(null);
  const [fetchedPatients, setFetchedPatients] = useState<FetchedPatientProfile[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const totalUnreadMessages = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  const [patientsChartData, setPatientsChartData] = useState([
    { name: 'New', value: 0, color: '#3B82F6' },
    { name: 'Recovered', value: 0, color: '#F59E0B' },
    { name: 'In Treatment', value: 0, color: '#EF4444' },
  ]);

  const [patientAnalysisData, setPatientAnalysisData] = useState<PatientAnalysisDataPoint[]>([]); 

  const [completedAppointments, setCompletedAppointments] = useState<Appointment[]>([]);
  const [loadingCompletedAppointments, setLoadingCompletedAppointments] = useState(true);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editPhone, setEditPhone] = useState(profile.phone || "");
  const [editProfilePic, setEditProfilePic] = useState(profile.profile_picture_url || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState(profile.first_name || "");
  const [editLastName, setEditLastName] = useState(profile.last_name || "");
  const [editMedicalLicense, setEditMedicalLicense] = useState(profile.medical_license || "");
  const [editSpecialization, setEditSpecialization] = useState(profile.specialization || "");
  const [editExperience, setEditExperience] = useState(profile.experience_years ? String(profile.experience_years) : "");
  const [editQualifications, setEditQualifications] = useState(profile.qualifications || "");
  const [editConsultationFee, setEditConsultationFee] = useState(profile.consultation_fee ? String(profile.consultation_fee) : "");
  const [editBio, setEditBio] = useState(profile.bio || "");
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadMessages = useCallback(async () => {
    if (!selectedPatientId) return;
    setLoadingMessages(true);
    try {
      const loadedMessages = await chatService.getMessages(profile.id, selectedPatientId);
      setMessages(loadedMessages);
      await chatService.markMessagesAsRead(selectedPatientId, profile.id);
      setUnreadCounts(prevCounts => ({ ...prevCounts, [selectedPatientId]: 0 }));
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
  }, [profile.id, selectedPatientId, toast]);

  const handleSendMessage = async (content: string, type: string) => {
    if (!selectedPatientId) return;

    try {
      const message = await chatService.sendMessage(profile.id, selectedPatientId, content, type);
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
    }
  };

  const fetchTotalAppointments = useCallback(async () => {
    if (!profile.id) {
      return;
    }
    try {
      const { count, error } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', profile.id)
        .not('status', 'eq', 'cancelled');

      if (error) throw error;
      setTotalAppointmentsCount(count || 0);
    } catch (error) {
      console.error('Error fetching total appointments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load total appointments count.',
        variant: 'destructive',
      });
    }
  }, [profile.id, toast]);

  const fetchTodaysAppointments = useCallback(async () => {
    if (!profile.id) {
      setLoadingTodaysAppointments(false);
      return;
    }

    const today = format(new Date(), 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients:profiles!appointments_patient_id_fkey (
            first_name,
            last_name,
            profile_picture_url
          )
        `)
        .eq('doctor_id', profile.id)
        .eq('appointment_date', today)
        .order('appointment_time', { ascending: true });

      if (error) throw error;

      const validAppointments: Appointment[] = (data || []).map(rawAppt => {
        if (isAppointmentValid(rawAppt)) {
          return rawAppt;
        }
        return null;
      }).filter(Boolean) as Appointment[];

      // Filter out completed appointments
      setTodaysAppointments(validAppointments.filter(appt => appt.status !== 'completed'));
    } catch (error) {
      console.error("Error fetching today's appointments:", error);
      toast({
        title: "Error",
        description: "Failed to load today's appointments.",
        variant: "destructive",
      });
    } finally {
      setLoadingTodaysAppointments(false);
    }
  }, [profile.id, toast]);

  const fetchUpcomingAppointments = useCallback(async () => {
    if (!profile.id) {
      setLoadingUpcomingAppointments(false);
      return;
    }

    const today = format(new Date(), 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients:profiles!appointments_patient_id_fkey (
            first_name,
            last_name,
            profile_picture_url
          )
        `)
        .eq('doctor_id', profile.id)
        .gt('appointment_date', today)
        .not('status', 'eq', 'cancelled')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) throw error;

      const validAppointments: Appointment[] = (data || []).map(rawAppt => {
        if (isAppointmentValid(rawAppt)) {
          return rawAppt;
        }
        return null;
      }).filter(Boolean) as Appointment[];

      // Filter out completed appointments
      setUpcomingAppointments(validAppointments.filter(appt => appt.status !== 'completed'));
    } catch (error) {
      console.error("Error fetching upcoming appointments:", error);
      toast({
        title: "Error",
        description: "Failed to load upcoming appointments.",
        variant: "destructive",
      });
    } finally {
      setLoadingUpcomingAppointments(false);
    }
  }, [profile.id, toast]);

  const fetchPendingAppointments = useCallback(async () => {
    if (!profile.id) {
      setLoadingPendingAppointments(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients:profiles!appointments_patient_id_fkey (
            first_name,
            last_name,
            profile_picture_url
          )
        `)
        .eq('doctor_id', profile.id)
        .in('status', ['pending', 'requested'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const validAppointments: Appointment[] = (data || []).map(rawAppt => {
        if (isAppointmentValid(rawAppt)) {
          return rawAppt;
        }
        return null;
      }).filter(Boolean) as Appointment[];

      setPendingAppointments(validAppointments);
    } catch (error) {
      console.error('Error fetching pending appointments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending appointments.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPendingAppointments(false);
    }
  }, [profile.id, toast]);

  const fetchRecentAppointment = useCallback(async () => {
    if (!profile.id) {
      setLoadingRecentAppointment(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients:profiles!appointments_patient_id_fkey (
            first_name,
            last_name,
            profile_picture_url
          )
        `)
        .eq('doctor_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const rawAppointment: RawAppointmentData = data[0] as RawAppointmentData;
        if (isAppointmentValid(rawAppointment)) {
          setRecentAppointment(rawAppointment);
        }
      }
    } catch (error) {
      console.error('Error fetching recent appointment:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recent appointment.',
        variant: "destructive",
      });
    } finally {
      setLoadingRecentAppointment(false);
    }
  }, [profile.id, toast]);

  const fetchPatients = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const { data: patientAppointmentsData, error: patientAppointmentsError } = await supabase
        .from('appointments')
        .select(
          `
          patient_id,
          patients:profiles!appointments_patient_id_fkey (
            first_name,
            last_name,
            profile_picture_url,
            date_of_birth
          )
          `
        )
        .eq('doctor_id', profile.id)
        .not('status', 'eq', 'cancelled')
        .order('created_at', { ascending: false });

      if (patientAppointmentsError) throw patientAppointmentsError;

      const uniquePatientsMap = new Map<string, FetchedPatientProfile>();
      (patientAppointmentsData || []).forEach((appt: RawPatientAppointmentData) => {
        if (appt.patients && !uniquePatientsMap.has(appt.patient_id)) {
          const patientAge = appt.patients.date_of_birth ? calculateAge(appt.patients.date_of_birth) : undefined;
          console.log(`Patient: ${appt.patients.first_name} ${appt.patients.last_name}, DOB: ${appt.patients.date_of_birth}, Calculated Age: ${patientAge}`);
          uniquePatientsMap.set(appt.patient_id, {
            id: appt.patient_id,
            first_name: appt.patients.first_name,
            last_name: appt.patients.last_name,
            profile_picture_url: appt.patients.profile_picture_url,
            date_of_birth: appt.patients.date_of_birth,
            age: patientAge,
          });
        }
      });

      setFetchedPatients(Array.from(uniquePatientsMap.values()));
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast({
        title: "Error",
        description: "Failed to load patients for chat.",
        variant: "destructive",
      });
    } finally {
      setLoadingPatients(false);
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
      (data || []).forEach((message: RawMessageData) => {
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

  const fetchCompletedAppointments = useCallback(async () => {
    if (!profile.id) {
      setLoadingCompletedAppointments(false);
      return;
    }
    setLoadingCompletedAppointments(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`*, patients:profiles!appointments_patient_id_fkey (first_name, last_name, profile_picture_url)`)
        .eq('doctor_id', profile.id)
        .in('status', ['completed', 'consulted'])
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });
      if (error) throw error;
      const validAppointments: Appointment[] = (data || []).map(rawAppt => {
        if (isAppointmentValid(rawAppt)) {
          return rawAppt;
        }
        return null;
      }).filter(Boolean) as Appointment[];
      setCompletedAppointments(validAppointments);
    } catch (error) {
      console.error('Error fetching completed appointments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load appointment history.',
        variant: 'destructive',
      });
    } finally {
      setLoadingCompletedAppointments(false);
    }
  }, [profile.id, toast]);

  const handleAcceptAppointment = async (appointmentId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .eq('doctor_id', profile.id);

      if (error) throw error;

      setPendingAppointments(prev => 
        prev.filter(appt => appt.id !== appointmentId)
      );
      setUpcomingAppointments(prev => {
        const updatedAppointment = prev.find(appt => appt.id === appointmentId);
        if (updatedAppointment) {
          updatedAppointment.status = 'confirmed';
          return [...prev];
        }
        return prev;
      });

      toast({
        title: "Success",
        description: "Appointment has been confirmed.",
      });
    } catch (error) {
      console.error("Error accepting appointment:", error);
      toast({
        title: "Error",
        description: "Failed to confirm appointment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .eq('doctor_id', profile.id);

      if (error) throw error;

      setPendingAppointments(prev => 
        prev.filter(appt => appt.id !== appointmentId)
      );
      setUpcomingAppointments(prev => 
        prev.filter(appt => appt.id !== appointmentId)
      );
      setTodaysAppointments(prev => 
        prev.filter(appt => appt.id !== appointmentId)
      );

      toast({
        title: "Success",
        description: "Appointment has been cancelled.",
      });
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast({
        title: "Error",
        description: "Failed to cancel appointment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = useCallback((patientId: string, patientName: string, profilePictureUrl: string | null) => {
    setSelectedPatientId(patientId);
    setSelectedPatient({ id: patientId, name: patientName, profile_picture_url: profilePictureUrl });
    setIsChatOpen(true);
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

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setChatMessage(e.target.value);
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage(chatMessage, 'text');
    }
  }, [handleSendMessage, chatMessage]);

  const handleCloseChat = useCallback(() => {
    setIsChatOpen(false);
    setSelectedPatientId(null);
    setSelectedPatient(null);
    setMessages([]);
  }, []);

  const handleMarkAsSeen = async (appointmentId: string) => {
    try {
      setLoading(true);
      console.log('Marking as seen:', appointmentId);
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', appointmentId)
        .eq('doctor_id', profile.id);
      if (error) throw error;
      setTodaysAppointments(prev => {
        const filtered = prev.filter(appt => appt.id !== appointmentId);
        console.log('Updated todaysAppointments:', filtered);
        return filtered;
      });
      setUpcomingAppointments(prev => {
        const filtered = prev.filter(appt => appt.id !== appointmentId);
        console.log('Updated upcomingAppointments:', filtered);
        return filtered;
      });
      fetchCompletedAppointments();
      toast({ title: 'Success', description: 'Appointment marked as seen.' });
    } catch (error) {
      console.error('Error marking appointment as seen:', error);
      toast({ title: 'Error', description: 'Failed to mark as seen.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: editFirstName,
        last_name: editLastName,
        phone: editPhone,
        profile_picture_url: editProfilePic,
        medical_license: editMedicalLicense,
        specialization: editSpecialization,
        experience_years: editExperience ? parseInt(editExperience) : null,
        qualifications: editQualifications,
        consultation_fee: editConsultationFee ? parseFloat(editConsultationFee) : null,
        bio: editBio
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

  const initials = `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`;

  useEffect(() => {
    fetchTotalAppointments();
    fetchTodaysAppointments();
    fetchUpcomingAppointments();
    fetchPendingAppointments();
    fetchRecentAppointment();
    fetchPatients();
    fetchUnreadCounts();
    fetchCompletedAppointments();
  }, [fetchTotalAppointments, fetchTodaysAppointments, fetchUpcomingAppointments, fetchPendingAppointments, fetchRecentAppointment, fetchPatients, fetchUnreadCounts, fetchCompletedAppointments]);

  useEffect(() => {
    const subscription = chatService.subscribeToMessages(profile.id, (message) => {
      const patientId = message.sender_id === profile.id ? message.receiver_id : message.sender_id;

      if (isChatOpen && selectedPatientId === patientId) {
        setMessages(prev => [...prev, message]);
        chatService.markMessagesAsRead(selectedPatientId, profile.id);
        setUnreadCounts(prevCounts => ({ ...prevCounts, [patientId]: 0 }));
      } else { 
        setUnreadCounts(prevCounts => ({
          ...prevCounts,
          [patientId]: (prevCounts[patientId] || 0) + 1,
        }));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [profile.id, isChatOpen, selectedPatientId]); 

  useEffect(() => {
    if (isChatOpen && selectedPatientId) {
      loadMessages(); 
    }
  }, [isChatOpen, selectedPatientId, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (todaysAppointments.length > 0) {
      const patientId = todaysAppointments[0].patient_id;
      const patient = fetchedPatients.find(p => p.id === patientId);
      if (patient) {
        setFeaturedPatient(patient);
      }
    } else if (recentAppointment) {
      const patientId = recentAppointment.patient_id;
      const patient = fetchedPatients.find(p => p.id === patientId);
      if (patient) {
        setFeaturedPatient(patient);
      }
    } else {
      setFeaturedPatient(null);
    }
  }, [todaysAppointments, recentAppointment, fetchedPatients]);

  const dailyRevenueData = [
    { name: '10 May', Income: 70, Expense: 40 },
    { name: '11 May', Income: 85, Expense: 60 },
    { name: '12 May', Income: 95, Expense: 65 },
    { name: '13 May', Income: 90, Expense: 60 },
    { name: '14 May', Income: 80, Expense: 55 },
    { name: '15 May', Income: 98, Expense: 70 },
    { name: '16 May', Income: 88, Expense: 60 },
  ];

  const overallAppointmentData = [
    { time: '8:00', appointments: 15 },
    { time: '9:00', appointments: 20 },
    { time: '10:00', appointments: 35 },
    { time: '11:00', appointments: 25 },
    { time: '12:00', appointments: 40 },
    { time: '13:00', appointments: 30 },
    { time: '14:00', appointments: 28 },
    { time: '15:00', appointments: 22 },
    { time: '16:00', appointments: 18 },
  ];

  const patientsPaceData = [
    { name: 'Jan', 'New Patient': 4000, 'Return Patient': 2400 },
    { name: 'Feb', 'New Patient': 3000, 'Return Patient': 1398 },
    { name: 'Mar', 'New Patient': 2000, 'Return Patient': 9800 },
    { name: 'Apr', 'New Patient': 2780, 'Return Patient': 3908 },
    { name: 'May', 'New Patient': 1890, 'Return Patient': 4800 },
    { name: 'Jun', 'New Patient': 2390, 'Return Patient': 3800 },
    { name: 'Jul', 'New Patient': 3490, 'Return Patient': 4300 },
  ];

  const admissionByDivisionData = [
    { name: 'Cardiology', value: 300, color: '#1F77B4' },
    { name: 'Endocrinology', value: 200, color: '#FF7F0E' },
    { name: 'Physicians', value: 150, color: '#2CA02C' },
    { name: 'Dermatology', value: 250, color: '#D62728' },
    { name: 'Orthopedics', value: 180, color: '#9467BD' },
    { name: 'Immunology', value: 120, color: '#8C564B' },
  ];

  const ChatMessageList = React.memo(({ messages, loadingMessages }: { messages: ChatMessage[], loadingMessages: boolean }) => {
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
          <a href={content} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 underline mt-1" onClick={e => handleMediaClick(content, 'file')}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            View PDF
          </a>
        );
      }
      if (/^https?:\/\//.test(content)) {
        return (
          <a href={content} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 underline mt-1" onClick={e => handleMediaClick(content, 'file')}>
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
            className={`flex ${message.sender_id === profile.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.sender_id === profile.id
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

  function calculateAge(dateOfBirth: string): number | undefined {
    try {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch (e) {
      console.error("Error calculating age:", e);
      return undefined;
    }
  }

  const handleMediaClick = (url: string, type: 'image'|'video'|'audio'|'file') => {
    setMediaPreview({ url, type });
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
    // Clear modal state on chat close or when messages change
    setShowPreview(false);
    setMediaPreview(null);
  }, [isChatOpen, selectedPatientId, messages.length]);

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans antialiased">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="flex items-center justify-center h-16 border-b border-gray-200">
          <Link to="/" className="flex items-center space-x-2 text-blue-600 hover:text-blue-700">
            <Heart className="h-6 w-6" />
            <span className="text-xl font-bold">MedicDr</span>
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <div className="flex items-center space-x-3 mb-6 p-2 rounded-lg bg-blue-50">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile.profile_picture_url || ''} alt="@doctor" />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-gray-800">Welcome Dr. {profile.first_name}</p>
              <p className="text-sm text-gray-500">Have a nice day of great work!</p>
            </div>
          </div>
          
          <Button variant="ghost" className="w-full justify-start text-blue-600 bg-blue-50 hover:bg-blue-100 font-semibold">
            <LayoutGrid className="h-5 w-5 mr-3" />
            Overview
          </Button>
          <Link to="/doctor/appointments">
            <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100">
              <Calendar className="h-5 w-5 mr-3" />
              Appointments
            </Button>
          </Link>
          <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100" onClick={() => setIsChatOpen(true)}>
            <MessageSquare className="h-5 w-5 mr-3" />
            Messages
            {totalUnreadMessages > 0 && (
              <span className="ml-auto flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-white text-xs font-bold">
                {totalUnreadMessages}
              </span>
            )}
          </Button>
          <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100" onClick={() => setEditProfileOpen(true)}>Edit Profile</Button>
          <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100" onClick={handleLogout}>
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </Button>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between h-16 bg-white border-b border-gray-200 px-6">
          <div className="text-xl font-bold text-gray-800">Overview</div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-gray-600 text-sm">
              <Calendar className="h-4 w-4 mr-1" />
              <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
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
                    <p className="text-xs leading-none text-muted-foreground">
                      {profile.user_type}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link to="/settings" className="flex items-center w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Appointments
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAppointmentsCount}</div>
                <p className="text-xs text-muted-foreground">
                  +20.1% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pendings
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingAppointments.length}</div>
                <p className="text-xs text-muted-foreground">
                  +1.0% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Request</CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">
                  +0% from last month
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-6 mb-6">
            <Card className="col-span-3">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Today's Appointment</CardTitle>
                <Button variant="link" className="text-blue-600 p-0 h-auto">See all</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingTodaysAppointments ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading today's appointments...</p>
                  </div>
                ) : todaysAppointments.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    No appointments for today.
                  </div>
                ) : (
                  todaysAppointments.map((appointment) => (
                    <div key={appointment.id} className="flex items-center space-x-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={appointment.patients.profile_picture_url || ''} />
                        <AvatarFallback>{`${appointment.patients.first_name?.[0] || ''}${appointment.patients.last_name?.[0] || ''}`}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{`${appointment.patients.first_name} ${appointment.patients.last_name}`}</p>
                        <p className="text-sm text-gray-500">{appointment.reason}</p>
                      </div>
                      <span className="ml-auto text-sm text-gray-500">
                        {appointment.appointment_time}
                      </span>
                      <Button variant="outline" size="sm" className="p-2 h-auto" onClick={() => handleMarkAsSeen(appointment.id)}>
                        <Check className="h-4 w-4" /> Mark as Seen
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Patient Details</CardTitle>
                <Button variant="link" className="text-blue-600 p-0 h-auto">See all</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {featuredPatient ? (
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={featuredPatient.profile_picture_url || ''} />
                      <AvatarFallback>{`${featuredPatient.first_name?.[0] || ''}${featuredPatient.last_name?.[0] || ''}`}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-lg">{`${featuredPatient.first_name} ${featuredPatient.last_name}`}</p>
                      <p className="text-sm text-gray-500">Age: {featuredPatient.age || 'N/A'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    No patient details available.
                  </div>
                )}
                <Separator />
                <p className="text-sm text-gray-600">
                  No prescription details available.
                </p>
              </CardContent>
            </Card>

            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Appointment Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingUpcomingAppointments ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading timeline...</p>
                  </div>
                ) : upcomingAppointments.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    No upcoming appointments.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingAppointments.map((appointment) => (
                      <div key={appointment.id} className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <div>
                          <p className="font-medium text-sm">{`${appointment.appointment_time} | ${appointment.reason}`}</p>
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={appointment.patients.profile_picture_url || ''} />
                              <AvatarFallback>{`${appointment.patients.first_name?.[0] || ''}${appointment.patients.last_name?.[0] || ''}`}</AvatarFallback>
                            </Avatar>
                            <p className="text-sm text-gray-500">{`${appointment.patients.first_name} ${appointment.patients.last_name}`}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="p-2 h-auto" onClick={() => handleMarkAsSeen(appointment.id)}>
                          <Check className="h-4 w-4" /> Mark as Seen
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Appointment Request</CardTitle>
                <Button variant="link" className="text-blue-600 p-0 h-auto">See all</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 text-sm font-semibold text-gray-600 border-b pb-2 mb-2">
                  <span>Name</span>
                  <span>Date</span>
                  <span>Time</span>
                  <span>Action</span>
                </div>
                {loadingPendingAppointments ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading requests...</p>
                  </div>
                ) : pendingAppointments.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    No pending appointment requests.
                  </div>
                ) : (
                  pendingAppointments.map((request) => (
                    <div key={request.id} className="grid grid-cols-4 items-center text-sm text-gray-700 py-2 border-b last:border-b-0">
                      <span>{`${request.patients.first_name} ${request.patients.last_name}`}</span>
                      <span>{format(new Date(request.appointment_date), 'dd MMM')}</span>
                      <span>{request.appointment_time}</span>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" className="p-2 h-auto" onClick={() => handleAcceptAppointment(request.id)}><Check className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" className="p-2 h-auto" onClick={() => handleCancelAppointment(request.id)}><XIcon className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" className="p-2 h-auto" onClick={() => handleOpenChat(request.patient_id, `${request.patients.first_name} ${request.patients.last_name}`, request.patients.profile_picture_url)}>
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Appointment History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingCompletedAppointments ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading history...</p>
                  </div>
                ) : completedAppointments.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">No appointment history.</div>
                ) : (
                  completedAppointments.map((appointment) => (
                    <div key={appointment.id} className="flex items-center space-x-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={appointment.patients.profile_picture_url || ''} />
                        <AvatarFallback>{`${appointment.patients.first_name?.[0] || ''}${appointment.patients.last_name?.[0] || ''}`}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{`${appointment.patients.first_name} ${appointment.patients.last_name}`}</p>
                        <p className="text-sm text-gray-500">{appointment.reason}</p>
                        <p className="text-xs text-gray-400">{appointment.appointment_date} at {appointment.appointment_time}</p>
                        <p className="text-xs text-green-600">You have seen this patient.</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        {!isChatOpen ? (
          <Button
            onClick={() => setIsChatOpen(true)}
            className="rounded-full p-4 bg-blue-600 hover:bg-blue-700 text-white shadow-lg relative"
          >
            <MessageSquare className="h-6 w-6" />
            {totalUnreadMessages > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                {totalUnreadMessages}
              </span>
            )}
          </Button>
        ) : (
          <div className="w-[80vw] h-[90vh] flex flex-col p-0 rounded-lg shadow-xl bg-white border">
            <div className="p-4 border-b flex items-center">
              {selectedPatientId ? (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedPatientId(null);
                      setSelectedPatient(null);
                      setMessages([]);
                    }}
                    className="h-auto w-auto p-1"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <h2 className="text-lg font-semibold">Chat with {selectedPatient?.name || "Patient"}</h2>
                </div>
              ) : (
                <h2 className="text-lg font-semibold">Chat</h2>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseChat}
                className="ml-auto h-auto w-auto p-1"
              >
                <XIcon className="h-5 w-5" />
              </Button>
            </div>
            <ResizablePanelGroup direction="horizontal" className="flex-1 items-stretch">
              <ResizablePanel defaultSize={30} minSize={20} className="flex flex-col border-r">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold">Your Patients</h2>
                  <Input
                    type="text"
                    placeholder="Search patients..."
                    className="mt-2"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loadingPatients ? (
                    <div className="p-4 text-center text-gray-500">Loading patients...</div>
                  ) : fetchedPatients.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No patients with confirmed appointments found.</div>
                  ) : (
                    <nav className="grid gap-1 p-2">
                      {fetchedPatients.filter(patient =>
                        patient.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        patient.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
                      ).map((patient) => (
                        <Button
                          key={patient.id}
                          variant="ghost"
                          className={`w-full justify-start ${selectedPatientId === patient.id ? 'bg-gray-100' : ''}`}
                          onClick={() => handleOpenChat(patient.id, `${patient.first_name} ${patient.last_name}`, patient.profile_picture_url)}
                        >
                          <Avatar className="h-8 w-8 mr-2">
                            <AvatarImage src={patient.profile_picture_url || undefined} />
                            <AvatarFallback>{`${patient.first_name?.[0] || ''}${patient.last_name?.[0] || ''}`}</AvatarFallback>
                          </Avatar>
                          <span className={`${(unreadCounts[patient.id] || 0) > 0 ? 'font-bold' : ''}`}>
                            {`${patient.first_name} ${patient.last_name}`}
                          </span>
                          {(unreadCounts[patient.id] || 0) > 0 && (
                            <span className="ml-auto flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-white text-xs font-bold">
                              {unreadCounts[patient.id]}
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
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[100px]">
                  <ChatMessageList messages={messages} loadingMessages={loadingMessages} />
                </div>
                {selectedPatientId && (
                  <div className="flex space-x-2 p-4 border-t">
                    <Input
                      placeholder="Type your message..."
                      value={chatMessage}
                      onChange={handleMessageChange}
                      onKeyPress={handleKeyPress}
                      className="flex-1"
                    />
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      id="doctor-chat-file-upload"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const filePath = `chat-media/${profile.id}/${Date.now()}_${file.name}`;
                        const { error: uploadError } = await supabase.storage
                          .from('chat-media')
                          .upload(filePath, file, { upsert: true });
                        if (!uploadError) {
                          const { data: publicUrlData } = supabase.storage
                            .from('chat-media')
                            .getPublicUrl(filePath);
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
                      onClick={() => document.getElementById('doctor-chat-file-upload').click()}
                      title="Send media"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-3A2.25 2.25 0 008.25 5.25v13.5A2.25 2.25 0 0010.5 21h3a2.25 2.25 0 002.25-2.25V15" />
                      </svg>
                    </Button>
                    <Button
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleSendMessage(chatMessage, 'text')}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </div>

      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col items-center space-y-2">
              <img src={editProfilePic} alt="Profile" className="h-20 w-20 rounded-full object-cover border" />
              <label className="flex items-center gap-2 cursor-pointer">
                <Upload className="h-5 w-5" />
                <span>Upload Photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleProfilePicFileChange} />
              </label>
              {uploadingPic && <span className="text-xs text-gray-500">Uploading...</span>}
            </div>
            <Input placeholder="First Name" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} />
            <Input placeholder="Last Name" value={editLastName} onChange={e => setEditLastName(e.target.value)} />
            <Input placeholder="Phone number" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            <Input placeholder="Profile picture URL" value={editProfilePic} onChange={e => setEditProfilePic(e.target.value)} />
            <Input placeholder="Medical License Number" value={editMedicalLicense} onChange={e => setEditMedicalLicense(e.target.value)} />
            <Input placeholder="Specialization" value={editSpecialization} onChange={e => setEditSpecialization(e.target.value)} />
            <Input placeholder="Years of Experience" type="number" value={editExperience} onChange={e => setEditExperience(e.target.value)} />
            <Input placeholder="Qualifications" value={editQualifications} onChange={e => setEditQualifications(e.target.value)} />
            <Input placeholder="Consultation Fee ($)" type="number" value={editConsultationFee} onChange={e => setEditConsultationFee(e.target.value)} />
            <Textarea placeholder="Professional Bio" value={editBio} onChange={e => setEditBio(e.target.value)} />
            <Button onClick={handleEditProfile} disabled={savingProfile} className="w-full">{savingProfile ? "Saving..." : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full-screen image preview modal */}
      {showPreview && mediaPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90" onClick={handleClosePreview}>
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
            <a
              href={mediaPreview.url}
              download
              className="absolute top-4 right-4 bg-white bg-opacity-80 rounded-full p-2 shadow-md"
              title="Download"
              onClick={e => {e.stopPropagation(); /* Optionally show toast here */}}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-green-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 6-6M12 18.75V3" />
              </svg>
            </a>
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
    </div>
  );
};

export default DoctorDashboard;
