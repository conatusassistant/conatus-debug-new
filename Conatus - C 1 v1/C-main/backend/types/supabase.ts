export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      automations: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          trigger: Json
          actions: Json[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          trigger: Json
          actions: Json[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          trigger?: Json
          actions?: Json[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          content: string
          role: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          content: string
          role: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          content?: string
          role?: string
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          }
        ]
      }
      service_connections: {
        Row: {
          id: string
          user_id: string
          service_name: string
          credentials: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          service_name: string
          credentials: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          service_name?: string
          credentials?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_connections_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      shared_templates: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          configuration: Json
          is_public: boolean
          upvotes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          configuration: Json
          is_public?: boolean
          upvotes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          configuration?: Json
          is_public?: boolean
          upvotes?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_templates_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_profiles: {
        Row: {
          id: string
          display_name: string | null
          preferences: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_template_interactions: {
        Row: {
          id: string
          user_id: string
          template_id: string
          interaction_type: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template_id: string
          interaction_type: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          template_id?: string
          interaction_type?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_template_interactions_template_id_fkey"
            columns: ["template_id"]
            referencedRelation: "shared_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_template_interactions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      template_comments: {
        Row: {
          id: string
          user_id: string
          template_id: string
          content: string
          upvotes: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template_id: string
          content: string
          upvotes?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          template_id?: string
          content?: string
          upvotes?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_comments_template_id_fkey"
            columns: ["template_id"]
            referencedRelation: "shared_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_comments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      automation_executions: {
        Row: {
          id: string
          automation_id: string
          status: string
          result: Json | null
          error: string | null
          started_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          automation_id: string
          status: string
          result?: Json | null
          error?: string | null
          started_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          automation_id?: string
          status?: string
          result?: Json | null
          error?: string | null
          started_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_automation_id_fkey"
            columns: ["automation_id"]
            referencedRelation: "automations"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
