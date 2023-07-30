/** @type {import('tailwindcss').Config} */
const round = (num) =>
    num
        .toFixed(7)
        .replace(/(\.[0-9]+?)0+$/, '$1')
        .replace(/\.0$/, '')
const rem = (px) => `${round(px / 16)}rem`
const em = (px, base) => `${round(px / base)}em`
module.exports = {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    darkMode: 'class',
    plugins: [require('@tailwindcss/typography')],
    preflight: false,
    theme: {
        extend: {
            typography: (theme) => ({
                DEFAULT: {
                    css: {
                        blockquote: {
                            fontWeight: 'regular',
                            fontStyle: 'regular',
                        },
                        'blockquote p:first-of-type::before': {
                            content: 'none',
                        },
                        'blockquote p:first-of-type::after': {
                            content: 'none',
                        },
                        a: {
                            textDecoration: 'none',
                            borderBottom: '1px solid #7dd3fc',
                        },
                        'a:hover': {
                            borderBottom: '2px solid #7dd3fc',
                        },
                        img: {
                            margin: 'auto',
                        },
                    },
                },
                lg: {
                    css: [
                        {
                            p: {
                                marginTop: em(10, 18),
                                marginBottom: em(10, 18),
                            },
                            blockquote: {
                                marginTop: em(12, 18),
                                marginBottom: em(12, 18),
                            },
                            h1: {
                                fontSize: em(26, 18),
                                marginTop: em(16, 18),
                                marginBottom: em(8, 18),
                            },
                            h2: {
                                fontSize: em(24, 18),
                                marginTop: em(12, 18),
                                marginBottom: em(6, 18),
                            },
                            h3: {
                                fontSize: em(22, 18),
                                marginTop: em(8, 18),
                                marginBottom: em(4, 18),
                            },
                            h4: {
                                fontSize: em(20, 18),
                                marginTop: em(4, 18),
                                marginBottom: em(2, 18),
                            },
                            ul: {
                                marginTop: em(12, 18),
                                marginBottom: em(12, 18),
                            },
                            li: {
                                marginTop: em(10, 18),
                                marginBottom: em(10, 18),
                            },
                        },
                    ],
                },
            }),
        },
    },
}
