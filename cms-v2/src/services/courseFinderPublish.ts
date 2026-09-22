import type { Course } from '../../shared/types';

export interface CourseFinderEmbedCourse {
  id: number;
  name: string;
  slug: string;
  category: string;
  level: string;
  status: string;
  url: string;
  coursePageUrl: string;
  sortOrder: number;
  qualification: string;
  courseLevel: string;
  courseLevels: string[];
  courseOption: string;
  isActive: boolean;
  enableInBanner: boolean;
  enableInNavigation: boolean;
}

/** Public course path from the CMS. Zenler page URLs are not used. */
export function publicCourseUrl(coursePageUrl?: string | null): string {
  const raw = String(coursePageUrl ?? '').trim();
  return raw || '#';
}

export function mapActiveCoursesForFinder(courses: Course[]): CourseFinderEmbedCourse[] {
  return courses
    .filter(course => course.isActive !== false && course.name)
    .map(course => ({
      id: course.id,
      name: course.name,
      slug: course.slug || '',
      category: course.category || '',
      level: course.level || '',
      status: course.status || '',
      url: publicCourseUrl(course.coursePageUrl),
      coursePageUrl: course.coursePageUrl || '',
      sortOrder: course.sortOrder || 0,
      qualification: course.qualification || '',
      courseLevel: course.courseLevel || '',
      courseLevels: course.courseLevels || (course.courseLevel ? [course.courseLevel] : []),
      courseOption: course.courseOption || '',
      isActive: course.isActive !== false,
      enableInBanner: course.enableInBanner === true,
      enableInNavigation: course.enableInNavigation !== false,
    }));
}
