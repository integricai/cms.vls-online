export interface CmsContentRow {
    key: string;
    data: unknown;
    updated_by: number | null;
    updated_at: string;
}
export declare function getContent(key: string): Promise<CmsContentRow | null>;
export declare function upsertContent(key: string, data: unknown, updatedBy?: number): Promise<CmsContentRow>;
export declare function listContentKeys(): Promise<string[]>;
//# sourceMappingURL=content.d.ts.map