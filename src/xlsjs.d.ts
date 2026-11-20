declare module "xlsjs" {
  export interface WorkSheet {
    [cell: string]: unknown;
  }

  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }

  export const utils: {
    sheet_to_json: (
      sheet: WorkSheet,
      opts?: {
        header?: number | string[];
        defval?: unknown;
        blankrows?: boolean;
      }
    ) => unknown[][];
  };

  export function readFile(
    filename: string,
    opts?: { cellDates?: boolean }
  ): WorkBook;
}
