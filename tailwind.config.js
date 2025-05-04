/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './client/**/*.{js,jsx,ts,tsx}',
        './client/index.html',
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#4F46E5',
                    50: '#EBEAFD',
                    100: '#D7D5FB',
                    200: '#B0ABF8',
                    300: '#8981F4',
                    400: '#6157F1',
                    500: '#4F46E5',
                    600: '#2418E0',
                    700: '#1C12AD',
                    800: '#140D7C',
                    900: '#0C074B',
                },
                secondary: {
                    DEFAULT: '#10B981',
                    50: '#E7FBF4',
                    100: '#CFF7E9',
                    200: '#9FEFCD',
                    300: '#6FE7B2',
                    400: '#3FDF96',
                    500: '#10B981',
                    600: '#0C9269',
                    700: '#086A4C',
                    800: '#04432F',
                    900: '#021B13',
                },
            }
        },
    },
    plugins: [],
};