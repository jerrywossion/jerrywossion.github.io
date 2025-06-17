import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

enum PostKind {
  NERD = "nerd",
  POET = "poet",
}
const PostKindEnums = [PostKind.NERD, PostKind.POET] as const;

enum Language {
  ZH_Hans = "zh-Hans",
  ZH_Hant = "zh-Hant",
  EN = "en",
}
const LanguageEnums = [
  Language.ZH_Hans,
  Language.ZH_Hant,
  Language.EN,
] as const;

const postSchema = z.object({
  id: z.string().uuid().toUpperCase(),
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  modDate: z.coerce.date(),
  kind: z.enum(PostKindEnums),
  tags: z.array(z.string()),
  language: z.enum(LanguageEnums).default(Language.ZH_Hans),
});

const nerdPosts = defineCollection({
  loader: glob({ base: "./src/content/nerd", pattern: "**/*.{md,mdx}" }),
  schema: postSchema,
});

const poetPosts = defineCollection({
  loader: glob({ base: "./src/content/poet", pattern: "**/*.{md,mdx}" }),
  schema: postSchema,
});

const microPosts = defineCollection({
  loader: glob({ base: "./src/content/murmur", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    pubDate: z.coerce.date(),
    modDate: z.coerce.date(),
  }),
});

export const collections = { nerdPosts, poetPosts, microPosts };
