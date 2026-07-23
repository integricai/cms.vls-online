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
  currency: string;
  amount: number;
  compareAtAmount: number | null;
  discountPercent: number | null;
  discountedPrice: number | null;
  /** Final USD price fed to ParityDeals: discountedPrice ?? amount */
  effectiveAmount: number;
  isDefault: boolean;
  isActive: boolean;
  stripePriceId: string | null;
  /** Zenler payment-option id (bulk import / checkout mapping). */
  zenlerPricingCode: string | null;
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
  currency?: string;
  amount: number;
  compareAtAmount?: number | null;
  discountPercent?: number | null;
  isDefault?: boolean;
  isActive?: boolean;
  stripePriceId?: string | null;
  zenlerPricingCode?: string | null;
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

export interface Customer {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  countryCode: string | null;
  zenlerUserId: string | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
}

export interface ResolvedCoursePrice {
  price: CourseGeoPrice;
  matchReason: 'duration' | 'default' | 'explicit';
  /** Final USD price for ParityDeals / checkout */
  effectiveAmount: number;
  detectedCountryCode: string | null;
}

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
