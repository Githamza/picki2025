export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      banners: {
        Row: {
          created_at: string | null;
          display_order: number | null;
          ends_at: string | null;
          id: number;
          image_url: string;
          is_active: boolean | null;
          link_url: string | null;
          starts_at: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          display_order?: number | null;
          ends_at?: string | null;
          id?: number;
          image_url: string;
          is_active?: boolean | null;
          link_url?: string | null;
          starts_at?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          display_order?: number | null;
          ends_at?: string | null;
          id?: number;
          image_url?: string;
          is_active?: boolean | null;
          link_url?: string | null;
          starts_at?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string | null;
          description: string | null;
          display_order: number | null;
          icon: string | null;
          id: number;
          image_url: string | null;
          is_active: boolean | null;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          icon?: string | null;
          id?: number;
          image_url?: string | null;
          is_active?: boolean | null;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          icon?: string | null;
          id?: number;
          image_url?: string | null;
          is_active?: boolean | null;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string | null;
          id: number;
          options: Json | null;
          order_id: string | null;
          product_id: number | null;
          product_name: string;
          quantity: number;
          total_price: number;
          unit_price: number;
          vendor_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: number;
          options?: Json | null;
          order_id?: string | null;
          product_id?: number | null;
          product_name: string;
          quantity: number;
          total_price: number;
          unit_price: number;
          vendor_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: number;
          options?: Json | null;
          order_id?: string | null;
          product_id?: number | null;
          product_name?: string;
          quantity?: number;
          total_price?: number;
          unit_price?: number;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          }
        ];
      };
      orders: {
        Row: {
          created_at: string | null;
          customer_email: string;
          customer_first_name: string;
          customer_last_name: string;
          customer_phone: string | null;
          id: string;
          notes: string | null;
          order_number: string;
          order_type: Database['public']['Enums']['order_type'];
          scheduled_time: string | null;
          status: Database['public']['Enums']['order_status'] | null;
          table_number: string | null;
          timing: Database['public']['Enums']['order_timing'] | null;
          total_amount: number;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          customer_email: string;
          customer_first_name: string;
          customer_last_name: string;
          customer_phone?: string | null;
          id?: string;
          notes?: string | null;
          order_number: string;
          order_type: Database['public']['Enums']['order_type'];
          scheduled_time?: string | null;
          status?: Database['public']['Enums']['order_status'] | null;
          table_number?: string | null;
          timing?: Database['public']['Enums']['order_timing'] | null;
          total_amount: number;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          customer_email?: string;
          customer_first_name?: string;
          customer_last_name?: string;
          customer_phone?: string | null;
          id?: string;
          notes?: string | null;
          order_number?: string;
          order_type?: Database['public']['Enums']['order_type'];
          scheduled_time?: string | null;
          status?: Database['public']['Enums']['order_status'] | null;
          table_number?: string | null;
          timing?: Database['public']['Enums']['order_timing'] | null;
          total_amount?: number;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      payment_splits: {
        Row: {
          amount: number;
          created_at: string | null;
          id: number;
          payment_id: string | null;
          transfer_id: string | null;
          transfer_status: string | null;
          vendor_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          id?: number;
          payment_id?: string | null;
          transfer_id?: string | null;
          transfer_status?: string | null;
          vendor_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          id?: number;
          payment_id?: string | null;
          transfer_id?: string | null;
          transfer_status?: string | null;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_splits_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_splits_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          }
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string | null;
          currency: string | null;
          id: string;
          metadata: Json | null;
          order_id: string | null;
          payment_url: string | null;
          provider: Database['public']['Enums']['payment_provider'];
          provider_payment_id: string;
          status: Database['public']['Enums']['payment_status'] | null;
          updated_at: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          metadata?: Json | null;
          order_id?: string | null;
          payment_url?: string | null;
          provider: Database['public']['Enums']['payment_provider'];
          provider_payment_id: string;
          status?: Database['public']['Enums']['payment_status'] | null;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          metadata?: Json | null;
          order_id?: string | null;
          payment_url?: string | null;
          provider?: Database['public']['Enums']['payment_provider'];
          provider_payment_id?: string;
          status?: Database['public']['Enums']['payment_status'] | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          }
        ];
      };
      product_options: {
        Row: {
          created_at: string | null;
          id: number;
          is_available: boolean | null;
          name: string;
          price_adjustment: number | null;
          product_id: number | null;
        };
        Insert: {
          created_at?: string | null;
          id?: number;
          is_available?: boolean | null;
          name: string;
          price_adjustment?: number | null;
          product_id?: number | null;
        };
        Update: {
          created_at?: string | null;
          id?: number;
          is_available?: boolean | null;
          name?: string;
          price_adjustment?: number | null;
          product_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'product_options_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          }
        ];
      };
      products: {
        Row: {
          category_id: number | null;
          created_at: string | null;
          id: number;
          image_url: string | null;
          is_available: boolean | null;
          long_description: string | null;
          name: string;
          price: number;
          short_description: string | null;
          stock_quantity: number | null;
          updated_at: string | null;
          vendor_id: string | null;
        };
        Insert: {
          category_id?: number | null;
          created_at?: string | null;
          id?: number;
          image_url?: string | null;
          is_available?: boolean | null;
          long_description?: string | null;
          name: string;
          price: number;
          short_description?: string | null;
          stock_quantity?: number | null;
          updated_at?: string | null;
          vendor_id?: string | null;
        };
        Update: {
          category_id?: number | null;
          created_at?: string | null;
          id?: number;
          image_url?: string | null;
          is_available?: boolean | null;
          long_description?: string | null;
          name?: string;
          price?: number;
          short_description?: string | null;
          stock_quantity?: number | null;
          updated_at?: string | null;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          }
        ];
      };
      users: {
        Row: {
          created_at: string | null;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          phone: string | null;
          role: Database['public']['Enums']['user_role'] | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          first_name: string;
          id?: string;
          last_name: string;
          phone?: string | null;
          role?: Database['public']['Enums']['user_role'] | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          phone?: string | null;
          role?: Database['public']['Enums']['user_role'] | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      vendors: {
        Row: {
          business_name: string;
          business_type: string | null;
          country: string | null;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          paygreen_merchant_id: string | null;
          stripe_account_id: string | null;
          stripe_onboarding_completed: boolean | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          business_name: string;
          business_type?: string | null;
          country?: string | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          paygreen_merchant_id?: string | null;
          stripe_account_id?: string | null;
          stripe_onboarding_completed?: boolean | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          business_name?: string;
          business_type?: string | null;
          country?: string | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          paygreen_merchant_id?: string | null;
          stripe_account_id?: string | null;
          stripe_onboarding_completed?: boolean | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vendors_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      order_status:
        | 'initiated'
        | 'todo'
        | 'ongoing'
        | 'done'
        | 'picked'
        | 'cancelled';
      order_timing: 'asap' | 'later';
      order_type: 'eat-in' | 'take-away' | 'delivery';
      payment_provider: 'paygreen' | 'stripe';
      payment_status:
        | 'pending'
        | 'processing'
        | 'completed'
        | 'failed'
        | 'refunded';
      user_role: 'customer' | 'vendor' | 'admin';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
      DefaultSchema['Views'])
  ? (DefaultSchema['Tables'] &
      DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
  ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
  ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {
      order_status: [
        'initiated',
        'todo',
        'ongoing',
        'done',
        'picked',
        'cancelled',
      ],
      order_timing: ['asap', 'later'],
      order_type: ['eat-in', 'take-away', 'delivery'],
      payment_provider: ['paygreen', 'stripe'],
      payment_status: [
        'pending',
        'processing',
        'completed',
        'failed',
        'refunded',
      ],
      user_role: ['customer', 'vendor', 'admin'],
    },
  },
} as const;
