import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Clock, Search, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Define the type that Supabase *actually* returns, including potential error objects for joins
interface SupabaseRawData {
  id: string;
  medical_license: string;
  specialization: string;
  experience_years: number;
  qualifications: string;
  consultation_fee: number;
  bio: string;
  license_document_url: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  profiles: {
    first_name?: string; // Optional because join might fail or data might be incomplete
    last_name?: string;
    profile_picture_url?: string | null;
    error?: true; // Explicitly account for Supabase query errors on joined fields
  } | null;
}

// Type guard function to check if a raw data item is a valid Doctor
function isDoctor(doc: SupabaseRawData): doc is Doctor {
  // Check if profiles exists and is an object
  if (!doc.profiles || typeof doc.profiles !== 'object') {
    return false;
  }

  // Check if profiles is an error object
  if ('error' in doc.profiles && doc.profiles.error === true) {
    return false;
  }

  // Now that doc.profiles is guaranteed to be an object and not an error,
  // we can safely access its properties and check their types.
  // We need to ensure first_name and last_name exist and are strings.
  if (typeof doc.profiles.first_name !== 'string' || typeof doc.profiles.last_name !== 'string') {
    return false;
  }

  // All checks passed, it's a valid Doctor structure.
  return true;
}

interface Doctor {
  id: string;
  medical_license: string;
  specialization: string;
  experience_years: number;
  qualifications: string;
  consultation_fee: number;
  bio: string;
  license_document_url: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  profiles: {
    first_name: string;
    last_name: string;
    profile_picture_url: string | null;
  } | null;
}

const FindDoctors = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const specializations = [
    "All Specializations",
    "Cardiology",
    "Dermatology", 
    "Pediatrics",
    "Orthopedics",
    "Neurology",
    "Gynecology",
    "Psychiatry",
    "General Medicine"
  ];

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const { data, error } = await supabase
          .from('doctors')
          .select(`
            *,
            profiles (
              first_name,
              last_name,
              profile_picture_url
            )
          `)
          .eq('is_verified', true);

        if (error) throw error;

        // Cast the raw data to our more flexible type for filtering.
        const rawDoctors: SupabaseRawData[] = (data || []) as SupabaseRawData[];

        // Filter using the type guard. After this, validDoctors will be of type Doctor[].
        const validDoctors: Doctor[] = rawDoctors.filter(isDoctor);

        setDoctors(validDoctors);
      } catch (error) {
        console.error('Error fetching doctors:', error);
        toast({
          title: "Error",
          description: "Failed to load doctors. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, [toast]);

  const filteredDoctors = doctors.filter(doctor => {
    const fullName = `${doctor.profiles.first_name} ${doctor.profiles.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                         doctor.specialization.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecialization = selectedSpecialization === '' || 
                                 selectedSpecialization === 'All Specializations' ||
                                 doctor.specialization === selectedSpecialization;
    return matchesSearch && matchesSpecialization;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading doctors...</p>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Doctors</h1>
          <p className="text-gray-600">Book appointments with verified healthcare professionals</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search doctors by name or specialization..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-4">
              <select
                value={selectedSpecialization}
                onChange={(e) => setSelectedSpecialization(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {specializations.map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                More Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredDoctors.length} doctor{filteredDoctors.length !== 1 ? 's' : ''} 
            {selectedSpecialization && selectedSpecialization !== 'All Specializations' && 
              ` in ${selectedSpecialization}`}
          </p>
        </div>

        {/* Doctors Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map(doctor => (
            <Card key={doctor.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <img
                    src={doctor.profiles.profile_picture_url || "/placeholder.svg"}
                    alt={`${doctor.profiles.first_name} ${doctor.profiles.last_name}`}
                    className="w-16 h-16 rounded-full object-cover bg-gray-200"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900">
                      Dr. {doctor.profiles.first_name} {doctor.profiles.last_name}
                    </h3>
                    <p className="text-blue-600 font-medium">{doctor.specialization}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-600">4.8</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    {doctor.experience_years} years experience
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    Online Consultation
                  </div>
                </div>

                {doctor.qualifications && (
                <div className="flex flex-wrap gap-1 mb-4">
                    {doctor.qualifications.split(',').map(qual => (
                    <Badge key={qual} variant="secondary" className="text-xs">
                        {qual.trim()}
                    </Badge>
                  ))}
                </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-green-600">${doctor.consultation_fee}</span>
                  <Badge variant="default">Available Today</Badge>
                </div>

                <Link to={`/book-appointment/${doctor.id}`}>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    Book Appointment
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredDoctors.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No doctors found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or browse all doctors.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FindDoctors;
