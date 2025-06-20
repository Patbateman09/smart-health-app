import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import PatientDashboard from './dashboards/PatientDashboard';
import DoctorDashboard from './dashboards/DoctorDashboard';
import { useState } from 'react';

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: patientHealthData, isLoading: patientHealthLoading } = useQuery({
    queryKey: ['patientHealthData', user?.id],
    queryFn: async () => {
      if (!user?.id || profile?.user_type !== 'patient') return null;

      const { data, error } = await supabase
        .from('patients')
        .select('smoking_status, drinking_status, heart_rate, body_temperature, blood_pressure, activity, bmi')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching patient health data:', error);
        throw error;
      }

      return data;
    },
    enabled: !!user?.id && profile?.user_type === 'patient',
  });

  if (authLoading || profileLoading || patientHealthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">No profile found</p>
      </div>
    );
  }

  if (profile.user_type === 'patient') {
    return <PatientDashboard
      profile={profile}
      smokingStatus={patientHealthData?.smoking_status}
      drinkingStatus={patientHealthData?.drinking_status}
      heartRate={patientHealthData?.heart_rate}
      bodyTemperature={patientHealthData?.body_temperature}
      bloodPressure={patientHealthData?.blood_pressure}
      activity={patientHealthData?.activity}
      bmi={patientHealthData?.bmi}
      isChatOpen={isChatOpen}
      setIsChatOpen={setIsChatOpen}
    />;
  } else if (profile.user_type === 'doctor') {
    return <DoctorDashboard profile={profile} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600">Invalid user type</p>
    </div>
  );
};

export default Dashboard;
