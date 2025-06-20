import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  profile_picture_url: string;
  user_type: string;
}

interface Doctor {
  bio?: string;
  specialization?: string;
  experience_years?: number;
  consultation_fee?: number;
  qualifications?: string;
}

interface FormState {
  first_name: string;
  last_name: string;
  phone: string;
  profile_picture_url: string;
  bio: string;
  specialization: string;
  experience_years: string;
  consultation_fee: string;
  qualifications: string;
}

const ProfilePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormState>({
    first_name: "",
    last_name: "",
    phone: "",
    profile_picture_url: "",
    bio: "",
    specialization: "",
    experience_years: "",
    consultation_fee: "",
    qualifications: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        console.warn("ProfilePage: No user found. Redirecting or showing empty state.");
        setLoading(false);
        return;
      }
      console.log("ProfilePage: User found:", user.id);
      setLoading(true);
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("ProfilePage: Error fetching profile:", profileError);
        toast({
          title: "Error loading profile",
          description: profileError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Fetch doctor data if user is a doctor
      let doctorData: Doctor = {};
      let doctorError = null;
      if (profileData?.user_type === "doctor") {
        const { data: docData, error: docErr } = await supabase
          .from("doctors")
          .select("*")
          .eq("id", user.id)
          .single();
        doctorData = docData || {};
        doctorError = docErr;

        if (doctorError) {
          console.error("ProfilePage: Error fetching doctor data:", doctorError);
          toast({
            title: "Error loading doctor data",
            description: doctorError.message,
            variant: "destructive",
          });
        }
      }
      if (profileData) {
        setProfile(profileData as Profile);
        setForm({
          first_name: profileData.first_name || "",
          last_name: profileData.last_name || "",
          phone: profileData.phone || "",
          profile_picture_url: profileData.profile_picture_url || "",
          bio: doctorData.bio || "",
          specialization: doctorData.specialization || "",
          experience_years: doctorData.experience_years?.toString() || "",
          consultation_fee: doctorData.consultation_fee?.toString() || "",
          qualifications: doctorData.qualifications || "",
        });
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user, toast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setLoading(true);
    // Update profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        profile_picture_url: form.profile_picture_url,
      })
      .eq("id", user.id);
    // Update doctors table if user is a doctor
    let doctorError = null;
    if (profile?.user_type === "doctor") {
      const { error } = await supabase
        .from("doctors")
        .update({
          bio: form.bio,
          specialization: form.specialization,
          experience_years: form.experience_years ? parseInt(form.experience_years) : null,
          consultation_fee: form.consultation_fee ? parseFloat(form.consultation_fee) : null,
          qualifications: form.qualifications,
        })
        .eq("id", user.id);
      doctorError = error;
    }
    if (!profileError && !doctorError) {
      toast({
        title: "Profile updated!",
        description: "Your profile information has been saved.",
      });
    } else {
      toast({
        title: "Update failed",
        description: (profileError || doctorError)?.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-20">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Manage Your Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>First Name</Label>
              <Input name="first_name" value={form.first_name} onChange={handleChange} />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input name="last_name" value={form.last_name} onChange={handleChange} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div>
              <Label>Profile Picture URL</Label>
              <Input name="profile_picture_url" value={form.profile_picture_url} onChange={handleChange} />
              {form.profile_picture_url && (
                <img src={form.profile_picture_url} alt="Profile" className="h-20 w-20 rounded-full mt-2" />
              )}
            </div>
            {profile?.user_type === "doctor" && (
              <>
                <div>
                  <Label>Bio</Label>
                  <Input name="bio" value={form.bio} onChange={handleChange} />
                </div>
                <div>
                  <Label>Specialization</Label>
                  <Input name="specialization" value={form.specialization} onChange={handleChange} />
                </div>
                <div>
                  <Label>Experience (years)</Label>
                  <Input name="experience_years" type="number" value={form.experience_years} onChange={handleChange} />
                </div>
                <div>
                  <Label>Consultation Fee</Label>
                  <Input name="consultation_fee" type="number" value={form.consultation_fee} onChange={handleChange} />
                </div>
                <div>
                  <Label>Qualifications</Label>
                  <Input name="qualifications" value={form.qualifications} onChange={handleChange} />
                </div>
              </>
            )}
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
