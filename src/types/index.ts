export interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
  role?: {
    id: string;
    name: string;
    description?: string;
  };
  hasFullAccess?: boolean;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_name: string;
  application_id: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationPermission {
  id: string;
  role_name: string;
  application_id: string;
  permission_name: string;
  created_at: string;
}

export interface EstimateWork {
  id: string;
  title: string;
  description: string;
  estimated_amount: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Work {
  sr_no: number;
  type: 'Technical Sanction' | 'Administrative Approval';
  works_id: string;
  ssr?: string;
  work_name: string;
  division?: string;
  sub_division?: string;
  fund_head?: string;
  major_head?: string;
  minor_head?: string;
  service_head?: string;
  departmental_head?: string;
  sanctioning_authority?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed';
  estimate_status?: 'draft' | 'ready_for_approval' | 'in_approval' | 'approved' | 'rejected' | 'sent_back';
  total_estimated_cost: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface SubWork {
  sr_no: number;
  works_id: string;
  subworks_id: string;
  subworks_name: string;
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface SubworkItem {
  sr_no?: number;
  id?: string;
  subwork_id: string;
  item_number: string;
  category?: string;
  description_of_item: string;
  ssr_quantity: number;
  ssr_rate: number;
  ssr_unit?: string;
  total_item_amount: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  csr_item_no?: string;
  csr_reference?: string;
  csr_labour_cost?: number;
  csr_unit?: string;
  operation_type?: 'none' | 'multiply' | 'divide' | 'add' | 'subtract';
  operation_value?: number;
  unit_conversion_factor?: number;
  final_unit?: string;
  final_quantity?: number;
}

export interface ItemMeasurement {
  id?: string;
  sr_no: number;
  subwork_item_id: number;
  measurement_sr_no: number;
  work_id?: string;
  subwork_id?: string;
  item_id?: string;
  header?: string;
  description_of_items?: string;
  factor: number;
  no_of_units: number;
  length: number;
  width_breadth: number;
  height_depth: number;
  calculated_quantity: number;
  estimated_quantity?: number;
  actual_quantity?: number;
  variance?: number;
  variance_reason?: string;
  unit?: string;
  is_manual_quantity?: boolean;
  manual_quantity?: number;
  is_deduction?: boolean;
  line_amount: number;
  rate?: number;
  rate_sr_no?: number;
  selected_rate_id?: number;
  excel_url?: string;
  excel_name?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ItemLead {
  sr_no: number;
  subwork_item_sr_no: number;
  material: string;
  location_of_quarry?: string;
  lead_in_km: number;
  lead_charges: number;
  initial_lead_charges: number;
  net_lead_charges: number;
  created_at: string;
  updated_at: string;
}

export interface ItemMaterial {
  sr_no: number;
  subwork_item_sr_no: number;
  material_name: string;
  required_quantity: number;
  unit?: string;
  rate_per_unit: number;
  total_material_cost: number;
  created_at: string;
  updated_at: string;
}

export interface ItemRate {
  sr_no: number;
  subwork_item_sr_no: number;
  description: string;
  rate: number;
  unit?: string;
  document_reference?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface EstimateSubWork {
  id: string;
  work_id: string;
  title: string;
  description: string;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface EstimateTemplate {
  id: string;
  template_name: string;
  description?: string;
  original_works_id: string;
  template_data: {
    work: Work;
    subworks: SubWork[];
    subworkItems: { [subworkId: string]: SubworkItem[] };
    measurements: { [itemId: string]: ItemMeasurement[] };
    leads: { [itemId: string]: ItemLead[] };
    materials: { [itemId: string]: ItemMaterial[] };
  };
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasFullAccess: () => boolean;
}

export interface LanguageContextType {
  language: string;
  changeLanguage: (lang: string) => void;
  t: (key: string) => string;
}

export interface TaxEntry {
  id: string;
  name: string;
  percentage: number;
  applyTo: 'part_a' | 'part_b' | 'part_c' | 'both' | 'part_a_b_combined';
}

export interface RecapCalculations {
  partA: {
    subtotal: number;
    taxes: { [taxId: string]: number };
    total: number;
  };
  partB: {
    subtotal: number;
    taxes: { [taxId: string]: number };
    total: number;
  };
  partC: {
    subtotal: number;
    taxes: { [taxId: string]: number };
    total: number;
  };
  partABCombined?: {
    subtotal: number;
    taxes: { [taxId: string]: number };
    total: number;
  };
  additionalCharges: {
    contingencies: number;
    inspectionCharges: number;
    dprCharges: number;
  };
  grandTotal: number;
}