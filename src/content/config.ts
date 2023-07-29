import { defineCollection, z } from 'astro:content'

const blogSchema = z.object({
    title: z.string(),
    tags: z.array(z.string()),
    pubDate: z
        .string()
        .or(z.date())
        .transform((val) => new Date(val)),
    updateDate: z
        .string()
        .or(z.date())
        .transform((val) => new Date(val)),
    image: z.string().optional(),
})

const tech = defineCollection({
    type: 'content',
    schema: blogSchema,
})
const essay = defineCollection({
    type: 'content',
    schema: blogSchema,
})

export const collections = { tech, essay }
