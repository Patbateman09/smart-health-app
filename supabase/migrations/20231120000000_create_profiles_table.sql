CREATE TABLE public.profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name text,
    last_name text,
    profile_picture_url text,
    date_of_birth date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_type text
); 