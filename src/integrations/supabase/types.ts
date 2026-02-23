export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          is_temporary: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_temporary?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_temporary?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          new_values: Json | null
          previous_values: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          new_values?: Json | null
          previous_values?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_values?: Json | null
          previous_values?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      cargos: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargos_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups_public"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          created_by: string
          group_id: string | null
          id: string
          kind: Database["public"]["Enums"]["chat_kind"]
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          group_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["chat_kind"]
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          group_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["chat_kind"]
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups_public"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          edited_at: string | null
          file_name: string | null
          id: string
          media_url: string | null
          message_type: string
          mime_type: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          edited_at?: string | null
          file_name?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          mime_type?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          edited_at?: string | null
          file_name?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          mime_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_poll_votes: {
        Row: {
          created_at: string
          id: string
          message_id: string
          option_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          option_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          option_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_poll_votes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reads: {
        Row: {
          conversation_id: string
          last_read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_users: {
        Row: {
          created_at: string
          dashboard_id: string
          id: string
          role: Database["public"]["Enums"]["dashboard_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          dashboard_id: string
          id?: string
          role: Database["public"]["Enums"]["dashboard_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          dashboard_id?: string
          id?: string
          role?: Database["public"]["Enums"]["dashboard_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_users_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          config: Json | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          created_at: string
          data_fim: string
          data_inicio: string
          descricao: string | null
          dia_inteiro: boolean
          group_id: string | null
          id: string
          lembretes: Json | null
          local: string | null
          membro_visitado_id: string | null
          participantes: string[] | null
          recorrencia: Json | null
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
          visita_id: string | null
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          descricao?: string | null
          dia_inteiro?: boolean
          group_id?: string | null
          id?: string
          lembretes?: Json | null
          local?: string | null
          membro_visitado_id?: string | null
          participantes?: string[] | null
          recorrencia?: Json | null
          tipo: string
          titulo: string
          updated_at?: string
          user_id: string
          visita_id?: string | null
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          dia_inteiro?: boolean
          group_id?: string | null
          id?: string
          lembretes?: Json | null
          local?: string | null
          membro_visitado_id?: string | null
          participantes?: string[] | null
          recorrencia?: Json | null
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups_public"
            referencedColumns: ["id"]
          },
        ]
      }
      group_join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          group_id: string
          id: string
          status: Database["public"]["Enums"]["join_request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          group_id: string
          id?: string
          status?: Database["public"]["Enums"]["join_request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          group_id?: string
          id?: string
          status?: Database["public"]["Enums"]["join_request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_join_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_join_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups_public"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups_public"
            referencedColumns: ["id"]
          },
        ]
      }
      group_user_presence: {
        Row: {
          group_id: string
          last_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          last_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          last_seen_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lembretes: {
        Row: {
          concluido: boolean
          created_at: string
          data_lembrete: string
          descricao: string | null
          id: string
          titulo: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          data_lembrete: string
          descricao?: string | null
          id?: string
          titulo: string
          user_id?: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          data_lembrete?: string
          descricao?: string | null
          id?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      management_groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          password_hash: string
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          password_hash: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          password_hash?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      membros: {
        Row: {
          cargos: string[] | null
          created_at: string
          data_aniversario: string | null
          data_nascimento: string | null
          faixa_etaria: string
          foto_url: string | null
          group_id: string | null
          id: string
          nome: string
          observacoes: string | null
          status_telefone: string | null
          telefone: string | null
        }
        Insert: {
          cargos?: string[] | null
          created_at?: string
          data_aniversario?: string | null
          data_nascimento?: string | null
          faixa_etaria: string
          foto_url?: string | null
          group_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status_telefone?: string | null
          telefone?: string | null
        }
        Update: {
          cargos?: string[] | null
          created_at?: string
          data_aniversario?: string | null
          data_nascimento?: string | null
          faixa_etaria?: string
          foto_url?: string | null
          group_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status_telefone?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membros_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notas: {
        Row: {
          conteudo: string
          created_at: string
          group_id: string | null
          id: string
          membro_id: string | null
          reuniao_id: string | null
          user_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          group_id?: string | null
          id?: string
          membro_id?: string | null
          reuniao_id?: string | null
          user_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          group_id?: string | null
          id?: string
          membro_id?: string | null
          reuniao_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          membro_id: string
          orou: boolean
          reuniao_id: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          membro_id: string
          orou?: boolean
          reuniao_id: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          membro_id?: string
          orou?: boolean
          reuniao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencas_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      reunioes: {
        Row: {
          created_at: string
          data: string
          group_id: string | null
          id: string
          numero_visitas: number | null
          observacoes: string | null
          oracoes: Json | null
          palavra_referencia: string | null
          quem_atendeu: string | null
          recitativos_individuais: number | null
          tema: string | null
        }
        Insert: {
          created_at?: string
          data: string
          group_id?: string | null
          id?: string
          numero_visitas?: number | null
          observacoes?: string | null
          oracoes?: Json | null
          palavra_referencia?: string | null
          quem_atendeu?: string | null
          recitativos_individuais?: number | null
          tema?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          group_id?: string | null
          id?: string
          numero_visitas?: number | null
          observacoes?: string | null
          oracoes?: Json | null
          palavra_referencia?: string | null
          quem_atendeu?: string | null
          recitativos_individuais?: number | null
          tema?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reunioes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_active_group: {
        Row: {
          group_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_active_group_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_active_group_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          custom_theme: Json | null
          dashboard_layout: Json | null
          id: string
          theme_preset: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_theme?: Json | null
          dashboard_layout?: Json | null
          id?: string
          theme_preset?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_theme?: Json | null
          dashboard_layout?: Json | null
          id?: string
          theme_preset?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_themes: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      visitas: {
        Row: {
          created_at: string
          data_visita: string | null
          group_id: string | null
          id: string
          is_past: boolean
          membro_visitado_id: string
          membros_presentes: string[]
          motivo: string
          observacoes: string | null
        }
        Insert: {
          created_at?: string
          data_visita?: string | null
          group_id?: string | null
          id?: string
          is_past?: boolean
          membro_visitado_id: string
          membros_presentes?: string[]
          motivo: string
          observacoes?: string | null
        }
        Update: {
          created_at?: string
          data_visita?: string | null
          group_id?: string | null
          id?: string
          is_past?: boolean
          membro_visitado_id?: string
          membros_presentes?: string[]
          motivo?: string
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitas_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "management_groups_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      management_groups_public: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_group_password: {
        Args: { _group_id: string; _password: string }
        Returns: boolean
      }
      create_management_group: {
        Args: { _description: string; _name: string; _password: string }
        Returns: string
      }
      current_group_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_group_password: { Args: { _password: string }; Returns: string }
      is_approved_user: { Args: { _user_id: string }; Returns: boolean }
      is_chat_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_dashboard_member: {
        Args: { _dashboard_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      transfer_group_ownership: {
        Args: { _group_id: string; _new_owner_id: string }
        Returns: undefined
      }
      unread_chat_count: {
        Args: { _group_id: string; _user_id: string }
        Returns: number
      }
      update_management_group_info: {
        Args: { _description: string; _group_id: string; _name: string }
        Returns: undefined
      }
      update_management_group_password: {
        Args: { _group_id: string; _new_password: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      chat_kind: "group" | "dm"
      dashboard_role: "owner" | "editor" | "viewer"
      group_role: "admin" | "member"
      join_request_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      chat_kind: ["group", "dm"],
      dashboard_role: ["owner", "editor", "viewer"],
      group_role: ["admin", "member"],
      join_request_status: ["pending", "approved", "rejected"],
    },
  },
} as const
