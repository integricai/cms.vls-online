import type { MigrationTemplate } from './migrationTypes';

export interface TemplateDesignTokens {
  navy: string;
  ink: string;
  slate: string;
  blue: string;
  blueStrong: string;
  blueBright: string;
  blue50: string;
  blue100: string;
  blue200: string;
  white: string;
  green: string;
  amber: string;
}

export interface TemplateSectionBlueprint {
  key: string;
  label: string;
  component: string;
  classes: string[];
  isBand: boolean;
  styles: Record<string, string | number>;
  sampleHeading: string;
  sampleDescription: string;
}

export interface MigrationTemplateBlueprint {
  template: MigrationTemplate;
  fileName: string;
  filePath: string;
  tokens: TemplateDesignTokens;
  sections: TemplateSectionBlueprint[];
}

export interface ComponentLibraryPresetRef {
  template: MigrationTemplate;
  sectionKey: string;
  fullSlug: string;
  storyId: number;
  component: string;
  created: boolean;
}

export interface ComponentLibrarySyncResult {
  folderSlug: string;
  presets: ComponentLibraryPresetRef[];
  created: number;
  updated: number;
}
