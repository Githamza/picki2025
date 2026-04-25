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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      banners: {
        Row: {
          created_at: string | null
          display_order: number | null
          ends_at: string | null
          id: number
          image_url: string
          is_active: boolean | null
          link_url: string | null
          starts_at: string | null
          title: string | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          ends_at?: string | null
          id?: number
          image_url: string
          is_active?: boolean | null
          link_url?: string | null
          starts_at?: string | null
          title?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          ends_at?: string | null
          id?: number
          image_url?: string
          is_active?: boolean | null
          link_url?: string | null
          starts_at?: string | null
          title?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_banners_vendor_id"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          close_time: string | null
          created_at: string | null
          day_of_week: number
          id: string
          is_closed: boolean
          open_time: string | null
          pickup_enabled: boolean
          pickup_open_time: string | null
          pickup_close_time: string | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean
          open_time?: string | null
          pickup_enabled?: boolean
          pickup_open_time?: string | null
          pickup_close_time?: string | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          close_time?: string | null
          created_at?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean
          open_time?: string | null
          pickup_enabled?: boolean
          pickup_open_time?: string | null
          pickup_close_time?: string | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: number
          image_url: string | null
          is_active: boolean | null
          name: string
          updated_at: string | null
          vendorId: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          vendorId?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          vendorId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_vendorId_fkey"
            columns: ["vendorId"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          discount_percent: number | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_subtotal: number | null
          updated_at: string
          valid_from: string
          valid_until: string
          vendor_id: string
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          discount_percent?: number | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_subtotal?: number | null
          updated_at?: string
          valid_from?: string
          valid_until: string
          vendor_id: string
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          discount_percent?: number | null
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_subtotal?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      customisation_options: {
        Row: {
          created_at: string | null
          customisation_id: number
          description: string | null
          display_order: number | null
          id: number
          image_url: string | null
          is_available: boolean | null
          name: string
          option_type: string | null
          price_adjustment: number | null
          product_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customisation_id: number
          description?: string | null
          display_order?: number | null
          id?: number
          image_url?: string | null
          is_available?: boolean | null
          name: string
          option_type?: string | null
          price_adjustment?: number | null
          product_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customisation_id?: number
          description?: string | null
          display_order?: number | null
          id?: number
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          option_type?: string | null
          price_adjustment?: number | null
          product_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customisation_options_customisation_id_fkey"
            columns: ["customisation_id"]
            isOneToOne: false
            referencedRelation: "customisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customisation_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customisations: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: number
          is_available: boolean | null
          is_required: boolean | null
          max_selections: number | null
          min_selections: number | null
          name: string
          selection_type: string
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: number
          is_available?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name: string
          selection_type: string
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: number
          is_available?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name?: string
          selection_type?: string
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customisations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address: string | null
          category: string
          created_at: string | null
          description: string | null
          eau: boolean | null
          electricite: boolean | null
          id: string
          images: string[] | null
          marker: Json | null
          owner: string
          permis_construire: boolean | null
          polygon: Json | null
          price: number
          price_per_m2: number | null
          published: boolean | null
          road: string
          superficie: number | null
          title: string
          titre_bleu: boolean | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          eau?: boolean | null
          electricite?: boolean | null
          id?: string
          images?: string[] | null
          marker?: Json | null
          owner: string
          permis_construire?: boolean | null
          polygon?: Json | null
          price: number
          price_per_m2?: number | null
          published?: boolean | null
          road?: string
          superficie?: number | null
          title: string
          titre_bleu?: boolean | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          eau?: boolean | null
          electricite?: boolean | null
          id?: string
          images?: string[] | null
          marker?: Json | null
          owner?: string
          permis_construire?: boolean | null
          polygon?: Json | null
          price?: number
          price_per_m2?: number | null
          published?: boolean | null
          road?: string
          superficie?: number | null
          title?: string
          titre_bleu?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      order_deliveries: {
        Row: {
          created_at: string
          currency: string
          current_task: string | null
          delivery_id: string | null
          dropoff_city: string
          dropoff_country_code: string
          dropoff_lat: number | null
          dropoff_line1: string
          dropoff_lng: number | null
          dropoff_postal_code: string
          eta_minutes: number | null
          event_id: string | null
          id: string
          job_id: string | null
          last_known_location: Json | null
          occurred_at: string | null
          order_id: string
          pickup_city: string
          pickup_country_code: string
          pickup_lat: number | null
          pickup_line1: string
          pickup_lng: number | null
          pickup_postal_code: string
          provider: string
          quote_amount_minor: number
          raw: Json | null
          status: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          current_task?: string | null
          delivery_id?: string | null
          dropoff_city: string
          dropoff_country_code: string
          dropoff_lat?: number | null
          dropoff_line1: string
          dropoff_lng?: number | null
          dropoff_postal_code: string
          eta_minutes?: number | null
          event_id?: string | null
          id?: string
          job_id?: string | null
          last_known_location?: Json | null
          occurred_at?: string | null
          order_id: string
          pickup_city: string
          pickup_country_code: string
          pickup_lat?: number | null
          pickup_line1: string
          pickup_lng?: number | null
          pickup_postal_code: string
          provider: string
          quote_amount_minor: number
          raw?: Json | null
          status?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_task?: string | null
          delivery_id?: string | null
          dropoff_city?: string
          dropoff_country_code?: string
          dropoff_lat?: number | null
          dropoff_line1?: string
          dropoff_lng?: number | null
          dropoff_postal_code?: string
          eta_minutes?: number | null
          event_id?: string | null
          id?: string
          job_id?: string | null
          last_known_location?: Json | null
          occurred_at?: string | null
          order_id?: string
          pickup_city?: string
          pickup_country_code?: string
          pickup_lat?: number | null
          pickup_line1?: string
          pickup_lng?: number | null
          pickup_postal_code?: string
          provider?: string
          quote_amount_minor?: number
          raw?: Json | null
          status?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_complements: {
        Row: {
          complement_name: string
          complement_product_id: number
          created_at: string | null
          id: string
          order_item_id: number
          quantity: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          complement_name: string
          complement_product_id: number
          created_at?: string | null
          id?: string
          order_item_id: number
          quantity?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          complement_name?: string
          complement_product_id?: number
          created_at?: string | null
          id?: string
          order_item_id?: number
          quantity?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_complements_complement_product_id_fkey"
            columns: ["complement_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_complements_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          comment: string | null
          created_at: string | null
          id: number
          options: Json | null
          order_id: string | null
          product_id: number | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
          vendor_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: number
          options?: Json | null
          order_id?: string | null
          product_id?: number | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
          vendor_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: number
          options?: Json | null
          order_id?: string | null
          product_id?: number | null
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          confirmation_email_sent: boolean | null
          coupon_code: string | null
          coupon_id: string | null
          coupon_redeemed: boolean
          created_at: string | null
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string | null
          discount_amount: number
          id: string
          notes: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          pay_at_checkout: boolean
          ready_email_sent: boolean | null
          refuse_reason: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          table_number: string | null
          timing: Database["public"]["Enums"]["order_timing"] | null
          total_amount: number
          updated_at: string | null
          user_id: string | null
          vendor_id: string | null
        }
        Insert: {
          confirmation_email_sent?: boolean | null
          coupon_code?: string | null
          coupon_id?: string | null
          coupon_redeemed?: boolean
          created_at?: string | null
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          pay_at_checkout?: boolean
          ready_email_sent?: boolean | null
          refuse_reason?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          table_number?: string | null
          timing?: Database["public"]["Enums"]["order_timing"] | null
          total_amount: number
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          confirmation_email_sent?: boolean | null
          coupon_code?: string | null
          coupon_id?: string | null
          coupon_redeemed?: boolean
          created_at?: string | null
          customer_email?: string
          customer_first_name?: string
          customer_last_name?: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          pay_at_checkout?: boolean
          ready_email_sent?: boolean | null
          refuse_reason?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          table_number?: string | null
          timing?: Database["public"]["Enums"]["order_timing"] | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_splits: {
        Row: {
          amount: number
          created_at: string | null
          id: number
          payment_id: string | null
          transfer_id: string | null
          transfer_status: string | null
          vendor_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: number
          payment_id?: string | null
          transfer_id?: string | null
          transfer_status?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: number
          payment_id?: string | null
          transfer_id?: string | null
          transfer_status?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_splits_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_splits_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          payment_url: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_payment_id: string
          status: Database["public"]["Enums"]["payment_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_url?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_payment_id: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_url?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_payment_id?: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_complements: {
        Row: {
          complement_product_id: number
          created_at: string | null
          custom_price: number | null
          display_order: number | null
          id: string
          is_free: boolean | null
          is_required: boolean | null
          max_selections: number | null
          product_id: number
          selection_type: string | null
          updated_at: string | null
        }
        Insert: {
          complement_product_id: number
          created_at?: string | null
          custom_price?: number | null
          display_order?: number | null
          id?: string
          is_free?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          product_id: number
          selection_type?: string | null
          updated_at?: string | null
        }
        Update: {
          complement_product_id?: number
          created_at?: string | null
          custom_price?: number | null
          display_order?: number | null
          id?: string
          is_free?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          product_id?: number
          selection_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_complements_complement_product_id_fkey"
            columns: ["complement_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_complements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_customisations: {
        Row: {
          created_at: string | null
          customisation_id: number
          display_order: number | null
          id: number
          product_id: number
        }
        Insert: {
          created_at?: string | null
          customisation_id: number
          display_order?: number | null
          id?: number
          product_id: number
        }
        Update: {
          created_at?: string | null
          customisation_id?: number
          display_order?: number | null
          id?: number
          product_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_customisations_customisation_id_fkey"
            columns: ["customisation_id"]
            isOneToOne: false
            referencedRelation: "customisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_customisations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string | null
          id: number
          is_available: boolean | null
          name: string
          price_adjustment: number | null
          product_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_available?: boolean | null
          name: string
          price_adjustment?: number | null
          product_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          is_available?: boolean | null
          name?: string
          price_adjustment?: number | null
          product_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_step_options: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: number
          image_url: string | null
          name: string
          option_type: string | null
          price_adjustment: number | null
          product_id: number | null
          step_ids: number[]
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: number
          image_url?: string | null
          name?: string
          option_type?: string | null
          price_adjustment?: number | null
          product_id?: number | null
          step_ids: number[]
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: number
          image_url?: string | null
          name?: string
          option_type?: string | null
          price_adjustment?: number | null
          product_id?: number | null
          step_ids?: number[]
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_product_step_options_vendor"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_step_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_steps: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number
          id: number
          is_required: boolean | null
          max_selections: number | null
          min_selections: number | null
          name: string
          product_id: number
          step_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: number
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name: string
          product_id: number
          step_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: number
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name?: string
          product_id?: number
          step_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_steps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: number | null
          created_at: string | null
          display_order: number
          has_customisations: boolean | null
          id: number
          image_url: string | null
          is_available: boolean | null
          is_multi_step: boolean | null
          long_description: string | null
          name: string
          no_catalogable: boolean | null
          price: number
          short_description: string | null
          stock_quantity: number | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          category_id?: number | null
          created_at?: string | null
          display_order?: number
          has_customisations?: boolean | null
          id?: number
          image_url?: string | null
          is_available?: boolean | null
          is_multi_step?: boolean | null
          long_description?: string | null
          name: string
          no_catalogable?: boolean | null
          price: number
          short_description?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          category_id?: number | null
          created_at?: string | null
          display_order?: number
          has_customisations?: boolean | null
          id?: number
          image_url?: string | null
          is_available?: boolean | null
          is_multi_step?: boolean | null
          long_description?: string | null
          name?: string
          no_catalogable?: boolean | null
          price?: number
          short_description?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          bio: string | null
          city: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          profile_photo_url: string | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          first_name: string
          id: string
          last_name: string
          phone?: string | null
          profile_photo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          profile_photo_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vendor_admin_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          last_name: string
          role: string
          updated_at: string | null
          user_id: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          first_name: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_name: string
          role?: string
          updated_at?: string | null
          user_id?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_name?: string
          role?: string
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_admin_users_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_metadata: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          phone: string | null
          postal_code: string | null
          street: string | null
          updated_at: string | null
          vendor_id: string
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string | null
          vendor_id: string
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string | null
          vendor_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_metadata_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_paygreen_credentials: {
        Row: {
          active: boolean
          created_at: string
          public_key: string
          sandbox_public_key: string | null
          sandbox_secret_key: string | null
          sandbox_shop_id: string | null
          secret_key: string | null
          shop_id: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          public_key: string
          sandbox_public_key?: string | null
          sandbox_secret_key?: string | null
          sandbox_shop_id?: string | null
          secret_key?: string | null
          shop_id: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          public_key?: string
          sandbox_public_key?: string | null
          sandbox_secret_key?: string | null
          sandbox_shop_id?: string | null
          secret_key?: string | null
          shop_id?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_paygreen_credentials_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_stuart_settings: {
        Row: {
          created_at: string
          enabled: boolean | null
          topics: string[] | null
          updated_at: string
          vendor_id: string
          webhook_id: string | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean | null
          topics?: string[] | null
          updated_at?: string
          vendor_id: string
          webhook_id?: string | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean | null
          topics?: string[] | null
          updated_at?: string
          vendor_id?: string
          webhook_id?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_stuart_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          auth_user_id: string | null
          banner_url: string | null
          business_name: string
          business_type: string | null
          closed_description: string | null
          closed_message: string | null
          country: string | null
          created_at: string | null
          currency: string
          customDomain: string | null
          daily_stock_reset_enabled: boolean | null
          delivery_dropoff_input_mode: string
          delivery_system: string
          enabled_order_types: Database["public"]["Enums"]["order_type"][]
          id: string
          info_message: string | null
          info_message_enabled: boolean
          is_active: boolean | null
          logo_url: string | null
          online_payments_enabled: boolean
          orders_suspended_at: string | null
          orders_suspended_message: string | null
          own_delivery_price: number
          paygreen_merchant_id: string | null
          paygreen_mode: string
          paygreen_onboarding_completed: boolean | null
          paymentprovider: Database["public"]["Enums"]["payment_provider_choice"]
          service_fee_fixed: number
          service_fee_rate_percent: number
          stripe_account_id: string | null
          stripe_onboarding_completed: boolean | null
          updated_at: string | null
          national_id: string | null
          user_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          banner_url?: string | null
          business_name: string
          business_type?: string | null
          closed_description?: string | null
          closed_message?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string
          customDomain?: string | null
          daily_stock_reset_enabled?: boolean | null
          delivery_dropoff_input_mode?: string
          delivery_system?: string
          enabled_order_types?: Database["public"]["Enums"]["order_type"][]
          id?: string
          info_message?: string | null
          info_message_enabled?: boolean
          is_active?: boolean | null
          logo_url?: string | null
          online_payments_enabled?: boolean
          orders_suspended_at?: string | null
          orders_suspended_message?: string | null
          own_delivery_price?: number
          paygreen_merchant_id?: string | null
          paygreen_mode?: string
          paygreen_onboarding_completed?: boolean | null
          paymentprovider?: Database["public"]["Enums"]["payment_provider_choice"]
          service_fee_fixed?: number
          service_fee_rate_percent?: number
          stripe_account_id?: string | null
          stripe_onboarding_completed?: boolean | null
          national_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          banner_url?: string | null
          business_name?: string
          business_type?: string | null
          closed_description?: string | null
          closed_message?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string
          customDomain?: string | null
          daily_stock_reset_enabled?: boolean | null
          delivery_dropoff_input_mode?: string
          delivery_system?: string
          enabled_order_types?: Database["public"]["Enums"]["order_type"][]
          id?: string
          info_message?: string | null
          info_message_enabled?: boolean
          is_active?: boolean | null
          logo_url?: string | null
          online_payments_enabled?: boolean
          orders_suspended_at?: string | null
          orders_suspended_message?: string | null
          own_delivery_price?: number
          paygreen_merchant_id?: string | null
          paygreen_mode?: string
          paygreen_onboarding_completed?: boolean | null
          paymentprovider?: Database["public"]["Enums"]["payment_provider_choice"]
          service_fee_fixed?: number
          service_fee_rate_percent?: number
          stripe_account_id?: string | null
          stripe_onboarding_completed?: boolean | null
          national_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_stock_for_order: { Args: { p_order_id: string }; Returns: Json }
      is_vendor_order: { Args: { order_id: string }; Returns: boolean }
      order_item_belongs_to_user: {
        Args: { item_order_id: string }
        Returns: boolean
      }
      reserve_stock_for_order: { Args: { p_order_id: string }; Returns: Json }
      reset_daily_product_stock: { Args: never; Returns: undefined }
      restore_stock_for_order: { Args: { p_order_id: string }; Returns: Json }
      user_is_vendor_for_order_item: {
        Args: { item_vendor_id: string }
        Returns: boolean
      }
      user_owns_order: { Args: { order_id: string }; Returns: boolean }
      validate_stock_for_cart: { Args: { p_items: Json }; Returns: Json }
      vendor_has_items_in_order: {
        Args: { order_id: string }
        Returns: boolean
      }
    }
    Enums: {
      coupon_discount_type: "percentage" | "fixed"
      order_status:
        | "todo"
        | "ongoing"
        | "done"
        | "picked"
        | "cancelled"
        | "initiated"
        | "paid"
        | "refused"
      order_timing: "asap" | "later"
      order_type: "eat-in" | "take-away" | "delivery"
      payment_provider: "paygreen" | "stripe"
      payment_provider_choice: "PAYGREEN" | "STRIPE"
      payment_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "refunded"
        | "paid"
      user_role: "customer" | "vendor" | "admin"
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
      coupon_discount_type: ["percentage", "fixed"],
      order_status: [
        "todo",
        "ongoing",
        "done",
        "picked",
        "cancelled",
        "initiated",
        "paid",
        "refused",
      ],
      order_timing: ["asap", "later"],
      order_type: ["eat-in", "take-away", "delivery"],
      payment_provider: ["paygreen", "stripe"],
      payment_provider_choice: ["PAYGREEN", "STRIPE"],
      payment_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
        "paid",
      ],
      user_role: ["customer", "vendor", "admin"],
    },
  },
} as const
