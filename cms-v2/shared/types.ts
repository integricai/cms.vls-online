// ── Auth ──────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: number;
  email: string;
  username: string;
  role: 'admin' | 'editor' | 'viewer';
  deployId?: string;
}

export interface LoginRequest {
  email?: string;
  username?: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: PublicUser;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  username: string;
  newPassword: string;
  captchaToken: string;
  captchaAnswer: string;
}

// ── Users ─────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role: 'admin' | 'editor' | 'viewer';
  isBlocked: boolean;
  resetToken: string | null;
  resetTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicUser = Pick<User, 'id' | 'email' | 'username' | 'firstName' | 'lastName' | 'role' | 'isBlocked' | 'createdAt'>;

export type AccessLevel = 'admin' | 'editor' | 'viewer';

// ── Snippets ──────────────────────────────────────────────────────

export interface Snippet {
  id: number;
  key: string;
  title: string;
  html: string;
  meta: Record<string, unknown>;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SnippetInput = Pick<Snippet, 'key' | 'title' | 'html' | 'meta'>;

// ── Courses ───────────────────────────────────────────────────────

export interface Course {
  id: number;
  zenlerCourseId: string;
  name: string;
  slug: string | null;
  category: string | null;
  level: string | null;
  status: string | null;
  zenlerUrl: string | null;
  isActive: boolean;
  enableInBanner: boolean;
  enableInNavigation: boolean;
  sortOrder: number;
  qualification: string | null;
  courseLevel: string | null;
  courseLevels: string[];
  courseOption: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CourseDropdownKind = 'qualification' | 'level' | 'course_option';

export interface CourseDropdownOption {
  id: number;
  kind: CourseDropdownKind;
  value: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoursePaymentCard {
  id: number;
  courseId: number;
  courseName?: string;
  zenlerCourseId?: string;
  courseSlug?: string | null;
  title: string;
  description: string;
  optionType: string | null;
  normalPrice: number;
  discountPrice: number | null;
  isDiscountActive: boolean;
  finalDisplayPrice: number;
  currency: string;
  ctaButtonText: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicPaymentOption {
  id: string;
  zenlerCourseId: string;
  courseTitle: string;
  courseSlug: string | null;
  paymentCardTitle: string;
  description: string;
  optionType: string | null;
  normalPrice: number;
  discountedPrice: number | null;
  isDiscountActive: boolean;
  finalDisplayPrice: number;
  currency: string;
  buttonText: string;
}

export interface CourseSyncResult {
  fetched: number;
  inserted: number;
  updated: number;
  deactivated: number;
  syncedAt: string;
}

export interface ScrapedCoursePrice {
  courseId: number;
  zenlerCourseId: string;
  courseName: string;
  url: string;
  price: number | null;
  price2: number | null;
  currency: string;
  rawPriceText: string | null;
  matched: boolean;
  error?: string;
}

export interface CoursePriceRecord {
  id: number;
  courseId: number;
  courseName?: string;
  zenlerCourseId?: string;
  courseSlug?: string | null;
  isEnabled: boolean;
  regularPrice: number;
  regularPrice2: number;
  currency: string;
  discountPercent: number;
  discountPercent2: number;
  finalPrice: number;
  finalPrice2: number;
  sourceUrl: string | null;
  rawPriceText: string | null;
  lastScrapedPrice: number | null;
  lastScrapedPrice2: number | null;
  lastScrapedAt: Date | null;
  lastScrapeStatus: string;
  lastScrapeError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── USD course pricing (regional discounts via ParityDeals) ───────

export type CoursePricingMode = 'session' | 'duration';

export interface CourseGeoPrice {
  id: number;
  courseId: number;
  courseName?: string;
  zenlerCourseId?: string;
  courseSlug?: string | null;
  name: string;
  /** Secondary line under the price title on course pages. */
  priceSubtitle: string | null;
  currency: string;
  amount: number;
  compareAtAmount: number | null;
  discountPercent: number | null;
  discountedPrice: number | null;
  /** CMS campaign effective (discountedPrice ?? amount). Checkout/display use list amount + Evendeals only. */
  effectiveAmount: number;
  isDefault: boolean;
  isActive: boolean;
  stripePriceId: string | null;
  /** Zenler payment-option id (bulk import / checkout mapping). */
  zenlerPricingCode: string | null;
  /** Evendeals product id for localized PPP; null falls back to EVENDEALS_PRODUCT_ID. */
  evenDeals: string | null;
  pricingMode: CoursePricingMode;
  examSessionMonth: number | null;
  examSessionYear: number | null;
  durationDays: number | null;
  /** Legacy month-based duration, kept for checkout duration matching. */
  durationMonths: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type CourseGeoPriceInput = {
  id?: number;
  courseId: number;
  name: string;
  /** Secondary line under the price title; null/empty clears. */
  priceSubtitle?: string | null;
  currency?: string;
  amount: number;
  compareAtAmount?: number | null;
  discountPercent?: number | null;
  isDefault?: boolean;
  isActive?: boolean;
  stripePriceId?: string | null;
  zenlerPricingCode?: string | null;
  /** Evendeals product id; null/empty clears selection (env fallback at quote time). */
  evenDeals?: string | null;
  pricingMode?: CoursePricingMode;
  examSessionMonth?: number | null;
  examSessionYear?: number | null;
  durationDays?: number | null;
};

export interface CoursePricingSummary {
  courseId: number;
  courseTitle: string;
  zenlerCourseId: string;
  courseSlug: string | null;
  status: string | null;
  isActive: boolean;
  defaultPrice: {
    id: number;
    name: string;
    amount: number;
    currency: string;
    compareAtAmount: number | null;
    discountPercent: number | null;
    discountedPrice: number | null;
    effectiveAmount: number;
    durationMonths: number;
  } | null;
  activePriceCount: number;
  hasActiveDefault: boolean;
  updatedAt: Date | string | null;
}

export type CustomerSource = 'stripe' | 'zenler_sync' | 'newsletter' | 'manual';

export type ExamStatus = 'unknown' | 'awaiting_result' | 'passed' | 'failed';

export type ExamStatusSource = 'manual' | 'student_link';

export interface Customer {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  countryCode: string | null;
  zenlerUserId: string | null;
  stripeCustomerId: string | null;
  newsletterSubscribed: boolean;
  newsletterSubscribedAt: Date | null;
  mailerliteSubscriberId: string | null;
  source: CustomerSource | null;
  lastZenlerSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerCourseStatus {
  id: number;
  customerId: number;
  courseId: number;
  examStatus: ExamStatus;
  examStatusUpdatedAt: Date | null;
  examStatusSource: ExamStatusSource | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SaleAssignmentStatus = 'AwaitingTutor' | 'Assigned' | 'AdminAssigned';

export type PaymentOrderStatus = 'Pending' | 'Paid' | 'Failed' | 'Cancelled' | 'Refunded';

export type ConversionUploadStatus =
  | 'pending_upload'
  | 'uploaded'
  | 'extended_upload'
  | 'failed';

export type CheckoutEnvironment = 'staging' | 'production';

export interface GoogleConversionListItem {
  id: number;
  checkoutEnvironment: CheckoutEnvironment;
  paidAt: string | null;
  studentName: string | null;
  studentEmail: string | null;
  studentPhone: string | null;
  courseTitle: string;
  amount: number;
  currency: string;
  conversionUploadStatus: ConversionUploadStatus;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  conversionUploadedAt: string | null;
  conversionUploadError: string | null;
}

export interface GoogleConversionListPage {
  items: GoogleConversionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GoogleConversionUploadResult {
  configured: boolean;
  selected: number;
  uploaded: number;
  extendedUpload: number;
  failed: number;
  requestId: string | null;
  message?: string;
}

export interface StudentCourseSummary {
  courseId: number;
  courseName: string | null;
  zenlerCourseId: string | null;
  paymentStatus: PaymentOrderStatus | null;
  saleId: number | null;
  soldAt: Date | null;
  refundedAt: Date | null;
  examStatus: ExamStatus;
  examStatusUpdatedAt: Date | null;
  examStatusSource: ExamStatusSource | null;
}

export interface StudentListItem {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  countryCode: string | null;
  zenlerUserId: string | null;
  stripeCustomerId: string | null;
  newsletterSubscribed: boolean;
  newsletterSubscribedAt: Date | null;
  source: CustomerSource | null;
  lastZenlerSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  purchaseCount: number;
  refundCount: number;
  courseNames: string[];
}

export interface StudentDetail extends StudentListItem {
  mailerliteSubscriberId: string | null;
  courses: StudentCourseSummary[];
}

export type StudentSyncStatus = 'idle' | 'running' | 'stopped' | 'failed' | 'completed';

/** Course-access filter: yes = CMS purchase OR Zenler course link; cms = Stripe sale only. */
export type StudentPurchaseFilter = 'all' | 'yes' | 'no' | 'cms';

export interface StudentListPage {
  items: StudentListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface StudentSyncState {
  status: StudentSyncStatus;
  lastCompletedPage: number;
  pageSize: number;
  totalPages: number | null;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  lastError: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
  nextPage: number | null;
}

export interface ZenlerStudentSyncResult {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  page: number;
  pageSize: number;
  totalPages: number;
  nextPage: number | null;
  done: boolean;
  stopped: boolean;
  totals: {
    fetched: number;
    created: number;
    updated: number;
    skipped: number;
  };
  syncState: StudentSyncState;
}

export interface EnrollmentSyncState {
  status: StudentSyncStatus;
  courseIndex: number;
  courseId: number | null;
  lastCompletedPage: number;
  pageSize: number;
  totalCourses: number | null;
  totalPagesInCourse: number | null;
  fetched: number;
  linked: number;
  createdCustomers: number;
  skipped: number;
  lastError: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface EnrollmentSyncResult {
  fetched: number;
  linked: number;
  createdCustomers: number;
  skipped: number;
  errors: string[];
  courseIndex: number;
  courseId: number | null;
  courseName: string | null;
  page: number;
  pageSize: number;
  totalCourses: number;
  totalPagesInCourse: number;
  nextCourseIndex: number | null;
  nextPage: number | null;
  done: boolean;
  stopped: boolean;
  totals: {
    fetched: number;
    linked: number;
    createdCustomers: number;
    skipped: number;
  };
  syncState: EnrollmentSyncState;
}

export interface ExamResultPreview {
  customerId: number;
  courseId: number;
  courseName: string | null;
  studentName: string;
  expiresAt: Date;
  used: boolean;
  expired: boolean;
}

export interface ExamResultSubmitResult {
  examStatus: ExamStatus;
  courseName: string | null;
  studentName: string;
}

export interface ExamEmailSendResult {
  customerId: number;
  courseId: number;
  email: string;
  sent: boolean;
  error?: string;
}

export interface ExamEmailBulkSendResult {
  courseId: number;
  attempted: number;
  sent: number;
  failed: number;
  results: ExamEmailSendResult[];
}

export interface Sale {
  id: number;
  customerId: number;
  courseId: number;
  coursePriceId: number | null;
  paymentOrderId: number;
  amount: number;
  currency: string;
  discountPercent: number | null;
  durationDays: number;
  soldAt: Date;
  expiryDate: Date;
  tutorId: number | null;
  assignmentStatus: SaleAssignmentStatus;
  commissionPercent: number | null;
  commissionAmount: number | null;
  assignedAt: Date | null;
  createdAt: Date;
}

export interface SaleListItem extends Sale {
  courseName: string | null;
  customerEmail: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  tutorName: string | null;
  inviteCount: number;
  acceptedInviteCount: number;
  paymentStatus: PaymentOrderStatus | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
}

export interface SaleCourseSummary {
  courseId: number;
  courseName: string;
  saleCount: number;
  unassignedCount: number;
  totalAmount: number;
  totalCommission: number;
  currencies: string[];
}

export interface SaleTutorSummary {
  tutorId: number;
  tutorName: string;
  commissionPercent: number;
  saleCount: number;
  totalAmount: number;
  totalCommission: number;
  currencies: string[];
}

export interface SaleAcceptPreview {
  saleId: number;
  courseName: string | null;
  studentFirstName: string | null;
  amount: number;
  currency: string;
  soldAt: Date | string;
  tutorName: string | null;
  status: 'available' | 'already_assigned' | 'expired' | 'invalid';
  assignedTutorName?: string | null;
}

export interface ResolvedCoursePrice {
  price: CourseGeoPrice;
  matchReason: 'duration' | 'default' | 'explicit';
  /** Final USD price for checkout (list amount after optional Evendeals discount) */
  effectiveAmount: number;
  detectedCountryCode: string | null;
  /** True when Evendeals localized discount was applied (field name kept for API compat). */
  geoPricingApplied: boolean;
  /** Quoted ISO country from Evendeals when regional pricing applied. */
  geoRegionCode: string | null;
  geoDiscountPercent: number | null;
}

export interface PricingRegionConfig {
  code: string;
  label: string;
  discountPercent: number;
  isActive: boolean;
  sortOrder: number;
  countries: string[];
}

/** How duration plans are labelled / rolled for a qualification. */
export type QualificationOfferType = 'exam_sessions' | 'open';

/**
 * Maps a qualification (ACCA, CIMA, …) to allowed durations, exam months,
 * and enrollment cutoff day for rolling session offers.
 */
export interface QualificationOfferRule {
  id: number;
  qualification: string;
  offerType: QualificationOfferType;
  /** Allowed / recommended access lengths in days, ascending (e.g. [90, 180]). */
  durationDays: number[];
  /** Calendar months when exams sit (1–12). Empty for open/subscription quals. */
  examMonths: number[];
  /**
   * Last calendar day of the month before a sitting on which that sitting is still offered.
   * E.g. 12 → Sep sitting closes after 12 Aug. Null = no early cutoff.
   */
  cutoffDay: number | null;
  /**
   * Course IDs that receive exam-session labels for this rule.
   * Empty = all courses with this qualification (legacy).
   * Non-empty = only listed courses; others show duration/day plan labels.
   */
  courseIds: number[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type QualificationOfferRuleInput = {
  qualification: string;
  offerType: QualificationOfferType;
  durationDays: number[];
  examMonths: number[];
  cutoffDay: number | null;
  courseIds?: number[];
  isActive?: boolean;
  sortOrder?: number;
};

export interface CoursePriceImportRow {
  rowNumber: number;
  zenlerCourseId?: string;
  pricingCode?: string;
  courseSlug?: string;
  courseTitle?: string;
  priceName: string;
  currency: string;
  amount: number;
  compareAtAmount?: number | null;
  discountPercent?: number | null;
  /** Undefined = not specified in CSV (preserve existing on update). */
  isDefault?: boolean;
  /** Undefined = not specified in CSV (preserve existing on update). */
  isActive?: boolean;
  /** Evendeals product UUID; empty/omitted = no per-row override. */
  evenDeals?: string | null;
  pricingMode?: CoursePricingMode;
  examSessionMonth?: number | null;
  examSessionYear?: number | null;
  durationDays?: number | null;
}

export interface CoursePriceImportRowError {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface CoursePriceImportPreviewRow {
  rowNumber: number;
  action: 'create' | 'update';
  courseId: number;
  courseTitle: string;
  zenlerCourseId: string;
  price: CoursePriceImportRow;
  existingPriceId?: number;
  defaultSpecified?: boolean;
}

export interface CoursePriceImportPreview {
  validRows: CoursePriceImportPreviewRow[];
  errors: CoursePriceImportRowError[];
  warnings: CoursePriceImportRowError[];
  stats?: {
    coursesWithoutDefault: number;
    duplicatesToDeactivate: number;
    autoDefaultedCourses: number;
  };
}

export interface CoursePriceImportResult {
  created: number;
  updated: number;
  skipped: number;
  deactivated: number;
  errors: CoursePriceImportRowError[];
}

// ── Custom payment offers (admin billing) ─────────────────────────

export interface CustomPaymentOffer {
  id: number;
  paymentOrderId: number;
  courseId: number;
  courseTitle?: string;
  createdByUserId: number | null;
  createdByName?: string | null;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  amount: number;
  currency: string;
  durationDays: number;
  discountReason: string;
  stripeCheckoutSessionId: string | null;
  checkoutUrl: string | null;
  emailSentAt: Date | string | null;
  createdAt: Date | string;
  orderStatus?: string | null;
  emailSent?: boolean;
}

export interface CustomPaymentOfferInput {
  firstName: string;
  lastName: string;
  email: string;
  courseId: number;
  amount: number;
  durationDays: number;
  discountReason: string;
}

// ── Tutors ────────────────────────────────────────────────────────

export interface Tutor {
  id: number;
  name: string;
  email: string | null;
  role: string | null;
  bio: string | null;
  photoUrl: string | null;
  initials: string | null;
  isActive: boolean;
  commissionPercent: number;
  courseIds: number[];
  courseNames?: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type TutorInput = {
  id?: number;
  name: string;
  email?: string | null;
  role?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  initials?: string | null;
  isActive?: boolean;
  commissionPercent?: number;
  courseIds?: number[];
};

// ── Books ────────────────────────────────────────────────────────

export interface BookRecord {
  id: number;
  sortOrder: number;
  isActive: boolean;
  quantity: number;
  title: string;
  description: string;
  imageUrl: string;
  imageAltText: string;
  price: number;
  discountedPrice: number | null;
  currency: string;
  stripeUrl: string;
  sourceUrl: string;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ScrapedBook = Omit<BookRecord, 'id' | 'sortOrder' | 'quantity' | 'lastSyncedAt' | 'createdAt' | 'updatedAt'>;

export interface BookSyncResult {
  scraped: number;
  saved: number;
  books: BookRecord[];
  syncedAt: string;
}

export interface BookDiscountCode {
  id: number;
  bookId: number;
  bookName?: string;
  code: string;
  insertDate: string;
  issueDate: string | null;
  customerEmail: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  issuedAt: Date | null;
  emailSentAt: Date | null;
  used: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type BookDiscountCodeInput = Pick<BookDiscountCode, 'code' | 'insertDate' | 'issueDate' | 'customerEmail'> & {
  id?: number;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  issuedAt?: Date | string | null;
  emailSentAt?: Date | string | null;
  used?: boolean;
};

export interface BookDiscountCodeBulkInput {
  bookId: number;
  codes: BookDiscountCodeInput[];
}

// ── Sitemap / site URLs ───────────────────────────────────────────

export type SitemapGroup = 'pages' | 'courses' | 'blog';

export interface SiteUrlRecord {
  id: number;
  path: string;
  sitemapGroup: SitemapGroup;
  storyblokFullSlug: string;
  storyblokStoryId: number | null;
  title: string;
  isEnabled: boolean;
  lastmod: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SitemapAdminData {
  urls: SiteUrlRecord[];
  counts: Record<SitemapGroup, { total: number; enabled: number }>;
  siteOrigin: string;
  preview: {
    index: string;
    pages: string;
    courses: string;
    blog: string;
  };
  webhookPath: string;
}

// ── API responses ─────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
