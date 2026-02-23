CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: dashboard_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dashboard_role AS ENUM (
    'owner',
    'editor',
    'viewer'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Upsert into profiles with username, avatar and email from auth metadata
  INSERT INTO public.profiles (id, username, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    email = EXCLUDED.email,
    updated_at = now();

  -- Ensure role in user_roles: admin for Igor, user for everyone else
  IF NEW.email = 'igor.ccb.mts@gmail.com' THEN
    -- Give admin role if not already present
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- Default role: user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: is_approved_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_approved_user(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;


--
-- Name: is_dashboard_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_dashboard_member(_user_id uuid, _dashboard_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dashboard_users
    WHERE user_id = _user_id
      AND dashboard_id = _dashboard_id
  );
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    is_temporary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    description text,
    previous_values jsonb,
    new_values jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cargos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cargos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dashboard_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dashboard_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.dashboard_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dashboards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lembretes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lembretes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text,
    data_lembrete date NOT NULL,
    concluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: membros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    data_nascimento date,
    faixa_etaria text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cargos text[] DEFAULT '{}'::text[],
    data_aniversario text,
    foto_url text,
    observacoes text,
    telefone text,
    status_telefone text,
    CONSTRAINT membros_status_telefone_check CHECK ((status_telefone = ANY (ARRAY['próprio'::text, 'mãe'::text, 'pai'::text])))
);


--
-- Name: notas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conteudo text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    membro_id uuid,
    reuniao_id uuid
);


--
-- Name: presencas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presencas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reuniao_id uuid NOT NULL,
    membro_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email text
);


--
-- Name: reunioes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reunioes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    data date NOT NULL,
    tema text,
    observacoes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    numero_visitas integer DEFAULT 0,
    recitativos_individuais integer DEFAULT 0,
    quem_atendeu text,
    palavra_referencia text,
    oracoes jsonb
);


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    theme_preset text DEFAULT 'padrao'::text NOT NULL,
    custom_theme jsonb,
    dashboard_layout jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_themes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    config jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cargos cargos_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cargos
    ADD CONSTRAINT cargos_nome_key UNIQUE (nome);


--
-- Name: cargos cargos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cargos
    ADD CONSTRAINT cargos_pkey PRIMARY KEY (id);


--
-- Name: dashboard_users dashboard_users_dashboard_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_users
    ADD CONSTRAINT dashboard_users_dashboard_id_user_id_key UNIQUE (dashboard_id, user_id);


--
-- Name: dashboard_users dashboard_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_users
    ADD CONSTRAINT dashboard_users_pkey PRIMARY KEY (id);


--
-- Name: dashboards dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_pkey PRIMARY KEY (id);


--
-- Name: lembretes lembretes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lembretes
    ADD CONSTRAINT lembretes_pkey PRIMARY KEY (id);


--
-- Name: membros membros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membros
    ADD CONSTRAINT membros_pkey PRIMARY KEY (id);


--
-- Name: notas notas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_pkey PRIMARY KEY (id);


--
-- Name: presencas presencas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presencas
    ADD CONSTRAINT presencas_pkey PRIMARY KEY (id);


--
-- Name: presencas presencas_reuniao_id_membro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presencas
    ADD CONSTRAINT presencas_reuniao_id_membro_id_key UNIQUE (reuniao_id, membro_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: reunioes reunioes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reunioes
    ADD CONSTRAINT reunioes_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_unique UNIQUE (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_themes user_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_themes
    ADD CONSTRAINT user_themes_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_presencas_membro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presencas_membro ON public.presencas USING btree (membro_id);


--
-- Name: idx_presencas_reuniao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presencas_reuniao ON public.presencas USING btree (reuniao_id);


--
-- Name: idx_reunioes_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reunioes_data ON public.reunioes USING btree (data DESC);


--
-- Name: ai_conversations update_ai_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_preferences update_user_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_messages ai_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;


--
-- Name: dashboard_users dashboard_users_dashboard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_users
    ADD CONSTRAINT dashboard_users_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES public.dashboards(id) ON DELETE CASCADE;


--
-- Name: dashboard_users dashboard_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_users
    ADD CONSTRAINT dashboard_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: dashboards dashboards_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notas notas_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.membros(id) ON DELETE SET NULL;


--
-- Name: notas notas_reuniao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_reuniao_id_fkey FOREIGN KEY (reuniao_id) REFERENCES public.reunioes(id) ON DELETE SET NULL;


--
-- Name: presencas presencas_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presencas
    ADD CONSTRAINT presencas_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.membros(id) ON DELETE CASCADE;


--
-- Name: presencas presencas_reuniao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presencas
    ADD CONSTRAINT presencas_reuniao_id_fkey FOREIGN KEY (reuniao_id) REFERENCES public.reunioes(id) ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can delete user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: audit_logs Admins can view all audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all user roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cargos Admins podem atualizar cargos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins podem atualizar cargos" ON public.cargos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cargos Admins podem deletar cargos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins podem deletar cargos" ON public.cargos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cargos Admins podem inserir cargos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins podem inserir cargos" ON public.cargos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: membros Apenas admins podem visualizar membros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Apenas admins podem visualizar membros" ON public.membros FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: audit_logs Approved users can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK ((public.is_approved_user(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: dashboards Members can view shared dashboards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view shared dashboards" ON public.dashboards FOR SELECT USING (((auth.uid() = owner_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_dashboard_member(auth.uid(), id)));


--
-- Name: dashboard_users Owners can manage dashboard users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage dashboard users" ON public.dashboard_users USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.dashboards d
  WHERE ((d.id = dashboard_users.dashboard_id) AND (d.owner_id = auth.uid())))))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.dashboards d
  WHERE ((d.id = dashboard_users.dashboard_id) AND (d.owner_id = auth.uid()))))));


--
-- Name: dashboards Owners can manage their dashboards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage their dashboards" ON public.dashboards USING (((auth.uid() = owner_id) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK (((auth.uid() = owner_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: ai_messages Users can delete messages in their AI conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete messages in their AI conversations" ON public.ai_messages FOR DELETE USING (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND (c.user_id = auth.uid()))))));


--
-- Name: ai_conversations Users can delete their own AI conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own AI conversations" ON public.ai_conversations FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notas Users can delete their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own notes" ON public.notas FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_preferences Users can delete their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own preferences" ON public.user_preferences FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: lembretes Users can delete their own reminders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own reminders" ON public.lembretes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_themes Users can delete their own themes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own themes" ON public.user_themes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: ai_messages Users can insert messages in their AI conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert messages in their AI conversations" ON public.ai_messages FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND (c.user_id = auth.uid()))))));


--
-- Name: ai_conversations Users can insert their own AI conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own AI conversations" ON public.ai_conversations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: notas Users can insert their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own notes" ON public.notas FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_preferences Users can insert their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own preferences" ON public.user_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: lembretes Users can insert their own reminders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own reminders" ON public.lembretes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_themes Users can insert their own themes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own themes" ON public.user_themes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_conversations Users can update their own AI conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own AI conversations" ON public.ai_conversations FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: notas Users can update their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notes" ON public.notas FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_preferences Users can update their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own preferences" ON public.user_preferences FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: lembretes Users can update their own reminders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own reminders" ON public.lembretes FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_themes Users can update their own themes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own themes" ON public.user_themes FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: ai_messages Users can view messages in their AI conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages in their AI conversations" ON public.ai_messages FOR SELECT USING (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND (c.user_id = auth.uid()))))));


--
-- Name: dashboard_users Users can view their dashboard memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their dashboard memberships" ON public.dashboard_users FOR SELECT USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: ai_conversations Users can view their own AI conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own AI conversations" ON public.ai_conversations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notas Users can view their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notes" ON public.notas FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_preferences Users can view their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own preferences" ON public.user_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: lembretes Users can view their own reminders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own reminders" ON public.lembretes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_themes Users can view their own themes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own themes" ON public.user_themes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: membros Usuários aprovados podem atualizar membros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários aprovados podem atualizar membros" ON public.membros FOR UPDATE TO authenticated USING (public.is_approved_user(auth.uid())) WITH CHECK (public.is_approved_user(auth.uid()));


--
-- Name: presencas Usuários aprovados podem atualizar presenças; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários aprovados podem atualizar presenças" ON public.presencas FOR UPDATE TO authenticated USING (public.is_approved_user(auth.uid())) WITH CHECK (public.is_approved_user(auth.uid()));


--
-- Name: reunioes Usuários aprovados podem atualizar reuniões; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários aprovados podem atualizar reuniões" ON public.reunioes FOR UPDATE TO authenticated USING (public.is_approved_user(auth.uid())) WITH CHECK (public.is_approved_user(auth.uid()));


--
-- Name: membros Usuários aprovados podem deletar membros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários aprovados podem deletar membros" ON public.membros FOR DELETE TO authenticated USING (public.is_approved_user(auth.uid()));


--
-- Name: presencas Usuários aprovados podem deletar presenças; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários aprovados podem deletar presenças" ON public.presencas FOR DELETE TO authenticated USING (public.is_approved_user(auth.uid()));


--
-- Name: reunioes Usuários aprovados podem deletar reuniões; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários aprovados podem deletar reuniões" ON public.reunioes FOR DELETE TO authenticated USING (public.is_approved_user(auth.uid()));


--
-- Name: membros Usuários aprovados podem inserir membros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários aprovados podem inserir membros" ON public.membros FOR INSERT TO authenticated WITH CHECK (public.is_approved_user(auth.uid()));


--
-- Name: presencas Usuários aprovados podem inserir presenças; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários aprovados podem inserir presenças" ON public.presencas FOR INSERT TO authenticated WITH CHECK (public.is_approved_user(auth.uid()));


--
-- Name: reunioes Usuários aprovados podem inserir reuniões; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários aprovados podem inserir reuniões" ON public.reunioes FOR INSERT TO authenticated WITH CHECK (public.is_approved_user(auth.uid()));


--
-- Name: cargos Usuários aprovados podem visualizar cargos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários aprovados podem visualizar cargos" ON public.cargos FOR SELECT TO authenticated USING (public.is_approved_user(auth.uid()));


--
-- Name: presencas Usuários aprovados podem visualizar presenças; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários aprovados podem visualizar presenças" ON public.presencas FOR SELECT TO authenticated USING (public.is_approved_user(auth.uid()));


--
-- Name: reunioes Usuários aprovados podem visualizar reuniões; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários aprovados podem visualizar reuniões" ON public.reunioes FOR SELECT TO authenticated USING (public.is_approved_user(auth.uid()));


--
-- Name: ai_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: cargos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;

--
-- Name: dashboard_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dashboard_users ENABLE ROW LEVEL SECURITY;

--
-- Name: dashboards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

--
-- Name: lembretes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;

--
-- Name: membros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;

--
-- Name: notas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;

--
-- Name: presencas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: reunioes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reunioes ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_themes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_themes ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;