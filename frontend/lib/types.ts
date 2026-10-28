// Types des données renvoyées par l'API Django.

export type Role = "learner" | "instructor" | "admin";
export type UserStatus = "active" | "pending" | "suspended";
export type Level = "beginner" | "intermediate" | "advanced";
export type RiskLevel = "low" | "medium" | "high";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  initials: string;
  avatar_color: string;
  role: Role;
  role_label: string;
  status: UserStatus;
  status_label: string;
  headline: string;
  date_joined: string;
  last_login: string | null;
  onboarding_completed: boolean | null;
}

export interface AdminUser extends User {
  enrollments_count: number;
  courses_count: number;
}

export interface Paginated<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: T[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
  description?: string;
  course_count?: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface InstructorMini {
  id: number;
  full_name: string;
  initials: string;
  avatar_color: string;
  headline: string;
}

export interface RecommendationInfo {
  score: number;
  collaborative: number;
  content: number;
  profile: number;
  reasons: { source: "collaborative" | "content" | "profile" | "popularity"; text: string }[];
  rank: number;
}

export interface CourseSummary {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  category: Category;
  level: Level;
  level_label: string;
  tags: string[];
  cover_color: string;
  instructor: InstructorMini;
  enrolled_count: number;
  review_count: number;
  avg_rating: number | null;
  lesson_count: number;
  duration_minutes: number;
  published_at: string | null;
  is_new: boolean;
  match_score: number | null;
  is_enrolled: boolean;
  recommendation?: RecommendationInfo | null;
}

export interface NextStep {
  type: "lesson" | "quiz";
  id: number;
  title: string;
  module_title: string;
}

export interface Review {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  user_name: string;
  user_initials: string;
  user_color: string;
}

export interface CourseDetail extends CourseSummary {
  description: string;
  learning_outcomes: string[];
  prerequisites: string;
  status: string;
  modules: {
    id: number;
    title: string;
    description: string;
    order: number;
    has_quiz: boolean;
    duration_minutes: number;
    lessons: { id: number; title: string; order: number; duration_minutes: number }[];
  }[];
  reviews: Review[];
  enrollment: { id: number; status: string; progress: number; next: NextStep | null; enrolled_at: string } | null;
  recommendation: RecommendationInfo | null;
  my_review: Review | null;
}

export interface EnrollmentItem {
  id: number;
  course: CourseSummary;
  status: "active" | "completed";
  status_label: string;
  progress: number;
  enrolled_at: string;
  completed_at: string | null;
  last_activity_at: string | null;
  next: NextStep | null;
  risk_level: RiskLevel | null;
}

export interface LearnCourse {
  course: { id: number; slug: string; title: string; cover_color: string; instructor: string };
  enrollment: { id: number; status: string; progress: number; completed_at: string | null };
  modules: {
    id: number;
    title: string;
    order: number;
    completed_lessons: number;
    lessons: { id: number; title: string; duration_minutes: number; completed: boolean }[];
    quiz: { id: number; title: string; passed: boolean; best_score: number | null; question_count: number } | null;
  }[];
  next: NextStep | null;
}

export interface LessonDetail {
  id: number;
  title: string;
  content: string;
  video_url: string;
  duration_minutes: number;
  completed: boolean;
  last_position_seconds: number;
  note: string;
  course: { id: number; slug: string; title: string };
  module: {
    id: number;
    title: string;
    order: number;
    completed_count: number;
    lessons: { id: number; title: string; duration_minutes: number; completed: boolean }[];
  };
  quiz: { id: number; title: string; passed: boolean } | null;
  previous_lesson: number | null;
  next_lesson: number | null;
  position: number;
  total_lessons: number;
  progress: number;
}

export interface QuizDetail {
  id: number;
  title: string;
  pass_score: number;
  course: { id: number; slug: string; title: string };
  module: { id: number; title: string; order: number };
  questions: { id: number; text: string; code: string; hint: string; choices: { id: number; text: string }[] }[];
  attempts: { id: number; score: number; passed: boolean; submitted_at: string }[];
}

export interface AttemptResult {
  id: number;
  score: number;
  passed: boolean;
  correct_count: number;
  total: number;
  pass_score: number;
  duration_seconds: number;
  hints_used: number;
  submitted_at: string;
  quiz: { id: number; title: string };
  module: { id: number; title: string; order: number };
  course: { id: number; slug: string; title: string };
  questions: {
    id: number;
    text: string;
    code: string;
    topic: string;
    is_correct: boolean;
    explanation: string;
    choices: { id: number; text: string; is_correct: boolean; chosen: boolean }[];
    lesson: { id: number; title: string } | null;
  }[];
  strengths: string[];
  weaknesses: { topic: string; errors: number }[];
  remediation: { id: number; title: string }[];
  next: NextStep | null;
  course_completed: boolean;
  risk: { level: RiskLevel; score: number } | null;
  history: { id: number; score: number; submitted_at: string }[];
}

export interface CourseCard {
  enrollment_id: number;
  course: { id: number; slug: string; title: string; cover_color: string; category: string; category_color: string };
  progress: number;
  status: string;
  last_activity_at: string | null;
  next: NextStep | null;
  risk_level: RiskLevel | null;
}

export interface LearnerDashboard {
  kpis: { courses_in_progress: number; lessons_completed: number; minutes_this_week: number; streak_days: number };
  nudge: { course: { slug: string; title: string }; days: number; progress: number; next: NextStep | null } | null;
  continue: CourseCard[];
  completed_count: number;
  onboarding_completed: boolean;
}

export interface LearnerProgress {
  goal: string | null;
  kpis: {
    total_minutes: number;
    completed_courses: number;
    enrolled_courses: number;
    avg_quiz_score: number | null;
    risk_level: RiskLevel;
    risk_label: string;
  };
  weekly_minutes: { label: string; start: string; minutes: number }[];
  weekly_note: string | null;
  quiz_scores: { label: string; score: number; quiz: string; date: string }[];
  skills: { name: string; color: string; value: number }[];
  path: { title: string; slug: string; status: "done" | "now" | "todo"; detail: string }[];
  segment: { name: string; description: string } | null;
}

export interface LearnerProfile {
  goal: string;
  goal_label: string;
  level: Level;
  level_label: string;
  weekly_hours: string;
  weekly_hours_label: string;
  interests: Tag[];
  onboarding_completed: boolean;
}

export interface RecommendationsResponse {
  tab: string;
  title: string;
  anchor: { id: number; slug: string; title: string } | null;
  tabs: Record<string, string>;
  results: (CourseSummary & { recommendation: RecommendationInfo })[];
}

export interface Notification {
  id: number;
  kind: string;
  kind_label: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface LearningEventItem {
  id: number;
  event_type: string;
  label: string;
  value: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// --- Formateur -----------------------------------------------------------------

export interface InstructorOverview {
  period: string;
  kpis: {
    active_learners: number;
    active_learners_delta: number | null;
    completion_rate: number;
    completion_delta_pts: number | null;
    high_risk: number;
    high_risk_delta: number;
    avg_quiz_score: number | null;
    avg_quiz_delta_pts: number | null;
  };
  daily_sessions: { date: string; sessions: number }[];
  risk_distribution: { low: number; medium: number; high: number };
  risk_note: string | null;
  alerts: {
    user: { id: number; name: string; initials: string; color: string };
    course: { id: number; title: string };
    score: number;
    level: RiskLevel;
    signal: string;
  }[];
  top_courses: { id: number; title: string; slug: string; enrolled: number; completion_rate: number }[];
}

export interface AtRiskRow {
  id: number;
  user: { id: number; name: string; email: string; initials: string; color: string };
  course: { id: number; title: string; slug: string };
  progress: number;
  last_activity_at: string | null;
  score: number;
  previous_score: number | null;
  level: RiskLevel;
  level_label: string;
  signals: string[];
  contacted_recently: boolean;
}

export interface AtRiskResponse extends Paginated<AtRiskRow> {
  summary: { high: number; medium: number; contacted_this_week: number; returned_after_contact: number };
}

export interface Contribution {
  feature: string;
  label: string;
  text: string;
  value: number;
  contribution: number;
  share: number;
}

export interface LearnerFile {
  user: { id: number; name: string; email: string; initials: string; color: string; date_joined: string; last_activity_at: string | null };
  profile: { goal: string | null; level: string | null; weekly_hours: string | null };
  segment: { name: string; description: string } | null;
  risk: {
    score: number;
    level: RiskLevel;
    level_label: string;
    previous_score: number | null;
    predicted_at: string;
    course: { id: number; title: string };
    contributions: Contribution[];
  } | null;
  activity: { date: string; count: number }[];
  courses: { id: number; title: string; slug: string; progress: number; status: string; detail: string; in_scope: boolean; risk_level: RiskLevel | null }[];
  suggestion: { id: number; title: string; slug: string; duration_minutes: number; score: number } | null;
  interventions: {
    id: number;
    kind: string;
    kind_label: string;
    message: string;
    instructor: string;
    suggested_course: string | null;
    scheduled_for: string | null;
    created_at: string;
    is_read: boolean;
  }[];
}

export interface CourseAnalytics {
  courses: { id: number; title: string; enrolled: number }[];
  course: { id: number; title: string; slug: string } | null;
  period?: string;
  funnel?: { label: string; value: number }[];
  funnel_note?: string | null;
  dropoff?: { label: string; value: number }[];
  dropoff_note?: string | null;
  segments?: { name: string; count: number; share: number; description: string; risk_level: RiskLevel }[];
  segments_trained_at?: string | null;
  lessons?: {
    id: number;
    title: string;
    module: string;
    viewers: number;
    exit_rate: number;
    replays: number;
    quiz_avg: number | null;
    status: "rework" | "watch" | "ok";
    status_label: string;
  }[];
}

export interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface InstructorCourse {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  status: string;
  status_label: string;
  category: Category;
  level: Level;
  level_label: string;
  cover_color: string;
  instructor: InstructorMini;
  enrolled_count: number;
  completed_count: number;
  completion_rate: number | null;
  avg_rating: number | null;
  lesson_count: number;
  duration_minutes: number;
  updated_at: string;
  submitted_at: string | null;
  published_at: string | null;
  review_comment: string;
}

export interface EditorLesson {
  id: number;
  module: number;
  title: string;
  order: number;
  content: string;
  video_url: string;
  duration_minutes: number;
}

export interface InstructorCourseDetail extends InstructorCourse {
  description: string;
  tags: string[];
  learning_outcomes: string[];
  prerequisites: string;
  modules: {
    id: number;
    title: string;
    description: string;
    order: number;
    lessons: EditorLesson[];
    quiz: { id: number; title: string; pass_score: number; question_count: number } | null;
  }[];
  checklist: ChecklistItem[];
}

export interface QuizEditorData {
  id?: number;
  title: string;
  pass_score: number;
  questions: {
    id?: number;
    text: string;
    code: string;
    topic: string;
    hint: string;
    explanation: string;
    lesson: number | null;
    choices: { id?: number; text: string; is_correct: boolean }[];
  }[];
}

export interface TrainingRun {
  id: number;
  status: "running" | "success" | "failed";
  status_label: string;
  trigger: string;
  triggered_by: string | null;
  steps: { key: string; label: string; status: string; detail: string; seconds?: number; started_at?: string; finished_at?: string }[];
  summary: Record<string, number>;
  error: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
}

export interface MLOverview {
  models: {
    kind: string;
    label: string;
    version: number | null;
    metrics: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    params: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    n_samples: number;
    trained_at: string | null;
  }[];
  embedding_map: { course_id: number; title: string; slug: string; category: string; color: string; x: number; y: number }[];
  history: { id: number; kind: string; label: string; version: number; trained_at: string; main_metric: number | null; metric_name: string; is_active: boolean }[];
  latest_run: TrainingRun | null;
  runs: TrainingRun[];
  can_train: boolean;
  training_in_progress: boolean;
}

// --- Administration -------------------------------------------------------------

export interface AdminDashboard {
  kpis: {
    users: number;
    users_delta: number | null;
    instructors: number;
    instructors_new: number;
    published_courses: number;
    published_new: number;
    enrollments_month: number;
    enrollments_delta: number | null;
  };
  monthly_signups: { label: string; year: number; value: number }[];
  accounts: { learners: number; instructors: number; admins: number; active_month: number };
  todo: { pending_courses: number; oldest_pending_days: number | null; pending_instructors: number; suspended_users: number };
  system: Record<"database" | "training" | "notifications" | "api", { ok: boolean; label: string; status?: string | null }>;
}

export interface RolesResponse {
  roles: { key: Role; label: string; count: number; description: string }[];
  permissions: { label: string; learner: boolean; instructor: boolean; admin: boolean }[];
}

export interface PlatformSettings {
  platform_name: string;
  contact_email: string;
  default_language: string;
  timezone: string;
  risk_threshold: number;
  medium_risk_threshold: number;
  recommendations_count: number;
  active_recommender: "hybrid" | "collaborative" | "content" | "popularity";
  training_schedule: string;
  inactivity_days: number;
  email_inactivity_reminder: boolean;
  email_instructor_alert: boolean;
  email_weekly_digest: boolean;
  email_completion_congrats: boolean;
  updated_at: string;
}

export interface ActivityLogEntry {
  id: number;
  actor: number | null;
  actor_label: string;
  action: "login" | "create" | "update" | "delete" | "system";
  action_label: string;
  description: string;
  ip_address: string | null;
  created_at: string;
}
