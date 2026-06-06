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
export interface BookRecord {
    id: number;
    sortOrder: number;
    isActive: boolean;
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
export type ScrapedBook = Omit<BookRecord, 'id' | 'sortOrder' | 'lastSyncedAt' | 'createdAt' | 'updatedAt'>;
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
export interface ApiSuccess<T = unknown> {
    ok: true;
    data: T;
}
export interface ApiError {
    ok: false;
    error: string;
}
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
//# sourceMappingURL=types.d.ts.map