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
      appointments: {
        Row: {
          id: string
          client_id: string
          barber_id: string
          service_id: string
          start_time: string
          end_time: string
          status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          barber_id: string
          service_id: string
          start_time: string
          end_time: string
          status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          barber_id?: string
          service_id?: string
          start_time?: string
          end_time?: string
          status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      loyalty_points: {
        Row: {
          id: string
          client_id: string
          transaction_id: string
          points_earned: number
          points_redeemed: number
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          transaction_id: string
          points_earned?: number
          points_redeemed?: number
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          transaction_id?: string
          points_earned?: number
          points_redeemed?: number
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          stock_quantity: number
          min_stock_alert: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price: number
          stock_quantity?: number
          min_stock_alert?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          stock_quantity?: number
          min_stock_alert?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          role: 'client' | 'barber' | 'admin'
          full_name: string
          phone: string | null
          birth_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: 'client' | 'barber' | 'admin'
          full_name: string
          phone?: string | null
          birth_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'client' | 'barber' | 'admin'
          full_name?: string
          phone?: string | null
          birth_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      services: {
        Row: {
          id: string
          name: string
          description: string | null
          duration: string
          price: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          duration: string
          price: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          duration?: string
          price?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      transaction_items: {
        Row: {
          id: string
          transaction_id: string
          service_id: string | null
          product_id: string | null
          quantity: number
          unit_price: number
          total_price: number
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          service_id?: string | null
          product_id?: string | null
          quantity?: number
          unit_price: number
          total_price: number
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          service_id?: string | null
          product_id?: string | null
          quantity?: number
          unit_price?: number
          total_price?: number
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          client_id: string
          barber_id: string | null
          appointment_id: string | null
          payment_method: 'cash' | 'credit_card' | 'debit_card' | 'pix'
          payment_status: 'pending' | 'completed' | 'refunded'
          total_amount: number
          commission_amount: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          barber_id?: string | null
          appointment_id?: string | null
          payment_method: 'cash' | 'credit_card' | 'debit_card' | 'pix'
          payment_status?: 'pending' | 'completed' | 'refunded'
          total_amount: number
          commission_amount?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          barber_id?: string | null
          appointment_id?: string | null
          payment_method?: 'cash' | 'credit_card' | 'debit_card' | 'pix'
          payment_status?: 'pending' | 'completed' | 'refunded'
          total_amount?: number
          commission_amount?: number | null
          created_at?: string
          updated_at?: string
        }
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
  }
}