import { z } from "zod";
import { isValidTag } from "@/lib/lesson-tags";

export const contextTagsSchema = z
  .array(z.string().trim().min(1))
  .superRefine((tags, ctx) => {
    for (const tag of tags) {
      if (!isValidTag(tag)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `無効なタグ: ${tag}`,
        });
      }
    }
  });
