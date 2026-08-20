
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'guest');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Sanctuaries
CREATE TABLE public.sanctuaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  price_per_night INTEGER NOT NULL,
  size_sqm INTEGER NOT NULL,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  hero_image TEXT NOT NULL,
  gallery TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sanctuaries TO anon, authenticated;
GRANT ALL ON public.sanctuaries TO service_role;
ALTER TABLE public.sanctuaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active sanctuaries" ON public.sanctuaries FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "Admins manage sanctuaries" ON public.sanctuaries FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bookings
CREATE TYPE public.booking_status AS ENUM ('pending_payment','payment_submitted','confirmed','cancelled');

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL DEFAULT 'LMN-' || upper(substring(md5(random()::text), 1, 8)),
  guest_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  sanctuary_slug TEXT NOT NULL,
  sanctuary_name TEXT NOT NULL,
  location TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INTEGER NOT NULL DEFAULT 2,
  special_requests TEXT,
  total_amount INTEGER NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending_payment',
  payment_reference TEXT,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read all bookings" ON public.bookings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update bookings" ON public.bookings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'guest');
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed sanctuaries
INSERT INTO public.sanctuaries (slug, name, tagline, location, description, price_per_night, size_sqm, amenities, hero_image, gallery, sort_order, active) VALUES
('king-suite', 'Self-Contained King Room', 'Our signature suite', 'Rugems Executive Lodge',
 'Experience the highest level of comfort with our spacious King Room, designed for guests seeking a premium stay.',
 900, 2,
 ARRAY['King Bed','Private Bathroom','Air Conditioning','Cable TV','Hot & Cold Water','Room Intercom'],
 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1600&q=80',
 ARRAY['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1600&q=80'],
 10, true),
('queen-suite', 'Self-Contained Queen Room', 'Elegant & private', 'Rugems Executive Lodge',
 'A comfortable and elegant Queen Room offering privacy and modern convenience.',
 720, 2,
 ARRAY['Queen Bed','Private Bathroom','Air Conditioning','Cable TV','Hot & Cold Water','Room Intercom'],
 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1600&q=80',
 ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1600&q=80'],
 20, true),
('double-ensuite', 'Self-Contained Double Room', 'Refined comfort', 'Rugems Executive Lodge',
 'An affordable self-contained room offering everything needed for a comfortable stay.',
 500, 2,
 ARRAY['Double Bed','Private Bathroom','Air Conditioning','Cable TV','Hot & Cold Water','Room Intercom'],
 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1600&q=80',
 ARRAY['https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1600&q=80'],
 30, true);
