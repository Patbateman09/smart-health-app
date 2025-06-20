import { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const MyAppointments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Record<string, string>>({});
  const [loadingRec, setLoadingRec] = useState<Record<string, boolean>>({});

  const fetchRecommendations = async (profile: any, appointment: any) => {
    setLoadingRec(prev => ({ ...prev, [appointment.id]: true }));
    setRecommendations(prev => ({ ...prev, [appointment.id]: '' }));
    try {
      const res = await fetch('http://localhost:3001/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, appointment }),
      });
      const data = await res.json();
      setRecommendations(prev => ({ ...prev, [appointment.id]: data.recommendations }));
    } catch (err) {
      setRecommendations(prev => ({ ...prev, [appointment.id]: 'Could not fetch recommendations.' }));
    } finally {
      setLoadingRec(prev => ({ ...prev, [appointment.id]: false }));
    }
  };

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

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
          .eq('patient_id', user.id)
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true });

        if (error) throw error;

        // Cast the raw data to our more flexible type for filtering.
        const rawAppointments: RawAppointmentData[] = (data || []) as RawAppointmentData[];

        // Filter using the type guard. After this, validAppointments will be of type Appointment[].
        const validAppointments: Appointment[] = rawAppointments.filter(isAppointmentValid);

        setAppointments(validAppointments);
      } catch (error) {
        console.error('Error fetching appointments:', error);
        toast({
          title: "Error",
          description: "Failed to load appointments. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [user, toast]);

  // Automatically fetch for the most recent completed appointment
  useEffect(() => {
    const completed = appointments.filter(a => a.status === 'completed');
    if (completed.length && user) {
      // Fetch patient profile from Supabase
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile) {
            // Only auto-fetch if not already fetched
            if (!recommendations[completed[0].id]) {
              fetchRecommendations(profile, completed[0]);
            }
          }
        });
    }
    // eslint-disable-next-line
  }, [appointments, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Appointments</h1>
          <p className="text-gray-600">Manage your upcoming and past appointments here.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {appointments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🗓️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No appointments found</h3>
            <p className="text-gray-600">You haven't booked any appointments yet.</p>
            <Link to="/find-doctors">
              <button className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 transition-colors">
                Book an Appointment
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {appointments.map(appointment => (
              <Card key={appointment.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    Dr. {appointment.doctors!.profiles!.first_name} {appointment.doctors!.profiles!.last_name}
                  </CardTitle>
                  <p className="text-blue-600 font-medium">{appointment.doctors!.specialization}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="h-5 w-5" />
                    <span>{new Date(appointment.appointment_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="h-5 w-5" />
                    <span>{appointment.appointment_time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <User2 className="h-5 w-5" />
                    <span>Reason: {appointment.reason}</span>
                  </div>
                  <div className="mt-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : appointment.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      Status: {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                    </span>
                  </div>
                  {appointment.status === 'completed' && (
                    <div className="mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const { data: profile } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', user.id)
                            .single();
                          if (profile) fetchRecommendations(profile, appointment);
                        }}
                        disabled={loadingRec[appointment.id]}
                        className="mb-2"
                      >
                        {loadingRec[appointment.id] ? 'Loading Recommendations...' : 'Get Health Recommendations'}
                      </Button>
                      {recommendations[appointment.id] && (
                        <Card className="bg-green-50 border-green-200 mt-2">
                          <CardHeader>
                            <CardTitle>Personalized Health Recommendations</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <pre className="whitespace-pre-wrap">{recommendations[appointment.id]}</pre>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAppointments; 