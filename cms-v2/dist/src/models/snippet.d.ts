import type { Snippet, SnippetInput } from '../../shared/types';
export declare function getAllSnippets(): Promise<Snippet[]>;
export declare function getSnippetById(id: number): Promise<Snippet | null>;
export declare function getSnippetByKey(key: string): Promise<Snippet | null>;
export declare function createSnippet(input: SnippetInput, createdBy: number): Promise<Snippet>;
export declare function updateSnippet(id: number, input: Partial<SnippetInput>): Promise<Snippet | null>;
export declare function deleteSnippet(id: number): Promise<boolean>;
//# sourceMappingURL=snippet.d.ts.map