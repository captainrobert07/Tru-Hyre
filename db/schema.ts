import { relations } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  timestamp,
  boolean,
  pgEnum,
  text,
  integer,
  jsonb,
  date,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "hr", "client", "vendor"]);

export const jobStatusEnum = pgEnum("job_status", ["open", "hold", "closing", "closed"]);
export const jobPriorityEnum = pgEnum("job_priority", ["low", "normal", "high", "urgent"]);

export const candidateStageEnum = pgEnum("candidate_stage", [
  "received",
  "hr_review",
  "screening",
  "submitted",
  "shortlist",
  "interview",
  "hold",
  "offer",
  "joined",
  "rejected",
]);
export const parseStatusEnum = pgEnum("parse_status", ["pending", "ok", "failed"]);

export const candidateSourceEnum = pgEnum("candidate_source", [
  "direct",
  "referral",
  "linkedin",
  "job_board",
  "agency",
  "careers",
  "other",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "submitted",
  "shortlist",
  "reject",
  "interview",
  "hold",
  "offer",
  "joined",
]);

export const feedbackKindEnum = pgEnum("feedback_kind", [
  "shortlist",
  "reject",
  "interview",
  "hold",
  "offer",
  "joined",
  "note",
]);

export const interviewModeEnum = pgEnum("interview_mode", ["video", "phone", "onsite"]);
export const interviewStatusEnum = pgEnum("interview_status", [
  "scheduled",
  "completed",
  "no_show",
  "cancelled",
]);
export const scorecardVerdictEnum = pgEnum("scorecard_verdict", [
  "strong_yes",
  "yes",
  "no",
  "strong_no",
]);

export const notificationKindEnum = pgEnum("notification_kind", [
  "stage_change",
  "feedback",
  "packet",
  "duplicate",
  "submission",
  "invitation",
  "system",
  "interview",
]);

export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "revoked", "expired"]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "login",
  "logout",
  "view",
  "download",
  "submit",
  "feedback",
  "invite",
  "role_change",
  "email_send",
  "template_edit",
  "interview_schedule",
  "interview_cancel",
]);

// ---------- Accounts ----------

export const clientAccounts = pgTable("client_accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  industry: varchar("industry", { length: 120 }),
  website: varchar("website", { length: 254 }),
  primaryContactName: varchar("primary_contact_name", { length: 120 }),
  primaryContactEmail: varchar("primary_contact_email", { length: 254 }),
  primaryContactPhone: varchar("primary_contact_phone", { length: 40 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const vendorAccounts = pgTable("vendor_accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  contactName: varchar("contact_name", { length: 120 }),
  contactEmail: varchar("contact_email", { length: 254 }),
  contactPhone: varchar("contact_phone", { length: 40 }),
  country: varchar("country", { length: 80 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  clientAccountId: integer("client_account_id").references(() => clientAccounts.id, { onDelete: "set null" }),
  vendorAccountId: integer("vendor_account_id").references(() => vendorAccounts.id, { onDelete: "set null" }),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const clientContacts = pgTable("client_contacts", {
  id: serial("id").primaryKey(),
  clientAccountId: integer("client_account_id").notNull().references(() => clientAccounts.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 254 }),
  phone: varchar("phone", { length: 40 }),
  title: varchar("title", { length: 120 }),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Jobs ----------

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  clientAccountId: integer("client_account_id").notNull().references(() => clientAccounts.id, { onDelete: "restrict" }),
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
  status: jobStatusEnum("status").notNull().default("open"),
  priority: jobPriorityEnum("priority").notNull().default("normal"),
  location: varchar("location", { length: 120 }),
  workMode: varchar("work_mode", { length: 40 }),
  experienceMin: numeric("experience_min", { precision: 4, scale: 1 }),
  experienceMax: numeric("experience_max", { precision: 4, scale: 1 }),
  ctcMin: numeric("ctc_min", { precision: 12, scale: 2 }),
  ctcMax: numeric("ctc_max", { precision: 12, scale: 2 }),
  positions: integer("positions").notNull().default(1),
  description: text("description"),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  closeBy: date("close_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  clientIdx: index("jobs_client_idx").on(t.clientAccountId),
  statusIdx: index("jobs_status_idx").on(t.status),
}));

export const jobVendors = pgTable("job_vendors", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  vendorAccountId: integer("vendor_account_id").notNull().references(() => vendorAccounts.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
}, (t) => ({
  jobIdx: index("job_vendors_job_idx").on(t.jobId),
  vendorIdx: index("job_vendors_vendor_idx").on(t.vendorAccountId),
}));

// ---------- Candidates ----------

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 200 }).notNull(),
  email: varchar("email", { length: 254 }),
  phone: varchar("phone", { length: 40 }),
  location: varchar("location", { length: 120 }),
  currentTitle: varchar("current_title", { length: 200 }),
  currentCompany: varchar("current_company", { length: 200 }),
  experienceYears: numeric("experience_years", { precision: 4, scale: 1 }),
  noticePeriodDays: integer("notice_period_days"),
  currentCtc: numeric("current_ctc", { precision: 12, scale: 2 }),
  expectedCtc: numeric("expected_ctc", { precision: 12, scale: 2 }),
  summary: text("summary"),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  linkedinUrl: varchar("linkedin_url", { length: 254 }),
  githubUrl: varchar("github_url", { length: 254 }),
  availableFrom: date("available_from"),
  willingToRelocate: boolean("willing_to_relocate"),
  workAuthorization: varchar("work_authorization", { length: 120 }),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  starredByClient: boolean("starred_by_client").notNull().default(false),
  stage: candidateStageEnum("stage").notNull().default("received"),
  parseStatus: parseStatusEnum("parse_status").notNull().default("pending"),
  parseError: text("parse_error"),
  vendorAccountId: integer("vendor_account_id").references(() => vendorAccounts.id, { onDelete: "set null" }),
  uploadedById: integer("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
  // How this candidate entered the pipeline. Defaults to direct (HR upload);
  // vendor uploads are set to agency, careers-page applicants to careers.
  source: candidateSourceEnum("source").notNull().default("direct"),
  // Free-text detail, e.g. the referrer's name or the specific job board.
  sourceDetail: varchar("source_detail", { length: 160 }),
  notes: text("notes"),
  refId: varchar("ref_id", { length: 24 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  emailIdx: index("candidates_email_idx").on(t.email),
  stageIdx: index("candidates_stage_idx").on(t.stage),
  vendorIdx: index("candidates_vendor_idx").on(t.vendorAccountId),
  sourceIdx: index("candidates_source_idx").on(t.source),
}));

export const resumeFiles = pgTable("resume_files", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  driveFileId: text("drive_file_id").notNull(),
  driveWebViewLink: text("drive_web_view_link"),
  originalName: varchar("original_name", { length: 254 }).notNull(),
  contentType: varchar("content_type", { length: 80 }),
  sizeBytes: integer("size_bytes"),
  contentHash: varchar("content_hash", { length: 64 }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
}, (t) => ({
  candidateIdx: index("resume_files_candidate_idx").on(t.candidateId),
  hashIdx: index("resume_files_hash_idx").on(t.contentHash),
  driveIdx: index("resume_files_drive_idx").on(t.driveFileId),
}));

export const clientPackets = pgTable("client_packets", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  driveFileId: text("drive_file_id").notNull(),
  driveWebViewLink: text("drive_web_view_link"),
  generatedById: integer("generated_by_id").references(() => users.id, { onDelete: "set null" }),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
}, (t) => ({
  driveIdx: index("client_packets_drive_idx").on(t.driveFileId),
  candidateIdx: index("client_packets_candidate_idx").on(t.candidateId),
}));

export const stageHistory = pgTable("stage_history", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  fromStage: candidateStageEnum("from_stage"),
  toStage: candidateStageEnum("to_stage").notNull(),
  changedById: integer("changed_by_id").references(() => users.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  candidateIdx: index("stage_history_candidate_idx").on(t.candidateId),
}));

// ---------- Submissions & feedback ----------

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  packetId: integer("packet_id").references(() => clientPackets.id, { onDelete: "set null" }),
  submittedById: integer("submitted_by_id").references(() => users.id, { onDelete: "set null" }),
  status: submissionStatusEnum("status").notNull().default("submitted"),
  expectedJoinDate: date("expected_join_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  candidateIdx: index("submissions_candidate_idx").on(t.candidateId),
  jobIdx: index("submissions_job_idx").on(t.jobId),
  statusIdx: index("submissions_status_idx").on(t.status),
}));

export const feedbackEvents = pgTable("feedback_events", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  kind: feedbackKindEnum("kind").notNull(),
  body: text("body"),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  submissionIdx: index("feedback_events_submission_idx").on(t.submissionId),
}));

// ---------- Interviews ----------

export const interviews = pgTable("interviews", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  // Most interviews hang off a submission (a candidate-for-a-job), but we allow
  // a null submission so an early-stage screening call can be booked too.
  submissionId: integer("submission_id").references(() => submissions.id, { onDelete: "set null" }),
  jobId: integer("job_id").references(() => jobs.id, { onDelete: "set null" }),
  title: varchar("title", { length: 200 }).notNull(),
  mode: interviewModeEnum("mode").notNull().default("video"),
  // Stored in UTC; rendered in the viewer's locale.
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
  location: text("location"),
  meetLink: text("meet_link"),
  // Google Calendar event id, so we can patch/delete the event on reschedule/cancel.
  googleEventId: text("google_event_id"),
  // Staff user ids invited as interviewers.
  interviewerIds: jsonb("interviewer_ids").$type<number[]>().notNull().default([]),
  status: interviewStatusEnum("status").notNull().default("scheduled"),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  candidateIdx: index("interviews_candidate_idx").on(t.candidateId),
  submissionIdx: index("interviews_submission_idx").on(t.submissionId),
  startIdx: index("interviews_start_idx").on(t.scheduledStart),
  statusIdx: index("interviews_status_idx").on(t.status),
}));

// Structured interview scorecard — one row per reviewer per interview/submission.
export const interviewFeedback = pgTable("interview_feedback", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  submissionId: integer("submission_id").references(() => submissions.id, { onDelete: "set null" }),
  interviewId: integer("interview_id").references(() => interviews.id, { onDelete: "set null" }),
  reviewerId: integer("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  verdict: scorecardVerdictEnum("verdict").notNull(),
  // Per-criterion 1-5 ratings, e.g. { technical: 4, communication: 5, culture: 3 }.
  scores: jsonb("scores").$type<Record<string, number>>().notNull().default({}),
  body: text("body"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  candidateIdx: index("interview_feedback_candidate_idx").on(t.candidateId),
  submissionIdx: index("interview_feedback_submission_idx").on(t.submissionId),
}));

// ---------- Notifications ----------

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: notificationKindEnum("kind").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  url: varchar("url", { length: 400 }),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("notifications_user_idx").on(t.userId),
  unreadIdx: index("notifications_unread_idx").on(t.userId, t.readAt),
}));

// ---------- Settings ----------

export const companyProfile = pgTable("company_profile", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  tagline: varchar("tagline", { length: 200 }),
  contactEmail: varchar("contact_email", { length: 254 }),
  parsingEnabled: boolean("parsing_enabled").notNull().default(true),
  ocrEnabled: boolean("ocr_enabled").notNull().default(false),
  aiParsingEnabled: boolean("ai_parsing_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 254 }).notNull(),
  role: roleEnum("role").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  invitedById: integer("invited_by_id").references(() => users.id, { onDelete: "set null" }),
  clientAccountId: integer("client_account_id").references(() => clientAccounts.id, { onDelete: "set null" }),
  vendorAccountId: integer("vendor_account_id").references(() => vendorAccounts.id, { onDelete: "set null" }),
  status: invitationStatusEnum("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Tasks / reminders ----------

export const taskStatusEnum = pgEnum("task_status", ["open", "done", "snoozed"]);

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 240 }).notNull(),
  body: text("body"),
  status: taskStatusEnum("status").notNull().default("open"),
  dueAt: timestamp("due_at"),
  candidateId: integer("candidate_id").references(() => candidates.id, { onDelete: "cascade" }),
  jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (t) => ({
  ownerIdx: index("tasks_owner_idx").on(t.ownerId, t.status),
  dueIdx: index("tasks_due_idx").on(t.dueAt),
}));

// ---------- Comments / collaboration ----------

export const commentTargetEnum = pgEnum("comment_target", ["candidate", "submission", "job"]);

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  targetType: commentTargetEnum("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  authorEmail: varchar("author_email", { length: 254 }),
  body: text("body").notNull(),
  mentions: jsonb("mentions").$type<number[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  targetIdx: index("comments_target_idx").on(t.targetType, t.targetId),
}));

// ---------- Saved views ----------

export const savedViewScopeEnum = pgEnum("saved_view_scope", ["candidates", "jobs", "clients", "vendors", "submissions"]);

export const savedViews = pgTable("saved_views", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scope: savedViewScopeEnum("scope").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  query: jsonb("query").$type<Record<string, string>>().notNull().default({}),
  pinned: boolean("pinned").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("saved_views_user_idx").on(t.userId, t.scope),
}));

// ---------- Audit ----------

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorEmail: varchar("actor_email", { length: 254 }),
  action: auditActionEnum("action").notNull(),
  targetType: varchar("target_type", { length: 80 }),
  targetId: varchar("target_id", { length: 80 }),
  summary: varchar("summary", { length: 400 }).notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: varchar("user_agent", { length: 254 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  actorIdx: index("audit_log_actor_idx").on(t.actorId),
  createdIdx: index("audit_log_created_idx").on(t.createdAt),
}));

// ---------- AI candidate↔job match scores ----------

// Cached AI fit scores for a (candidate, job) pair. Recomputed on demand
// ("Refresh scores"); one row per pair.
export const candidateScores = pgTable("candidate_scores", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  score: integer("score").notNull(), // 0-100
  reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
  model: varchar("model", { length: 64 }),
  computedAt: timestamp("computed_at").notNull().defaultNow(),
}, (t) => ({
  pairIdx: uniqueIndex("candidate_scores_pair_idx").on(t.candidateId, t.jobId),
  jobIdx: index("candidate_scores_job_idx").on(t.jobId),
}));

// ---------- Feature flags ----------

// On/off state for optional features. The catalogue (label/description/
// category/default) lives in code at lib/features.ts; only the boolean state
// is persisted here, keyed by the feature key. A missing row = use the
// code-defined default.
export const featureFlags = pgTable("feature_flags", {
  key: varchar("key", { length: 64 }).primaryKey(),
  enabled: boolean("enabled").notNull(),
  updatedById: integer("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------- Email templates + outbox ----------

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  subject: varchar("subject", { length: 240 }).notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  updatedById: integer("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailOutbox = pgTable("email_outbox", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").references(() => candidates.id, { onDelete: "set null" }),
  templateSlug: varchar("template_slug", { length: 64 }).notNull(),
  toEmail: varchar("to_email", { length: 254 }).notNull(),
  fromEmail: varchar("from_email", { length: 254 }).notNull(),
  subject: varchar("subject", { length: 240 }).notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text").notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  error: text("error"),
  sentAt: timestamp("sent_at"),
  triggeredById: integer("triggered_by_id").references(() => users.id, { onDelete: "set null" }),
  fromStage: varchar("from_stage", { length: 32 }),
  toStage: varchar("to_stage", { length: 32 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  candidateIdx: index("email_outbox_candidate_idx").on(t.candidateId),
  createdIdx: index("email_outbox_created_idx").on(t.createdAt),
}));

// ---------- Relations ----------

export const usersRelations = relations(users, ({ one, many }) => ({
  clientAccount: one(clientAccounts, {
    fields: [users.clientAccountId],
    references: [clientAccounts.id],
  }),
  vendorAccount: one(vendorAccounts, {
    fields: [users.vendorAccountId],
    references: [vendorAccounts.id],
  }),
  notifications: many(notifications),
}));

export const clientAccountsRelations = relations(clientAccounts, ({ many }) => ({
  contacts: many(clientContacts),
  jobs: many(jobs),
  users: many(users),
}));

export const vendorAccountsRelations = relations(vendorAccounts, ({ many }) => ({
  candidates: many(candidates),
  jobAssignments: many(jobVendors),
  users: many(users),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  client: one(clientAccounts, { fields: [jobs.clientAccountId], references: [clientAccounts.id] }),
  owner: one(users, { fields: [jobs.ownerId], references: [users.id] }),
  vendors: many(jobVendors),
  submissions: many(submissions),
}));

export const jobVendorsRelations = relations(jobVendors, ({ one }) => ({
  job: one(jobs, { fields: [jobVendors.jobId], references: [jobs.id] }),
  vendor: one(vendorAccounts, { fields: [jobVendors.vendorAccountId], references: [vendorAccounts.id] }),
}));

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  vendor: one(vendorAccounts, { fields: [candidates.vendorAccountId], references: [vendorAccounts.id] }),
  uploadedBy: one(users, { fields: [candidates.uploadedById], references: [users.id] }),
  resumeFiles: many(resumeFiles),
  packets: many(clientPackets),
  history: many(stageHistory),
  submissions: many(submissions),
  interviews: many(interviews),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  candidate: one(candidates, { fields: [submissions.candidateId], references: [candidates.id] }),
  job: one(jobs, { fields: [submissions.jobId], references: [jobs.id] }),
  packet: one(clientPackets, { fields: [submissions.packetId], references: [clientPackets.id] }),
  feedback: many(feedbackEvents),
  interviews: many(interviews),
}));

export const interviewsRelations = relations(interviews, ({ one }) => ({
  candidate: one(candidates, { fields: [interviews.candidateId], references: [candidates.id] }),
  submission: one(submissions, { fields: [interviews.submissionId], references: [submissions.id] }),
  job: one(jobs, { fields: [interviews.jobId], references: [jobs.id] }),
  createdBy: one(users, { fields: [interviews.createdById], references: [users.id] }),
}));

export const interviewFeedbackRelations = relations(interviewFeedback, ({ one }) => ({
  candidate: one(candidates, { fields: [interviewFeedback.candidateId], references: [candidates.id] }),
  submission: one(submissions, { fields: [interviewFeedback.submissionId], references: [submissions.id] }),
  interview: one(interviews, { fields: [interviewFeedback.interviewId], references: [interviews.id] }),
  reviewer: one(users, { fields: [interviewFeedback.reviewerId], references: [users.id] }),
}));

// ---------- Type exports ----------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ClientAccount = typeof clientAccounts.$inferSelect;
export type VendorAccount = typeof vendorAccounts.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type FeedbackEvent = typeof feedbackEvents.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type Interview = typeof interviews.$inferSelect;
export type NewInterview = typeof interviews.$inferInsert;
export type InterviewFeedback = typeof interviewFeedback.$inferSelect;
export type CandidateScore = typeof candidateScores.$inferSelect;
