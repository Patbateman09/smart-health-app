import { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, User2, ArrowLeft } from "lucide-react";
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

const UpcomingAppointments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

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
          .gte('appointment_date', new Date().toISOString().split('T')[0]) // Only future appointments
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true });

        if (error) throw error;

        setAppointments(data || []);
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
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Upcoming Appointments</h1>
          <p className="text-gray-600">View and manage your upcoming appointments here.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {appointments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🗓️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No upcoming appointments</h3>
            <p className="text-gray-600">You don't have any upcoming appointments scheduled.</p>
            <Link to="/find-doctors">
              <Button className="mt-6">
                Book an Appointment
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {appointments.map(appointment => (
              <Card key={appointment.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    Dr. {appointment.doctors?.profiles?.first_name} {appointment.doctors?.profiles?.last_name}
                  </CardTitle>
                  <p className="text-blue-600 font-medium">{appointment.doctors?.specialization}</p>
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
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      appointment.status === 'pending' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : (appointment.status === 'completed' || appointment.status === 'confirmed')
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      Status: {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UpcomingAppointments; 