import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, Heart } from "lucide-react";
import { Link } from "react-router-dom";

const EmailConfirmation = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirmEmail = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const token_hash = hashParams.get('token_hash');
      const type = hashParams.get('type');

      if (token_hash && type === 'email') {
        try {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: 'email'
          });

          if (error) {
            console.error('Email confirmation error:', error);
            setStatus('error');
            setMessage('Failed to confirm email. The link may have expired or is invalid.');
          } else {
            setStatus('success');
            setMessage('Your email has been confirmed successfully! You can now sign in to your account.');
          }
        } catch (error) {
          console.error('Unexpected error:', error);
          setStatus('error');
          setMessage('An unexpected error occurred. Please try again.');
        }
      } else {
        setStatus('error');
        setMessage('Invalid confirmation link.');
      }
    };

    confirmEmail();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center py-8">
      <div className="max-w-md w-full px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-6">
            <Heart className="h-6 w-6" />
            <span className="text-xl font-bold">HealthCare+</span>
          </Link>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              {status === 'loading' && <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
              {status === 'success' && <CheckCircle className="h-6 w-6 text-green-600" />}
              {status === 'error' && <XCircle className="h-6 w-6 text-red-600" />}
              
              {status === 'loading' && 'Confirming Email...'}
              {status === 'success' && 'Email Confirmed!'}
              {status === 'error' && 'Confirmation Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">{message}</p>
            
            {status === 'success' && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-medium">Welcome to HealthCare+!</p>
                  <p className="text-green-600 text-sm mt-1">
                    Your account is now active and ready to use.
                  </p>
                </div>
                <Link 
                  to="/login" 
                  className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign In Now
                </Link>
              </div>
            )}
            
            {status === 'error' && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-medium">Need Help?</p>
                  <p className="text-red-600 text-sm mt-1">
                    Try signing up again or contact support if the issue persists.
                  </p>
                </div>
                <Link 
                  to="/signup" 
                  className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Back to Sign Up
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailConfirmation;
