import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const InputHealthData = () => {
  const [heartRate, setHeartRate] = useState('');
  const [bodyTemperature, setBodyTemperature] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [activity, setActivity] = useState('');
  const [bmi, setBmi] = useState('');
  const [smokingHabit, setSmokingHabit] = useState('');
  const [drinkingHabit, setDrinkingHabit] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      toast({
        title: "Error",
        description: "You must be logged in to submit health data.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('patients')
        .update({
          bmi: bmi ? parseFloat(bmi) : null,
          smoking_status: smokingHabit !== 'Non-smoker',
          drinking_status: drinkingHabit === 'Daily',
          heart_rate: heartRate ? parseFloat(heartRate) : null,
          body_temperature: bodyTemperature ? parseFloat(bodyTemperature) : null,
          blood_pressure: bloodPressure || null,
          activity: activity || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Health data updated successfully!",
      });

      // Invalidate the profile query to force a refetch on the dashboard
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });

      // Clear form
      setHeartRate('');
      setBodyTemperature('');
      setBloodPressure('');
      setActivity('');
      setBmi('');
      setSmokingHabit('');
      setDrinkingHabit('');
    } catch (error: unknown) {
      console.error('Error submitting health data:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit health data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans antialiased">
      <div className="flex-1 flex flex-col">
        <header className="flex items-center h-16 bg-white border-b border-gray-200 px-6">
          <Link to="/" className="flex items-center text-gray-600 hover:text-gray-900">
            <ChevronLeft className="h-5 w-5 mr-2" />
            <span className="text-lg font-semibold">Back to Dashboard</span>
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <div className="max-w-4xl mx-auto">
            <Card className="p-6">
              <CardHeader>
                <CardTitle className="text-2xl font-bold mb-4">Input Your Health Data</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="heartRate">Heart Rate (bpm)</Label>
                      <Input
                        id="heartRate"
                        type="number"
                        value={heartRate}
                        onChange={(e) => setHeartRate(e.target.value)}
                        placeholder="e.g., 75"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bodyTemperature">Body Temperature (°C)</Label>
                      <Input
                        id="bodyTemperature"
                        type="number"
                        step="0.1"
                        value={bodyTemperature}
                        onChange={(e) => setBodyTemperature(e.target.value)}
                        placeholder="e.g., 36.5"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bloodPressure">Blood Pressure (e.g., 120/80)</Label>
                      <Input
                        id="bloodPressure"
                        type="text"
                        value={bloodPressure}
                        onChange={(e) => setBloodPressure(e.target.value)}
                        placeholder="e.g., 120/80"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="activity">Activity (hours/day)</Label>
                      <Input
                        id="activity"
                        type="text"
                        value={activity}
                        onChange={(e) => setActivity(e.target.value)}
                        placeholder="e.g., 2h 30m"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bmi">BMI</Label>
                      <Input
                        id="bmi"
                        type="number"
                        step="0.1"
                        value={bmi}
                        onChange={(e) => setBmi(e.target.value)}
                        placeholder="e.g., 22.5"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="smokingHabit">Smoking Habit</Label>
                      <Select
                        value={smokingHabit}
                        onValueChange={(value) => setSmokingHabit(value)}
                        disabled={loading}
                      >
                        <SelectTrigger id="smokingHabit">
                          <SelectValue placeholder="Select smoking habit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Non-smoker">Non-smoker</SelectItem>
                          <SelectItem value="1 pack/day">1 pack/day</SelectItem>
                          <SelectItem value="2 packs/day">2 packs/day</SelectItem>
                          <SelectItem value="3 packs/day">3 packs/day</SelectItem>
                          <SelectItem value="4 packs/day">4 packs/day</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="drinkingHabit">Drinking Habit</Label>
                      <Select
                        value={drinkingHabit}
                        onValueChange={(value) => setDrinkingHabit(value)}
                        disabled={loading}
                      >
                        <SelectTrigger id="drinkingHabit">
                          <SelectValue placeholder="Select drinking habit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Social drinker">Social drinker</SelectItem>
                          <SelectItem value="Daily">Daily</SelectItem>
                          <SelectItem value="Weekly">Weekly</SelectItem>
                          <SelectItem value="Monthly">Monthly</SelectItem>
                          <SelectItem value="Occasionally">Occasionally</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit Health Data'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default InputHealthData; 