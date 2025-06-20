CREATE TABLE public.appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    appointment_date date NOT NULL,
    appointment_time text NOT NULL,
    reason text,
    status text DEFAULT 'pending' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    otp_code text,
    otp_verified boolean DEFAULT false
); 