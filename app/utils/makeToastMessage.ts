// biome-ignore lint/style/useImportType: <explanation>
import { z } from "zod";

export function MakeToastMessage(errors: z.ZodIssue[]): string {
    let errorMessage = "";
    if (errors.length > 0) {
      errorMessage = errors.map((error) => `- ${error.message}`).join("\n");
    }
    return errorMessage;
  }