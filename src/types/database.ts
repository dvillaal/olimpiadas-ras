/**
 * Tipos de la base de datos.
 *
 * Escritos a mano para que el proyecto compile sin conexión. Una vez enlaces
 * tu proyecto de Supabase puedes regenerarlos con:
 *
 *   npm run db:types
 *
 * y este archivo quedará sincronizado automáticamente con el esquema real.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'admin' | 'group';
export type GroupStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type SportType = 'individual' | 'group';
export type RegistrationStatus =
  | 'draft'
  | 'payment_pending'
  | 'correction'
  | 'rejected'
  | 'confirmed'
  | 'cancelled';
export type PaymentStatus = 'sent' | 'correction' | 'rejected' | 'approved';
export type PayableType = 'team' | 'individual' | 'stand';
export type TeamMemberRole = 'starter' | 'substitute';
export type IntergroupStatus = 'pending' | 'proposed' | 'accepted' | 'rejected' | 'cancelled';
export type DocumentType = 'RC' | 'TI' | 'CC' | 'CE' | 'PA' | 'PEP';
export type Gender = 'F' | 'M' | 'O';

type Settings = {
  id: boolean;
  event_name: string;
  individual_fee: number;
  group_team_fee: number;
  stand_fee: number;
  stand_limit: number;
  max_proof_mb: number;
  registration_open: boolean;
  bank_label: string;
  bank_name: string;
  bank_account_type: string;
  bank_account_number: string;
  bank_nit: string;
  bank_holder: string;
  updated_at: string;
};

type Country = {
  code: string;
  name: string;
  is_reserved: boolean;
  created_at: string;
};

type Branch = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
};

type Group = {
  id: string;
  code: string | null;
  name: string;
  city: string;
  department: string;
  leader_name: string;
  leader_document: string;
  leader_email: string;
  leader_phone: string;
  country_code: string | null;
  status: GroupStatus;
  rejection_reason: string | null;
  notes: string;
  active: boolean;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  role: UserRole;
  group_id: string | null;
  full_name: string;
  email: string;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

type Participant = {
  id: string;
  group_id: string;
  doc_type: DocumentType;
  document: string;
  first_names: string;
  last_names: string;
  full_name: string;
  birthdate: string;
  branch_id: string;
  gender: Gender | null;
  phone: string;
  email: string | null;
  active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

type Sport = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  type: SportType;
  description: string;
  category: string;
  team_size: number;
  substitutes: number;
  max_teams_per_group: number;
  max_sports_per_participant: number;
  deadline: string | null;
  fee: number | null;
  allow_intergroup: boolean;
  max_external: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type SportBranch = {
  sport_id: string;
  branch_id: string;
};

type Team = {
  id: string;
  owner_group_id: string;
  sport_id: string;
  name: string;
  captain_id: string | null;
  status: RegistrationStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

type TeamMember = {
  team_id: string;
  participant_id: string;
  role: TeamMemberRole;
  added_at: string;
};

type IndividualRegistration = {
  id: string;
  group_id: string;
  sport_id: string;
  status: RegistrationStatus;
  amount: number;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

type IndividualRegistrationParticipant = {
  registration_id: string;
  participant_id: string;
};

type IntergroupRequest = {
  id: string;
  team_id: string;
  requester_group_id: string;
  target_group_id: string;
  slots_requested: number;
  message: string;
  response_note: string;
  status: IntergroupStatus;
  created_at: string;
  responded_at: string | null;
  resolved_at: string | null;
};

type IntergroupProposal = {
  request_id: string;
  participant_id: string;
  accepted: boolean;
};

type Stand = {
  id: string;
  group_id: string;
  name: string;
  responsible: string;
  document: string;
  phone: string;
  email: string | null;
  products: string;
  description: string;
  needs_power: boolean;
  needs_furniture: boolean;
  notes: string;
  amount: number;
  status: RegistrationStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

type Payment = {
  id: string;
  group_id: string;
  payable_type: PayableType;
  payable_id: string;
  concept: string;
  expected_amount: number;
  reported_amount: number;
  payment_date: string;
  payer_name: string;
  payer_document: string;
  origin_bank: string;
  reference: string;
  proof_path: string;
  proof_name: string;
  proof_size: number;
  notes: string;
  status: PaymentStatus;
  admin_note: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

type Notification = {
  id: string;
  group_id: string | null;
  title: string;
  body: string;
  link: string | null;
  kind: string;
  read_at: string | null;
  created_at: string;
};

type AuditLog = {
  id: number;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Json;
  created_at: string;
};

type EmailLog = {
  id: number;
  to_email: string;
  template: string;
  subject: string;
  status: string;
  error: string | null;
  created_at: string;
};

/** Convierte una fila en su forma insertable: opcionales los que tienen default. */
type Insertable<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

type TableDef<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      settings: TableDef<Settings, Insertable<Settings, 'id'>>;
      countries: TableDef<Country, Insertable<Country, 'code' | 'name'>>;
      branches: TableDef<Branch, Insertable<Branch, 'id' | 'name'>>;
      groups: TableDef<Group, Insertable<Group, 'name' | 'leader_name' | 'leader_email'>>;
      profiles: TableDef<Profile, Insertable<Profile, 'id' | 'email'>>;
      participants: TableDef<
        Participant,
        Omit<
          Insertable<
            Participant,
            'group_id' | 'document' | 'first_names' | 'last_names' | 'birthdate' | 'branch_id'
          >,
          'full_name'
        >
      >;
      sports: TableDef<Sport, Insertable<Sport, 'slug' | 'name' | 'type'>>;
      sport_branches: TableDef<SportBranch, SportBranch>;
      teams: TableDef<Team, Insertable<Team, 'owner_group_id' | 'sport_id' | 'name'>>;
      team_members: TableDef<TeamMember, Insertable<TeamMember, 'team_id' | 'participant_id'>>;
      individual_registrations: TableDef<
        IndividualRegistration,
        Insertable<IndividualRegistration, 'group_id' | 'sport_id'>
      >;
      individual_registration_participants: TableDef<
        IndividualRegistrationParticipant,
        IndividualRegistrationParticipant
      >;
      intergroup_requests: TableDef<
        IntergroupRequest,
        Insertable<
          IntergroupRequest,
          'team_id' | 'requester_group_id' | 'target_group_id' | 'slots_requested'
        >
      >;
      intergroup_proposals: TableDef<
        IntergroupProposal,
        Insertable<IntergroupProposal, 'request_id' | 'participant_id'>
      >;
      stands: TableDef<Stand, Insertable<Stand, 'group_id' | 'name' | 'responsible'>>;
      payments: TableDef<
        Payment,
        Insertable<
          Payment,
          | 'group_id'
          | 'payable_type'
          | 'payable_id'
          | 'concept'
          | 'expected_amount'
          | 'reported_amount'
          | 'payment_date'
          | 'payer_name'
          | 'reference'
          | 'proof_path'
        >
      >;
      notifications: TableDef<Notification, Insertable<Notification, 'title'>>;
      audit_log: TableDef<AuditLog, Insertable<AuditLog, 'action'>>;
      email_log: TableDef<EmailLog, Insertable<EmailLog, 'to_email' | 'template' | 'subject'>>;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      current_group_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      current_user_role: { Args: Record<PropertyKey, never>; Returns: UserRole };
      sport_effective_fee: { Args: { p_sport_id: string }; Returns: number };
      participant_sport_count: {
        Args: { p_participant_id: string; p_exclude_team?: string; p_exclude_reg?: string };
        Returns: number;
      };
      claim_country: { Args: { p_code: string }; Returns: Group };
      release_country: { Args: { p_group_id: string }; Returns: undefined };
      review_payment: {
        Args: { p_payment_id: string; p_status: PaymentStatus; p_note?: string };
        Returns: Payment;
      };
      submit_payment: {
        Args: {
          p_payable_type: PayableType;
          p_payable_id: string;
          p_concept: string;
          p_expected_amount: number;
          p_reported_amount: number;
          p_payment_date: string;
          p_payer_name: string;
          p_payer_document: string;
          p_origin_bank: string;
          p_reference: string;
          p_proof_path: string;
          p_proof_name: string;
          p_proof_size: number;
          p_notes?: string;
        };
        Returns: Payment;
      };
      accept_intergroup_proposal: { Args: { p_request_id: string }; Returns: undefined };
      log_audit: {
        Args: { p_action: string; p_entity_type?: string; p_entity_id?: string; p_metadata?: Json };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      group_status: GroupStatus;
      sport_type: SportType;
      registration_status: RegistrationStatus;
      payment_status: PaymentStatus;
      payable_type: PayableType;
      team_member_role: TeamMemberRole;
      intergroup_status: IntergroupStatus;
      document_type: DocumentType;
      gender: Gender;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type {
  Settings,
  Country,
  Branch,
  Group,
  Profile,
  Participant,
  Sport,
  SportBranch,
  Team,
  TeamMember,
  IndividualRegistration,
  IndividualRegistrationParticipant,
  IntergroupRequest,
  IntergroupProposal,
  Stand,
  Payment,
  Notification,
  AuditLog,
  EmailLog,
};
