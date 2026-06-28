import type { Course } from '../../shared/types';

export interface CourseFinderEmbedCourse {
  id: number;
  name: string;
  slug: string;
  category: string;
  level: string;
  status: string;
  url: string;
  sortOrder: number;
  qualification: string;
  courseLevel: string;
  courseLevels: string[];
  courseOption: string;
}

export function publicCourseUrl(zenlerUrl: string | null, slug: string | null): string {
  const raw = zenlerUrl || (slug ? `/courses/${slug}` : '#');
  return raw.replace('https://vls.newzenler.com', 'https://vls-online.com');
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
      url: publicCourseUrl(course.zenlerUrl, course.slug),
      sortOrder: course.sortOrder || 0,
      qualification: course.qualification || '',
      courseLevel: course.courseLevel || '',
      courseLevels: course.courseLevels || (course.courseLevel ? [course.courseLevel] : []),
      courseOption: course.courseOption || '',
    }));
}
