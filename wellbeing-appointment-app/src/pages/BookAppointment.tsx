import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const BookAppointment = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [doctorExists, setDoctorExists] = useState(false);

  // Verify doctor exists
  useEffect(() => {
    const verifyDoctor = async () => {
      if (!doctorId) return;
      
      const { data, error } = await supabase
        .from('doctors')
        .select('id')
        .eq('id', doctorId)
        .single();

      if (error) {
        console.error('Error verifying doctor:', error);
        toast({
          title: "Error",
          description: "Could not verify doctor. Please try again.",
          variant: "destructive",
        });
        navigate('/find-doctors');
        return;
      }

      if (!data) {
        toast({
          title: "Invalid Doctor",
          description: "The selected doctor does not exist.",
          variant: "destructive",
        });
        navigate('/find-doctors');
        return;
      }

      setDoctorExists(true);
    };

    verifyDoctor();
  }, [doctorId, navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to book an appointment.",
        variant: "destructive",
      });
      return;
    }

    if (!doctorExists) {
      toast({
        title: "Invalid Doctor",
        description: "Please select a valid doctor.",
        variant: "destructive",
      });
      return;
    }

    // Validate date and time
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      toast({
        title: "Invalid Date",
        description: "Please select a future date for your appointment.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Attempting to book appointment with data:', {
        doctor_id: doctorId,
        patient_id: user.id,
        appointment_date: date,
        appointment_time: time,
        reason: reason,
        status: "pending"
      });

      const { data, error } = await supabase.from("appointments").insert([
        {
          doctor_id: doctorId,
          patient_id: user.id,
          appointment_date: date,
          appointment_time: time,
          reason: reason,
          status: "pending"
        },
      ]).select();

      if (error) {
        console.error("Supabase error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('Appointment booked successfully:', data);

      toast({
        title: "Appointment Booked!",
        description: "Your appointment has been scheduled.",
        variant: "default",
      });
      setTimeout(() => navigate("/find-doctors"), 1200);
    } catch (error) {
      console.error("Booking error details:", error);
      toast({
        title: "Booking Failed",
        description: error instanceof Error ? error.message : "Failed to book appointment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!doctorExists) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-lg shadow-lg">
          <CardContent className="p-6">
            <p className="text-center text-gray-600">Verifying doctor information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 py-8">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Book Appointment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div>
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
                placeholder="Reason for appointment"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={loading}>
                Back
              </Button>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Booking..." : "Book Appointment"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookAppointment;