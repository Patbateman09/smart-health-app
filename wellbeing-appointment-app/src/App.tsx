import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import FindDoctors from "./pages/FindDoctors";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import EmailConfirmation from "./pages/EmailConfirmation";
import NotFound from "./pages/NotFound";
import BookAppointment from "./pages/BookAppointment";
import ProfilePage from "./pages/ProfilePage";
import MyAppointments from "./pages/MyAppointments";
import UpcomingAppointments from "./pages/UpcomingAppointments";
import InputHealthData from "./pages/InputHealthData";
import UpcomingDoctorAppointments from './pages/UpcomingDoctorAppointments';
import AIChatAssistant from "@/components/AIChatAssistant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/find-doctors" element={<FindDoctors />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/login" element={<Login />} />
              <Route path="/email-confirmation" element={<EmailConfirmation />} />
              <Route path="/book-appointment/:doctorId" element={<BookAppointment />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile-settings" element={<ProfilePage />} />
              <Route path="/my-appointments" element={<MyAppointments />} />
              <Route path="/upcoming-appointments" element={<UpcomingAppointments />} />
              <Route path="/input-health-data" element={<InputHealthData />} />
              <Route path="/doctor/appointments" element={<UpcomingDoctorAppointments />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          {/* Only show AIChatAssistant if not doctor */}
          {profile?.user_type !== 'doctor' && <AIChatAssistant />}
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
