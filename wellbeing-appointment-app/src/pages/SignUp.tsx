import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Upload, User, Stethoscope, Loader2 } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const SignUp = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [userType, setUserType] = useState<'patient' | 'doctor'>(
    (searchParams.get('type') as 'patient' | 'doctor') || 'patient'
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    // Common fields
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    profilePicture: null as File | null,
    profilePictureUrl: '',
    
    // Patient specific
    dateOfBirth: '',
    gender: '',
    address: '',
    emergencyContact: '',
    
    // Doctor specific
    medicalLicense: '',
    specialization: '',
    experience: '',
    qualifications: '',
    consultationFee: '',
    bio: '',
    licenseDocument: null as File | null
  });

  const { toast } = useToast();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const specializations = [
    'Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics', 
    'Neurology', 'Gynecology', 'Psychiatry', 'General Medicine',
    'Oncology', 'Radiology', 'Anesthesiology', 'Pathology'
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: string, file: File | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: file,
      profilePictureUrl: file ? URL.createObjectURL(file) : ''
    }));
  };

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields.",
          variant: "destructive"
        });
        return false;
      }
      if (!formData.password || formData.password.length < 6) {
        toast({
          title: "Invalid Password",
          description: "Password must be at least 6 characters long.",
          variant: "destructive"
        });
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        toast({
          title: "Password Mismatch",
          description: "Passwords do not match.",
          variant: "destructive"
        });
        return false;
      }
    }

    if (step === 2 && userType === 'doctor') {
      if (!formData.medicalLicense || !formData.specialization) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields for doctor registration.",
          variant: "destructive"
        });
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/email-confirmation`;
      
      // 1. Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            user_type: userType,
            ...(userType === 'doctor' && {
              medical_license: formData.medicalLicense,
              specialization: formData.specialization,
              experience_years: formData.experience ? parseInt(formData.experience) : null,
              qualifications: formData.qualifications,
              consultation_fee: formData.consultationFee ? parseFloat(formData.consultationFee) : null,
              bio: formData.bio
            })
          }
        }
      });

      if (error) {
        console.error('Signup error:', error);
        toast({
          title: "Signup Failed",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      // 2. Get the new user's ID
      const userId = data.user?.id;
      if (!userId) {
        toast({
          title: "Error",
          description: "Could not get user ID after sign up.",
          variant: "destructive"
        });
        return;
      }

      // 3. Upload the profile picture if it exists
      let profilePictureUrl = '';
      if (formData.profilePicture) {
        setUploadingImage(true);
        const file = formData.profilePicture;
        const filePath = `profile-pictures/${userId}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true });
        setUploadingImage(false);
        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({
            title: "Upload Failed",
            description: "Failed to upload profile picture. Please try again.",
            variant: "destructive"
          });
        } else {
          // Get the public URL
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          profilePictureUrl = publicUrlData.publicUrl;
          setFormData(prev => ({ ...prev, profilePictureUrl }));
          toast({
            title: "Upload Successful",
            description: "Profile picture uploaded successfully.",
          });
        }
      }

      // 4. Upsert all profile fields into the profiles table
      const profileData: any = {
        id: userId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        user_type: userType,
        profile_picture_url: profilePictureUrl || null,
      };
      if (userType === 'patient') {
        profileData.date_of_birth = formData.dateOfBirth || null;
        profileData.gender = formData.gender || null;
        profileData.address = formData.address || null;
        profileData.emergency_contact = formData.emergencyContact || null;
      }
      if (userType === 'doctor') {
        profileData.medical_license = formData.medicalLicense || null;
        profileData.specialization = formData.specialization || null;
        profileData.experience_years = formData.experience ? parseInt(formData.experience) : null;
        profileData.qualifications = formData.qualifications || null;
        profileData.consultation_fee = formData.consultationFee ? parseFloat(formData.consultationFee) : null;
        profileData.bio = formData.bio || null;
      }
      await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: ['id'] });

      // Upsert into patients or doctors table as appropriate
      if (userType === 'patient') {
        await supabase.from('patients').upsert({
          id: userId,
          date_of_birth: formData.dateOfBirth || null,
          gender: formData.gender || null,
          address: formData.address || null,
          emergency_contact: formData.emergencyContact || null,
          // Add other patient fields as needed
        }, { onConflict: ['id'] });
      }
      if (userType === 'doctor') {
        await supabase.from('doctors').upsert({
          id: userId,
          medical_license: formData.medicalLicense || null,
          specialization: formData.specialization || null,
          experience_years: formData.experience ? parseInt(formData.experience) : null,
          qualifications: formData.qualifications || null,
          consultation_fee: formData.consultationFee ? parseFloat(formData.consultationFee) : null,
          bio: formData.bio || null,
          // Add other doctor fields as needed
        }, { onConflict: ['id'] });
      }

      if (data.user && !data.user.email_confirmed_at) {
        toast({
          title: "Check Your Email",
          description: "We've sent you a confirmation link. Please check your email and click the link to activate your account.",
        });
        navigate('/login');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePictureUpload = async (file: File) => {
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(`public/${user.id}/${file.name}`, file);

    if (error) {
      console.error('Upload error:', error);
      alert(JSON.stringify(error, null, 2));
    } else {
      alert('Upload success!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 py-8 animate-fade-in">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8 animate-scale-in">
          <Link to="/" className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-4 hover-scale">
            <Heart className="h-6 w-6" />
            <span className="text-xl font-bold">HealthCare+</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Account</h1>
          <p className="text-gray-600">Join our healthcare community</p>
        </div>

        {/* User Type Selection */}
        <Card className="mb-6 animate-fade-in">
          <CardContent className="p-6">
            <Label className="text-base font-medium mb-4 block">I am a:</Label>
            <RadioGroup
              value={userType}
              onValueChange={(value: 'patient' | 'doctor') => setUserType(value)}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="patient" id="patient" />
                <Label htmlFor="patient" className="flex items-center gap-2 cursor-pointer">
                  <User className="h-4 w-4" />
                  Patient
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="doctor" id="doctor" />
                <Label htmlFor="doctor" className="flex items-center gap-2 cursor-pointer">
                  <Stethoscope className="h-4 w-4" />
                  Doctor
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Progress Indicator */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                  currentStep >= step 
                    ? 'bg-blue-600 text-white transform scale-110' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-1 mx-2 transition-all duration-500 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-2 text-sm text-gray-600">
            Step {currentStep} of 3
          </div>
        </div>

        <Card className="animate-scale-in">
          <CardHeader>
            <CardTitle>
              {currentStep === 1 && "Basic Information"}
              {currentStep === 2 && "Profile Details"}
              {currentStep === 3 && "Additional Information"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                {/* Profile Picture Upload */}
                <div className="text-center">
                  <Label className="text-base font-medium mb-4 block">Profile Picture (Optional)</Label>
                  <div className="flex flex-col items-center space-y-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={formData.profilePictureUrl || ''} />
                      <AvatarFallback>
                        <Upload className="h-8 w-8 text-gray-400" />
                      </AvatarFallback>
                    </Avatar>
                    {formData.profilePictureUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleFileChange('profilePicture', null)}
                        className="hover-scale text-xs px-2 py-1 mt-2"
                      >
                        Remove
                      </Button>
                    )}
                    <div className="flex items-center space-x-2">
                      <Input
                        id="profilePicture"
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange('profilePicture', e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('profilePicture')?.click()}
                        disabled={uploadingImage}
                        className="hover-scale"
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Photo
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder="Create a password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      placeholder="Confirm your password"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Profile Details */}
            {currentStep === 2 && (
              <>
                {userType === 'patient' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="dateOfBirth">Date of Birth</Label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="gender">Gender</Label>
                        <select
                          id="gender"
                          value={formData.gender}
                          onChange={(e) => handleInputChange('gender', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        placeholder="Enter your address"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="emergencyContact">Emergency Contact</Label>
                      <Input
                        id="emergencyContact"
                        value={formData.emergencyContact}
                        onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                        placeholder="Emergency contact phone number"
                      />
                    </div>
                  </>
                )}

                {userType === 'doctor' && (
                  <>
                    <div>
                      <Label htmlFor="medicalLicense">Medical License Number *</Label>
                      <Input
                        id="medicalLicense"
                        value={formData.medicalLicense}
                        onChange={(e) => handleInputChange('medicalLicense', e.target.value)}
                        placeholder="Enter your medical license number"
                      />
                    </div>

                    <div>
                      <Label htmlFor="specialization">Specialization *</Label>
                      <select
                        id="specialization"
                        value={formData.specialization}
                        onChange={(e) => handleInputChange('specialization', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select Specialization</option>
                        {specializations.map(spec => (
                          <option key={spec} value={spec}>{spec}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="experience">Years of Experience</Label>
                        <Input
                          id="experience"
                          type="number"
                          value={formData.experience}
                          onChange={(e) => handleInputChange('experience', e.target.value)}
                          placeholder="Years"
                        />
                      </div>
                      <div>
                        <Label htmlFor="consultationFee">Consultation Fee ($)</Label>
                        <Input
                          id="consultationFee"
                          type="number"
                          value={formData.consultationFee}
                          onChange={(e) => handleInputChange('consultationFee', e.target.value)}
                          placeholder="Fee amount"
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Step 3: Additional Information */}
            {currentStep === 3 && (
              <>
                {userType === 'doctor' && (
                  <>
                    <div>
                      <Label htmlFor="qualifications">Qualifications</Label>
                      <Textarea
                        id="qualifications"
                        value={formData.qualifications}
                        onChange={(e) => handleInputChange('qualifications', e.target.value)}
                        placeholder="List your medical qualifications (e.g., MD, MBBS, PhD)"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="bio">Professional Bio</Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                        placeholder="Tell patients about your background and expertise"
                        rows={4}
                      />
                    </div>
                  </>
                )}

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Almost Done!</h3>
                  <p className="text-blue-700 text-sm">
                    After submitting, you'll receive a verification email. Please click the link in the email to activate your account.
                  </p>
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6">
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  disabled={loading}
                  className="hover-scale"
                >
                  Previous
                </Button>
              )}
              
              <div className="ml-auto">
                {currentStep < 3 ? (
                  <Button onClick={handleNext} disabled={loading} className="hover-scale">
                    Next
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSubmit} 
                    className="bg-green-600 hover:bg-green-700 hover-scale"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6 animate-fade-in">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium story-link">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
