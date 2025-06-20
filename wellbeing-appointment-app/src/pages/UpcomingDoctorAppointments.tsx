import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { Appointment, isAppointmentValid, RawAppointmentData } from '@/components/dashboards/DoctorDashboard'; // Reusing interfaces

const UpcomingDoctorAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        setLoading(false);
        toast({
          title: "Error",
          description: "User not authenticated.",
          variant: "destructive",
        });
        return;
      }

      const doctorId = userData.user.id;
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
          .eq('doctor_id', doctorId)
          .gte('appointment_date', today)
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true });

        if (error) {
          console.error('Supabase error fetching doctor appointments:', error); // More specific logging
          throw error;
        }

        const validAppointments: Appointment[] = (data || []).map(rawAppt => {
          if (isAppointmentValid(rawAppt)) {
            return rawAppt;
          }
          console.warn('Invalid appointment data skipped:', rawAppt); // Log invalid data
          return null;
        }).filter(Boolean) as Appointment[];

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
  }, [toast]);

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;

      setAppointments(prevAppointments =>
        prevAppointments.map(appt =>
          appt.id === appointmentId ? { ...appt, status: 'cancelled' } : appt
        )
      );
      toast({
        title: "Success",
        description: "Appointment cancelled successfully.",
      });
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast({
        title: "Error",
        description: "Failed to cancel appointment. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Upcoming Appointments</h1>
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading upcoming appointments...</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No upcoming appointments found.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {appointments.map((appointment) => (
            <Card key={appointment.id} className="shadow-md">
              <CardHeader>
                <CardTitle>{format(new Date(appointment.appointment_date), 'PPP')}</CardTitle>
                <p className="text-sm text-gray-500">{appointment.appointment_time}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <img
                    src={appointment.patients.profile_picture_url || 'https://via.placeholder.com/40'}
                    alt={`${appointment.patients.first_name} ${appointment.patients.last_name}`}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium">{`${appointment.patients.first_name} ${appointment.patients.last_name}`}</p>
                    <p className="text-sm text-gray-500">{appointment.reason}</p>
                  </div>
                </div>
                <div className="text-sm">
                  Status: <span className={`font-semibold ${appointment.status === 'cancelled' ? 'text-red-500' : 'text-green-500'}`}>{appointment.status.toUpperCase()}</span>
                </div>
                {appointment.status !== 'cancelled' && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleCancelAppointment(appointment.id)}
                  >
                    Cancel Appointment
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UpcomingDoctorAppointments; 