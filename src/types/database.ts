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

export type UserRole = 'admin' | 'group' | 'referee';
/** Alcance de un perfil admin: 'limited' no ve bitácora/correos ni puede dar de alta administradores. */
export type AdminScope = 'full' | 'limited';
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
export type IntergroupStatus =
  | 'pending'
  | 'proposed'
  | 'accepted'
  | 'admin_review'
  | 'admin_approved'
  | 'admin_rejected'
  | 'rejected'
  | 'cancelled';
export type DocumentType = 'RC' | 'TI' | 'CC' | 'CE' | 'PA' | 'PEP';
export type Gender = 'F' | 'M' | 'O';
export type ScheduleType = 'match' | 'session';
export type ScheduleStatus = 'scheduled' | 'in_progress' | 'finished' | 'cancelled';
/** En unos deportes gana la marca más alta y en otros la más baja. */
export type ResultOrder = 'asc' | 'desc';

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
  /** Fecha/hora de inicio del evento; null si todavía no se ha definido. */
  event_starts_at: string | null;
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
  /** Rango de edad de la rama. La edad del participante debe caer dentro. */
  min_age: number;
  max_age: number;
  description: string;
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
  /** Solo relevante cuando role='admin'; 'full' en cualquier otro rol. */
  admin_scope: AdminScope;
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
  /** Cuántas personas caben en una tanda de un deporte individual. */
  session_capacity: number;
  /** Cómo se llama el resultado aquí: «Goles», «Tiempo», «Puntos». */
  result_label: string;
  result_order: ResultOrder;
  created_at: string;
  updated_at: string;
};

type SportBranch = {
  sport_id: string;
  branch_id: string;
};

type Referee = {
  id: string;
  phone: string;
  notes: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type RefereeSport = {
  referee_id: string;
  sport_id: string;
};

type Schedule = {
  id: string;
  sport_id: string;
  branch_id: string;
  type: ScheduleType;
  label: string;
  starts_on: string;
  starts_at: string;
  venue: string;
  referee_id: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  status: ScheduleStatus;
  score_a: number | null;
  score_b: number | null;
  result_notes: string;
  result_published: boolean;
  result_entered_by: string | null;
  result_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

type ScheduleParticipant = {
  schedule_id: string;
  participant_id: string;
  value: number | null;
  disqualified: boolean;
  rank: number | null;
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
  /** Revisión de la organización, obligatoria antes de que el equipo pague. */
  admin_note: string;
  admin_reviewed_at: string | null;
  admin_reviewed_by: string | null;
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

// ─── Vistas del portal público ───────────────────────────────────────────────
// Solo exponen competencias con resultado publicado y nombres ya públicos.

type PublicSchedule = {
  id: string;
  type: ScheduleType;
  label: string;
  starts_on: string;
  starts_at: string;
  venue: string;
  status: ScheduleStatus;
  result_published: boolean;
  score_a: number | null;
  score_b: number | null;
  result_notes: string;
  sport_name: string;
  sport_icon: string;
  sport_slug: string;
  result_label: string;
  branch_id: string;
  branch_name: string;
  team_a_name: string | null;
  team_b_name: string | null;
  referee_name: string | null;
};

type PublicStanding = {
  sport_id: string;
  sport_name: string;
  sport_slug: string;
  branch_id: string;
  branch_name: string;
  team_id: string;
  team_name: string;
  group_name: string;
  country_code: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
};

type PublicIndividualRank = {
  sport_id: string;
  sport_name: string;
  sport_slug: string;
  result_label: string;
  branch_id: string;
  branch_name: string;
  participant_id: string;
  participant_name: string;
  group_name: string;
  country_code: string | null;
  best_value: number;
  position: number;
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
      referees: TableDef<Referee, Insertable<Referee, 'id'>>;
      referee_sports: TableDef<RefereeSport, RefereeSport>;
      schedules: TableDef<
        Schedule,
        Insertable<Schedule, 'sport_id' | 'branch_id' | 'type' | 'starts_on' | 'starts_at'>
      >;
      schedule_participants: TableDef<
        ScheduleParticipant,
        Insertable<ScheduleParticipant, 'schedule_id' | 'participant_id'>
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
      // Las tres únicas consultas accesibles sin iniciar sesión.
      public_schedule: { Row: PublicSchedule; Relationships: [] };
      public_standings: { Row: PublicStanding; Relationships: [] };
      public_individual_ranking: { Row: PublicIndividualRank; Relationships: [] };
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_full_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
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
      submit_payment_bulk: {
        Args: {
          p_items: unknown;
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
        Returns: Payment[];
      };
      accept_intergroup_proposal: { Args: { p_request_id: string }; Returns: undefined };
      review_intergroup_request: {
        Args: { p_request_id: string; p_approve: boolean; p_note?: string };
        Returns: undefined;
      };
      team_intergroup_approved: { Args: { p_team_id: string }; Returns: boolean };
      generate_schedule: {
        Args: {
          p_sport_id: string;
          p_branch_id: string;
          p_starts_on: string;
          p_starts_at: string;
          p_interval_min?: number;
          p_venue?: string;
          p_referee_id?: string | null;
          p_include_pending?: boolean;
        };
        /** Cuántas competencias quedaron creadas. */
        Returns: number;
      };
      save_match_result: {
        Args: {
          p_schedule_id: string;
          p_score_a: number | null;
          p_score_b: number | null;
          p_notes?: string;
          p_publish?: boolean;
        };
        Returns: Schedule;
      };
      save_session_result: {
        Args: {
          p_schedule_id: string;
          p_entries: Json;
          p_notes?: string;
          p_publish?: boolean;
        };
        Returns: Schedule;
      };
      can_manage_schedule: { Args: { p_schedule_id: string }; Returns: boolean };
      current_referee_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      log_audit: {
        Args: { p_action: string; p_entity_type?: string; p_entity_id?: string; p_metadata?: Json };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      admin_scope: AdminScope;
      group_status: GroupStatus;
      sport_type: SportType;
      registration_status: RegistrationStatus;
      payment_status: PaymentStatus;
      payable_type: PayableType;
      team_member_role: TeamMemberRole;
      intergroup_status: IntergroupStatus;
      document_type: DocumentType;
      gender: Gender;
      schedule_type: ScheduleType;
      schedule_status: ScheduleStatus;
      result_order: ResultOrder;
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
  Referee,
  RefereeSport,
  Schedule,
  ScheduleParticipant,
  PublicSchedule,
  PublicStanding,
  PublicIndividualRank,
};
